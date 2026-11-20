import React, { useState } from 'react';
import { RefreshCw, Home } from 'lucide-react';
import peaceArtwork from '../../assets/images/shalom_peace_light_1794907456870.jpg';

interface ShalomErrorPageProps {
  onRetry?: () => void;
  onReturnHome?: () => void;
  technicalHint?: string;
  mode?: 'offline' | 'network' | 'runtime';
  titleOverride?: string;
  messageOverride?: string;
}

export const ShalomErrorPage: React.FC<ShalomErrorPageProps> = ({
  onRetry,
  onReturnHome,
  technicalHint,
  mode,
  titleOverride,
  messageOverride,
}) => {
  const [retrying, setRetrying] = useState(false);

  const effectiveMode: 'offline' | 'network' | 'runtime' =
    mode ||
    (typeof navigator !== 'undefined' && navigator.onLine === false ? 'offline' : 'runtime');

  const resolvedMessage =
    messageOverride ||
    (effectiveMode === 'offline'
      ? '« Pas de connexion Internet. Vos données locales restent disponibles — rétablissez la connexion pour cette action ou revenez à SHALOM. »'
      : effectiveMode === 'network'
        ? '« Une ressource distante n’a pas pu être chargée pour le moment. Réessayez dans quelques instants ou revenez à SHALOM. »'
        : '« Une erreur interne est survenue sur cet écran. Vos créations, prières et documents locaux restent en sécurité — appuyez sur Réessayer ou Retour à SHALOM. »');

  const handleRetry = () => {
    setRetrying(true);
    if (onRetry) {
      onRetry();
    } else {
      window.location.reload();
    }
    window.setTimeout(() => setRetrying(false), 1800);
  };

  const handleReturnHome = () => {
    if (onReturnHome) {
      onReturnHome();
      return;
    }
    try {
      window.history.replaceState({}, '', './');
    } catch {
      // ignore history error
    }
    window.location.replace('./');
  };

  return (
    <div className="min-h-dvh w-full relative overflow-hidden bg-[#060e20] text-white flex items-center justify-center p-4 sm:p-8 select-none">
      {/* Background atmospheric artwork with night-blue veil */}
      <div className="absolute inset-0 pointer-events-none">
        <img
          src={peaceArtwork}
          alt=""
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).src = './shalom_peace_light.jpg';
          }}
          className="w-full h-full object-cover opacity-35"
        />
        <div
          className="absolute inset-0"
          style={{
            background:
              'radial-gradient(circle at 50% 25%, rgba(212, 175, 55, 0.16) 0%, rgba(10, 22, 48, 0.84) 48%, rgba(5, 11, 26, 0.98) 100%)',
          }}
        />
      </div>

      {/* Main sanctuary card */}
      <main className="relative z-10 w-full max-w-md rounded-3xl bg-[#0a1733]/90 backdrop-blur-md border border-[#d4af37]/30 shadow-[0_25px_70px_rgba(0,0,0,0.65)] p-6 sm:p-8 text-center space-y-5">
        <div className="flex flex-col items-center gap-3">
          <div className="w-20 h-20 rounded-2xl overflow-hidden border-2 border-[#d4af37]/60 shadow-[0_0_25px_rgba(212,175,55,0.28)] bg-[#071128]">
            <img
              src="./shalom_logo.jpg"
              alt="Logo SHALOM"
              className="w-full h-full object-cover"
            />
          </div>

          <div className="space-y-1">
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-[0.2em] text-[#f4d778] font-display">
              {titleOverride || 'SHALOM'}
            </h1>
            <p className="text-sm sm:text-base font-medium text-blue-100/90 italic">
              {effectiveMode === 'offline'
                ? '« Mode hors ligne… »'
                : effectiveMode === 'network'
                  ? '« Service distant indisponible… »'
                  : '« Incident technique local… »'}
            </p>
          </div>
        </div>

        <div className="rounded-2xl overflow-hidden border border-white/10 aspect-[16/9] bg-[#071128] relative">
          <img
            src={peaceArtwork}
            alt="Lumière de paix SHALOM"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).src = './shalom_peace_light.jpg';
            }}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0a1733]/80 via-transparent to-transparent" />
        </div>

        <p className="text-xs sm:text-sm text-slate-200 leading-relaxed">{resolvedMessage}</p>

        <blockquote className="py-3 px-4 rounded-2xl bg-[#0f254f]/70 border border-[#d4af37]/25 text-xs sm:text-sm font-serif italic text-[#fde68a]">
          « Je vous laisse la paix, je vous donne ma paix. » — Jean 14:27.
        </blockquote>

        {technicalHint && (
          <p className="text-[11px] text-slate-400 break-words">{technicalHint}</p>
        )}

        <div className="flex flex-col gap-2.5">
          <button
            type="button"
            onClick={handleRetry}
            disabled={retrying}
            className="w-full min-h-[48px] px-6 py-3 rounded-xl bg-gradient-to-r from-[#c89d28] via-[#dfb848] to-[#c89d28] hover:brightness-110 active:scale-[0.99] disabled:opacity-70 text-[#071128] font-extrabold text-xs sm:text-sm tracking-wider flex items-center justify-center gap-2 shadow-lg transition cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${retrying ? 'animate-spin' : ''}`} />
            <span>RÉESSAYER</span>
          </button>

          <button
            type="button"
            onClick={handleReturnHome}
            className="w-full min-h-[44px] px-5 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 border border-white/20 text-slate-100 font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition cursor-pointer"
          >
            <Home className="w-4 h-4" />
            <span>RETOUR À SHALOM</span>
          </button>
        </div>
      </main>
    </div>
  );
};
