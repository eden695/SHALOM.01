import React from 'react';
import { AlertTriangle, WifiOff, RefreshCw, RotateCcw, Globe } from 'lucide-react';
import { classifyAppError } from '../../../services/studios/canvasSafety';
import { clearStudioDraft } from '../../../services/studioPersistence';

export type StudioTabId = 'design' | 'presentation' | 'video' | 'audio';

interface StudioErrorBoundaryProps {
  studioId: StudioTabId;
  studioLabel: string;
  isEn: boolean;
  onSwitchStudio: (next: StudioTabId) => void;
  children: React.ReactNode;
}

interface StudioErrorBoundaryState {
  hasError: boolean;
  errorKind: 'offline' | 'network' | 'runtime';
  errorMessage: string;
  resettingDraft: boolean;
  retryKey: number;
}

export class StudioErrorBoundary extends React.Component<
  StudioErrorBoundaryProps,
  StudioErrorBoundaryState
> {
  state: StudioErrorBoundaryState = {
    hasError: false,
    errorKind: 'runtime',
    errorMessage: '',
    resettingDraft: false,
    retryKey: 0,
  };

  static getDerivedStateFromError(error: unknown): Partial<StudioErrorBoundaryState> {
    return {
      hasError: true,
      errorKind: classifyAppError(error),
      errorMessage: error instanceof Error ? error.message : String(error || ''),
    };
  }

  componentDidUpdate(prevProps: StudioErrorBoundaryProps) {
    if (prevProps.studioId !== this.props.studioId && this.state.hasError) {
      this.setState({
        hasError: false,
        errorKind: 'runtime',
        errorMessage: '',
        resettingDraft: false,
      });
    }
  }

  handleRetry = () => {
    this.setState((prev) => ({
      hasError: false,
      errorMessage: '',
      retryKey: prev.retryKey + 1,
    }));
  };

  handleResetDraft = async () => {
    this.setState({ resettingDraft: true });
    try {
      await clearStudioDraft(this.props.studioId);
    } catch {
      // ignore cleanup error
    } finally {
      this.setState((prev) => ({
        hasError: false,
        errorMessage: '',
        resettingDraft: false,
        retryKey: prev.retryKey + 1,
      }));
    }
  };

  render() {
    const { studioLabel, studioId, isEn, onSwitchStudio, children } = this.props;
    const { hasError, errorKind, errorMessage, resettingDraft, retryKey } = this.state;

    if (!hasError) {
      return <React.Fragment key={`${studioId}_${retryKey}`}>{children}</React.Fragment>;
    }

    const isOffline = errorKind === 'offline';
    const isNetwork = errorKind === 'network';

    const title = isOffline
      ? isEn
        ? 'Internet Connection Required'
        : 'Connexion Internet absente'
      : isNetwork
        ? isEn
          ? 'Remote Resource Failed to Load'
          : 'Échec de chargement d’une ressource'
        : isEn
          ? `Issue inside ${studioLabel}`
          : `Incident technique dans ${studioLabel}`;

    const description = isOffline
      ? isEn
        ? 'Your device is offline. Reconnect to access online templates or continue working with local assets.'
        : 'Votre appareil semble hors ligne. Rétablissez Internet ou ouvrez un autre studio local.'
      : isNetwork
        ? isEn
          ? 'A remote asset or module could not be loaded right now. Your saved SHALOM projects remain safe.'
          : 'Une ressource externe n’a pas répondu à temps. Vos projets locaux SHALOM restent intacts.'
        : isEn
          ? 'An internal rendering or draft issue occurred inside this studio only. The rest of SHALOM is unaffected.'
          : 'Une erreur interne s’est produite uniquement dans ce studio (pas un problème Internet). Vos projets SHALOM restent intacts.';

    const otherTabs: Array<{ id: StudioTabId; label: string }> = [
      { id: 'design', label: isEn ? 'Graphic Studio' : 'Studio Création' },
      { id: 'presentation', label: isEn ? 'Presentation Studio' : 'Studio Présentation' },
      { id: 'video', label: isEn ? 'Video Studio' : 'Studio Vidéo' },
      { id: 'audio', label: isEn ? 'Audio Studio' : 'Studio Audio' },
    ];

    return (
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#081024] p-6 sm:p-10 text-center max-w-2xl mx-auto my-4 space-y-5 shadow-sm">
        <div className="w-14 h-14 rounded-2xl mx-auto flex items-center justify-center bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border border-amber-200/80 dark:border-amber-800/50">
          {isOffline ? (
            <WifiOff className="w-7 h-7" />
          ) : isNetwork ? (
            <Globe className="w-7 h-7" />
          ) : (
            <AlertTriangle className="w-7 h-7" />
          )}
        </div>

        <div className="space-y-2">
          <h3 className="text-lg sm:text-xl font-extrabold text-slate-900 dark:text-white">
            {title}
          </h3>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
            {description}
          </p>
          {errorMessage && (
            <p className="text-[11px] font-mono text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-900/70 rounded-xl px-3 py-2 break-words">
              {errorMessage.slice(0, 200)}
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-center gap-2.5">
          <button
            type="button"
            onClick={this.handleRetry}
            className="min-h-[44px] px-4 py-2 rounded-xl bg-blue-700 hover:bg-blue-800 text-white text-xs sm:text-sm font-bold flex items-center gap-2 transition"
          >
            <RefreshCw className="w-4 h-4" />
            <span>{isEn ? 'Try Again' : 'Réessayer'}</span>
          </button>

          <button
            type="button"
            onClick={this.handleResetDraft}
            disabled={resettingDraft}
            className="min-h-[44px] px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-100 text-xs sm:text-sm font-bold flex items-center gap-2 transition disabled:opacity-50"
          >
            <RotateCcw className="w-4 h-4" />
            <span>
              {isEn ? 'Reset Studio Draft' : 'Réinitialiser le brouillon du studio'}
            </span>
          </button>
        </div>

        <div className="pt-3 border-t border-slate-200 dark:border-slate-800">
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-2">
            {isEn ? 'Switch to another studio:' : 'Ou ouvrir un autre studio :'}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2">
            {otherTabs
              .filter((t) => t.id !== studioId)
              .map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => onSwitchStudio(t.id)}
                  className="min-h-[40px] px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                >
                  {t.label}
                </button>
              ))}
          </div>
        </div>
      </div>
    );
  }
}
