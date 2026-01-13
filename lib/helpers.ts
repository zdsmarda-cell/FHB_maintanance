
import { db, api, isProductionDomain } from './db';
import { Maintenance } from './types';

// Helper to parse JSON string (e.g., '{"cs":"Sklad","en":"Warehouse"}') or Object and return current lang
export const getLocalized = (data: any, lang: string): string => {
    if (!data) return '';
    
    let parsed = data;

    // If it's a string that looks like JSON, try to parse it
    if (typeof data === 'string' && data.trim().startsWith('{')) {
        try {
            parsed = JSON.parse(data);
        } catch (e) {
            // Not valid JSON, return as is
            return data;
        }
    }

    // If we have an object (either passed directly or parsed above)
    if (typeof parsed === 'object' && parsed !== null) {
        // Return requested lang, fallback to CS, fallback to EN, fallback to first key
        return parsed[lang] || parsed['cs'] || parsed['en'] || Object.values(parsed)[0] || '';
    }

    // Fallback for plain strings
    return String(data);
};

// Shared Logic for calculating Next Run Date
// Ensures Dashboard and Maintenance Page show the exact same date
export const calculateNextMaintenanceDate = (m: Maintenance): Date | null => {
    if (!m.isActive) return null;
    
    // Helper: Safely parse YYYY-MM-DD or ISO string to Local Midnight Date
    const toLocalMidnight = (dateInput: string | Date | undefined): Date => {
        const now = new Date();
        const currentYear = now.getFullYear();
        
        if (!dateInput) return new Date(currentYear, now.getMonth(), now.getDate());

        let dateStr = '';

        if (dateInput instanceof Date) {
            const y = dateInput.getFullYear();
            const mo = String(dateInput.getMonth() + 1).padStart(2, '0');
            const d = String(dateInput.getDate()).padStart(2, '0');
            dateStr = `${y}-${mo}-${d}`;
        } else if (typeof dateInput === 'string') {
            dateStr = dateInput.substring(0, 10);
        }

        if (dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
            const [y, m, d] = dateStr.split('-').map(Number);
            return new Date(y, m - 1, d);
        }

        return new Date(currentYear, now.getMonth(), now.getDate());
    };

    // 1. Determine Base Date (Last Generated OR Created At)
    const baseDate = toLocalMidnight(m.lastGeneratedDate || m.createdAt);
    
    // 2. Determine "Floor" Date (The earliest possible Next Run)
    // The worker runs at 00:01. If we are viewing this app, "today's" 00:01 has already passed.
    // Therefore, the earliest possible auto-generation is TOMORROW.
    // We treat "Today" effectively as "Tomorrow" for the catch-up logic.
    const earliestPossibleRun = toLocalMidnight(new Date());
    earliestPossibleRun.setDate(earliestPossibleRun.getDate() + 1); // Shift to Tomorrow

    // 3. Add Interval
    const interval = Number(m.interval) || 1;
    let targetDate = new Date(baseDate);
    targetDate.setDate(baseDate.getDate() + interval);

    // 4. Catch-up Logic
    // If the theoretical target is older than the earliest possible run (Tomorrow),
    // jump to the earliest possible run.
    if (targetDate.getTime() < earliestPossibleRun.getTime()) {
        targetDate = new Date(earliestPossibleRun);
    }

    // 5. Allowed Days Logic (skip weekends etc.)
    const allowedDays = m.allowedDays || [];
    if (allowedDays.length > 0) {
        let safetyCounter = 0;
        while (safetyCounter < 366) { 
            const day = targetDate.getDay(); // 0 = Sunday
            if (allowedDays.includes(day)) {
                return targetDate;
            }
            targetDate.setDate(targetDate.getDate() + 1);
            safetyCounter++;
        }
    }
    
    return targetDate;
};

// Helper to prepare data for saving - calls API if translation enabled
export const prepareMultilingual = async (text: string): Promise<string> => {
    if (!text) return '';
    
    console.log(`[Translate] Preparing: "${text}"`);

    let settings;
    try {
        const isMock = !isProductionDomain || (localStorage.getItem('auth_token')?.startsWith('mock-token-'));
        if (isMock) {
            settings = db.settings.get();
        } else {
            settings = await api.get('/settings');
        }

        while (typeof settings === 'string') {
            try {
                const parsed = JSON.parse(settings);
                settings = parsed;
            } catch (e) {
                break;
            }
        }
    } catch (e) {
        console.warn("[Translate] Failed to load settings, defaulting to false", e);
        settings = { enableOnlineTranslation: false };
    }

    if (!settings?.enableOnlineTranslation) {
        return text; 
    }

    try {
        const isMock = !isProductionDomain || (localStorage.getItem('auth_token')?.startsWith('mock-token-'));
        let translations;
        
        if (isMock) {
            await new Promise(r => setTimeout(r, 500));
            translations = {
                cs: text,
                en: `[EN] ${text}`,
                uk: `[UK] ${text}`
            };
        } else {
            translations = await api.post('/translate', { text });
        }
        
        return JSON.stringify(translations);
    } catch (e) {
        console.error("[Translate] API Failed, saving raw text:", e);
        return text;
    }
};
