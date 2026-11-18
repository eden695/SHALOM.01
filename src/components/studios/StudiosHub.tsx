import React from 'react';
import { Palette, Presentation, Music, Film, Sparkles } from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';
import { useModuleSubView } from '../../contexts/NavigationContext';
import { CreativeStudioModule } from './CreativeStudioModule';
import { AudioStudioModule } from './AudioStudioModule';
import { VideoStudioModule } from './VideoStudioModule';
import { StudioErrorBoundary, StudioTabId } from './shared/StudioErrorBoundary';

export const StudiosHub: React.FC = () => {
  const { lang } = useLanguage();
  const isEn = lang === 'en';
  const [rawActiveStudio, setActiveStudio] = useModuleSubView<StudioTabId>(
    'studios',
    'design'
  );

  const activeStudio: StudioTabId =
    rawActiveStudio === 'presentation' ||
    rawActiveStudio === 'video' ||
    rawActiveStudio === 'audio'
      ? rawActiveStudio
      : 'design';

  const activeStudioLabel =
    activeStudio === 'presentation'
      ? isEn
        ? 'Presentation Studio'
        : 'Studio Présentation'
      : activeStudio === 'video'
        ? isEn
          ? 'Video Studio'
          : 'Studio Vidéo'
        : activeStudio === 'audio'
          ? isEn
            ? 'Audio Studio'
            : 'Studio Audio'
          : isEn
            ? 'Visual Studio'
            : 'Studio Création';

  return (
    <div className="space-y-2.5 animate-in fade-in duration-200">
      {/* Compact Header & 4-Studio Switcher — preserves mobile/desktop viewport space */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-1">
        <div className="flex items-center gap-2 min-w-0">
          <Sparkles className="w-5 h-5 text-amber-500 shrink-0" />
          <h2 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-white font-display truncate">
            {isEn ? 'SHALOM Studios' : 'Studios SHALOM'}
          </h2>
          <span className="hidden xl:inline text-xs text-slate-500 dark:text-slate-400 truncate">
            ·{' '}
            {isEn
              ? 'Design, Presentations, Video & Audio Pro Workspace'
              : 'Création Graphique, Présentation, Montage Vidéo & Audio'}
          </span>
        </div>

        <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-100 dark:bg-[#0c1631] border border-slate-200 dark:border-slate-800 overflow-x-auto no-scrollbar">
          <button
            type="button"
            onClick={() => setActiveStudio('design')}
            className={`min-h-[42px] sm:min-h-[38px] px-3 py-1.5 text-xs font-bold rounded-lg flex items-center gap-1.5 transition whitespace-nowrap shrink-0 ${
              activeStudio === 'design'
                ? 'bg-blue-700 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-300 hover:bg-white/60 dark:hover:bg-slate-800/70'
            }`}
          >
            <Palette className="w-3.5 h-3.5 shrink-0" />
            <span>{isEn ? 'Graphic Studio' : 'Studio Création'}</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveStudio('presentation')}
            className={`min-h-[42px] sm:min-h-[38px] px-3 py-1.5 text-xs font-bold rounded-lg flex items-center gap-1.5 transition whitespace-nowrap shrink-0 ${
              activeStudio === 'presentation'
                ? 'bg-blue-700 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-300 hover:bg-white/60 dark:hover:bg-slate-800/70'
            }`}
          >
            <Presentation className="w-3.5 h-3.5 shrink-0" />
            <span>{isEn ? 'Presentations' : 'Studio Présentation'}</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveStudio('video')}
            className={`min-h-[42px] sm:min-h-[38px] px-3 py-1.5 text-xs font-bold rounded-lg flex items-center gap-1.5 transition whitespace-nowrap shrink-0 ${
              activeStudio === 'video'
                ? 'bg-blue-700 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-300 hover:bg-white/60 dark:hover:bg-slate-800/70'
            }`}
          >
            <Film className="w-3.5 h-3.5 shrink-0" />
            <span>{isEn ? 'Video Studio' : 'Studio Vidéo'}</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveStudio('audio')}
            className={`min-h-[42px] sm:min-h-[38px] px-3 py-1.5 text-xs font-bold rounded-lg flex items-center gap-1.5 transition whitespace-nowrap shrink-0 ${
              activeStudio === 'audio'
                ? 'bg-blue-700 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-300 hover:bg-white/60 dark:hover:bg-slate-800/70'
            }`}
          >
            <Music className="w-3.5 h-3.5 shrink-0" />
            <span>{isEn ? 'Audio Studio' : 'Studio Audio'}</span>
          </button>
        </div>
      </div>

      <StudioErrorBoundary
        studioId={activeStudio}
        studioLabel={activeStudioLabel}
        isEn={isEn}
        onSwitchStudio={setActiveStudio}
      >
        {activeStudio === 'design' && <CreativeStudioModule key="studio_design" mode="design" />}
        {activeStudio === 'presentation' && (
          <CreativeStudioModule key="studio_presentation" mode="presentation" />
        )}
        {activeStudio === 'video' && <VideoStudioModule key="studio_video" />}
        {activeStudio === 'audio' && <AudioStudioModule key="studio_audio" />}
      </StudioErrorBoundary>
    </div>
  );
};
