
import { db, api, isProductionDomain } from './db';
import { Maintenance } from './types';

// Helper to parse JSON string (e.g., '{"cs":"Sklad","en":"Warehouse"}') and return current lang
export const getLocalized = (data: string | undefined, lang: string): string => {
    if (!data) return '';
    
    // Check if it looks like JSON
    if (data.trim().startsWith('{')) {
        try {
            const parsed = JSON.parse(data);
            if (typeof parsed === 'object' && parsed !== null) {
                // Return requested lang, fallback to CS, fallback to first key, fallback to raw
                return parsed[lang] || parsed['cs'] || Object.values(parsed)[0] || data;
            }
        } catch (e) {
            // Not valid JSON, return as is
            return data;
        }
    }
    return data;
};

// Shared Logic for calculating Next Run Date
// Ensures Dashboard and Maintenance Page show the exact same date
export const calculateNextMaintenanceDate = (m: Maintenance): Date | null => {
    if (!m.isActive) return null;
    
    // Determine base date: Last Generated -> Created At -> Now
    const baseDateStr = m.lastGeneratedDate || m.createdAt;
    const baseDate = baseDateStr ? new Date(baseDateStr) : new Date();
    
    // Normalize time to midnight to avoid timezone shift issues during addition
    baseDate.setHours(0,0,0,0);

    // Theoretical next date based purely on interval
    const nextDate = new Date(baseDate);
    nextDate.setDate(baseDate.getDate() + m.interval);

    // Check allowed days logic (skip weekends etc.)
    let targetDate = new Date(nextDate);
    let safetyCounter = 0;
    const allowedDays = m.allowedDays || [];

    // If no specific days allowed (empty array), usually implies all days are allowed or legacy data
    // If logic dictates specific days must be set, we assume default 1-5 if empty, 
    // but here we just return targetDate if array is empty to be safe.
    if (allowedDays.length === 0) return targetDate;

    while (safetyCounter < 30) {
        const day = targetDate.getDay(); // 0 = Sunday, 1 = Monday...
        if (allowedDays.includes(day)) {
            return targetDate;
        }
        // Try next day
        targetDate.setDate(targetDate.getDate() + 1);
        safetyCounter++;
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

        // Even in Mock mode, if the user enabled translation in settings, try to call the real API if reachable,
        // otherwise fallback to mock simulation.
        // Since we cannot call protected API from mock-token easily without failure, we simulate or skip.
        // BUT user complained "generally nowhere called". If they are running full backend locally, it should work.
        
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
