
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
    // This avoids timezone issues where "2023-10-27" (UTC) becomes "2023-10-26" (Local)
    const toLocalMidnight = (dateInput: string | Date | undefined): Date => {
        const now = new Date();
        if (!dateInput) return new Date(now.getFullYear(), now.getMonth(), now.getDate());

        let d: Date;
        if (typeof dateInput === 'string') {
            // If format is YYYY-MM-DD, parse manually to force local time
            if (dateInput.match(/^\d{4}-\d{2}-\d{2}$/)) {
                const [y, m, day] = dateInput.split('-').map(Number);
                return new Date(y, m - 1, day);
            }
            d = new Date(dateInput);
        } else {
            d = dateInput;
        }

        if (isNaN(d.getTime())) return new Date(now.getFullYear(), now.getMonth(), now.getDate());
        
        return new Date(d.getFullYear(), d.getMonth(), d.getDate());
    };

    // 1. Determine Base Date (Last Generated OR Created At)
    const baseDate = toLocalMidnight(m.lastGeneratedDate || m.createdAt);
    const today = toLocalMidnight(new Date());

    // 2. Add Interval
    // Logic: Next = Last + Interval
    let targetDate = new Date(baseDate);
    targetDate.setDate(baseDate.getDate() + m.interval);

    // 3. Catch-up Logic
    // "Pokud je dane datum starsi jak aktualni, tak pouziji aktualni"
    // If target is STRICTLY BEFORE today, reset to today.
    // Example: Target (Yesterday) < Today (Today) -> True -> Reset to Today.
    // Example: Target (Tomorrow) < Today (Today) -> False -> Keep Tomorrow.
    if (targetDate.getTime() < today.getTime()) {
        targetDate = new Date(today);
    }

    // 4. Allowed Days Logic (skip weekends etc.)
    const allowedDays = m.allowedDays || [];
    if (allowedDays.length > 0) {
        let safetyCounter = 0;
        // Limit loop to prevent infinite loop in case of bad config (e.g. empty allowed days, though checked above)
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

        // Recursively parse stringified JSON until it is an object (same logic as SettingsPage)
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

    console.log("[Translate] Settings:", settings);

    if (!settings?.enableOnlineTranslation) {
        console.log("[Translate] Skipped: Translation disabled.");
        return text; // Return plain string if translation disabled
    }

    // 2. Call Translation API
    try {
        const isMock = !isProductionDomain || (localStorage.getItem('auth_token')?.startsWith('mock-token-'));
        let translations;
        
        console.log("[Translate] Calling API...");

        if (isMock) {
            // Mock Translation Logic on Client for Demo
            // Simulate delay
            await new Promise(r => setTimeout(r, 500));
            translations = {
                cs: text,
                en: `[EN] ${text}`,
                uk: `[UK] ${text}`
            };
        } else {
            translations = await api.post('/translate', { text });
        }
        
        console.log("[Translate] Result:", translations);
        return JSON.stringify(translations);
    } catch (e) {
        console.error("[Translate] API Failed, saving raw text:", e);
        return text;
    }
};
