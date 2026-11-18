import React, { createContext, useContext, useRef, useState, useEffect, useCallback } from 'react';
import { MediaRecordingManager, RecorderState } from '../services/audioVideoRecorder';

export interface FinishedRecording {
  blob: Blob;
  mimeType: string;
  duration: number;
  mediaType: 'audio' | 'video';
  previewUrl: string;
}

export interface CapturedRecordingPhoto {
  id: string;
  blob: Blob;
  previewUrl: string;
}

export interface ShalomAndroidRecorderBridge {
  startForegroundService?: (mode: 'audio' | 'video') => boolean;
  stopForegroundService?: () => boolean;
  updateRecordingNotification?: (durationSec: number, isPaused: boolean) => void;
  showFloatingBubble?: (mode: 'audio' | 'video') => boolean;
  hideFloatingBubble?: () => boolean;
  hasOverlayPermission?: () => boolean;
}

declare global {
  interface Window {
    ShalomAndroidRecorder?: ShalomAndroidRecorderBridge;
  }
}

interface RecordingContextValue {
  recorderState: RecorderState;
  captureMethod: 'mic' | 'video' | 'import';
  setCaptureMethod: (m: 'mic' | 'video' | 'import') => void;
  facingMode: 'user' | 'environment';
  setFacingMode: (f: 'user' | 'environment') => void;
  isRecordingModalOpen: boolean;
  setIsRecordingModalOpen: (open: boolean) => void;
  isFloatingBubbleHidden: boolean;
  setIsFloatingBubbleHidden: (hidden: boolean) => void;
  finishedRecording: FinishedRecording | null;
  setFinishedRecording: React.Dispatch<React.SetStateAction<FinishedRecording | null>>;
  capturedPhotos: CapturedRecordingPhoto[];
  addCapturedPhoto: (blob: Blob) => void;
  removeCapturedPhoto: (idx: number) => void;
  clearCapturedPhotos: () => void;
  startAudio: () => Promise<void>;
  startVideo: (videoEl: HTMLVideoElement | null, facing: 'user' | 'environment') => Promise<void>;
  attachPreviewElement: (videoEl: HTMLVideoElement | null) => void;
  pauseOrResume: () => void;
  switchCamera: () => Promise<'user' | 'environment'>;
  capturePhotoFromVideo: () => Promise<Blob | null>;
  acquirePhotoStream: (facing: 'user' | 'environment') => Promise<MediaStream>;
  stopRecording: () => Promise<FinishedRecording | null>;
  cancelRecording: () => void;
  appWasBackgrounded: boolean;
  hasNativeForegroundRecorder: boolean;
}

const DEFAULT_STATE: RecorderState = {
  isRecording: false,
  isPaused: false,
  durationSeconds: 0,
  audioLevel: 0,
  mode: 'audio',
  facingMode: 'user',
  error: null,
};

const RecordingContext = createContext<RecordingContextValue | null>(null);

export const RecordingProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const managerRef = useRef<MediaRecordingManager | null>(null);
  const wakeLockRef = useRef<{ release: () => Promise<void> } | null>(null);

  const [recorderState, setRecorderState] = useState<RecorderState>(DEFAULT_STATE);
  const [captureMethod, setCaptureMethod] = useState<'mic' | 'video' | 'import'>('mic');
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [isRecordingModalOpen, setIsRecordingModalOpen] = useState(false);
  const [isFloatingBubbleHidden, setIsFloatingBubbleHidden] = useState(false);
  const [finishedRecording, setFinishedRecording] = useState<FinishedRecording | null>(null);
  const [capturedPhotos, setCapturedPhotos] = useState<CapturedRecordingPhoto[]>([]);
  const [appWasBackgrounded, setAppWasBackgrounded] = useState(false);

  const hasNativeForegroundRecorder =
    typeof window !== 'undefined' &&
    Boolean(window.ShalomAndroidRecorder?.startForegroundService);

  useEffect(() => {
    managerRef.current = new MediaRecordingManager((state) => {
      setRecorderState(state);
    });
    return () => {
      managerRef.current?.cancel();
      wakeLockRef.current?.release().catch(() => {});
      window.ShalomAndroidRecorder?.stopForegroundService?.();
    };
  }, []);

  useEffect(() => {
    const handleVisibility = () => {
      if (recorderState.isRecording && document.visibilityState === 'hidden') {
        setAppWasBackgrounded(true);
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [recorderState.isRecording]);

  const addCapturedPhoto = useCallback((blob: Blob) => {
    if (!blob || blob.size === 0) return;
    const previewUrl = URL.createObjectURL(blob);
    setCapturedPhotos((prev) => [
      ...prev,
      { id: `cphoto_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`, blob, previewUrl },
    ]);
  }, []);

  const removeCapturedPhoto = useCallback((idx: number) => {
    setCapturedPhotos((prev) => {
      const target = prev[idx];
      if (target) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((_, i) => i !== idx);
    });
  }, []);

  const clearCapturedPhotos = useCallback(() => {
    setCapturedPhotos((prev) => {
      prev.forEach((p) => URL.revokeObjectURL(p.previewUrl));
      return [];
    });
  }, []);

  const stopRecording = useCallback(async (): Promise<FinishedRecording | null> => {
    if (!managerRef.current) return null;
    const result = await managerRef.current.stop();
    window.ShalomAndroidRecorder?.stopForegroundService?.();
    window.ShalomAndroidRecorder?.hideFloatingBubble?.();
    if (!result.blob || result.blob.size === 0) return null;
    const previewUrl = URL.createObjectURL(result.blob);
    const finished: FinishedRecording = {
      blob: result.blob,
      mimeType: result.mimeType,
      duration: result.duration,
      mediaType: recorderState.mode === 'video' ? 'video' : 'audio',
      previewUrl,
    };
    setFinishedRecording(finished);
    setIsFloatingBubbleHidden(false);
    return finished;
  }, [recorderState.mode]);

  useEffect(() => {
    if (!recorderState.isRecording) {
      setAppWasBackgrounded(false);
      setIsFloatingBubbleHidden(false);
      if (wakeLockRef.current) {
        wakeLockRef.current.release().catch(() => {});
        wakeLockRef.current = null;
      }
      if ('mediaSession' in navigator) {
        try {
          navigator.mediaSession.playbackState = 'none';
          navigator.mediaSession.setActionHandler('play', null);
          navigator.mediaSession.setActionHandler('pause', null);
          navigator.mediaSession.setActionHandler('stop', null);
        } catch {
          // ignore
        }
      }
      return;
    }

    const nav = navigator as Navigator & {
      wakeLock?: { request: (type: 'screen') => Promise<{ release: () => Promise<void> }> };
    };
    if (nav.wakeLock?.request && !wakeLockRef.current) {
      nav.wakeLock
        .request('screen')
        .then((sentinel) => {
          wakeLockRef.current = sentinel;
        })
        .catch(() => {});
    }

    if ('mediaSession' in navigator && typeof MediaMetadata !== 'undefined') {
      try {
        navigator.mediaSession.metadata = new MediaMetadata({
          title:
            recorderState.mode === 'video'
              ? 'Enregistrement vidéo en cours'
              : 'Enregistrement audio en cours',
          artist: 'SHALOM · Parole Divine',
          album: 'Capture active',
        });
        navigator.mediaSession.playbackState = recorderState.isPaused ? 'paused' : 'playing';
        navigator.mediaSession.setActionHandler('play', () => managerRef.current?.resume());
        navigator.mediaSession.setActionHandler('pause', () => managerRef.current?.pause());
        navigator.mediaSession.setActionHandler('stop', () => {
          stopRecording().then(() => setIsRecordingModalOpen(true));
        });
      } catch {
        // ignore if unsupported
      }
    }
  }, [recorderState.isRecording, recorderState.isPaused, recorderState.mode, stopRecording]);

  useEffect(() => {
    if (recorderState.isRecording && window.ShalomAndroidRecorder?.updateRecordingNotification) {
      try {
        window.ShalomAndroidRecorder.updateRecordingNotification(
          recorderState.durationSeconds,
          recorderState.isPaused
        );
      } catch {
        // ignore
      }
    }
  }, [recorderState.isRecording, recorderState.durationSeconds, recorderState.isPaused]);

  const startAudio = useCallback(async () => {
    if (!managerRef.current) return;
    setCaptureMethod('mic');
    setIsFloatingBubbleHidden(false);
    window.ShalomAndroidRecorder?.startForegroundService?.('audio');
    await managerRef.current.startAudioRecording();
  }, []);

  const startVideo = useCallback(
    async (videoEl: HTMLVideoElement | null, facing: 'user' | 'environment') => {
      if (!managerRef.current) return;
      setCaptureMethod('video');
      setFacingMode(facing);
      setIsFloatingBubbleHidden(false);
      window.ShalomAndroidRecorder?.startForegroundService?.('video');
      await managerRef.current.startVideoRecording(videoEl, facing);
    },
    []
  );

  const attachPreviewElement = useCallback((videoEl: HTMLVideoElement | null) => {
    managerRef.current?.attachPreviewElement(videoEl);
  }, []);

  const pauseOrResume = useCallback(() => {
    if (!managerRef.current) return;
    if (recorderState.isPaused) {
      managerRef.current.resume();
    } else {
      managerRef.current.pause();
    }
  }, [recorderState.isPaused]);

  const switchCamera = useCallback(async () => {
    if (!managerRef.current) return facingMode;
    const next = await managerRef.current.switchCamera();
    setFacingMode(next);
    return next;
  }, [facingMode]);

  const capturePhotoFromVideo = useCallback(async () => {
    if (!managerRef.current) return null;
    return managerRef.current.capturePhotoFromActiveVideo();
  }, []);

  const acquirePhotoStream = useCallback(async (facing: 'user' | 'environment') => {
    if (!managerRef.current) {
      return navigator.mediaDevices.getUserMedia({ video: { facingMode: facing } });
    }
    return managerRef.current.acquireVideoCameraStream(facing);
  }, []);

  const cancelRecording = useCallback(() => {
    managerRef.current?.cancel();
    window.ShalomAndroidRecorder?.stopForegroundService?.();
    window.ShalomAndroidRecorder?.hideFloatingBubble?.();
    setIsFloatingBubbleHidden(false);
  }, []);

  return (
    <RecordingContext.Provider
      value={{
        recorderState,
        captureMethod,
        setCaptureMethod,
        facingMode,
        setFacingMode,
        isRecordingModalOpen,
        setIsRecordingModalOpen,
        isFloatingBubbleHidden,
        setIsFloatingBubbleHidden,
        finishedRecording,
        setFinishedRecording,
        capturedPhotos,
        addCapturedPhoto,
        removeCapturedPhoto,
        clearCapturedPhotos,
        startAudio,
        startVideo,
        attachPreviewElement,
        pauseOrResume,
        switchCamera,
        capturePhotoFromVideo,
        acquirePhotoStream,
        stopRecording,
        cancelRecording,
        appWasBackgrounded,
        hasNativeForegroundRecorder,
      }}
    >
      {children}
    </RecordingContext.Provider>
  );
};

export function useGlobalRecording(): RecordingContextValue {
  const ctx = useContext(RecordingContext);
  if (!ctx) {
    throw new Error('useGlobalRecording must be used within RecordingProvider');
  }
  return ctx;
}
