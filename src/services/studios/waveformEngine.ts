// Real AudioBuffer Waveform Peak Extraction (WeakMap-cached) & High-DPI Clip Canvas Renderer

const PEAK_CACHE = new WeakMap<AudioBuffer, Map<number, Float32Array>>();

/**
 * Extracts normalized [0..1] amplitude peaks for an AudioBuffer across `bucketCount` columns.
 * Results are cached per AudioBuffer & bucketCount in a WeakMap to avoid stutter during zoom/drag.
 */
export function getWaveformPeaks(buffer: AudioBuffer, bucketCount = 180): Float32Array {
  const safeBuckets = Math.max(16, Math.min(1200, Math.round(bucketCount)));
  let byCount = PEAK_CACHE.get(buffer);
  if (!byCount) {
    byCount = new Map<number, Float32Array>();
    PEAK_CACHE.set(buffer, byCount);
  }
  const existing = byCount.get(safeBuckets);
  if (existing) return existing;

  const peaks = new Float32Array(safeBuckets);
  const channelCount = Math.max(1, buffer.numberOfChannels);
  const totalSamples = buffer.length;
  if (totalSamples === 0) {
    byCount.set(safeBuckets, peaks);
    return peaks;
  }

  const samplesPerBucket = Math.max(1, Math.floor(totalSamples / safeBuckets));
  const chData = buffer.getChannelData(0);
  const chData2 = channelCount > 1 ? buffer.getChannelData(1) : null;

  let globalMax = 0.001;
  for (let i = 0; i < safeBuckets; i++) {
    const start = i * samplesPerBucket;
    const end = Math.min(totalSamples, start + samplesPerBucket);
    const step = Math.max(1, Math.floor((end - start) / 16));
    let peak = 0;
    for (let s = start; s < end; s += step) {
      const v0 = Math.abs(chData[s] || 0);
      const v1 = chData2 ? Math.abs(chData2[s] || 0) : v0;
      const v = v0 > v1 ? v0 : v1;
      if (v > peak) peak = v;
    }
    peaks[i] = peak;
    if (peak > globalMax) globalMax = peak;
  }

  // Soft auto-normalize so quiet voice recordings still show clear readable waveforms
  const normFactor = globalMax < 0.55 ? 0.85 / Math.max(0.08, globalMax) : 1;
  if (normFactor !== 1) {
    for (let i = 0; i < safeBuckets; i++) {
      peaks[i] = Math.min(1, peaks[i] * normFactor);
    }
  }

  byCount.set(safeBuckets, peaks);
  return peaks;
}

export interface DrawClipWaveformOptions {
  trimStartSec: number;
  trimEndSec: number;
  fadeInSec?: number;
  fadeOutSec?: number;
  color: string;
  muted?: boolean;
  selected?: boolean;
}

/**
 * Renders the trimmed segment's real audio waveform + fade-in/fade-out gain envelope onto a <canvas>.
 */
export function drawClipWaveformCanvas(
  canvas: HTMLCanvasElement,
  buffer: AudioBuffer,
  options: DrawClipWaveformOptions
): void {
  const rect = canvas.getBoundingClientRect();
  const cssW = Math.max(24, Math.round(rect.width || canvas.clientWidth || 120));
  const cssH = Math.max(18, Math.round(rect.height || canvas.clientHeight || 40));
  const dpr = Math.min(2, typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1);

  if (canvas.width !== cssW * dpr || canvas.height !== cssH * dpr) {
    canvas.width = cssW * dpr;
    canvas.height = cssH * dpr;
  }

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  ctx.save();
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, cssW, cssH);

  const bufDur = Math.max(0.01, buffer.duration);
  const tStart = Math.max(0, Math.min(bufDur, options.trimStartSec));
  const tEnd = Math.max(tStart + 0.01, Math.min(bufDur, options.trimEndSec));
  const activeDur = tEnd - tStart;

  const fullPeaks = getWaveformPeaks(buffer, 320);
  const startIdx = Math.floor((tStart / bufDur) * fullPeaks.length);
  const endIdx = Math.max(startIdx + 1, Math.ceil((tEnd / bufDur) * fullPeaks.length));
  const sliceLen = endIdx - startIdx;

  const barStep = cssW > 180 ? 3 : 2.5;
  const barWidth = Math.max(1.2, barStep - 1);
  const numBars = Math.max(6, Math.floor(cssW / barStep));
  const midY = cssH / 2;
  const maxAmp = cssH * 0.42;

  const fadeInSec = Math.max(0, options.fadeInSec || 0);
  const fadeOutSec = Math.max(0, options.fadeOutSec || 0);

  ctx.fillStyle = options.muted
    ? 'rgba(148, 163, 184, 0.45)'
    : options.selected
      ? '#ffffff'
      : 'rgba(255, 255, 255, 0.88)';

  for (let b = 0; b < numBars; b++) {
    const ratio = (b + 0.5) / numBars;
    const peakIndex = Math.min(fullPeaks.length - 1, startIdx + Math.floor(ratio * sliceLen));
    let amp = fullPeaks[peakIndex] || 0.04;

    // Apply visual fade envelope gain multiplier so fade ramps reflect directly in waveform
    const localSec = ratio * activeDur;
    let env = 1;
    if (fadeInSec > 0 && localSec < fadeInSec) {
      env = Math.min(env, localSec / fadeInSec);
    }
    if (fadeOutSec > 0 && activeDur - localSec < fadeOutSec) {
      env = Math.min(env, Math.max(0, activeDur - localSec) / fadeOutSec);
    }
    amp *= 0.25 + 0.75 * env;

    const barH = Math.max(2, amp * maxAmp * 2);
    const x = b * barStep;
    ctx.fillRect(x, midY - barH / 2, barWidth, barH);
  }

  // Draw crisp fade-in and fade-out ramp triangles
  if (fadeInSec > 0.05) {
    const fw = Math.min(cssW * 0.48, (fadeInSec / activeDur) * cssW);
    ctx.fillStyle = 'rgba(15, 23, 42, 0.28)';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(fw, 0);
    ctx.lineTo(0, cssH);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = 'rgba(251, 191, 36, 0.9)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, cssH);
    ctx.lineTo(fw, 1);
    ctx.stroke();
  }

  if (fadeOutSec > 0.05) {
    const fw = Math.min(cssW * 0.48, (fadeOutSec / activeDur) * cssW);
    ctx.fillStyle = 'rgba(15, 23, 42, 0.28)';
    ctx.beginPath();
    ctx.moveTo(cssW, 0);
    ctx.lineTo(cssW - fw, 0);
    ctx.lineTo(cssW, cssH);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = 'rgba(251, 191, 36, 0.9)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(cssW - fw, 1);
    ctx.lineTo(cssW, cssH);
    ctx.stroke();
  }

  ctx.restore();
}
