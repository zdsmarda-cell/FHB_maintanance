
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
    
    // 1. Check settings
    let settings;
    try {
        const isMock = !isProductionDomain || (localStorage.getItem('auth_token')?.startsWith('mock-token-'));
        if (isMock) {
            settings = db.settings.get();
        } else {
            // We assume settings are loaded in the app or fetch them quickly.
            // For simplicity in this helper, we'll try to fetch or default to local check if cached.
            // A robust app would use a Context or Store.
            // Let's optimistic check localStorage for settings cache from SettingsPage?
            // Fallback: fetch
            const s = await api.get('/settings');
            settings = s;
        }
    } catch (e) {
        settings = { enableOnlineTranslation: false };
    }

    if (!settings?.enableOnlineTranslation) {
        return text; // Return plain string if translation disabled
    }

    // 2. Call Translation API
    try {
        const isMock = !isProductionDomain || (localStorage.getItem('auth_token')?.startsWith('mock-token-'));
        let translations;
        
        if (isMock) {
            // Mock Translation Logic on Client for Demo
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
        console.error("Translation failed, saving raw text:", e);
        return text;
    }
};
