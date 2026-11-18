// Audio & Video MediaRecorder Service for SHALOM
// Direct hardware camera stream pipeline eliminates background requestAnimationFrame video freezes,
// supports live camera switching, simultaneous PHOTO capture without interrupting recording, and level metering.

export interface RecorderState {
  isRecording: boolean;
  isPaused: boolean;
  durationSeconds: number;
  audioLevel: number; // 0 to 100
  mode: 'audio' | 'video';
  facingMode: 'user' | 'environment';
  error: string | null;
}

export class MediaRecordingManager {
  private mediaRecorder: MediaRecorder | null = null;
  private recordedChunks: Blob[] = [];
  private recordedSegments: Blob[] = [];
  private mediaStream: MediaStream | null = null;
  private videoSourceStream: MediaStream | null = null;
  private audioSourceStream: MediaStream | null = null;
  private previewVideoElement: HTMLVideoElement | null = null;
  private timerInterval: number | null = null;
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private levelAnimFrame: number | null = null;
  private visibilityListener: (() => void) | null = null;
  private onStateChangeCallback: ((state: RecorderState) => void) | null = null;

  public state: RecorderState = {
    isRecording: false,
    isPaused: false,
    durationSeconds: 0,
    audioLevel: 0,
    mode: 'audio',
    facingMode: 'user',
    error: null,
  };

  constructor(onStateChange?: (state: RecorderState) => void) {
    if (onStateChange) this.onStateChangeCallback = onStateChange;
  }

  private notify() {
    if (this.onStateChangeCallback) {
      this.onStateChangeCallback({ ...this.state });
    }
  }

  public static isSupported(): { audio: boolean; video: boolean } {
    const hasMediaDevices = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
    const hasMediaRecorder = typeof window !== 'undefined' && 'MediaRecorder' in window;
    return {
      audio: hasMediaDevices && hasMediaRecorder,
      video: hasMediaDevices && hasMediaRecorder,
    };
  }

  public static getBestMimeType(mode: 'audio' | 'video'): string | undefined {
    if (typeof MediaRecorder === 'undefined' || !MediaRecorder.isTypeSupported) {
      return undefined;
    }

    if (mode === 'audio') {
      const audioTypes = [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/mp4',
        'audio/ogg;codecs=opus',
        'audio/ogg',
      ];
      for (const t of audioTypes) {
        if (MediaRecorder.isTypeSupported(t)) return t;
      }
      return undefined;
    }

    const videoTypes = [
      'video/webm;codecs=vp8,opus',
      'video/webm;codecs=vp9,opus',
      'video/webm',
      'video/mp4',
    ];
    for (const t of videoTypes) {
      if (MediaRecorder.isTypeSupported(t)) return t;
    }
    return undefined;
  }

  private startAudioLevelMeter(stream: MediaStream) {
    try {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;

      const ctx = new AudioCtx();
      if (ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
      }
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);

      this.audioContext = ctx;
      this.analyser = analyser;

      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      const updateLevel = () => {
        if (!this.analyser || !this.state.isRecording) return;
        // Skip rAF UI updates while app is backgrounded so we don't burn cycles or stall
        if (document.visibilityState === 'hidden') {
          this.levelAnimFrame = null;
          return;
        }
        if (this.state.isPaused) {
          this.state.audioLevel = 0;
          this.notify();
          this.levelAnimFrame = requestAnimationFrame(updateLevel);
          return;
        }

        this.analyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i];
        }
        const average = sum / dataArray.length;
        this.state.audioLevel = Math.min(100, Math.round((average / 128) * 100));
        this.notify();
        this.levelAnimFrame = requestAnimationFrame(updateLevel);
      };

      if (document.visibilityState !== 'hidden') {
        this.levelAnimFrame = requestAnimationFrame(updateLevel);
      }

      if (this.visibilityListener) {
        document.removeEventListener('visibilitychange', this.visibilityListener);
      }
      this.visibilityListener = () => {
        if (!this.state.isRecording) return;
        if (document.visibilityState === 'visible') {
          if (this.audioContext?.state === 'suspended') {
            this.audioContext.resume().catch(() => {});
          }
          if (!this.levelAnimFrame && this.analyser) {
            this.levelAnimFrame = requestAnimationFrame(updateLevel);
          }
          // Ensure preview video resumes cleanly upon returning to foreground
          if (this.previewVideoElement && this.previewVideoElement.paused) {
            this.previewVideoElement.play().catch(() => {});
          }
        }
      };
      document.addEventListener('visibilitychange', this.visibilityListener);
    } catch {
      // Non-critical if AudioContext unavailable
    }
  }

  private createRecorder(stream: MediaStream, mode: 'audio' | 'video'): MediaRecorder {
    const preferredMime = MediaRecordingManager.getBestMimeType(mode);
    if (preferredMime) {
      try {
        return new MediaRecorder(stream, { mimeType: preferredMime });
      } catch {
        // Fallback to browser default
      }
    }
    return new MediaRecorder(stream);
  }

  public async startAudioRecording(): Promise<MediaStream> {
    this.cleanup();
    this.state = {
      isRecording: false,
      isPaused: false,
      durationSeconds: 0,
      audioLevel: 0,
      mode: 'audio',
      facingMode: 'user',
      error: null,
    };

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error("L'API microphone n'est pas prise en charge sur cet appareil.");
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      const audioTracks = stream.getAudioTracks();
      if (audioTracks.length === 0) {
        throw new Error('Aucun microphone détecté sur cet appareil.');
      }
      audioTracks.forEach((t) => {
        t.enabled = true;
      });

      this.mediaStream = stream;
      this.audioSourceStream = stream;
      this.recordedChunks = [];
      this.recordedSegments = [];
      this.mediaRecorder = this.createRecorder(stream, 'audio');

      this.mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          this.recordedChunks.push(e.data);
        }
      };

      this.mediaRecorder.onerror = () => {
        this.state.error = "Erreur pendant l'enregistrement audio.";
        this.notify();
      };

      this.mediaRecorder.start(250);
      this.startTimer();

      this.state.isRecording = true;
      this.state.isPaused = false;
      this.notify();
      this.startAudioLevelMeter(stream);

      return stream;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erreur d'accès au microphone";
      this.state.error = msg;
      this.notify();
      throw err;
    }
  }

  public async acquireVideoCameraStream(facingMode: 'user' | 'environment'): Promise<MediaStream> {
    const isPortrait =
      typeof window !== 'undefined' && window.innerHeight >= window.innerWidth;
    const idealW = isPortrait ? 720 : 1280;
    const idealH = isPortrait ? 1280 : 720;
    const idealRatio = idealW / idealH;

    try {
      return await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { exact: facingMode },
          width: { ideal: idealW },
          height: { ideal: idealH },
          aspectRatio: { ideal: idealRatio },
        },
      });
    } catch {
      return await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: facingMode },
          width: { ideal: idealW },
          height: { ideal: idealH },
          aspectRatio: { ideal: idealRatio },
        },
      });
    }
  }

  public static async capturePhotoFromVideoElement(
    videoEl: HTMLVideoElement | null
  ): Promise<Blob | null> {
    if (!videoEl || videoEl.readyState < 2 || videoEl.videoWidth === 0 || videoEl.videoHeight === 0) {
      return null;
    }
    const canvas = document.createElement('canvas');
    canvas.width = videoEl.videoWidth;
    canvas.height = videoEl.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(videoEl, 0, 0, canvas.width, canvas.height);
    return new Promise((resolve) => {
      canvas.toBlob((blob) => resolve(blob), 'image/jpeg', 0.92);
    });
  }

  public async capturePhotoFromActiveVideo(): Promise<Blob | null> {
    // 1. Prefer ImageCapture API directly from live camera video track (never touches MediaRecorder!)
    const track = this.videoSourceStream?.getVideoTracks()?.[0];
    if (track && track.readyState === 'live') {
      const win = window as unknown as {
        ImageCapture?: new (t: MediaStreamTrack) => {
          takePhoto?: () => Promise<Blob>;
          grabFrame?: () => Promise<ImageBitmap>;
        };
      };
      if (win.ImageCapture) {
        try {
          const ic = new win.ImageCapture(track);
          if (ic.takePhoto) {
            const photo = await ic.takePhoto();
            if (photo && photo.size > 0) return photo;
          }
          if (ic.grabFrame) {
            const bmp = await ic.grabFrame();
            const c = document.createElement('canvas');
            c.width = bmp.width;
            c.height = bmp.height;
            c.getContext('2d')?.drawImage(bmp, 0, 0);
            bmp.close();
            const blob = await new Promise<Blob | null>((r) => c.toBlob(r, 'image/jpeg', 0.92));
            if (blob && blob.size > 0) return blob;
          }
        } catch {
          // Fall back smoothly to video element frame capture
        }
      }
    }

    // 2. Fallback to attached previewVideoElement
    if (
      this.previewVideoElement &&
      this.previewVideoElement.readyState >= 2 &&
      this.previewVideoElement.videoWidth > 0
    ) {
      return MediaRecordingManager.capturePhotoFromVideoElement(this.previewVideoElement);
    }

    // 3. Transient hidden capture only if previewVideoElement is detached (e.g. minimized bubble)
    if (this.videoSourceStream) {
      const tempVid = document.createElement('video');
      tempVid.muted = true;
      tempVid.playsInline = true;
      tempVid.srcObject = this.videoSourceStream;
      await tempVid.play().catch(() => {});
      await new Promise((r) => setTimeout(r, 150));
      const blob = await MediaRecordingManager.capturePhotoFromVideoElement(tempVid);
      tempVid.srcObject = null;
      return blob;
    }

    return null;
  }

  public attachPreviewElement(videoEl: HTMLVideoElement | null) {
    this.previewVideoElement = videoEl;
    if (videoEl && this.videoSourceStream) {
      videoEl.srcObject = this.videoSourceStream;
      videoEl.muted = true;
      videoEl.play().catch(() => {});
    }
  }

  public async startVideoRecording(
    videoElement?: HTMLVideoElement | null,
    facingMode: 'user' | 'environment' = 'user'
  ): Promise<MediaStream> {
    this.cleanup();
    this.state = {
      isRecording: false,
      isPaused: false,
      durationSeconds: 0,
      audioLevel: 0,
      mode: 'video',
      facingMode,
      error: null,
    };

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error("L'accès à la caméra n'est pas disponible sur cet appareil.");
      }

      this.previewVideoElement = videoElement || null;

      // Separate mic stream so audio capture never restarts on camera flip
      const audioStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      audioStream.getAudioTracks().forEach((t) => {
        t.enabled = true;
      });
      this.audioSourceStream = audioStream;

      const videoStream = await this.acquireVideoCameraStream(facingMode);
      this.videoSourceStream = videoStream;

      if (this.previewVideoElement) {
        this.previewVideoElement.srcObject = videoStream;
        this.previewVideoElement.muted = true;
        await this.previewVideoElement.play().catch(() => {});
      }

      // Bind camera hardware track DIRECTLY into MediaRecorder (ZERO requestAnimationFrame dependency -> never freezes in background!)
      const recordingStream = new MediaStream([
        ...videoStream.getVideoTracks(),
        ...audioStream.getAudioTracks(),
      ]);

      this.mediaStream = recordingStream;
      this.recordedChunks = [];
      this.recordedSegments = [];
      this.mediaRecorder = this.createRecorder(recordingStream, 'video');

      this.mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          this.recordedChunks.push(e.data);
        }
      };

      this.mediaRecorder.onerror = () => {
        this.state.error = "Erreur pendant l'enregistrement vidéo.";
        this.notify();
      };

      this.mediaRecorder.start(500);
      this.startTimer();

      this.state.isRecording = true;
      this.state.isPaused = false;
      this.notify();

      this.startAudioLevelMeter(audioStream);
      return videoStream;
    } catch (err: unknown) {
      this.cleanup();
      const msg = err instanceof Error ? err.message : "Erreur d'accès à la caméra";
      this.state.error = msg;
      this.notify();
      throw err;
    }
  }

  public async switchCamera(): Promise<'user' | 'environment'> {
    if (this.state.mode !== 'video' || !this.state.isRecording) {
      const next = this.state.facingMode === 'user' ? 'environment' : 'user';
      this.state.facingMode = next;
      this.notify();
      return next;
    }

    const nextFacing: 'user' | 'environment' =
      this.state.facingMode === 'user' ? 'environment' : 'user';

    // Try track constraint switch first (instant, zero stream interruption on supported Android devices)
    const activeVideoTrack = this.videoSourceStream?.getVideoTracks()?.[0];
    if (activeVideoTrack?.applyConstraints) {
      try {
        await activeVideoTrack.applyConstraints({ facingMode: { exact: nextFacing } });
        this.state.facingMode = nextFacing;
        this.state.error = null;
        this.notify();
        return nextFacing;
      } catch {
        // Device uses separate physical camera IDs; perform safe segment handoff
      }
    }

    // Preserve active chunks into segments cleanly before swapping hardware camera
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      await new Promise<void>((resolve) => {
        const rec = this.mediaRecorder!;
        const prevOnStop = rec.onstop;
        rec.onstop = () => {
          const fallbackMime = 'video/webm';
          const mime = rec.mimeType || this.recordedChunks[0]?.type || fallbackMime;
          if (this.recordedChunks.length > 0) {
            this.recordedSegments.push(new Blob(this.recordedChunks, { type: mime }));
            this.recordedChunks = [];
          }
          rec.onstop = prevOnStop;
          resolve();
        };
        try {
          rec.requestData();
        } catch {
          // ignore
        }
        rec.stop();
      });
    }

    if (this.videoSourceStream) {
      this.videoSourceStream.getVideoTracks().forEach((t) => t.stop());
      this.videoSourceStream = null;
    }

    try {
      const newVideoStream = await this.acquireVideoCameraStream(nextFacing);
      this.videoSourceStream = newVideoStream;

      if (this.previewVideoElement) {
        this.previewVideoElement.srcObject = newVideoStream;
        this.previewVideoElement.muted = true;
        await this.previewVideoElement.play().catch(() => {});
      }

      const audioTracks = this.audioSourceStream?.getAudioTracks() || [];
      const newRecStream = new MediaStream([
        ...newVideoStream.getVideoTracks(),
        ...audioTracks,
      ]);
      this.mediaStream = newRecStream;
      this.mediaRecorder = this.createRecorder(newRecStream, 'video');
      this.mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          this.recordedChunks.push(e.data);
        }
      };
      if (!this.state.isPaused) {
        this.mediaRecorder.start(500);
      } else {
        this.mediaRecorder.start(500);
        this.mediaRecorder.pause();
      }

      this.state.facingMode = nextFacing;
      this.state.error = null;
      this.notify();
      return nextFacing;
    } catch {
      try {
        const fallbackStream = await this.acquireVideoCameraStream(this.state.facingMode);
        this.videoSourceStream = fallbackStream;
        if (this.previewVideoElement) {
          this.previewVideoElement.srcObject = fallbackStream;
          await this.previewVideoElement.play().catch(() => {});
        }
      } catch {
        // ignore
      }
      throw new Error("Impossible de basculer vers l'autre caméra sur cet appareil.");
    }
  }

  public pause(): void {
    if (this.mediaRecorder && this.state.isRecording && !this.state.isPaused) {
      if (this.mediaRecorder.state === 'recording') {
        this.mediaRecorder.pause();
      }
      this.pauseTimer();
      this.state.isPaused = true;
      this.notify();
    }
  }

  public resume(): void {
    if (this.mediaRecorder && this.state.isRecording && this.state.isPaused) {
      if (this.mediaRecorder.state === 'paused') {
        this.mediaRecorder.resume();
      }
      this.startTimer();
      this.state.isPaused = false;
      this.notify();
    }
  }

  public async stop(): Promise<{ blob: Blob; mimeType: string; duration: number }> {
    return new Promise((resolve, reject) => {
      if (!this.mediaRecorder) {
        reject(new Error('Aucun enregistrement en cours'));
        return;
      }

      const recorder = this.mediaRecorder;
      const fallbackMime = this.state.mode === 'audio' ? 'audio/webm' : 'video/webm';
      const mimeType = recorder.mimeType || this.recordedChunks[0]?.type || fallbackMime;
      const duration = Math.max(1, this.state.durationSeconds);

      const finalizeBlob = (): Blob => {
        const currentSeg = new Blob(this.recordedChunks, { type: mimeType });
        if (this.recordedSegments.length === 0) return currentSeg;
        return new Blob([...this.recordedSegments, currentSeg], { type: mimeType });
      };

      if (recorder.state === 'inactive') {
        const finalBlob = finalizeBlob();
        this.cleanup();
        this.state.isRecording = false;
        this.state.isPaused = false;
        this.state.audioLevel = 0;
        this.notify();
        resolve({ blob: finalBlob, mimeType, duration });
        return;
      }

      recorder.onstop = () => {
        const finalBlob = finalizeBlob();
        this.cleanup();
        this.state.isRecording = false;
        this.state.isPaused = false;
        this.state.audioLevel = 0;
        this.notify();
        resolve({ blob: finalBlob, mimeType, duration });
      };

      try {
        recorder.requestData();
      } catch {
        // Ignore if not supported
      }
      recorder.stop();
    });
  }

  public cancel(): void {
    try {
      if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
        this.mediaRecorder.onstop = null;
        this.mediaRecorder.stop();
      }
    } catch {
      // ignore
    }
    this.cleanup();
    this.state = {
      isRecording: false,
      isPaused: false,
      durationSeconds: 0,
      audioLevel: 0,
      mode: 'audio',
      facingMode: 'user',
      error: null,
    };
    this.notify();
  }

  private startTimer() {
    if (this.timerInterval) clearInterval(this.timerInterval);
    this.timerInterval = window.setInterval(() => {
      this.state.durationSeconds += 1;
      this.notify();
    }, 1000);
  }

  private pauseTimer() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  }

  private cleanup() {
    this.pauseTimer();
    if (this.visibilityListener) {
      document.removeEventListener('visibilitychange', this.visibilityListener);
      this.visibilityListener = null;
    }
    if (this.levelAnimFrame) {
      cancelAnimationFrame(this.levelAnimFrame);
      this.levelAnimFrame = null;
    }
    if (this.audioContext) {
      this.audioContext.close().catch(() => {});
      this.audioContext = null;
      this.analyser = null;
    }
    if (this.previewVideoElement) {
      this.previewVideoElement.srcObject = null;
      this.previewVideoElement = null;
    }

    [this.videoSourceStream, this.audioSourceStream, this.mediaStream].forEach((s) => {
      if (s) s.getTracks().forEach((track) => track.stop());
    });
    this.videoSourceStream = null;
    this.audioSourceStream = null;
    this.mediaStream = null;
    this.recordedChunks = [];
    this.recordedSegments = [];
  }
}
