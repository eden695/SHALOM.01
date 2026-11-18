import React, { useState, useRef, useEffect } from 'react';
import {
  Mic,
  Video,
  Pause,
  Play,
  Square,
  Maximize2,
  Camera,
  EyeOff,
  GripVertical,
} from 'lucide-react';
import { useGlobalRecording } from '../../contexts/RecordingContext';

interface FloatingRecordingBarProps {
  activeTab: string;
  onReturnToParole: () => void;
}

export const FloatingRecordingBar: React.FC<FloatingRecordingBarProps> = ({
  activeTab,
  onReturnToParole,
}) => {
  const {
    recorderState,
    isRecordingModalOpen,
    setIsRecordingModalOpen,
    isFloatingBubbleHidden,
    setIsFloatingBubbleHidden,
    pauseOrResume,
    stopRecording,
    capturePhotoFromVideo,
    addCapturedPhoto,
    capturedPhotos,
    appWasBackgrounded,
  } = useGlobalRecording();

  const [isStopping, setIsStopping] = useState(false);
  const [photoFeedback, setPhotoFeedback] = useState(false);
  const [position, setPosition] = useState<{ x: number; y: number }>(() => {
    if (typeof window === 'undefined') return { x: 16, y: 16 };
    return {
      x: Math.max(12, Math.min(window.innerWidth - 332, window.innerWidth - 344)),
      y: Math.max(72, window.innerHeight - 156),
    };
  });

  const dragRef = useRef<{
    dragging: boolean;
    startX: number;
    startY: number;
    origX: number;
    origY: number;
    moved: boolean;
  }>({ dragging: false, startX: 0, startY: 0, origX: 0, origY: 0, moved: false });

  useEffect(() => {
    const clampOnResize = () => {
      setPosition((prev) => ({
        x: Math.max(8, Math.min(window.innerWidth - 180, prev.x)),
        y: Math.max(56, Math.min(window.innerHeight - 90, prev.y)),
      }));
    };
    window.addEventListener('resize', clampOnResize);
    return () => window.removeEventListener('resize', clampOnResize);
  }, []);

  const shouldShow =
    recorderState.isRecording &&
    (!isRecordingModalOpen || activeTab !== 'parole' || appWasBackgrounded);

  if (!shouldShow) return null;

  const mins = Math.floor(recorderState.durationSeconds / 60);
  const secs = recorderState.durationSeconds % 60;
  const formattedTime = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;

  const handleQuickStop = async () => {
    if (isStopping) return;
    setIsStopping(true);
    try {
      await stopRecording();
      onReturnToParole();
      setIsRecordingModalOpen(true);
    } finally {
      setIsStopping(false);
    }
  };

  const handleOpenRecorder = () => {
    onReturnToParole();
    setIsRecordingModalOpen(true);
  };

  const handleQuickPhoto = async () => {
    if (recorderState.mode === 'video') {
      const blob = await capturePhotoFromVideo();
      if (blob && blob.size > 0) {
        addCapturedPhoto(blob);
        setPhotoFeedback(true);
        window.setTimeout(() => setPhotoFeedback(false), 1200);
        return;
      }
    }
    // For audio mode (which needs live camera preview), return cleanly to Parole recorder
    handleOpenRecorder();
  };

  const startDrag = (e: React.PointerEvent<HTMLElement>) => {
    if ((e.target as HTMLElement).closest('button')) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = {
      dragging: true,
      startX: e.clientX,
      startY: e.clientY,
      origX: position.x,
      origY: position.y,
      moved: false,
    };
  };

  const moveDrag = (e: React.PointerEvent<HTMLElement>) => {
    if (!dragRef.current.dragging) return;
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    if (Math.abs(dx) > 4 || Math.abs(dy) > 4) dragRef.current.moved = true;
    const maxW = isFloatingBubbleHidden ? window.innerWidth - 110 : window.innerWidth - 300;
    setPosition({
      x: Math.max(8, Math.min(Math.max(8, maxW), dragRef.current.origX + dx)),
      y: Math.max(52, Math.min(window.innerHeight - 76, dragRef.current.origY + dy)),
    });
  };

  const endDrag = () => {
    dragRef.current.dragging = false;
  };

  if (isFloatingBubbleHidden) {
    return (
      <div
        role="region"
        aria-label="Bulle d'enregistrement réduite"
        style={{ left: `${position.x}px`, top: `${position.y}px`, touchAction: 'none' }}
        onPointerDown={startDrag}
        onPointerMove={moveDrag}
        onPointerUp={endDrag}
        className="fixed z-50 select-none"
      >
        <button
          type="button"
          onClick={() => setIsFloatingBubbleHidden(false)}
          title="Réafficher les commandes d'enregistrement"
          className="min-h-[44px] px-3 py-2 rounded-full bg-[#0b1f42]/95 text-white border border-red-500/70 shadow-2xl flex items-center gap-2 cursor-pointer"
        >
          <span className="relative flex h-2.5 w-2.5 shrink-0">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500" />
          </span>
          <span className="font-mono text-xs font-bold tabular-nums text-red-200">
            {formattedTime}
          </span>
        </button>
      </div>
    );
  }

  return (
    <div
      role="region"
      aria-label="Bulle flottante d'enregistrement"
      style={{ left: `${position.x}px`, top: `${position.y}px`, touchAction: 'none' }}
      onPointerDown={startDrag}
      onPointerMove={moveDrag}
      onPointerUp={endDrag}
      className="fixed z-50 w-[312px] sm:w-[348px] max-w-[calc(100vw-16px)] select-none"
    >
      <div className="px-3 py-2.5 rounded-2xl bg-[#0b1f42]/95 backdrop-blur-md text-white border border-red-500/60 shadow-[0_14px_38px_rgba(0,0,0,0.45)] space-y-2 cursor-grab active:cursor-grabbing">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <GripVertical className="w-4 h-4 text-slate-400 shrink-0" />
            <span className="relative flex h-2.5 w-2.5 shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500" />
            </span>
            {recorderState.mode === 'video' ? (
              <Video className="w-3.5 h-3.5 text-amber-300 shrink-0" />
            ) : (
              <Mic className="w-3.5 h-3.5 text-amber-300 shrink-0" />
            )}
            <span className="text-xs font-bold truncate">
              {recorderState.isPaused ? 'En pause' : 'Capture active'}
            </span>
            <span className="font-mono text-xs font-bold tabular-nums text-red-300">
              {formattedTime}
            </span>
          </div>

          <button
            type="button"
            onClick={() => setIsFloatingBubbleHidden(true)}
            className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center shrink-0"
            title="Masquer la bulle sans arrêter l'enregistrement"
            aria-label="Masquer la bulle"
          >
            <EyeOff className="w-3.5 h-3.5 text-slate-200" />
          </button>
        </div>

        <div className="flex items-center justify-between gap-1.5">
          <button
            type="button"
            onClick={pauseOrResume}
            className="flex-1 min-h-[40px] px-2.5 rounded-xl bg-white/15 hover:bg-white/25 text-xs font-bold flex items-center justify-center gap-1.5 transition"
            title={recorderState.isPaused ? 'Reprendre' : 'Mettre en pause'}
          >
            {recorderState.isPaused ? (
              <>
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Reprendre</span>
              </>
            ) : (
              <>
                <Pause className="w-3.5 h-3.5" />
                <span>Pause</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={handleQuickPhoto}
            className={`min-h-[40px] px-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1 transition ${
              photoFeedback
                ? 'bg-emerald-500 text-slate-950'
                : 'bg-amber-500 hover:bg-amber-400 text-slate-950'
            }`}
            title="Capturer une photo pendant l'enregistrement"
          >
            <Camera className="w-3.5 h-3.5" />
            <span>
              {photoFeedback ? 'OK' : capturedPhotos.length > 0 ? `Photo (${capturedPhotos.length})` : 'Photo'}
            </span>
          </button>

          <button
            type="button"
            onClick={handleQuickStop}
            disabled={isStopping}
            className="min-h-[40px] px-3 rounded-xl bg-red-600 hover:bg-red-500 disabled:opacity-60 text-white text-xs font-bold flex items-center justify-center gap-1 transition"
            title="Arrêter et enregistrer"
          >
            <Square className="w-3 h-3 fill-current" />
            <span>Arrêter</span>
          </button>

          <button
            type="button"
            onClick={handleOpenRecorder}
            className="w-10 min-h-[40px] rounded-xl bg-blue-600 hover:bg-blue-500 flex items-center justify-center shrink-0 transition"
            title="Ouvrir Parole Divine"
            aria-label="Ouvrir Parole Divine"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
