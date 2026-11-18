// WebView & cross-browser Canvas 2D / WebAudio safety utilities for SHALOM Studios

export function drawRoundedRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  radius: number
): void {
  const safeW = Math.max(0, w);
  const safeH = Math.max(0, h);
  const r = Math.max(0, Math.min(radius, safeW / 2, safeH / 2));

  if (typeof (ctx as CanvasRenderingContext2D & { roundRect?: unknown }).roundRect === 'function') {
    try {
      ctx.roundRect(x, y, safeW, safeH, r);
      return;
    } catch {
      // Fall through to manual path
    }
  }

  ctx.moveTo(x + r, y);
  ctx.lineTo(x + safeW - r, y);
  ctx.quadraticCurveTo(x + safeW, y, x + safeW, y + r);
  ctx.lineTo(x + safeW, y + safeH - r);
  ctx.quadraticCurveTo(x + safeW, y + safeH, x + safeW - r, y + safeH);
  ctx.lineTo(x + r, y + safeH);
  ctx.quadraticCurveTo(x, y + safeH, x, y + safeH - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

export function safeSetLetterSpacing(ctx: CanvasRenderingContext2D, spacingPx: number): void {
  try {
    if ('letterSpacing' in ctx) {
      (ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = `${spacingPx}px`;
    }
  } catch {
    // Ignore unsupported WebView versions
  }
}

export function safeApplyCanvasFilter(ctx: CanvasRenderingContext2D, filterValue: string): void {
  try {
    if ('filter' in ctx) {
      ctx.filter = filterValue;
    }
  } catch {
    // Ignore unsupported WebView versions
  }
}

export function isDrawableMediaLoaded(
  media: HTMLImageElement | HTMLVideoElement | HTMLCanvasElement | null | undefined
): boolean {
  if (!media) return false;
  if (typeof HTMLImageElement !== 'undefined' && media instanceof HTMLImageElement) {
    return Boolean(media.complete && media.naturalWidth > 0 && media.naturalHeight > 0);
  }
  if (typeof HTMLVideoElement !== 'undefined' && media instanceof HTMLVideoElement) {
    return Boolean(media.readyState >= 2 && media.videoWidth > 0 && media.videoHeight > 0);
  }
  if (typeof HTMLCanvasElement !== 'undefined' && media instanceof HTMLCanvasElement) {
    return Boolean(media.width > 0 && media.height > 0);
  }
  const anyEl = media as unknown as {
    complete?: boolean;
    naturalWidth?: number;
    videoWidth?: number;
    width?: number;
  };
  if (typeof anyEl.naturalWidth === 'number') {
    return Boolean(anyEl.complete !== false && anyEl.naturalWidth > 0);
  }
  if (typeof anyEl.videoWidth === 'number') {
    return anyEl.videoWidth > 0;
  }
  return Boolean((anyEl.width || 0) > 0);
}

export function safeDrawMedia(
  ctx: CanvasRenderingContext2D,
  media: HTMLImageElement | HTMLVideoElement | HTMLCanvasElement | null | undefined,
  a1: number,
  a2: number,
  a3: number,
  a4: number,
  a5?: number,
  a6?: number,
  a7?: number,
  a8?: number
): boolean {
  if (!isDrawableMediaLoaded(media) || !media) return false;
  try {
    if (
      typeof a5 === 'number' &&
      typeof a6 === 'number' &&
      typeof a7 === 'number' &&
      typeof a8 === 'number'
    ) {
      ctx.drawImage(media, a1, a2, a3, a4, a5, a6, a7, a8);
    } else {
      ctx.drawImage(media, a1, a2, a3, a4);
    }
    return true;
  } catch {
    return false;
  }
}

export function createSafeAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const Ctx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctx) return null;
  try {
    return new Ctx();
  } catch {
    return null;
  }
}

export function classifyAppError(error: unknown): 'offline' | 'network' | 'runtime' {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return 'offline';
  }
  const msg = error instanceof Error ? `${error.name} ${error.message}` : String(error || '');
  if (/ChunkLoadError|Loading chunk|Failed to fetch dynamically imported module|NetworkError|ERR_INTERNET_DISCONNECTED|ERR_NETWORK_CHANGED/i.test(msg)) {
    return 'network';
  }
  return 'runtime';
}
