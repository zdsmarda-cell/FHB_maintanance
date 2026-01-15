
import React from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { RefreshCw, X } from 'lucide-react';

export const ReloadPrompt = () => {
  const {
    offlineReady: [offlineReady, setOfflineReady],
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegistered(r) {
      console.log('SW Registered: ' + r);
    },
    onRegisterError(error) {
      console.log('SW registration error', error);
    },
  });

  const close = () => {
    setOfflineReady(false);
    setNeedRefresh(false);
  };

  if (!offlineReady && !needRefresh) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[100] p-4 bg-slate-800 text-white rounded-lg shadow-lg border border-slate-700 max-w-sm animate-fade-in-up">
      <div className="flex items-start gap-4">
        <div className="flex-1">
          <h3 className="font-bold text-sm mb-1">
            {offlineReady ? 'Připraveno offline' : 'Nová verze k dispozici'}
          </h3>
          <p className="text-xs text-slate-300">
            {offlineReady 
              ? 'Aplikace je nyní připravena k použití offline.' 
              : 'Je dostupná nová verze aplikace. Klikněte pro aktualizaci.'}
          </p>
        </div>
        <button onClick={close} className="text-slate-400 hover:text-white">
          <X className="w-4 h-4" />
        </button>
      </div>
      
      {needRefresh && (
        <div className="mt-3 flex justify-end">
          <button 
            onClick={() => updateServiceWorker(true)}
            className="flex items-center px-3 py-1.5 bg-blue-600 hover:bg-blue-700 rounded text-xs font-bold transition-colors"
          >
            <RefreshCw className="w-3 h-3 mr-1.5" /> Aktualizovat
          </button>
        </div>
      )}
    </div>
  );
};
