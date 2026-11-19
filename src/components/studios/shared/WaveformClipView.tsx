import React, { useEffect, useRef, useState } from 'react';
import { drawClipWaveformCanvas } from '../../../services/studios/waveformEngine';

interface WaveformClipViewProps {
  id: string;
  name: string;
  color: string;
  buffer?: AudioBuffer | null;
  leftPx: number;
  widthPx: number;
  durationSec: number;
  trimStartSec: number;
  trimEndSec: number;
  fadeInSec?: number;
  fadeOutSec?: number;
  muted?: boolean;
  locked?: boolean;
  selected: boolean;
  pxPerSec: number;
  onSelect: () => void;
  onMoveCommit: (newStartSec: number) => void;
  onTrimCommit: (nextTrimStart: number, nextTrimEnd: number, nextStartSecDelta: number) => void;
  startTimeSec: number;
}

export const WaveformClipView: React.FC<WaveformClipViewProps> = ({
  name,
  color,
  buffer,
  leftPx,
  widthPx,
  durationSec,
  trimStartSec,
  trimEndSec,
  fadeInSec = 0,
  fadeOutSec = 0,
  muted = false,
  locked = false,
  selected,
  pxPerSec,
  onSelect,
  onMoveCommit,
  onTrimCommit,
  startTimeSec,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [dragMode, setDragMode] = useState<'none' | 'move' | 'trim-left' | 'trim-right'>('none');
  const [deltaPx, setDeltaPx] = useState(0);
  const dragOriginRef = useRef<{ startX: number; mode: 'move' | 'trim-left' | 'trim-right' } | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !buffer) return;
    drawClipWaveformCanvas(canvas, buffer, {
      trimStartSec,
      trimEndSec,
      fadeInSec,
      fadeOutSec,
      color,
      muted,
      selected,
    });
  }, [buffer, trimStartSec, trimEndSec, fadeInSec, fadeOutSec, color, muted, selected, widthPx]);

  const maxClipBufDur = buffer ? buffer.duration : Math.max(trimEndSec, durationSec);
  const currentActiveDur = Math.max(0.15, trimEndSec - trimStartSec);

  // Compute live preview offsets during drag
  let previewLeft = leftPx;
  let previewWidth = widthPx;
  let liveDur = currentActiveDur;

  if (dragMode === 'move') {
    previewLeft = Math.max(0, leftPx + deltaPx);
  } else if (dragMode === 'trim-left') {
    const deltaSec = deltaPx / Math.max(10, pxPerSec);
    const maxShift = currentActiveDur - 0.2;
    const minShift = -trimStartSec;
    const clampedShift = Math.max(minShift, Math.min(maxShift, deltaSec));
    const finalShift = Math.max(-startTimeSec, clampedShift);
    previewLeft = leftPx + finalShift * pxPerSec;
    previewWidth = Math.max(24, widthPx - finalShift * pxPerSec);
    liveDur = Math.max(0.2, currentActiveDur - finalShift);
  } else if (dragMode === 'trim-right') {
    const deltaSec = deltaPx / Math.max(10, pxPerSec);
    const maxExpand = maxClipBufDur - trimEndSec;
    const minShrink = -(currentActiveDur - 0.2);
    const clampedShift = Math.max(minShrink, Math.min(maxExpand, deltaSec));
    previewWidth = Math.max(24, widthPx + clampedShift * pxPerSec);
    liveDur = Math.max(0.2, currentActiveDur + clampedShift);
  }

  const startPointerGesture = (
    e: React.PointerEvent,
    mode: 'move' | 'trim-left' | 'trim-right'
  ) => {
    e.stopPropagation();
    onSelect();
    if (locked) return;
    dragOriginRef.current = { startX: e.clientX, mode };
    setDragMode(mode);
    setDeltaPx(0);

    const onMove = (ev: PointerEvent) => {
      if (!dragOriginRef.current) return;
      setDeltaPx(ev.clientX - dragOriginRef.current.startX);
    };

    const onUp = (ev: PointerEvent) => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
      const origin = dragOriginRef.current;
      dragOriginRef.current = null;
      if (!origin) {
        setDragMode('none');
        setDeltaPx(0);
        return;
      }

      const finalDeltaPx = ev.clientX - origin.startX;
      const deltaSec = finalDeltaPx / Math.max(10, pxPerSec);

      if (Math.abs(finalDeltaPx) >= 3) {
        if (origin.mode === 'move') {
          onMoveCommit(Math.max(0, Number((startTimeSec + deltaSec).toFixed(2))));
        } else if (origin.mode === 'trim-left') {
          const maxShift = currentActiveDur - 0.2;
          const minShift = Math.max(-trimStartSec, -startTimeSec);
          const clampedShift = Math.max(minShift, Math.min(maxShift, deltaSec));
          const nextTrimStart = Number((trimStartSec + clampedShift).toFixed(2));
          onTrimCommit(nextTrimStart, trimEndSec, Number(clampedShift.toFixed(2)));
        } else if (origin.mode === 'trim-right') {
          const maxExpand = maxClipBufDur - trimEndSec;
          const minShrink = -(currentActiveDur - 0.2);
          const clampedShift = Math.max(minShrink, Math.min(maxExpand, deltaSec));
          const nextTrimEnd = Number((trimEndSec + clampedShift).toFixed(2));
          onTrimCommit(trimStartSec, nextTrimEnd, 0);
        }
      }

      setDragMode('none');
      setDeltaPx(0);
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
  };

  return (
    <div
      style={{
        left: `${previewLeft}px`,
        width: `${Math.max(30, previewWidth)}px`,
        backgroundColor: color,
      }}
      onPointerDown={(e) => startPointerGesture(e, 'move')}
      className={`absolute top-1.5 bottom-1.5 rounded-xl select-none touch-none overflow-visible flex flex-col justify-between transition-shadow ${
        selected
          ? 'ring-2 ring-amber-400 shadow-lg z-20'
          : 'ring-1 ring-white/25 opacity-95 hover:opacity-100 z-10'
      } ${muted ? 'opacity-50 grayscale-[35%]' : ''} ${
        locked ? 'cursor-not-allowed' : 'cursor-grab active:cursor-grabbing'
      }`}
    >
      {/* Live Duration Pill when actively dragging/trimming */}
      {dragMode !== 'none' && (
        <div className="pointer-events-none absolute -top-6 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-md bg-slate-950 text-amber-300 text-[10px] font-bold tabular-nums shadow-md whitespace-nowrap z-30 border border-amber-400/40">
          {liveDur.toFixed(2)}s
        </div>
      )}

      {/* Real Audio Waveform Canvas */}
      {buffer && (
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full rounded-xl pointer-events-none opacity-85"
        />
      )}

      {/* Clip Header */}
      <div className="relative z-10 flex items-center justify-between gap-1 px-2.5 pt-1 pointer-events-none">
        <span className="text-[10px] font-bold text-white drop-shadow-xs truncate">{name}</span>
        <span className="text-[9px] font-semibold text-white/90 tabular-nums shrink-0 drop-shadow-xs">
          {currentActiveDur.toFixed(1)}s
        </span>
      </div>

      {/* Left Interactive Trim Handle (Large mobile-friendly hitbox) */}
      {!locked && (
        <div
          role="slider"
          aria-label="Rogner le début du clip"
          onPointerDown={(e) => startPointerGesture(e, 'trim-left')}
          className="absolute left-0 top-0 bottom-0 w-7 sm:w-4 -translate-x-1/3 flex items-center justify-center cursor-ew-resize z-30 group touch-none"
        >
          <div className="w-1.5 h-7 rounded-full bg-white/95 group-hover:bg-amber-300 shadow-sm border border-slate-900/40" />
        </div>
      )}

      {/* Right Interactive Trim Handle (Large mobile-friendly hitbox) */}
      {!locked && (
        <div
          role="slider"
          aria-label="Rogner la fin du clip"
          onPointerDown={(e) => startPointerGesture(e, 'trim-right')}
          className="absolute right-0 top-0 bottom-0 w-7 sm:w-4 translate-x-1/3 flex items-center justify-center cursor-ew-resize z-30 group touch-none"
        >
          <div className="w-1.5 h-7 rounded-full bg-white/95 group-hover:bg-amber-300 shadow-sm border border-slate-900/40" />
        </div>
      )}
    </div>
  );
};
