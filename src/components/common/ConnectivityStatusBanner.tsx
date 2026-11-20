import React, { useState } from 'react';
import { WifiOff, Wifi, RefreshCw, AlertTriangle } from 'lucide-react';
import { useConnectivity } from '../../hooks/useConnectivity';
import { useLanguage } from '../../contexts/LanguageContext';

export const ConnectivityStatusBanner: React.FC = () => {
  const { lang } = useLanguage();
  const isEn = lang === 'en';
  const { status, isOnline, isSlowConnection, justReconnected, pendingCount, retryConnection } =
    useConnectivity();
  const [checking, setChecking] = useState(false);

  const handleRetry = async () => {
    setChecking(true);
    try {
      await retryConnection();
    } finally {
      setChecking(false);
    }
  };

  if (justReconnected && isOnline && status !== 'server_error') {
    return (
      <div className="max-w-5xl w-full mx-auto px-3 sm:px-6 pt-2">
        <div
          role="status"
          className="px-3.5 py-2 rounded-xl bg-emerald-600 text-white text-xs font-semibold flex items-center justify-between gap-2 shadow-xs"
        >
          <div className="flex items-center gap-2 min-w-0">
            <Wifi className="w-4 h-4 shrink-0" />
            <span className="truncate">
              {isEn
                ? 'Connection restored. Your SHALOM space is up to date.'
                : 'Connexion rétablie. Toutes les fonctionnalités en ligne sont disponibles.'}
            </span>
          </div>
        </div>
      </div>
    );
  }

  if (status === 'offline' || !isOnline) {
    return (
      <div className="max-w-5xl w-full mx-auto px-3 sm:px-6 pt-2">
        <div
          role="status"
          className="px-3.5 py-2 rounded-xl bg-slate-800 dark:bg-slate-900 border border-slate-700 text-slate-100 text-xs flex flex-wrap items-center justify-between gap-2 shadow-xs"
        >
          <div className="flex items-center gap-2 min-w-0">
            <WifiOff className="w-4 h-4 text-amber-400 shrink-0" />
            <span className="font-medium leading-snug">
              {isEn
                ? 'Offline mode active — your Vault, Prayers, Studios & saved resources stay available.'
                : 'Mode hors ligne actif — votre Coffre, vos Prières, Studios et projets enregistrés restent accessibles.'}
              {pendingCount > 0
                ? isEn
                  ? ` (${pendingCount} pending sync)`
                  : ` (${pendingCount} élément(s) en attente)`
                : ''}
            </span>
          </div>
          <button
            type="button"
            onClick={handleRetry}
            disabled={checking}
            className="min-h-[34px] px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-[11px] font-bold flex items-center gap-1.5 shrink-0 transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${checking ? 'animate-spin' : ''}`} />
            <span>{isEn ? 'Retry' : 'Vérifier'}</span>
          </button>
        </div>
      </div>
    );
  }

  if (isSlowConnection && status === 'slow') {
    return (
      <div className="max-w-5xl w-full mx-auto px-3 sm:px-6 pt-2">
        <div
          role="status"
          className="px-3.5 py-2 rounded-xl bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800/70 text-amber-900 dark:text-amber-200 text-xs flex items-center justify-between gap-2"
        >
          <div className="flex items-center gap-2 min-w-0">
            <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
            <span className="truncate">
              {isEn
                ? 'Slow network detected — local SHALOM tools work instantly.'
                : 'Connexion lente détectée — vos outils locaux SHALOM restent instantanés.'}
            </span>
          </div>
        </div>
      </div>
    );
  }

  return null;
};
