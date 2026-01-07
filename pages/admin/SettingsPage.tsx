import React, { useState } from 'react';
import { db } from '../../lib/db';

export const SettingsPage = () => {
    const [settings, setSettings] = useState(db.settings.get());
    
    const toggleTranslation = () => {
        const newVal = !settings.enableOnlineTranslation;
        const newSettings = { ...settings, enableOnlineTranslation: newVal };
        setSettings(newSettings);
        db.settings.save(newSettings);
    };

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
