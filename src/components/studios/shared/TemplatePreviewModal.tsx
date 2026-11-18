import React, { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, BookmarkPlus, CheckCircle2, ArrowLeft, Sparkles } from 'lucide-react';
import { Modal } from '../../common/Modal';
import {
  renderAudioPreviewToCanvas,
  renderDesignLikePreviewToCanvas,
  renderVideoPreviewToCanvas,
} from './TemplatePreviewCard';

export interface PreviewModalTemplateData {
  id: string;
  title: string;
  category?: string;
  description?: string;
  kind: 'design' | 'presentation' | 'video' | 'audio';
  format?: string;
  aspect?: string;
  bgType?: string;
  bgColor1?: string;
  bgColor2?: string;
  bgAngle?: number;
  bgRemoteImageUrl?: string;
  layers?: Array<Record<string, unknown>>;
  pages?: Array<Record<string, unknown>>;
  scenes?: Array<Record<string, unknown>>;
  overlays?: Array<Record<string, unknown>>;
  tracks?: Array<{ id?: string; name?: string; color?: string; volume?: number }>;
  synthAdditions?: Array<{ preset?: string; duration?: number; trackId?: string; startTimeSec?: number; name?: string }>;
  markers?: Array<{ timeSec?: number; label?: string; color?: string }>;
  badgeColor?: string;
  scriptText?: string;
  sourceLabel?: string;
  isSavedOffline?: boolean;
  isSavingOffline?: boolean;
  rawTemplate: unknown;
}

interface TemplatePreviewModalProps {
  template: PreviewModalTemplateData | null;
  isEn: boolean;
  onClose: () => void;
  onUseTemplate: (tpl: PreviewModalTemplateData) => void;
  onSaveToShalom?: (tpl: PreviewModalTemplateData) => void;
}

export const TemplatePreviewModal: React.FC<TemplatePreviewModalProps> = ({
  template,
  isEn,
  onClose,
  onUseTemplate,
  onSaveToShalom,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [subIndex, setSubIndex] = useState(0);

  useEffect(() => {
    setSubIndex(0);
  }, [template?.id]);

  useEffect(() => {
    if (!template || !canvasRef.current) return;
    let cancelled = false;
    const canvas = canvasRef.current;

    if (template.kind === 'design' || template.kind === 'presentation') {
      const slideList =
        Array.isArray(template.pages) && template.pages.length > 0 ? template.pages : null;
      const activeSlide = slideList ? slideList[Math.min(subIndex, slideList.length - 1)] : null;
      const targetBgType = String(activeSlide?.bgType || template.bgType || 'gradient');
      const targetC1 = String(activeSlide?.bgColor1 || template.bgColor1 || '#0b1f42');
      const targetC2 = String(activeSlide?.bgColor2 || template.bgColor2 || '#1d4ed8');
      const targetAngle = Number(activeSlide?.bgAngle ?? template.bgAngle ?? 135);
      const targetLayers =
        (activeSlide?.layers as Array<Record<string, unknown>>) || template.layers || [];

      renderDesignLikePreviewToCanvas(
        canvas,
        {
          format: template.kind === 'presentation' ? 'landscape' : template.format,
          bgType: targetBgType,
          bgColor1: targetC1,
          bgColor2: targetC2,
          bgAngle: targetAngle,
          layers: targetLayers,
        },
        760
      );

      if (template.bgRemoteImageUrl && template.bgRemoteImageUrl.startsWith('https://')) {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
          if (cancelled || !canvasRef.current) return;
          renderDesignLikePreviewToCanvas(
            canvasRef.current,
            {
              format: template.kind === 'presentation' ? 'landscape' : template.format,
              bgType: 'image',
              bgColor1: targetC1,
              bgColor2: targetC2,
              bgAngle: targetAngle,
              layers: targetLayers,
              bgImageEl: img,
            },
            760
          );
        };
        img.src = template.bgRemoteImageUrl;
      }
    } else if (template.kind === 'video') {
      const scenesList =
        Array.isArray(template.scenes) && template.scenes.length > 0 ? template.scenes : [];
      const rotatedScenes =
        scenesList.length > 1
          ? [scenesList[Math.min(subIndex, scenesList.length - 1)], ...scenesList]
          : scenesList;
      renderVideoPreviewToCanvas(
        canvas,
        {
          aspect: template.aspect,
          bgColor: template.bgColor1,
          scenes: rotatedScenes,
          overlays: template.overlays,
        },
        720
      );
    } else {
      renderAudioPreviewToCanvas(
        canvas,
        {
          badgeColor: template.badgeColor,
          tracks: template.tracks,
          synthAdditions: template.synthAdditions,
          markers: template.markers,
        },
        720
      );
    }

    return () => {
      cancelled = true;
    };
  }, [template, subIndex]);

  if (!template) return null;

  const pageOrSceneCount =
    template.kind === 'presentation' || (template.pages && template.pages.length > 1)
      ? template.pages?.length || 1
      : template.kind === 'video'
        ? template.scenes?.length || 1
        : 1;

  const hasRasterPhoto = Boolean(template.bgRemoteImageUrl);

  return (
    <Modal
      isOpen={Boolean(template)}
      onClose={onClose}
      title={template.title}
      subtitle={[template.category, template.sourceLabel].filter(Boolean).join(' · ') || undefined}
      maxWidth="2xl"
    >
      <div className="space-y-4">
        {/* Large High-Resolution Visual Stage Preview */}
        <div className="rounded-2xl bg-slate-950 border border-slate-800 p-3 sm:p-5 flex flex-col items-center justify-center relative">
          <canvas
            ref={canvasRef}
            className="max-w-full max-h-[42vh] object-contain rounded-xl shadow-lg"
          />

          {pageOrSceneCount > 1 && (
            <div className="mt-3 flex items-center gap-2">
              <button
                type="button"
                onClick={() => setSubIndex((i) => Math.max(0, i - 1))}
                disabled={subIndex === 0}
                className="min-w-[40px] min-h-[40px] rounded-lg bg-slate-800 hover:bg-slate-700 text-white flex items-center justify-center disabled:opacity-35 transition"
                aria-label="Précédent"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-xs font-bold text-slate-200 tabular-nums px-2">
                {template.kind === 'video'
                  ? `${isEn ? 'Scene' : 'Scène'} ${subIndex + 1} / ${pageOrSceneCount}`
                  : `${isEn ? 'Slide' : 'Diapo'} ${subIndex + 1} / ${pageOrSceneCount}`}
              </span>
              <button
                type="button"
                onClick={() => setSubIndex((i) => Math.min(pageOrSceneCount - 1, i + 1))}
                disabled={subIndex >= pageOrSceneCount - 1}
                className="min-w-[40px] min-h-[40px] rounded-lg bg-slate-800 hover:bg-slate-700 text-white flex items-center justify-center disabled:opacity-35 transition"
                aria-label="Suivant"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        {/* Honest Metadata & Editability Info */}
        <div className="text-xs text-slate-600 dark:text-slate-300 space-y-1.5">
          {template.description && <p className="leading-relaxed">{template.description}</p>}
          {template.kind === 'audio' && template.tracks && (
            <div className="text-[11px] text-slate-500 dark:text-slate-400">
              <strong className="text-slate-700 dark:text-slate-200">
                {isEn ? 'Tracks included:' : 'Pistes incluses :'}
              </strong>{' '}
              {template.tracks.map((t) => t.name || 'Track').join(' · ')}
            </div>
          )}
          {template.scriptText && (
            <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-[11px] text-slate-600 dark:text-slate-300 whitespace-pre-line max-h-24 overflow-y-auto">
              {template.scriptText}
            </div>
          )}
          <div className="flex items-start gap-2 text-[11px] text-slate-500 dark:text-slate-400 pt-1">
            <Sparkles className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
            <span>
              {hasRasterPhoto
                ? isEn
                  ? 'Includes a full photographic backdrop image plus editable text & shape layers on top.'
                  : 'Inclut une photographie d’arrière-plan et des textes/formes superposés entièrement modifiables.'
                : isEn
                  ? 'Every text block, color, alignment, and element can be edited freely after loading.'
                  : 'Chaque texte, couleur, alignement, page ou piste reste 100 % modifiable après chargement.'}
            </span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-1.5 transition"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>{isEn ? 'Back to templates' : 'Retour aux modèles'}</span>
          </button>

          <div className="flex flex-wrap items-center gap-2">
            {onSaveToShalom && (
              <button
                type="button"
                disabled={template.isSavingOffline}
                onClick={() => onSaveToShalom(template)}
                className="min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5 transition"
              >
                {template.isSavedOffline ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                ) : (
                  <BookmarkPlus className="w-4 h-4 text-blue-600" />
                )}
                <span>
                  {template.isSavedOffline
                    ? isEn
                      ? 'Saved offline'
                      : 'Enregistré dans SHALOM'
                    : isEn
                      ? 'Save to SHALOM'
                      : 'Enregistrer dans SHALOM'}
                </span>
              </button>
            )}

            <button
              type="button"
              onClick={() => onUseTemplate(template)}
              className="min-h-[44px] px-5 py-2 rounded-xl bg-blue-700 hover:bg-blue-800 text-white text-xs sm:text-sm font-extrabold flex items-center gap-2 shadow-sm transition"
            >
              <span>{isEn ? 'Use this template' : 'Utiliser ce modèle'}</span>
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
};
