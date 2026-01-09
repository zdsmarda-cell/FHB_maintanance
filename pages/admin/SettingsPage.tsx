
import React, { useState, useEffect } from 'react';
import { db, api, isProductionDomain } from '../../lib/db';
import { Loader } from 'lucide-react';

export const SettingsPage = () => {
    const [loading, setLoading] = useState(false);
    const [settings, setSettings] = useState<any>({});
    
    const isMock = !isProductionDomain || (localStorage.getItem('auth_token')?.startsWith('mock-token-'));

    const refresh = async () => {
        setLoading(true);
        try {
            if(isMock) {
                setSettings(db.settings.get());
            } else {
                const data = await api.get('/settings');
                setSettings(data);
            }
        } catch(e) { console.error(e); } 
        finally { setLoading(false); }
    };

    useEffect(() => { refresh(); }, []);
    
    const toggleTranslation = async () => {
        const newVal = !settings.enableOnlineTranslation;
        const newSettings = { ...settings, enableOnlineTranslation: newVal };
        setSettings(newSettings); // Optimistic update
        try {
            if(isMock) db.settings.save(newSettings);
            else await api.post('/settings', newSettings);
        } catch(e) { console.error(e); refresh(); }
    };

    if (loading) return <div className="p-10 text-center"><Loader className="animate-spin w-8 h-8 mx-auto text-blue-600"/></div>;

    return (
        <div className="bg-white p-6 rounded shadow-sm border border-slate-200">
            <h3 className="font-bold text-lg mb-4">Administrátorské nastavení</h3>
            <div className="flex items-center justify-between py-3 border-b">
                <div>
                    <div className="font-medium">Online překlady</div>
                    <div className="text-xs text-slate-500">Automaticky překládat uživatelské vstupy pomocí externí služby.</div>
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
