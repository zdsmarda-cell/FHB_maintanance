
import React, { useState, useEffect } from 'react';
import { db, api, isProductionDomain } from '../../lib/db';
import { Loader } from 'lucide-react';
import { useI18n } from '../../lib/i18n';

export const SettingsPage = () => {
    const { t } = useI18n();
    const [loading, setLoading] = useState(false);
    const [settings, setSettings] = useState<any>({});
    
    // Check localStorage manually to debug
    const hasMockToken = localStorage.getItem('auth_token')?.startsWith('mock-token-');
    const isMock = !isProductionDomain || hasMockToken;

    const refresh = async () => {
        setLoading(true);
        try {
            let data: any = {};
            
            if(isMock) {
                console.log("Settings: Using MOCK data.");
                data = db.settings.get();
            } else {
                console.log("Settings: Fetching from API...");
                data = await api.get('/settings');
            }

            // SAFETY CHECK 1: If API returns a string (double encoded), parse it
            if (typeof data === 'string') {
                try { data = JSON.parse(data); } catch (e) { console.error("Failed to parse settings string", e); }
            }

            // SAFETY CHECK 2: If data looks like a spread string (numeric keys like {0: "{", 1: "\""}), reset it.
            // This prevents the "garbage payload" bug where a string is spread into an object.
            if (data && typeof data === 'object' && '0' in data) {
                console.warn("SettingsPage: Detected malformed settings data (spread string), resetting to defaults.");
                data = {};
            }

            setSettings(data || {});

        } catch(e) { console.error(e); } 
        finally { setLoading(false); }
    };

    useEffect(() => { refresh(); }, []);
    
    const toggleTranslation = async () => {
        // Ensure settings is an object before spreading
        const currentSettings = (typeof settings === 'object' && settings !== null) ? settings : {};
        const newVal = !currentSettings.enableOnlineTranslation;
        
        const newSettings = { ...currentSettings, enableOnlineTranslation: newVal };
        setSettings(newSettings); // Optimistic update
        
        try {
            if(isMock) {
                console.log("Settings: Saving to MOCK.", newSettings);
                db.settings.save(newSettings);
            }
            else {
                console.log("Settings: Saving to API...", newSettings);
                await api.post('/settings', newSettings);
            }
            
            // Removed reload to keep user on Settings page
            // setTimeout(() => window.location.reload(), 500);

        } catch(e) { console.error(e); refresh(); }
    };

    if (loading) return <div className="p-10 text-center"><Loader className="animate-spin w-8 h-8 mx-auto text-blue-600"/></div>;

    return (
        <div className="bg-white p-6 rounded shadow-sm border border-slate-200">
            <h3 className="font-bold text-lg mb-4">{t('settings.title')}</h3>
            {isMock && (
                <div className="mb-4 p-2 bg-amber-50 border border-amber-200 text-amber-800 text-xs rounded">
                    {t('settings.mock_mode_warning')}
                </div>
            )}
            <div className="flex items-center justify-between py-3 border-b">
                <div>
                    <div className="font-medium">{t('settings.online_translation')}</div>
                    <div className="text-xs text-slate-500">{t('settings.online_translation_desc')}</div>
                </div>
                <button 
                    onClick={toggleTranslation}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${settings.enableOnlineTranslation ? 'bg-blue-600' : 'bg-slate-200'}`}
                >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${settings.enableOnlineTranslation ? 'translate-x-6' : 'translate-x-1'}`} />
                </button>
            </div>
        </div>
    );
};
