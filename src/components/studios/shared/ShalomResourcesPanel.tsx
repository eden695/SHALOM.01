import React, { useMemo, useState } from 'react';
import { CheckCircle2, FolderHeart, Music, Film, LayoutTemplate, Image as ImageIcon, Trash2, Sparkles } from 'lucide-react';
import { SavedStudioTemplate } from '../../../types';

interface ShalomResourcesPanelProps {
  studioType: 'design' | 'presentation' | 'audio' | 'video';
  savedItems: SavedStudioTemplate[];
  isEn: boolean;
  onApplyItem: (item: SavedStudioTemplate) => void;
  onDeleteItem: (item: SavedStudioTemplate) => void;
}

export const ShalomResourcesPanel: React.FC<ShalomResourcesPanelProps> = ({
  studioType,
  savedItems,
  isEn,
  onApplyItem,
  onDeleteItem,
}) => {
  const [filter, setFilter] = useState<'all' | 'template' | 'media'>('all');

  const items = useMemo(() => {
    const byStudio = savedItems.filter((it) => it.studioType === studioType);
    if (filter === 'template') {
      return byStudio.filter((it) => !it.resourceType || it.resourceType === 'template');
    }
    if (filter === 'media') {
      return byStudio.filter((it) => it.resourceType && it.resourceType !== 'template');
    }
    return byStudio;
  }, [savedItems, studioType, filter]);

  const counts = useMemo(() => {
    const byStudio = savedItems.filter((it) => it.studioType === studioType);
    return {
      all: byStudio.length,
      template: byStudio.filter((it) => !it.resourceType || it.resourceType === 'template').length,
      media: byStudio.filter((it) => it.resourceType && it.resourceType !== 'template').length,
    };
  }, [savedItems, studioType]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-xs font-extrabold text-slate-900 dark:text-white">
          <FolderHeart className="w-4 h-4 text-amber-500" />
          <span>{isEn ? 'My SHALOM Resources' : 'Mes ressources SHALOM'}</span>
        </div>
        <span className="text-[10px] font-semibold text-emerald-700 dark:text-emerald-400">
          {counts.all} {isEn ? 'offline' : 'hors-ligne'}
        </span>
      </div>

      {/* Sub-filter tabs */}
      <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-[11px]">
        <button
          type="button"
          onClick={() => setFilter('all')}
          className={`flex-1 py-1.5 px-2 rounded-lg font-semibold transition ${
            filter === 'all'
              ? 'bg-white dark:bg-blue-700 text-blue-700 dark:text-white shadow-xs'
              : 'text-slate-600 dark:text-slate-400'
          }`}
        >
          {isEn ? 'All' : 'Tout'} ({counts.all})
        </button>
        <button
          type="button"
          onClick={() => setFilter('template')}
          className={`flex-1 py-1.5 px-2 rounded-lg font-semibold transition ${
            filter === 'template'
              ? 'bg-white dark:bg-blue-700 text-blue-700 dark:text-white shadow-xs'
              : 'text-slate-600 dark:text-slate-400'
          }`}
        >
          {isEn ? 'Templates' : 'Modèles'} ({counts.template})
        </button>
        <button
          type="button"
          onClick={() => setFilter('media')}
          className={`flex-1 py-1.5 px-2 rounded-lg font-semibold transition ${
            filter === 'media'
              ? 'bg-white dark:bg-blue-700 text-blue-700 dark:text-white shadow-xs'
              : 'text-slate-600 dark:text-slate-400'
          }`}
        >
          {isEn ? 'Assets' : 'Médias'} ({counts.media})
        </button>
      </div>

      {items.length === 0 ? (
        <div className="p-4 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 text-center space-y-1.5">
          <Sparkles className="w-5 h-5 text-amber-500 mx-auto" />
          <div className="text-xs font-bold text-slate-700 dark:text-slate-200">
            {isEn ? 'No saved offline resources yet' : 'Aucune ressource enregistrée ici'}
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
            {isEn
              ? 'Click "ENREGISTRER DANS SHALOM" on any online template, image, element or audio/video clip to store it 100% offline.'
              : 'Cliquez sur « ENREGISTRER DANS SHALOM » sur un modèle, une image, un élément ou un son en ligne pour le conserver hors-ligne.'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((item) => {
            const isResourceMedia = item.resourceType && item.resourceType !== 'template';
            return (
              <div
                key={item.id}
                className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800 flex items-center gap-2.5"
              >
                {/* Preview thumbnail */}
                <div
                  className="w-12 h-12 rounded-lg shrink-0 overflow-hidden flex items-center justify-center border border-slate-200/80 dark:border-slate-700 bg-white dark:bg-slate-800"
                  style={
                    !item.previewDataUrl && item.previewColor
                      ? {
                          background: `linear-gradient(135deg, ${item.previewColor}, ${
                            item.previewColor2 || item.previewColor
                          })`,
                        }
                      : undefined
                  }
                >
                  {item.previewDataUrl ? (
                    <img
                      src={item.previewDataUrl}
                      alt={item.title}
                      className="w-full h-full object-cover"
                    />
                  ) : item.resourceType === 'audio' || item.studioType === 'audio' ? (
                    <Music className="w-5 h-5 text-white drop-shadow-xs" />
                  ) : item.resourceType === 'video' || item.studioType === 'video' ? (
                    <Film className="w-5 h-5 text-white drop-shadow-xs" />
                  ) : isResourceMedia ? (
                    <ImageIcon className="w-5 h-5 text-blue-600" />
                  ) : (
                    <LayoutTemplate className="w-5 h-5 text-white drop-shadow-xs" />
                  )}
                </div>

                {/* Metadata + verified status */}
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-bold text-slate-900 dark:text-white truncate">
                    {item.title}
                  </div>
                  <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate mt-0.5 flex items-center gap-1">
                    {item.verifiedOffline && (
                      <CheckCircle2 className="w-3 h-3 text-emerald-500 shrink-0" />
                    )}
                    <span className="truncate">
                      {item.verifiedOffline
                        ? isEn
                          ? 'Verified offline'
                          : 'Hors-ligne vérifié'
                        : isEn
                          ? 'Saved template'
                          : 'Enregistré'}{' '}
                      · {item.category}
                      {item.license ? ` · ${item.license}` : ''}
                    </span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => onApplyItem(item)}
                    className="min-h-[34px] px-2.5 py-1 rounded-lg bg-blue-700 hover:bg-blue-800 text-white text-[11px] font-bold whitespace-nowrap"
                  >
                    {isResourceMedia
                      ? isEn
                        ? 'Insert'
                        : 'Insérer'
                      : isEn
                        ? 'Use'
                        : 'Utiliser'}
                  </button>
                  <button
                    type="button"
                    onClick={() => onDeleteItem(item)}
                    aria-label="Supprimer"
                    className="min-w-[34px] min-h-[34px] rounded-lg flex items-center justify-center text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
