import React from 'react';
import { Palette, Music, Film, Sparkles } from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';
import { useModuleSubView } from '../../contexts/NavigationContext';
import { CreativeStudioModule } from './CreativeStudioModule';
import { AudioStudioModule } from './AudioStudioModule';
import { VideoStudioModule } from './VideoStudioModule';

export const StudiosHub: React.FC = () => {
  const { lang } = useLanguage();
  const isEn = lang === 'en';
  const [activeStudio, setActiveStudio] = useModuleSubView<'design' | 'audio' | 'video'>(
    'studios',
    'design'
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white flex items-center gap-2 font-display">
            <Sparkles className="w-6 h-6 text-amber-500" />
            <span>{isEn ? 'Christian Creative Studios' : 'Studios de Création Chrétienne'}</span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            {isEn
              ? 'Offline Graphic Design, Audio Mixing & Video Montage for faith sharing'
              : 'Création visuelle, Studio Audio & Studio Vidéo 100% intégrés et hors-ligne'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200/60 dark:border-slate-700/60">
          <button
            type="button"
            onClick={() => setActiveStudio('design')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition ${
              activeStudio === 'design'
                ? 'bg-white dark:bg-[#0f2b5c] text-blue-700 dark:text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            <Palette className="w-3.5 h-3.5" />
            <span>{isEn ? 'Visual Studio' : 'Studio Création'}</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveStudio('audio')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition ${
              activeStudio === 'audio'
                ? 'bg-white dark:bg-[#0f2b5c] text-blue-700 dark:text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            <Music className="w-3.5 h-3.5" />
            <span>{isEn ? 'Audio Studio' : 'Studio Audio'}</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveStudio('video')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition ${
              activeStudio === 'video'
                ? 'bg-white dark:bg-[#0f2b5c] text-blue-700 dark:text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            <Film className="w-3.5 h-3.5" />
            <span>{isEn ? 'Video Studio' : 'Studio Vidéo'}</span>
          </button>
        </div>
      </div>

      {activeStudio === 'design' && <CreativeStudioModule />}
      {activeStudio === 'audio' && <AudioStudioModule />}
      {activeStudio === 'video' && <VideoStudioModule />}
    </div>
  );
};
