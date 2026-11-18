import React, { useEffect, useRef } from 'react';
import { drawStudioVectorElement, StudioVectorElementKind } from '../../../services/studioGraphics';
import { drawRoundedRectPath, safeDrawMedia } from '../../../services/studios/canvasSafety';

export interface PreviewTemplateShape {
  id: string;
  title: string;
  category?: string;
  subtitle?: string;
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
  slideCount?: number;
  isImagePackaged?: boolean;
  isSaved?: boolean;
  onSaveOffline?: () => void;
  isSavingOffline?: boolean;
  onSelectPreview: () => void;
  isEn?: boolean;
}

export function renderDesignLikePreviewToCanvas(
  canvas: HTMLCanvasElement,
  tpl: {
    format?: string;
    bgType?: string;
    bgColor1?: string;
    bgColor2?: string;
    bgAngle?: number;
    layers?: Array<Record<string, unknown>>;
    bgImageEl?: HTMLImageElement | null;
  },
  scaleWidth = 360
): void {
  const fmt = tpl.format || 'square';
  const baseW = fmt === 'landscape' ? 1280 : fmt === 'a4' ? 1240 : 1080;
  const baseH =
    fmt === 'landscape'
      ? 720
      : fmt === 'story'
        ? 1920
        : fmt === 'portrait'
          ? 1350
          : fmt === 'a4'
            ? 1754
            : 1080;

  const scale = scaleWidth / baseW;
  canvas.width = Math.max(120, Math.round(baseW * scale));
  canvas.height = Math.max(90, Math.round(baseH * scale));
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  ctx.save();
  ctx.scale(scale, scale);

  const c1 = tpl.bgColor1 || '#0b1f42';
  const c2 = tpl.bgColor2 || '#1d4ed8';
  if (tpl.bgType === 'image' && tpl.bgImageEl) {
    ctx.fillStyle = c1;
    ctx.fillRect(0, 0, baseW, baseH);
    const iw = tpl.bgImageEl.naturalWidth || tpl.bgImageEl.width || baseW;
    const ih = tpl.bgImageEl.naturalHeight || tpl.bgImageEl.height || baseH;
    const iRatio = iw / Math.max(1, ih);
    const cRatio = baseW / baseH;
    let dw = baseW;
    let dh = baseH;
    let dx = 0;
    let dy = 0;
    if (iRatio > cRatio) {
      dh = baseH;
      dw = baseH * iRatio;
      dx = (baseW - dw) / 2;
    } else {
      dw = baseW;
      dh = baseW / iRatio;
      dy = (baseH - dh) / 2;
    }
    safeDrawMedia(ctx, tpl.bgImageEl, dx, dy, dw, dh);
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.fillRect(0, 0, baseW, baseH);
  } else if (tpl.bgType === 'solid') {
    ctx.fillStyle = c1;
    ctx.fillRect(0, 0, baseW, baseH);
  } else {
    const rad = ((tpl.bgAngle ?? 135) * Math.PI) / 180;
    const cx = baseW / 2;
    const cy = baseH / 2;
    const r = Math.max(baseW, baseH) / 2;
    const grad = ctx.createLinearGradient(
      cx - Math.cos(rad) * r,
      cy - Math.sin(rad) * r,
      cx + Math.cos(rad) * r,
      cy + Math.sin(rad) * r
    );
    grad.addColorStop(0, c1);
    grad.addColorStop(1, c2);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, baseW, baseH);
  }

  const layers = Array.isArray(tpl.layers) ? tpl.layers : [];
  for (const layer of layers) {
    ctx.save();
    ctx.globalAlpha = typeof layer.opacity === 'number' ? layer.opacity : 1;
    ctx.translate(Number(layer.x) || baseW / 2, Number(layer.y) || baseH / 2);
    ctx.rotate(((Number(layer.rotation) || 0) * Math.PI) / 180);

    if (layer.kind === 'shape') {
      drawStudioVectorElement(
        ctx,
        (layer.shape as StudioVectorElementKind) || 'rect',
        Number(layer.width) || 180,
        Number(layer.height) || 180,
        String(layer.fillColor || '#fbbf24'),
        String(layer.strokeColor || '#ffffff'),
        Number(layer.strokeWidth) || 0,
        typeof layer.secondaryColor === 'string' ? layer.secondaryColor : undefined
      );
    } else if (layer.kind === 'text') {
      const fontSize = Number(layer.fontSize) || 48;
      const fontFamily = String(layer.fontFamily || '"Outfit", sans-serif');
      ctx.font = `${layer.italic ? 'italic ' : ''}${layer.bold !== false ? '700 ' : '400 '}${fontSize}px ${fontFamily}`;
      const align = (layer.align as CanvasTextAlign) || 'center';
      ctx.textAlign = align;
      ctx.textBaseline = 'middle';
      const lines = String(layer.text || '').split('\n');
      const lineH = fontSize * 1.25;
      const maxLineW = Math.max(40, ...lines.map((ln) => ctx.measureText(ln).width));
      const totalH = lines.length * lineH;

      if (layer.bgEnabled) {
        ctx.fillStyle = String(layer.bgColor || '#0b1f42');
        ctx.beginPath();
        drawRoundedRectPath(ctx, -maxLineW / 2 - 22, -totalH / 2 - 12, maxLineW + 44, totalH + 24, 16);
        ctx.fill();
      }
      if (layer.shadow) {
        ctx.shadowColor = 'rgba(0,0,0,0.45)';
        ctx.shadowBlur = 12;
        ctx.shadowOffsetY = 4;
      }
      ctx.fillStyle = String(layer.color || '#ffffff');
      const startY = -((lines.length - 1) * lineH) / 2;
      lines.forEach((ln, idx) => {
        const tx = align === 'left' ? -maxLineW / 2 : align === 'right' ? maxLineW / 2 : 0;
        ctx.fillText(ln, tx, startY + idx * lineH);
      });
    }
    ctx.restore();
  }

  ctx.restore();
}

export function renderVideoPreviewToCanvas(
  canvas: HTMLCanvasElement,
  tpl: {
    aspect?: string;
    bgColor?: string;
    scenes?: Array<Record<string, unknown>>;
    overlays?: Array<Record<string, unknown>>;
  },
  scaleWidth = 360
): void {
  const aspect = tpl.aspect || '9:16';
  const baseW = aspect === '16:9' ? 1280 : 1080;
  const baseH =
    aspect === '9:16'
      ? 1920
      : aspect === '16:9'
        ? 720
        : aspect === '4:5'
          ? 1350
          : 1080;
  const scale = scaleWidth / baseW;
  canvas.width = Math.max(120, Math.round(baseW * scale));
  canvas.height = Math.max(90, Math.round(baseH * scale));
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  ctx.save();
  ctx.scale(scale, scale);

  const firstScene = Array.isArray(tpl.scenes) && tpl.scenes.length > 0 ? tpl.scenes[0] : {};
  const bg1 = String(firstScene.bgColor || tpl.bgColor || '#071128');
  const bg2 = String(firstScene.bgColor2 || '#1d4ed8');
  const grad = ctx.createLinearGradient(0, 0, baseW, baseH);
  grad.addColorStop(0, bg1);
  grad.addColorStop(1, bg2);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, baseW, baseH);

  if (firstScene.shape) {
    ctx.save();
    ctx.translate(baseW / 2, baseH * 0.28);
    drawStudioVectorElement(
      ctx,
      (firstScene.shape as StudioVectorElementKind) || 'cross',
      Math.round(Math.min(baseW, baseH) * 0.22),
      Math.round(Math.min(baseW, baseH) * 0.22),
      String(firstScene.shapeColor || '#fbbf24'),
      '#ffffff',
      0
    );
    ctx.restore();
  }

  if (firstScene.text) {
    const fz = Number(firstScene.fontSize) || 48;
    ctx.save();
    ctx.font = `700 ${fz}px ${String(firstScene.fontFamily || '"Outfit", sans-serif')}`;
    ctx.fillStyle = String(firstScene.textColor || '#ffffff');
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(0,0,0,0.45)';
    ctx.shadowBlur = 12;
    const lines = String(firstScene.text).split('\n');
    const lh = fz * 1.28;
    const sy = baseH * 0.56 - ((lines.length - 1) * lh) / 2;
    lines.forEach((ln, i) => ctx.fillText(ln, baseW / 2, sy + i * lh));
    ctx.restore();
  }

  const overlays = Array.isArray(tpl.overlays) ? tpl.overlays : [];
  if (overlays[0] && overlays[0].text) {
    const ov = overlays[0];
    const cx = ((Number(ov.xPct) || 50) / 100) * baseW;
    const cy = ((Number(ov.yPct) || 86) / 100) * baseH;
    ctx.save();
    ctx.font = `700 ${Number(ov.size) || 26}px "Outfit", sans-serif`;
    const txt = String(ov.text);
    const w = Math.min(baseW - 80, ctx.measureText(txt).width + 44);
    ctx.fillStyle = 'rgba(8, 16, 36, 0.8)';
    ctx.beginPath();
    drawRoundedRectPath(ctx, cx - w / 2, cy - 28, w, 56, 14);
    ctx.fill();
    ctx.fillStyle = String(ov.color || '#fde68a');
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(txt, cx, cy);
    ctx.restore();
  }

  ctx.restore();
}

export function renderAudioPreviewToCanvas(
  canvas: HTMLCanvasElement,
  tpl: {
    badgeColor?: string;
    tracks?: Array<{ id?: string; name?: string; color?: string }>;
    synthAdditions?: Array<{ duration?: number; trackId?: string; startTimeSec?: number; name?: string }>;
    markers?: Array<{ timeSec?: number; color?: string }>;
  },
  scaleWidth = 360
): void {
  const w = scaleWidth;
  const h = Math.round(scaleWidth * 0.54);
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const grad = ctx.createLinearGradient(0, 0, w, h);
  grad.addColorStop(0, '#071128');
  grad.addColorStop(1, '#0f172a');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  // Grid lines
  ctx.strokeStyle = 'rgba(148, 163, 184, 0.14)';
  ctx.lineWidth = 1;
  for (let x = 24; x < w; x += 48) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, h);
    ctx.stroke();
  }

  const tracks = Array.isArray(tpl.tracks) && tpl.tracks.length > 0
    ? tpl.tracks
    : [{ id: 'track_1', color: '#2563eb' }, { id: 'track_2', color: '#059669' }];
  const laneH = Math.max(26, Math.floor((h - 32) / Math.min(4, tracks.length)));
  const maxSec = Math.max(
    18,
    ...(Array.isArray(tpl.synthAdditions)
      ? tpl.synthAdditions.map((s) => (Number(s.startTimeSec) || 0) + (Number(s.duration) || 4))
      : [18])
  );

  tracks.slice(0, 4).forEach((t, idx) => {
    const y = 20 + idx * (laneH + 6);
    ctx.fillStyle = 'rgba(255,255,255,0.05)';
    ctx.beginPath();
    drawRoundedRectPath(ctx, 10, y, w - 20, laneH, 6);
    ctx.fill();

    const matchingSynths = (tpl.synthAdditions || []).filter((s) => !t.id || s.trackId === t.id);
    if (matchingSynths.length === 0) {
      // Draw subtle waveform bars for voice track
      ctx.fillStyle = t.color || tpl.badgeColor || '#3b82f6';
      for (let bx = 18; bx < w - 24; bx += 5) {
        const amp = Math.max(4, Math.abs(Math.sin(bx * 0.25 + idx)) * (laneH * 0.55));
        ctx.fillRect(bx, y + laneH / 2 - amp / 2, 2.5, amp);
      }
    } else {
      matchingSynths.forEach((s) => {
        const sx = 12 + ((Number(s.startTimeSec) || 0) / maxSec) * (w - 24);
        const sw = Math.max(28, ((Number(s.duration) || 4) / maxSec) * (w - 24));
        ctx.fillStyle = t.color || '#10b981';
        ctx.globalAlpha = 0.28;
        ctx.beginPath();
        drawRoundedRectPath(ctx, sx, y + 3, Math.min(w - sx - 12, sw), laneH - 6, 5);
        ctx.fill();
        ctx.globalAlpha = 0.9;
        for (let bx = sx + 4; bx < Math.min(w - 14, sx + sw - 4); bx += 5) {
          const amp = Math.max(4, Math.abs(Math.cos(bx * 0.18 + idx)) * (laneH * 0.5));
          ctx.fillRect(bx, y + laneH / 2 - amp / 2, 2.5, amp);
        }
        ctx.globalAlpha = 1;
      });
    }
  });

  // Markers
  (tpl.markers || []).forEach((m) => {
    const mx = 12 + ((Number(m.timeSec) || 0) / maxSec) * (w - 24);
    ctx.strokeStyle = m.color || '#fbbf24';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(mx, 6);
    ctx.lineTo(mx, h - 6);
    ctx.stroke();
    ctx.fillStyle = m.color || '#fbbf24';
    ctx.beginPath();
    ctx.arc(mx, 8, 3.5, 0, Math.PI * 2);
    ctx.fill();
  });
}

export const TemplatePreviewCard: React.FC<PreviewTemplateShape> = ({
  title,
  category,
  subtitle,
  kind,
  format,
  aspect,
  bgType,
  bgColor1,
  bgColor2,
  bgAngle,
  bgRemoteImageUrl,
  layers,
  pages,
  scenes,
  overlays,
  tracks,
  synthAdditions,
  markers,
  badgeColor,
  slideCount,
  isSaved,
  onSaveOffline,
  isSavingOffline,
  onSelectPreview,
  isEn,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let cancelled = false;

    const firstSlide =
      Array.isArray(pages) && pages.length > 0 ? (pages[0] as Record<string, unknown>) : null;

    if (kind === 'design' || kind === 'presentation') {
      const targetBgType = String(firstSlide?.bgType || bgType || 'gradient');
      const targetC1 = String(firstSlide?.bgColor1 || bgColor1 || '#0b1f42');
      const targetC2 = String(firstSlide?.bgColor2 || bgColor2 || '#1d4ed8');
      const targetAngle = Number(firstSlide?.bgAngle ?? bgAngle ?? 135);
      const targetLayers =
        (firstSlide?.layers as Array<Record<string, unknown>>) || layers || [];

      renderDesignLikePreviewToCanvas(canvas, {
        format: kind === 'presentation' ? 'landscape' : format,
        bgType: targetBgType,
        bgColor1: targetC1,
        bgColor2: targetC2,
        bgAngle: targetAngle,
        layers: targetLayers,
      });

      if (bgRemoteImageUrl && bgRemoteImageUrl.startsWith('https://')) {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
          if (cancelled || !canvasRef.current) return;
          renderDesignLikePreviewToCanvas(canvasRef.current, {
            format: kind === 'presentation' ? 'landscape' : format,
            bgType: 'image',
            bgColor1: targetC1,
            bgColor2: targetC2,
            bgAngle: targetAngle,
            layers: targetLayers,
            bgImageEl: img,
          });
        };
        img.src = bgRemoteImageUrl;
      }
    } else if (kind === 'video') {
      renderVideoPreviewToCanvas(canvas, {
        aspect,
        bgColor: bgColor1,
        scenes,
        overlays,
      });
    } else {
      renderAudioPreviewToCanvas(canvas, {
        badgeColor,
        tracks,
        synthAdditions,
        markers,
      });
    }

    return () => {
      cancelled = true;
    };
  }, [
    kind,
    format,
    aspect,
    bgType,
    bgColor1,
    bgColor2,
    bgAngle,
    bgRemoteImageUrl,
    layers,
    pages,
    scenes,
    overlays,
    tracks,
    synthAdditions,
    markers,
    badgeColor,
  ]);

  const metaParts: string[] = [];
  if (category) metaParts.push(category);
  if (kind === 'presentation' && (slideCount || pages?.length)) {
    const count = slideCount || pages?.length || 1;
    metaParts.push(isEn ? `${count} slides` : `${count} diapos`);
  } else if (kind === 'video') {
    const totalSec = (scenes || []).reduce((acc, s) => acc + (Number(s.durationSec) || 4), 0);
    if (aspect) metaParts.push(aspect);
    if (totalSec > 0) metaParts.push(`${totalSec.toFixed(1)}s`);
  } else if (kind === 'audio') {
    metaParts.push(`${(tracks || []).length || 2} ${isEn ? 'tracks' : 'pistes'}`);
  } else if (format) {
    metaParts.push(format.toUpperCase());
  }

  return (
    <div className="group rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0c1631] overflow-hidden hover:border-blue-600 dark:hover:border-blue-500 transition flex flex-col">
      <button
        type="button"
        onClick={onSelectPreview}
        className="w-full text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 cursor-pointer"
      >
        <div className="w-full aspect-[4/3] bg-slate-900 flex items-center justify-center overflow-hidden p-1.5">
          <canvas
            ref={canvasRef}
            className="max-w-full max-h-full object-contain rounded-lg shadow-sm"
          />
        </div>
        <div className="p-2.5 space-y-0.5">
          <div className="text-xs font-bold text-slate-900 dark:text-white truncate">
            {title}
          </div>
          {subtitle && (
            <div className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-1">
              {subtitle}
            </div>
          )}
          {metaParts.length > 0 && (
            <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate tabular-nums">
              {metaParts.join(' · ')}
            </div>
          )}
        </div>
      </button>

      {onSaveOffline && (
        <div className="px-2.5 pb-2.5 pt-0.5 mt-auto">
          <button
            type="button"
            disabled={isSavingOffline}
            onClick={(e) => {
              e.stopPropagation();
              onSaveOffline();
            }}
            className={`w-full min-h-[34px] px-2.5 py-1 rounded-lg text-[10px] font-bold transition whitespace-nowrap ${
              isSaved
                ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                : 'bg-slate-100 dark:bg-slate-800 hover:bg-blue-50 dark:hover:bg-blue-950/40 text-slate-700 dark:text-slate-200'
            }`}
          >
            {isSavingOffline
              ? isEn
                ? 'Saving...'
                : 'Enregistrement...'
              : isSaved
                ? isEn
                  ? 'Saved offline'
                  : 'Hors-ligne ✓'
                : isEn
                  ? 'Save to SHALOM'
                  : 'Enregistrer'}
          </button>
        </div>
      )}
    </div>
  );
};
