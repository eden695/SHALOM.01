import React, { useEffect, useRef, useState } from 'react';
import { Crop, RotateCcw, Check } from 'lucide-react';
import { Modal } from '../../common/Modal';

export interface NormalizedCropRect {
  cropX: number;
  cropY: number;
  cropW: number;
  cropH: number;
}

interface ImageCropModalProps {
  isOpen: boolean;
  imageEl: HTMLImageElement | null;
  initialCrop?: Partial<NormalizedCropRect>;
  isEn: boolean;
  onClose: () => void;
  onApply: (crop: NormalizedCropRect) => void;
}

export const ImageCropModal: React.FC<ImageCropModalProps> = ({
  isOpen,
  imageEl,
  initialCrop,
  isEn,
  onClose,
  onApply,
}) => {
  const stageRef = useRef<HTMLDivElement | null>(null);
  const [crop, setCrop] = useState<NormalizedCropRect>({
    cropX: 0,
    cropY: 0,
    cropW: 1,
    cropH: 1,
  });

  const dragRef = useRef<{
    mode: 'move' | 'se' | 'nw';
    startX: number;
    startY: number;
    orig: NormalizedCropRect;
  } | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setCrop({
      cropX: Math.max(0, Math.min(0.9, initialCrop?.cropX ?? 0)),
      cropY: Math.max(0, Math.min(0.9, initialCrop?.cropY ?? 0)),
      cropW: Math.max(0.1, Math.min(1, initialCrop?.cropW ?? 1)),
      cropH: Math.max(0.1, Math.min(1, initialCrop?.cropH ?? 1)),
    });
  }, [isOpen, initialCrop?.cropX, initialCrop?.cropY, initialCrop?.cropW, initialCrop?.cropH]);

  if (!isOpen || !imageEl) return null;

  const natW = imageEl.naturalWidth || imageEl.width || 1;
  const natH = imageEl.naturalHeight || imageEl.height || 1;

  const applyAspectPreset = (ratioW: number | null, ratioH: number | null) => {
    if (!ratioW || !ratioH) {
      setCrop({ cropX: 0, cropY: 0, cropW: 1, cropH: 1 });
      return;
    }
    const imgAspect = natW / natH;
    const targetAspect = ratioW / ratioH;
    let w = 1;
    let h = 1;
    if (imgAspect > targetAspect) {
      h = 0.9;
      w = Math.min(1, (h * natH * targetAspect) / natW);
    } else {
      w = 0.9;
      h = Math.min(1, (w * natW) / (targetAspect * natH));
    }
    setCrop({
      cropX: Math.max(0, (1 - w) / 2),
      cropY: Math.max(0, (1 - h) / 2),
      cropW: w,
      cropH: h,
    });
  };

  const handlePointerDown = (e: React.PointerEvent, mode: 'move' | 'se' | 'nw') => {
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    dragRef.current = {
      mode,
      startX: e.clientX,
      startY: e.clientY,
      orig: { ...crop },
    };
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    const g = dragRef.current;
    const box = stageRef.current?.getBoundingClientRect();
    if (!g || !box || box.width === 0 || box.height === 0) return;

    const dx = (e.clientX - g.startX) / box.width;
    const dy = (e.clientY - g.startY) / box.height;

    if (g.mode === 'move') {
      const nextX = Math.max(0, Math.min(1 - g.orig.cropW, g.orig.cropX + dx));
      const nextY = Math.max(0, Math.min(1 - g.orig.cropH, g.orig.cropY + dy));
      setCrop({ ...g.orig, cropX: nextX, cropY: nextY });
    } else if (g.mode === 'se') {
      const nextW = Math.max(0.12, Math.min(1 - g.orig.cropX, g.orig.cropW + dx));
      const nextH = Math.max(0.12, Math.min(1 - g.orig.cropY, g.orig.cropH + dy));
      setCrop({ ...g.orig, cropW: nextW, cropH: nextH });
    } else {
      const maxDx = g.orig.cropW - 0.12;
      const maxDy = g.orig.cropH - 0.12;
      const clampedDx = Math.max(-g.orig.cropX, Math.min(maxDx, dx));
      const clampedDy = Math.max(-g.orig.cropY, Math.min(maxDy, dy));
      setCrop({
        cropX: g.orig.cropX + clampedDx,
        cropY: g.orig.cropY + clampedDy,
        cropW: g.orig.cropW - clampedDx,
        cropH: g.orig.cropH - clampedDy,
      });
    }
  };

  const handlePointerUp = () => {
    dragRef.current = null;
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEn ? 'Crop Image' : 'Recadrer l’image'}
      subtitle={
        isEn
          ? 'Drag the selection frame or corners to adjust visible framing.'
          : 'Déplacez le cadre ou les poignées d’angle pour recadrer sans détruire l’original.'
      }
      maxWidth="xl"
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300 mr-1 flex items-center gap-1">
            <Crop className="w-3.5 h-3.5" />
            {isEn ? 'Aspect:' : 'Format :'}
          </span>
          {[
            { label: isEn ? 'Full' : 'Complet', rw: null, rh: null },
            { label: '1:1', rw: 1, rh: 1 },
            { label: '4:3', rw: 4, rh: 3 },
            { label: '16:9', rw: 16, rh: 9 },
            { label: '9:16', rw: 9, rh: 16 },
          ].map((preset) => (
            <button
              key={preset.label}
              type="button"
              onClick={() => applyAspectPreset(preset.rw, preset.rh)}
              className="min-h-[36px] px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-blue-50 dark:hover:bg-blue-950/40 text-xs font-bold text-slate-700 dark:text-slate-200 transition"
            >
              {preset.label}
            </button>
          ))}
        </div>

        <div className="flex justify-center bg-slate-950 rounded-2xl p-4 border border-slate-800">
          <div
            ref={stageRef}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            className="relative inline-block max-w-full max-h-[38dvh] sm:max-h-[46vh] select-none touch-none"
            style={{ aspectRatio: `${natW} / ${natH}` }}
          >
            <img
              src={imageEl.src}
              alt="Recadrage"
              className="w-full h-full object-contain pointer-events-none opacity-45"
            />
            {/* Highlighted crop box */}
            <div
              onPointerDown={(e) => handlePointerDown(e, 'move')}
              className="absolute border-2 border-amber-400 shadow-[0_0_0_9999px_rgba(2,6,23,0.45)] cursor-move"
              style={{
                left: `${crop.cropX * 100}%`,
                top: `${crop.cropY * 100}%`,
                width: `${crop.cropW * 100}%`,
                height: `${crop.cropH * 100}%`,
              }}
            >
              <div
                onPointerDown={(e) => handlePointerDown(e, 'nw')}
                className="absolute -top-4 -left-4 w-9 h-9 sm:-top-2.5 sm:-left-2.5 sm:w-6 sm:h-6 rounded-full bg-amber-400 border-2 border-slate-950 cursor-nwse-resize touch-none"
              />
              <div
                onPointerDown={(e) => handlePointerDown(e, 'se')}
                className="absolute -bottom-4 -right-4 w-9 h-9 sm:-bottom-2.5 sm:-right-2.5 sm:w-6 sm:h-6 rounded-full bg-amber-400 border-2 border-slate-950 cursor-nwse-resize touch-none"
              />
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
          <button
            type="button"
            onClick={() => setCrop({ cropX: 0, cropY: 0, cropW: 1, cropH: 1 })}
            className="min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-1.5 transition"
          >
            <RotateCcw className="w-4 h-4" />
            <span>{isEn ? 'Reset crop' : 'Réinitialiser'}</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="min-h-[44px] px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-300"
            >
              {isEn ? 'Cancel' : 'Annuler'}
            </button>
            <button
              type="button"
              onClick={() => onApply(crop)}
              className="min-h-[44px] px-5 py-2 rounded-xl bg-blue-700 hover:bg-blue-800 text-white text-xs font-extrabold flex items-center gap-1.5 shadow-sm transition"
            >
              <Check className="w-4 h-4" />
              <span>{isEn ? 'Apply Crop' : 'Appliquer le recadrage'}</span>
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
};
