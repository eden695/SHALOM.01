import React, { useState } from 'react';
import { RefreshCw } from 'lucide-react';
import peaceArtwork from '../../assets/images/shalom_peace_light_1794907456870.jpg';

interface ShalomErrorPageProps {
  onRetry?: () => void;
  technicalHint?: string;
  mode?: 'offline' | 'network' | 'runtime';
  titleOverride?: string;
  messageOverride?: string;
}

export const ShalomErrorPage: React.FC<ShalomErrorPageProps> = ({
  onRetry,
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
      ? '« Nous n’arrivons pas à établir la connexion pour le moment. Vérifiez votre connexion Internet et réessayez dans quelques instants. »'
      : effectiveMode === 'network'
        ? '« Une ressource distante n’a pas pu être chargée pour le moment. Réessayez dans quelques instants. »'
        : '« Une erreur interne est survenue dans l’application. Vos créations et données locales restent en sécurité — appuyez sur Réessayer pour restaurer l’affichage. »');

  const handleRetry = () => {
    setRetrying(true);
    if (onRetry) {
      onRetry();
    } else {
      window.location.reload();
    }
    window.setTimeout(() => setRetrying(false), 1800);
  };

  return (
    <div className="min-h-screen w-full relative overflow-hidden bg-[#060e20] text-white flex items-center justify-center p-5 sm:p-8 select-none">
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
                ? '« Connexion hors ligne… »'
                : effectiveMode === 'network'
                  ? '« Chargement interrompu… »'
                  : '« Un instant de paix… »'}
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

        <button
          type="button"
          onClick={handleRetry}
          disabled={retrying}
          className="w-full min-h-[48px] px-6 py-3 rounded-xl bg-gradient-to-r from-[#c89d28] via-[#dfb848] to-[#c89d28] hover:brightness-110 active:scale-[0.99] disabled:opacity-70 text-[#071128] font-extrabold text-xs sm:text-sm tracking-wider flex items-center justify-center gap-2 shadow-lg transition cursor-pointer"
        >
          <RefreshCw className={`w-4 h-4 ${retrying ? 'animate-spin' : ''}`} />
          <span>RÉESSAYER</span>
        </button>
      </main>
    </div>
  );
};
