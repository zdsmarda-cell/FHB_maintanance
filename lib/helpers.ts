
import { db, api, isProductionDomain } from './db';

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

// Helper to prepare data for saving - calls API if translation enabled
export const prepareMultilingual = async (text: string): Promise<string> => {
    if (!text) return '';
    
    console.log(`[Translate] Preparing: "${text}"`);

    // 1. Check settings
    let settings;
    try {
        const isMock = !isProductionDomain || (localStorage.getItem('auth_token')?.startsWith('mock-token-'));
        if (isMock) {
            settings = db.settings.get();
        } else {
            // Fetch settings from API
            settings = await api.get('/settings');
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
