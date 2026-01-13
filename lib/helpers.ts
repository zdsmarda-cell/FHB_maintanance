
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
    // This strictly ignores Time and Timezone offsets from the input string
    // forcing it to be treated as a local calendar date.
    const toLocalMidnight = (dateInput: string | Date | undefined): Date => {
        const now = new Date();
        const currentYear = now.getFullYear();
        
        if (!dateInput) return new Date(currentYear, now.getMonth(), now.getDate());

        let dateStr = '';

        if (dateInput instanceof Date) {
            // If it's a Date object, convert to YYYY-MM-DD local string first
            const y = dateInput.getFullYear();
            const mo = String(dateInput.getMonth() + 1).padStart(2, '0');
            const d = String(dateInput.getDate()).padStart(2, '0');
            dateStr = `${y}-${mo}-${d}`;
        } else if (typeof dateInput === 'string') {
            // Take only the first 10 chars (YYYY-MM-DD)
            // This strips 'T14:00:00Z' etc, preventing timezone shifts
            dateStr = dateInput.substring(0, 10);
        }

        // Parse strictly as [Year, Month, Day]
        if (dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
            const [y, m, d] = dateStr.split('-').map(Number);
            // new Date(y, m-1, d) creates a date at Local Midnight
            return new Date(y, m - 1, d);
        }

        // Fallback
        return new Date(currentYear, now.getMonth(), now.getDate());
    };

    // 1. Determine Base Date (Last Generated OR Created At)
    const baseDate = toLocalMidnight(m.lastGeneratedDate || m.createdAt);
    const today = toLocalMidnight(new Date());

    // 2. Add Interval (Ensure interval is treated as number)
    const interval = Number(m.interval) || 1;
    let targetDate = new Date(baseDate);
    targetDate.setDate(baseDate.getDate() + interval);

    // 3. Catch-up Logic
    // If the calculated target is strictly in the past (< Today), snap to Today.
    // Example: Target (Yesterday) < Today (Today) -> True -> Target becomes Today.
    // Example: Target (Tomorrow) < Today (Today) -> False -> Keeps Tomorrow.
    if (targetDate.getTime() < today.getTime()) {
        targetDate = new Date(today);
    }

    // 4. Strict Progression Check
    // If applying catch-up or simple math resulted in a date that is equal to or older than the Last Generated date
    // (e.g. if run twice same day), force it to move forward.
    // However, if Catch-up moved it to Today, and Last Generated was Yesterday, we are fine.
    // Only if Target <= BaseDate do we have a problem (Next scheduled date implies future relative to last execution).
    if (targetDate.getTime() <= baseDate.getTime()) {
        targetDate.setDate(targetDate.getDate() + 1);
    }

    // 5. Allowed Days Logic (skip weekends etc.)
    const allowedDays = m.allowedDays || [];
    if (allowedDays.length > 0) {
        let safetyCounter = 0;
        // Limit loop to prevent infinite loop in case of bad config
        while (safetyCounter < 366) { 
            const day = targetDate.getDay(); // 0 = Sunday, 1 = Monday...
            if (allowedDays.includes(day)) {
                return targetDate;
            }
            // Try next day
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

    // 1. Check settings with Robust Parsing
    let settings;
    try {
        const isMock = !isProductionDomain || (localStorage.getItem('auth_token')?.startsWith('mock-token-'));
        if (isMock) {
            settings = db.settings.get();
        } else {
            // Fetch settings from API
            settings = await api.get('/settings');
        }

        // Recursively parse stringified JSON until it is an object
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

    // 2. Call Translation API
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
