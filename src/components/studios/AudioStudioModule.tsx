import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import {
  Mic,
  Square,
  Upload,
  Music,
  Scissors,
  Trash2,
  Download,
  Share2,
  Save,
  Loader2,
  CheckCircle2,
  Volume2,
  VolumeX,
  Wand2,
  Play,
  Copy,
  Plus,
  Layers,
  Sliders,
  AlignLeft,
  Archive,
  Undo2,
  Redo2,
  ZoomIn,
  ZoomOut,
  Lock,
  Unlock,
  Flag,
  Sparkles,
  Eye,
  FolderOpen,
  FileAudio,
  Magnet,
  CheckSquare,
  X,
  ArrowUp,
  ArrowDown,
  Search,
  Globe,
  AlignCenter,
  AlignRight,
} from 'lucide-react';
import { Mp3Encoder } from '@breezystack/lamejs';
import { useShalomDB } from '../../hooks/useShalomDB';
import { dbService, STORES } from '../../services/db';
import { useLanguage } from '../../contexts/LanguageContext';
import { CreativeDesignItem, RecordedParole, SavedStudioTemplate, VaultDocument } from '../../types';
import { SocialShareModal } from '../common/SocialShareModal';
import { SharePayload, normalizeMediaToShareFile } from '../../services/socialShare';
import { downloadBlobToDevice, readFileAsVerifiedBlob, sanitizeFileName } from '../../services/fileTransfer';
import { loadStudioDraft, saveStudioDraft } from '../../services/studioPersistence';
import {
  saveOnlineTemplateLocally,
  deleteSavedOnlineTemplate,
} from '../../services/studioTemplatesStore';
import { Modal } from '../common/Modal';

interface AudioTrack {
  id: string;
  name: string;
  color: string;
  volume: number;
  muted: boolean;
  solo: boolean;
  locked?: boolean;
}

interface AudioClipItem {
  id: string;
  trackId: string;
  name: string;
  buffer: AudioBuffer;
  assetKey?: string;
  startTimeSec: number;
  trimStart: number;
  trimEnd: number;
  gain: number;
  pan: number;
  fadeInSec: number;
  fadeOutSec: number;
  playbackRate: number;
  removeSilence: boolean;
}

interface AudioMarker {
  id: string;
  timeSec: number;
  label: string;
  color: string;
}

interface AudioMasterFx {
  eqLowDb: number;
  eqMidDb: number;
  eqHighDb: number;
  reverbMix: number; // 0 to 0.7
}

interface AudioScriptStyle {
  bold: boolean;
  italic: boolean;
  underline: boolean;
  align: 'left' | 'center' | 'right';
}

const DEFAULT_SCRIPT_STYLE: AudioScriptStyle = {
  bold: false,
  italic: false,
  underline: false,
  align: 'left',
};

interface AudioSnapshot {
  tracks: AudioTrack[];
  clips: AudioClipItem[];
  markers: AudioMarker[];
  masterGain: number;
  masterFx: AudioMasterFx;
  scriptText: string;
  scriptStyle?: AudioScriptStyle;
}

interface SerializedAudioClip {
  id: string;
  trackId: string;
  name: string;
  assetKey: string;
  startTimeSec: number;
  trimStart: number;
  trimEnd: number;
  gain: number;
  pan: number;
  fadeInSec: number;
  fadeOutSec: number;
  playbackRate: number;
  removeSilence: boolean;
}

interface SerializedAudioProject {
  version: 2;
  tracks: AudioTrack[];
  clips: SerializedAudioClip[];
  markers: AudioMarker[];
  masterGain: number;
  masterFx: AudioMasterFx;
  scriptText: string;
  scriptStyle?: AudioScriptStyle;
}

const DEFAULT_TRACKS: AudioTrack[] = [
  { id: 'track_1', name: 'Piste 1 · Voix / Prédication', color: '#2563eb', volume: 1.0, muted: false, solo: false },
  { id: 'track_2', name: 'Piste 2 · Musique / Tapis', color: '#d97706', volume: 0.45, muted: false, solo: false },
  { id: 'track_3', name: 'Piste 3 · Effets / Cloches', color: '#059669', volume: 0.75, muted: false, solo: false },
];

const TRACK_COLORS = ['#2563eb', '#d97706', '#059669', '#9333ea', '#e11d48', '#0891b2'];

type SynthPresetId =
  | 'c_major'
  | 'g_warm'
  | 'a_minor'
  | 'soft_bell'
  | 'chime'
  | 'swell'
  | 'metronome'
  | 'silence';

interface AudioTemplateDef {
  id: string;
  titleFr: string;
  titleEn: string;
  descFr: string;
  descEn: string;
  category?: string;
  tags?: string[];
  source?: 'local' | 'online-catalog' | 'online-live';
  badgeColor: string;
  tracks: AudioTrack[];
  synthAdditions: Array<{
    preset: SynthPresetId;
    duration: number;
    trackId: string;
    name: string;
    startTimeSec: number;
    gain: number;
  }>;
  markers: AudioMarker[];
  scriptFr: string;
  scriptEn: string;
}

const AUDIO_TEMPLATES: AudioTemplateDef[] = [
  {
    id: 'podcast_exhortation',
    titleFr: 'Podcast & Exhortation',
    titleEn: 'Podcast & Exhortation',
    descFr: 'Carillon d’intro + Tapis Do majeur discret + 3 repères d’enregistrement.',
    descEn: 'Intro chime + gentle C Major bed + 3 recording cue markers.',
    category: 'Verset',
    tags: ['podcast', 'exhortation', 'psaume', 'verset'],
    source: 'local',
    badgeColor: '#2563eb',
    tracks: [
      { id: 'track_1', name: 'Voix Orateur', color: '#2563eb', volume: 1.05, muted: false, solo: false },
      { id: 'track_2', name: 'Tapis Musical Doux', color: '#d97706', volume: 0.35, muted: false, solo: false },
      { id: 'track_3', name: 'Transitions', color: '#059669', volume: 0.75, muted: false, solo: false },
    ],
    synthAdditions: [
      { preset: 'chime', duration: 3, trackId: 'track_3', name: 'Carillon Intro', startTimeSec: 0, gain: 0.9 },
      { preset: 'c_major', duration: 18, trackId: 'track_2', name: 'Tapis Do majeur', startTimeSec: 0.5, gain: 0.8 },
    ],
    markers: [
      { id: 'mk_1', timeSec: 0.5, label: 'Intro & Salutation', color: '#fbbf24' },
      { id: 'mk_2', timeSec: 4, label: 'Verset du jour', color: '#3b82f6' },
      { id: 'mk_3', timeSec: 12, label: 'Prière finale', color: '#10b981' },
    ],
    scriptFr: 'Shalom bien-aimés ! Aujourd’hui méditons ensemble sur Psaumes 23:1 : « L’Éternel est mon berger : je ne manquerai de rien. »\n\nPrenons un instant pour déposer nos fardeaux et accueillir Sa paix...',
    scriptEn: 'Shalom beloved! Today let us meditate on Psalm 23:1: "The Lord is my shepherd; I shall not want."\n\nTake a quiet moment to lay down every burden and receive His peace...',
  },
  {
    id: 'guided_meditation',
    titleFr: 'Méditation Guidée Paisible',
    titleEn: 'Peaceful Guided Meditation',
    descFr: 'Cloche d’ouverture + Accord Sol chaleureux prolongé + Réverb douce.',
    descEn: 'Opening bell + warm G Major ambient pad + gentle room reverb.',
    category: 'Méditation',
    tags: ['meditation', 'paix', 'priere', 'silence'],
    source: 'local',
    badgeColor: '#059669',
    tracks: [
      { id: 'track_1', name: 'Voix Douce', color: '#2563eb', volume: 1.0, muted: false, solo: false },
      { id: 'track_2', name: 'Ambiance Sol Majeur', color: '#059669', volume: 0.45, muted: false, solo: false },
    ],
    synthAdditions: [
      { preset: 'soft_bell', duration: 4, trackId: 'track_2', name: 'Cloche Paix', startTimeSec: 0, gain: 0.85 },
      { preset: 'g_warm', duration: 22, trackId: 'track_2', name: 'Accord Sol Chaleureux', startTimeSec: 1, gain: 0.85 },
    ],
    markers: [
      { id: 'mk_m1', timeSec: 0, label: 'Respiration & Silence', color: '#10b981' },
      { id: 'mk_m2', timeSec: 6, label: 'Lecture lente du verset', color: '#fbbf24' },
    ],
    scriptFr: 'Inspirez profondément… « Je vous laisse la paix, je vous donne ma paix. » (Jean 14:27)\n\nLaissez cette vérité descendre dans votre cœur sans hâte.',
    scriptEn: 'Breathe slowly… "Peace I leave with you, my peace I give to you." (John 14:27)\n\nLet this truth settle gently into your spirit.',
  },
  {
    id: 'church_announcement',
    titleFr: 'Annonce Église Dynamique',
    titleEn: 'Church Announcement',
    descFr: 'Montée sonore + Tapis lumineux court pour partager un événement.',
    descEn: 'Light swell + crisp upbeat bed to announce a church event.',
    category: 'Église',
    tags: ['eglise', 'annonce', 'culte', 'evenement'],
    source: 'local',
    badgeColor: '#d97706',
    tracks: [
      { id: 'track_1', name: 'Annonce Vocale', color: '#2563eb', volume: 1.1, muted: false, solo: false },
      { id: 'track_2', name: 'Fond Rythmique Doux', color: '#d97706', volume: 0.4, muted: false, solo: false },
    ],
    synthAdditions: [
      { preset: 'swell', duration: 3, trackId: 'track_2', name: 'Montée Intro', startTimeSec: 0, gain: 0.9 },
      { preset: 'c_major', duration: 12, trackId: 'track_2', name: 'Soutien Annonce', startTimeSec: 2.5, gain: 0.8 },
    ],
    markers: [
      { id: 'mk_a1', timeSec: 1.5, label: 'Titre & Date', color: '#f59e0b' },
      { id: 'mk_a2', timeSec: 8, label: 'Lieu & Invitation', color: '#3b82f6' },
    ],
    scriptFr: 'Rendez-vous spécial ce dimanche pour notre culte de louange et de prière ! Invitez un ami ou un membre de votre famille.',
    scriptEn: 'Join us this Sunday for a special worship and prayer service! Invite a friend or family member.',
  },
  {
    id: 'choir_harmony',
    titleFr: 'Chant & Répétition Chœur',
    titleEn: 'Worship & Harmony',
    descFr: 'Métronome 80 BPM + Accord La mineur + 2 pistes vocales séparées.',
    descEn: '80 BPM click track + A minor pad + dual vocal lanes.',
    category: 'Louange',
    tags: ['louange', 'chant', 'choeur', 'repetition'],
    source: 'local',
    badgeColor: '#9333ea',
    tracks: [
      { id: 'track_1', name: 'Voix Lead', color: '#2563eb', volume: 1.0, muted: false, solo: false },
      { id: 'track_2', name: 'Harmonie / Chœur', color: '#9333ea', volume: 0.85, muted: false, solo: false },
      { id: 'track_3', name: 'Accord & Métronome', color: '#d97706', volume: 0.45, muted: false, solo: false },
    ],
    synthAdditions: [
      { preset: 'metronome', duration: 12, trackId: 'track_3', name: 'Métronome 80 BPM', startTimeSec: 0, gain: 0.7 },
      { preset: 'a_minor', duration: 12, trackId: 'track_3', name: 'Accord La mineur', startTimeSec: 0, gain: 0.8 },
    ],
    markers: [
      { id: 'mk_c1', timeSec: 0, label: 'Décompte', color: '#9333ea' },
      { id: 'mk_c2', timeSec: 3, label: 'Couplet / Refrain', color: '#fbbf24' },
    ],
    scriptFr: 'Tonalité : La mineur · Tempo : 80 BPM.\nCouplet 1 puis Refrain à l’unisson.',
    scriptEn: 'Key: A Minor · Tempo: 80 BPM.\nVerse 1 followed by Chorus in harmony.',
  },
];

function encodeWavFromAudioBuffer(buffer: AudioBuffer): Blob {
  const numChannels = Math.min(2, buffer.numberOfChannels);
  const sampleRate = buffer.sampleRate;
  const length = buffer.length;
  const bytesPerSample = 2;
  const blockAlign = numChannels * bytesPerSample;
  const dataByteSize = length * blockAlign;
  const arrayBuffer = new ArrayBuffer(44 + dataByteSize);
  const view = new DataView(arrayBuffer);

  const writeStr = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + dataByteSize, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true);
  writeStr(36, 'data');
  view.setUint32(40, dataByteSize, true);

  const channels: Float32Array[] = [];
  for (let c = 0; c < numChannels; c++) {
    channels.push(buffer.getChannelData(c));
  }

  let offset = 44;
  for (let i = 0; i < length; i++) {
    for (let c = 0; c < numChannels; c++) {
      const sample = Math.max(-1, Math.min(1, channels[c][i]));
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
      offset += 2;
    }
  }

  return new Blob([arrayBuffer], { type: 'audio/wav' });
}

function encodeMp3FromAudioBuffer(buffer: AudioBuffer): Blob {
  const numChannels = Math.min(2, buffer.numberOfChannels);
  const sampleRate = buffer.sampleRate;
  const encoder = new Mp3Encoder(numChannels, sampleRate, 128);
  const mp3Chunks: BlobPart[] = [];

  const toInt16 = (floatArr: Float32Array) => {
    const out = new Int16Array(floatArr.length);
    for (let i = 0; i < floatArr.length; i++) {
      const s = Math.max(-1, Math.min(1, floatArr[i]));
      out[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }
    return out;
  };

  const left = toInt16(buffer.getChannelData(0));
  const right = numChannels > 1 ? toInt16(buffer.getChannelData(1)) : undefined;
  const blockSize = 1152;

  for (let i = 0; i < left.length; i += blockSize) {
    const lChunk = left.subarray(i, i + blockSize);
    const rChunk = right ? right.subarray(i, i + blockSize) : undefined;
    const encoded = encoder.encodeBuffer(lChunk, rChunk);
    if (encoded.length > 0) {
      mp3Chunks.push(new Uint8Array(encoded));
    }
  }

  const flushed = encoder.flush();
  if (flushed.length > 0) {
    mp3Chunks.push(new Uint8Array(flushed));
  }

  return new Blob(mp3Chunks, { type: 'audio/mpeg' });
}

function stripSilencesFromBuffer(
  ctx: BaseAudioContext,
  buffer: AudioBuffer,
  startSec: number,
  endSec: number
): AudioBuffer {
  const sr = buffer.sampleRate;
  const startIdx = Math.max(0, Math.floor(startSec * sr));
  const endIdx = Math.min(buffer.length, Math.floor(endSec * sr));
  const windowSize = Math.floor(sr * 0.05);
  const minSilentWindows = 6;
  const rmsThreshold = 0.012;

  const ch0 = buffer.getChannelData(0);
  const keepRanges: Array<[number, number]> = [];
  let silentRun = 0;
  let blockStart = startIdx;

  for (let pos = startIdx; pos < endIdx; pos += windowSize) {
    const winEnd = Math.min(endIdx, pos + windowSize);
    let sumSq = 0;
    for (let i = pos; i < winEnd; i++) {
      sumSq += ch0[i] * ch0[i];
    }
    const rms = Math.sqrt(sumSq / Math.max(1, winEnd - pos));
    if (rms < rmsThreshold) {
      silentRun++;
      if (silentRun === minSilentWindows) {
        const cutEnd = Math.max(blockStart, pos - windowSize * (minSilentWindows - 2));
        if (cutEnd > blockStart) keepRanges.push([blockStart, cutEnd]);
      }
    } else {
      if (silentRun >= minSilentWindows) {
        blockStart = Math.max(startIdx, pos - windowSize);
      }
      silentRun = 0;
    }
  }

  if (silentRun < minSilentWindows && endIdx > blockStart) {
    keepRanges.push([blockStart, endIdx]);
  }
  if (keepRanges.length === 0) {
    keepRanges.push([startIdx, endIdx]);
  }

  const totalSamples = keepRanges.reduce((acc, [a, b]) => acc + (b - a), 0);
  const out = ctx.createBuffer(buffer.numberOfChannels, Math.max(1, totalSamples), sr);
  for (let c = 0; c < buffer.numberOfChannels; c++) {
    const src = buffer.getChannelData(c);
    const dst = out.getChannelData(c);
    let writePos = 0;
    for (const [a, b] of keepRanges) {
      dst.set(src.subarray(a, b), writePos);
      writePos += b - a;
    }
  }
  return out;
}

function buildPreparedBuffer(ctx: BaseAudioContext, clip: AudioClipItem): AudioBuffer {
  const s = Math.max(0, Math.min(clip.trimStart, clip.buffer.duration - 0.05));
  const e = Math.max(s + 0.05, Math.min(clip.trimEnd, clip.buffer.duration));
  if (clip.removeSilence) {
    return stripSilencesFromBuffer(ctx, clip.buffer, s, e);
  }
  const startFrame = Math.floor(s * clip.buffer.sampleRate);
  const endFrame = Math.floor(e * clip.buffer.sampleRate);
  const frameCount = Math.max(1, endFrame - startFrame);
  const out = ctx.createBuffer(clip.buffer.numberOfChannels, frameCount, clip.buffer.sampleRate);
  for (let c = 0; c < clip.buffer.numberOfChannels; c++) {
    out.getChannelData(c).set(clip.buffer.getChannelData(c).subarray(startFrame, endFrame));
  }
  return out;
}

function createReverbImpulse(ctx: BaseAudioContext, seconds = 1.6, decay = 2.4): AudioBuffer {
  const rate = ctx.sampleRate;
  const length = Math.max(1, Math.floor(rate * seconds));
  const impulse = ctx.createBuffer(2, length, rate);
  for (let c = 0; c < 2; c++) {
    const data = impulse.getChannelData(c);
    for (let i = 0; i < length; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, decay);
    }
  }
  return impulse;
}

function synthesizePadBuffer(
  ctx: BaseAudioContext,
  preset: SynthPresetId,
  durationSec: number
): AudioBuffer {
  const sr = ctx.sampleRate;
  const len = Math.max(1, Math.floor(sr * durationSec));
  const buf = ctx.createBuffer(2, len, sr);
  if (preset === 'silence') return buf;

  const left = buf.getChannelData(0);
  const right = buf.getChannelData(1);

  if (preset === 'metronome') {
    const beatInterval = 60 / 80; // 80 BPM
    for (let i = 0; i < len; i++) {
      const t = i / sr;
      const inBeat = t % beatInterval;
      if (inBeat < 0.045) {
        const beatIndex = Math.floor(t / beatInterval);
        const freq = beatIndex % 4 === 0 ? 1100 : 760;
        const env = Math.exp(-inBeat * 75) * 0.35;
        const val = Math.sin(2 * Math.PI * freq * inBeat) * env;
        left[i] = val;
        right[i] = val;
      }
    }
    return buf;
  }

  if (preset === 'chime') {
    const notes = [523.25, 659.25, 783.99, 1046.5];
    for (let i = 0; i < len; i++) {
      const t = i / sr;
      let val = 0;
      notes.forEach((f, idx) => {
        const localT = t - idx * 0.25;
        if (localT >= 0) {
          val += Math.sin(2 * Math.PI * f * localT) * Math.exp(-localT * 2.2) * 0.14;
        }
      });
      left[i] = val;
      right[i] = val;
    }
    return buf;
  }

  if (preset === 'swell') {
    const freqs = [220, 277.18, 329.63, 440];
    for (let i = 0; i < len; i++) {
      const t = i / sr;
      const progress = t / Math.max(0.2, durationSec);
      const env = Math.sin(Math.PI * Math.min(1, progress)) * 0.2;
      let sL = 0;
      let sR = 0;
      freqs.forEach((f, idx) => {
        const w = Math.sin(2 * Math.PI * f * t);
        sL += w * (idx % 2 === 0 ? 1 : 0.7);
        sR += w * (idx % 2 === 1 ? 1 : 0.7);
      });
      left[i] = (sL / freqs.length) * env;
      right[i] = (sR / freqs.length) * env;
    }
    return buf;
  }

  const freqs =
    preset === 'c_major'
      ? [261.63, 329.63, 392.0, 523.25]
      : preset === 'g_warm'
        ? [196.0, 246.94, 293.66, 392.0]
        : preset === 'a_minor'
          ? [220.0, 261.63, 329.63, 440.0]
          : [523.25, 1046.5, 1567.98];

  for (let i = 0; i < len; i++) {
    const t = i / sr;
    const attack = Math.min(1, t / 0.4);
    const release = Math.min(1, (durationSec - t) / 0.6);
    const bellDecay = preset === 'soft_bell' ? Math.exp(-t * 1.4) : 1;
    const env = Math.max(0, Math.min(attack, release)) * bellDecay * 0.16;

    let sampleL = 0;
    let sampleR = 0;
    for (let fIdx = 0; fIdx < freqs.length; fIdx++) {
      const f = freqs[fIdx];
      const wave = Math.sin(2 * Math.PI * f * t);
      sampleL += wave * (fIdx % 2 === 0 ? 1.0 : 0.75);
      sampleR += wave * (fIdx % 2 === 1 ? 1.0 : 0.75);
    }
    left[i] = (sampleL / freqs.length) * env;
    right[i] = (sampleR / freqs.length) * env;
  }

  return buf;
}

function generateAudioCoverThumbnail(title: string, trackCount: number, durSec: number): string {
  const c = document.createElement('canvas');
  c.width = 480;
  c.height = 270;
  const ctx = c.getContext('2d');
  if (!ctx) return '';
  const g = ctx.createLinearGradient(0, 0, 480, 270);
  g.addColorStop(0, '#07132c');
  g.addColorStop(1, '#1d4ed8');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 480, 270);

  // Waveform bars visual
  ctx.fillStyle = '#fbbf24';
  for (let i = 0; i < 36; i++) {
    const h = 24 + Math.abs(Math.sin(i * 0.65)) * 88;
    ctx.fillRect(36 + i * 11, 145 - h / 2, 6, h);
  }
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 22px "Outfit", sans-serif';
  ctx.fillText((title || 'Projet Audio').slice(0, 28), 32, 48);
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.font = '600 14px "Outfit", sans-serif';
  ctx.fillText(`${trackCount} piste(s) · ${durSec.toFixed(1)}s · Studio Audio SHALOM`, 32, 236);
  return c.toDataURL('image/png');
}

const WaveformPreview: React.FC<{
  buffer: AudioBuffer;
  trimStart: number;
  trimEnd: number;
  color: string;
}> = ({ buffer, trimStart, trimEnd, color }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, w, h);

    const data = buffer.getChannelData(0);
    const step = Math.max(1, Math.floor(data.length / w));
    const mid = h / 2;
    const dur = Math.max(0.05, buffer.duration);
    const trimStartX = Math.floor((trimStart / dur) * w);
    const trimEndX = Math.floor((trimEnd / dur) * w);

    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    ctx.fillRect(trimStartX, 0, Math.max(2, trimEndX - trimStartX), h);

    for (let x = 0; x < w; x++) {
      let min = 1;
      let max = -1;
      const start = x * step;
      for (let j = 0; j < step; j++) {
        const val = data[start + j] || 0;
        if (val < min) min = val;
        if (val > max) max = val;
      }
      const inside = x >= trimStartX && x <= trimEndX;
      ctx.fillStyle = inside ? color : '#475569';
      const top = mid + min * mid * 0.9;
      const barH = Math.max(2, (max - min) * mid * 0.9);
      ctx.fillRect(x, top, 1, barH);
    }
  }, [buffer, trimStart, trimEnd, color]);

  return (
    <canvas
      ref={canvasRef}
      width={360}
      height={52}
      className="w-full h-13 rounded-xl border border-slate-700/70"
    />
  );
};

export const AudioStudioModule: React.FC = () => {
  const { lang } = useLanguage();
  const { recordings, creations, customTemplates, userProfile, reloadData } = useShalomDB();
  const isEn = lang === 'en';

  const savedAudioProjects = useMemo(
    () => creations.filter((c) => c.studioType === 'audio'),
    [creations]
  );
  const savedAudioTemplates = useMemo(
    () => customTemplates.filter((t) => t.studioType === 'audio'),
    [customTemplates]
  );

  const [currentProjectId, setCurrentProjectId] = useState<string | null>(null);
  const [projectTitle, setProjectTitle] = useState(
    isEn ? 'Untitled Audio Project' : 'Nouveau projet audio'
  );
  const [tracks, setTracks] = useState<AudioTrack[]>(DEFAULT_TRACKS);
  const [selectedTrackId, setSelectedTrackId] = useState<string>('track_1');
  const [clips, setClips] = useState<AudioClipItem[]>([]);
  const [selectedClipIds, setSelectedClipIds] = useState<string[]>([]);
  const [markers, setMarkers] = useState<AudioMarker[]>([]);
  const [masterGain, setMasterGain] = useState(1.0);
  const [masterFx, setMasterFx] = useState<AudioMasterFx>({
    eqLowDb: 0,
    eqMidDb: 0,
    eqHighDb: 0,
    reverbMix: 0.08,
  });
  const [scriptText, setScriptText] = useState('');
  const [scriptFontSize, setScriptFontSize] = useState(14);
  const [scriptStyle, setScriptStyle] = useState<AudioScriptStyle>(DEFAULT_SCRIPT_STYLE);

  // Canva-style tool tabs & zoom/snap
  const [activeToolTab, setActiveToolTab] = useState<
    'templates' | 'elements' | 'script' | 'fx' | 'projects'
  >('elements');
  const [zoomPxPerSec, setZoomPxPerSec] = useState(48);
  const [snapEnabled, setSnapEnabled] = useState(true);

  // Online templates search
  const [templateQuery, setTemplateQuery] = useState('');
  const [templateCategory, setTemplateCategory] = useState('all');
  const [onlineTemplates, setOnlineTemplates] = useState<AudioTemplateDef[]>([]);
  const [templatePage, setTemplatePage] = useState(1);
  const [templateHasMore, setTemplateHasMore] = useState(true);
  const [isSearchingOnline, setIsSearchingOnline] = useState(false);
  const [isLoadingMoreTemplates, setIsLoadingMoreTemplates] = useState(false);
  const [onlineStatusMsg, setOnlineStatusMsg] = useState<string | null>(null);

  // Undo / Redo stacks
  const [undoStack, setUndoStack] = useState<AudioSnapshot[]>([]);
  const [redoStack, setRedoStack] = useState<AudioSnapshot[]>([]);

  // Synthesis tool state
  const [synthPreset, setSynthPreset] = useState<SynthPresetId>('c_major');
  const [synthDuration, setSynthDuration] = useState(5);

  // Mic recording
  const [isRecordingMic, setIsRecordingMic] = useState(false);
  const [micSeconds, setMicSeconds] = useState(0);
  const micRecorderRef = useRef<MediaRecorder | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const micChunksRef = useRef<Blob[]>([]);
  const micTimerRef = useRef<number | null>(null);

  // Live preview playback
  const [isPlayingPreview, setIsPlayingPreview] = useState(false);
  const [playheadSec, setPlayheadSec] = useState(0);
  const previewSourcesRef = useRef<AudioBufferSourceNode[]>([]);
  const previewTimerRef = useRef<number | null>(null);
  const previewStartWallRef = useRef<number>(0);
  const previewStartOffsetRef = useRef<number>(0);

  // Final preview modal + Export
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [isSavingProject, setIsSavingProject] = useState(false);
  const [isRendering, setIsRendering] = useState(false);
  const [exportedUrl, setExportedUrl] = useState<string | null>(null);
  const [exportedBlob, setExportedBlob] = useState<Blob | null>(null);
  const [exportedFormat, setExportedFormat] = useState<'wav' | 'mp3'>('mp3');
  const [notice, setNotice] = useState<string | null>(null);
  const [sharePayload, setSharePayload] = useState<SharePayload | null>(null);

  // Auto-draft recovery prompt state
  const [recoverableDraft, setRecoverableDraft] = useState<boolean>(false);
  const draftLoadedRef = useRef(false);

  // Timeline drag ref
  const dragClipRef = useRef<{
    clipId: string;
    startClientX: number;
    origStartSec: number;
  } | null>(null);

  const audioCtxRef = useRef<AudioContext | null>(null);

  const getAudioCtx = useCallback(() => {
    if (!audioCtxRef.current || audioCtxRef.current.state === 'closed') {
      const Ctx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      audioCtxRef.current = new Ctx();
    }
    return audioCtxRef.current;
  }, []);

  const pushHistory = useCallback(() => {
    const snap: AudioSnapshot = {
      tracks: tracks.map((t) => ({ ...t })),
      clips: clips.map((c) => ({ ...c })),
      markers: markers.map((m) => ({ ...m })),
      masterGain,
      masterFx: { ...masterFx },
      scriptText,
      scriptStyle: { ...scriptStyle },
    };
    setUndoStack((prev) => [...prev.slice(-19), snap]);
    setRedoStack([]);
  }, [tracks, clips, markers, masterGain, masterFx, scriptText, scriptStyle]);

  const handleUndo = useCallback(() => {
    if (undoStack.length === 0) return;
    const prevSnap = undoStack[undoStack.length - 1];
    const currentSnap: AudioSnapshot = {
      tracks: tracks.map((t) => ({ ...t })),
      clips: clips.map((c) => ({ ...c })),
      markers: markers.map((m) => ({ ...m })),
      masterGain,
      masterFx: { ...masterFx },
      scriptText,
      scriptStyle: { ...scriptStyle },
    };
    setRedoStack((r) => [...r.slice(-19), currentSnap]);
    setUndoStack((u) => u.slice(0, -1));
    setTracks(prevSnap.tracks);
    setClips(prevSnap.clips);
    setMarkers(prevSnap.markers);
    setMasterGain(prevSnap.masterGain);
    setMasterFx(prevSnap.masterFx);
    setScriptText(prevSnap.scriptText);
    setScriptStyle(prevSnap.scriptStyle || DEFAULT_SCRIPT_STYLE);
  }, [undoStack, tracks, clips, markers, masterGain, masterFx, scriptText, scriptStyle]);

  const handleRedo = useCallback(() => {
    if (redoStack.length === 0) return;
    const nextSnap = redoStack[redoStack.length - 1];
    const currentSnap: AudioSnapshot = {
      tracks: tracks.map((t) => ({ ...t })),
      clips: clips.map((c) => ({ ...c })),
      markers: markers.map((m) => ({ ...m })),
      masterGain,
      masterFx: { ...masterFx },
      scriptText,
      scriptStyle: { ...scriptStyle },
    };
    setUndoStack((u) => [...u.slice(-19), currentSnap]);
    setRedoStack((r) => r.slice(0, -1));
    setTracks(nextSnap.tracks);
    setClips(nextSnap.clips);
    setMarkers(nextSnap.markers);
    setMasterGain(nextSnap.masterGain);
    setMasterFx(nextSnap.masterFx);
    setScriptText(nextSnap.scriptText);
    setScriptStyle(nextSnap.scriptStyle || DEFAULT_SCRIPT_STYLE);
  }, [redoStack, tracks, clips, markers, masterGain, masterFx, scriptText, scriptStyle]);

  // Keyboard shortcuts Undo/Redo/Delete
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) handleRedo();
        else handleUndo();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        handleRedo();
      } else if (e.key === 'Delete' && selectedClipIds.length > 0) {
        e.preventDefault();
        pushHistory();
        setClips((prev) => prev.filter((c) => !selectedClipIds.includes(c.id)));
        setSelectedClipIds([]);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleUndo, handleRedo, selectedClipIds, pushHistory]);

  // Check if auto-draft exists on initial mount
  useEffect(() => {
    if (draftLoadedRef.current) return;
    draftLoadedRef.current = true;
    loadStudioDraft('audio').then((d) => {
      if (d && d.projectJson) {
        setRecoverableDraft(true);
      }
    });
  }, []);

  useEffect(() => {
    return () => {
      if (micTimerRef.current) clearInterval(micTimerRef.current);
      if (previewTimerRef.current) clearInterval(previewTimerRef.current);
      previewSourcesRef.current.forEach((s) => {
        try {
          s.stop();
        } catch {
          // noop
        }
      });
      micStreamRef.current?.getTracks().forEach((t) => t.stop());
      if (exportedUrl) URL.revokeObjectURL(exportedUrl);
    };
  }, [exportedUrl]);

  // Ensure every clip's AudioBuffer is persisted into MEDIA_BLOBS once for fast save/draft
  const ensureClipAssetKey = async (clip: AudioClipItem): Promise<string> => {
    if (clip.assetKey) {
      const exists = await dbService.verifyMediaBlob(clip.assetKey);
      if (exists) return clip.assetKey;
    }
    const wavBlob = encodeWavFromAudioBuffer(clip.buffer);
    const key = `studio_audio_asset_${clip.id}_${Date.now()}`;
    await dbService.saveMediaBlob(key, wavBlob, 'audio/wav');
    clip.assetKey = key;
    return key;
  };

  const serializeCurrentProject = async (): Promise<{
    json: string;
    mediaAssetKeys: string[];
  }> => {
    const serializedClips: SerializedAudioClip[] = [];
    const assetKeys: string[] = [];

    for (const c of clips) {
      const key = await ensureClipAssetKey(c);
      assetKeys.push(key);
      serializedClips.push({
        id: c.id,
        trackId: c.trackId,
        name: c.name,
        assetKey: key,
        startTimeSec: c.startTimeSec,
        trimStart: c.trimStart,
        trimEnd: c.trimEnd,
        gain: c.gain,
        pan: c.pan,
        fadeInSec: c.fadeInSec,
        fadeOutSec: c.fadeOutSec,
        playbackRate: c.playbackRate,
        removeSilence: c.removeSilence,
      });
    }

    const payload: SerializedAudioProject = {
      version: 2,
      tracks,
      clips: serializedClips,
      markers,
      masterGain,
      masterFx,
      scriptText,
      scriptStyle,
    };
    return { json: JSON.stringify(payload), mediaAssetKeys: assetKeys };
  };

  const deserializeAndLoadProject = async (title: string, projectJson: string, projectId: string | null) => {
    const parsed = JSON.parse(projectJson) as SerializedAudioProject;
    const ctx = getAudioCtx();
    const restoredClips: AudioClipItem[] = [];

    for (const sc of parsed.clips || []) {
      const blob = await dbService.getMediaBlob(sc.assetKey);
      if (!blob) continue;
      try {
        const buf = await ctx.decodeAudioData((await blob.arrayBuffer()).slice(0));
        restoredClips.push({
          id: sc.id,
          trackId: sc.trackId,
          name: sc.name,
          buffer: buf,
          assetKey: sc.assetKey,
          startTimeSec: sc.startTimeSec,
          trimStart: sc.trimStart,
          trimEnd: Math.min(sc.trimEnd, buf.duration),
          gain: sc.gain,
          pan: sc.pan,
          fadeInSec: sc.fadeInSec,
          fadeOutSec: sc.fadeOutSec,
          playbackRate: sc.playbackRate,
          removeSilence: sc.removeSilence,
        });
      } catch {
        // skip corrupted clip
      }
    }

    setProjectTitle(title);
    setCurrentProjectId(projectId);
    setTracks(parsed.tracks?.length ? parsed.tracks : DEFAULT_TRACKS);
    if (parsed.tracks?.length) setSelectedTrackId(parsed.tracks[0].id);
    setClips(restoredClips);
    setMarkers(parsed.markers || []);
    setMasterGain(parsed.masterGain ?? 1.0);
    setMasterFx(parsed.masterFx || { eqLowDb: 0, eqMidDb: 0, eqHighDb: 0, reverbMix: 0.08 });
    setScriptText(parsed.scriptText || '');
    setScriptStyle(parsed.scriptStyle || DEFAULT_SCRIPT_STYLE);
    setSelectedClipIds(restoredClips[0] ? [restoredClips[0].id] : []);
    setUndoStack([]);
    setRedoStack([]);
  };

  // Debounced auto-draft saving when content changes
  useEffect(() => {
    if (clips.length === 0 && !scriptText.trim() && markers.length === 0) return;
    const timer = window.setTimeout(async () => {
      try {
        const { json, mediaAssetKeys } = await serializeCurrentProject();
        await saveStudioDraft('audio', projectTitle, json, mediaAssetKeys);
      } catch {
        // ignore background draft error
      }
    }, 2200);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tracks, clips, markers, masterGain, masterFx, scriptText, scriptStyle, projectTitle]);

  const handleRestoreDraft = async () => {
    const draft = await loadStudioDraft('audio');
    if (!draft) {
      setRecoverableDraft(false);
      return;
    }
    try {
      await deserializeAndLoadProject(draft.title || 'Brouillon Audio', draft.projectJson, null);
      setRecoverableDraft(false);
      setNotice(isEn ? 'Previous audio session restored.' : 'Brouillon audio restauré automatiquement !');
    } catch {
      setRecoverableDraft(false);
    }
  };

  const totalProjectDuration = useMemo(() => {
    if (clips.length === 0) return 0;
    return clips.reduce((maxEnd, clip) => {
      const effectiveDur = Math.max(0.05, clip.trimEnd - clip.trimStart) / clip.playbackRate;
      return Math.max(maxEnd, clip.startTimeSec + effectiveDur);
    }, 0);
  }, [clips]);

  const getNextStartForTrack = (trackId: string, currentClips = clips) => {
    const trackClips = currentClips.filter((c) => c.trackId === trackId);
    if (trackClips.length === 0) return 0;
    return Number(
      trackClips
        .reduce((maxEnd, c) => {
          const d = Math.max(0.05, c.trimEnd - c.trimStart) / c.playbackRate;
          return Math.max(maxEnd, c.startTimeSec + d);
        }, 0)
        .toFixed(2)
    );
  };

  const addBufferAsClip = (
    buffer: AudioBuffer,
    name: string,
    targetTrackId?: string,
    explicitStartSec?: number,
    explicitGain = 1.0
  ) => {
    const tId = targetTrackId || selectedTrackId;
    const startAt = explicitStartSec !== undefined ? explicitStartSec : getNextStartForTrack(tId);
    const id = `clip_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const item: AudioClipItem = {
      id,
      trackId: tId,
      name,
      buffer,
      startTimeSec: startAt,
      trimStart: 0,
      trimEnd: Number(buffer.duration.toFixed(2)),
      gain: explicitGain,
      pan: 0,
      fadeInSec: 0.05,
      fadeOutSec: 0.1,
      playbackRate: 1.0,
      removeSilence: false,
    };
    setClips((prev) => [...prev, item]);
    setSelectedClipIds([id]);
  };

  const decodeBlobToClip = async (blob: Blob, name: string, targetTrackId?: string) => {
    const ctx = getAudioCtx();
    const arr = await blob.arrayBuffer();
    const buffer = await ctx.decodeAudioData(arr.slice(0));
    pushHistory();
    addBufferAsClip(buffer, name, targetTrackId);
  };

  const handleApplyTemplate = async (
    tpl: AudioTemplateDef,
    options?: { skipPersist?: boolean }
  ) => {
    pushHistory();
    const ctx = getAudioCtx();
    const nextTracks = tpl.tracks.map((t) => ({ ...t }));
    const nextClips: AudioClipItem[] = tpl.synthAdditions.map((sa, idx) => {
      const buf = synthesizePadBuffer(ctx, sa.preset, sa.duration);
      return {
        id: `clip_${Date.now()}_${idx}`,
        trackId: sa.trackId,
        name: sa.name,
        buffer: buf,
        startTimeSec: sa.startTimeSec,
        trimStart: 0,
        trimEnd: Number(buf.duration.toFixed(2)),
        gain: sa.gain,
        pan: 0,
        fadeInSec: 0.15,
        fadeOutSec: 0.4,
        playbackRate: 1.0,
        removeSilence: false,
      };
    });
    setTracks(nextTracks);
    setSelectedTrackId(nextTracks[0].id);
    setClips(nextClips);
    setMarkers(tpl.markers.map((m) => ({ ...m })));
    setScriptText(isEn ? tpl.scriptEn : tpl.scriptFr);
    setProjectTitle(isEn ? tpl.titleEn : tpl.titleFr);
    setSelectedClipIds(nextClips[0] ? [nextClips[0].id] : []);

    const isOnlineTpl =
      Boolean(tpl.source && tpl.source !== 'local') ||
      tpl.id.startsWith('live_') ||
      tpl.id.startsWith('proc_') ||
      tpl.id.startsWith('online_');
    if (isOnlineTpl && !options?.skipPersist) {
      try {
        await saveOnlineTemplateLocally({
          id: tpl.id,
          studioType: 'audio',
          title: isEn ? tpl.titleEn : tpl.titleFr,
          category: tpl.category || 'En ligne',
          templateObj: tpl,
          previewColor: tpl.badgeColor,
          source: tpl.source,
        });
        reloadData();
      } catch {
        // non-fatal
      }
    }

    setNotice(
      isEn
        ? `Template "${tpl.titleEn}" loaded${isOnlineTpl && !options?.skipPersist ? ' and kept in My Templates' : ''}!`
        : `Modèle « ${tpl.titleFr} » chargé${isOnlineTpl && !options?.skipPersist ? ' et conservé dans Vos modèles' : ''} !`
    );
  };

  const handleApplySavedOnlineTemplate = async (savedItem: SavedStudioTemplate) => {
    try {
      const parsed = JSON.parse(savedItem.templateJson) as AudioTemplateDef;
      await handleApplyTemplate(parsed, { skipPersist: true });
    } catch {
      setNotice(isEn ? 'Could not load saved template.' : 'Impossible d’ouvrir ce modèle enregistré.');
    }
  };

  const handleDeleteSavedOnlineTemplate = async (id: string) => {
    await deleteSavedOnlineTemplate(id);
    reloadData();
  };

  const handleImportAudioFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    for (let i = 0; i < files.length; i++) {
      try {
        const verified = await readFileAsVerifiedBlob(files[i]);
        await decodeBlobToClip(verified.blob, verified.fileName);
        setNotice(
          isEn
            ? `Imported "${verified.fileName}" cleanly.`
            : `Son « ${verified.fileName} » importé sur la timeline.`
        );
      } catch (err) {
        setNotice(
          err instanceof Error
            ? err.message
            : isEn
              ? `Could not decode ${files[i].name}.`
              : `Impossible de décoder ${files[i].name}.`
        );
      }
    }
    e.target.value = '';
  };

  const handleImportFromParole = async (recId: string) => {
    const rec = recordings.find((r) => r.id === recId);
    if (!rec?.blobKey) return;
    const blob = await dbService.getMediaBlob(rec.blobKey);
    if (!blob) return;
    try {
      await decodeBlobToClip(blob, rec.title);
      setNotice(isEn ? `Added "${rec.title}" to track.` : `« ${rec.title} » ajouté à la piste.`);
    } catch {
      setNotice(
        isEn
          ? 'This recording could not be decoded in Audio Studio.'
          : 'Cet enregistrement n’a pas pu être décodé dans le studio.'
      );
    }
  };

  const handleGenerateSynthClip = (overridePreset?: SynthPresetId) => {
    const presetToUse = overridePreset || synthPreset;
    const ctx = getAudioCtx();
    const dur = Math.max(1, Math.min(30, synthDuration));
    const buf = synthesizePadBuffer(ctx, presetToUse, dur);
    const labelMap: Record<SynthPresetId, string> = {
      silence: `Silence (${dur}s)`,
      c_major: `Accord Do majeur (${dur}s)`,
      g_warm: `Accord Sol chaleureux (${dur}s)`,
      a_minor: `Accord La mineur (${dur}s)`,
      soft_bell: `Cloche méditation (${dur}s)`,
      chime: `Carillon transition (${dur}s)`,
      swell: `Montée lumineuse (${dur}s)`,
      metronome: `Métronome 80 BPM (${dur}s)`,
    };
    pushHistory();
    addBufferAsClip(buf, labelMap[presetToUse]);
  };

  const handleToggleMicRecord = async () => {
    if (isRecordingMic) {
      micRecorderRef.current?.stop();
      setIsRecordingMic(false);
      if (micTimerRef.current) clearInterval(micTimerRef.current);
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      micStreamRef.current = stream;
      micChunksRef.current = [];
      const recorder = new MediaRecorder(stream);
      micRecorderRef.current = recorder;

      recorder.ondataavailable = (ev) => {
        if (ev.data.size > 0) micChunksRef.current.push(ev.data);
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(micChunksRef.current, { type: recorder.mimeType || 'audio/webm' });
        await decodeBlobToClip(blob, `${isEn ? 'Mic Take' : 'Prise micro'} #${clips.length + 1}`);
      };

      recorder.start(250);
      setIsRecordingMic(true);
      setMicSeconds(0);
      micTimerRef.current = window.setInterval(() => setMicSeconds((s) => s + 1), 1000);
    } catch {
      setNotice(
        isEn
          ? 'Microphone permission denied or unavailable.'
          : 'Accès au microphone refusé ou indisponible.'
      );
    }
  };

  const handleAddTrack = () => {
    pushHistory();
    const nextIdx = tracks.length + 1;
    const newId = `track_${Date.now()}`;
    setTracks((prev) => [
      ...prev,
      {
        id: newId,
        name: `Piste ${nextIdx}`,
        color: TRACK_COLORS[(nextIdx - 1) % TRACK_COLORS.length],
        volume: 1.0,
        muted: false,
        solo: false,
      },
    ]);
    setSelectedTrackId(newId);
  };

  const updateTrack = (id: string, patch: Partial<AudioTrack>) => {
    setTracks((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  };

  const removeTrack = (id: string) => {
    if (tracks.length <= 1) return;
    pushHistory();
    setTracks((prev) => prev.filter((t) => t.id !== id));
    setClips((prev) => prev.filter((c) => c.trackId !== id));
    if (selectedTrackId === id) {
      const remaining = tracks.find((t) => t.id !== id);
      if (remaining) setSelectedTrackId(remaining.id);
    }
  };

  const moveTrackOrder = (trackId: string, dir: -1 | 1) => {
    const idx = tracks.findIndex((t) => t.id === trackId);
    const target = idx + dir;
    if (idx === -1 || target < 0 || target >= tracks.length) return;
    pushHistory();
    setTracks((prev) => {
      const next = [...prev];
      const temp = next[idx];
      next[idx] = next[target];
      next[target] = temp;
      return next;
    });
  };

  const handleSearchOnlineTemplates = useCallback(
    async (overrideQuery?: string, overrideCat?: string, appendPage?: number) => {
      const q = (overrideQuery !== undefined ? overrideQuery : templateQuery).trim();
      const cat = overrideCat !== undefined ? overrideCat : templateCategory;
      const targetPage = appendPage && appendPage > 1 ? appendPage : 1;
      const isAppend = targetPage > 1;
      if (isAppend) {
        setIsLoadingMoreTemplates(true);
      } else {
        setIsSearchingOnline(true);
        setOnlineStatusMsg(null);
      }
      try {
        const excludeTitles = isAppend
          ? onlineTemplates.map((t) => (isEn ? t.titleEn : t.titleFr))
          : [];
        const res = await fetch('/api/studios/templates/search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            studioType: 'audio',
            query: q,
            category: cat,
            lang: isEn ? 'en' : 'fr',
            page: targetPage,
            excludeTitles,
          }),
        });
        const data = await res.json();
        if (res.ok && data?.ok && Array.isArray(data.templates)) {
          const incoming = (data.templates as AudioTemplateDef[]).map((tpl) => ({
            ...tpl,
            source: tpl.source || ('online-catalog' as const),
          }));
          setTemplatePage(targetPage);
          setTemplateHasMore(data.hasMore !== false);
          let nextTotal = incoming.length;
          setOnlineTemplates((prev) => {
            if (!isAppend) return incoming;
            const seen = new Set(prev.map((t) => t.id));
            const merged = [...prev, ...incoming.filter((t) => !seen.has(t.id))];
            nextTotal = merged.length;
            return merged;
          });
          setOnlineStatusMsg(
            isEn
              ? `${nextTotal} online audio template(s) loaded.`
              : `${nextTotal} modèle(s) audio chargé(s) en ligne.`
          );
        } else {
          setOnlineStatusMsg(
            isEn ? 'Online search unavailable right now.' : 'Catalogue en ligne temporairement indisponible.'
          );
        }
      } catch {
        setOnlineStatusMsg(
          isEn ? 'Offline mode: showing local & saved templates.' : 'Mode hors-ligne : modèles locaux et conservés affichés.'
        );
      } finally {
        setIsSearchingOnline(false);
        setIsLoadingMoreTemplates(false);
      }
    },
    [templateQuery, templateCategory, isEn, onlineTemplates]
  );

  useEffect(() => {
    if (activeToolTab === 'templates' && onlineTemplates.length === 0 && !isSearchingOnline) {
      handleSearchOnlineTemplates('', 'all', 1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeToolTab]);

  const displayedAudioTemplates = useMemo(() => {
    const q = templateQuery.trim().toLowerCase();
    const cat = templateCategory;
    const matchFn = (tpl: AudioTemplateDef) => {
      const catMatch =
        cat === 'all' || (tpl.category || '').toLowerCase() === cat.toLowerCase();
      if (!catMatch) return false;
      if (!q) return true;
      const hay = `${tpl.titleFr} ${tpl.titleEn} ${tpl.descFr} ${tpl.category || ''} ${(tpl.tags || []).join(' ')}`.toLowerCase();
      return hay.includes(q);
    };
    const seen = new Set<string>();
    const combined: AudioTemplateDef[] = [];
    for (const tpl of onlineTemplates) {
      if (!seen.has(tpl.id)) {
        seen.add(tpl.id);
        combined.push(tpl);
      }
    }
    for (const tpl of AUDIO_TEMPLATES) {
      if (matchFn(tpl) && !seen.has(tpl.id)) {
        seen.add(tpl.id);
        combined.push(tpl);
      }
    }
    return combined;
  }, [onlineTemplates, templateQuery, templateCategory]);

  const updateClip = (id: string, patch: Partial<AudioClipItem>) => {
    setClips((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  };

  const duplicateClip = (clip: AudioClipItem) => {
    pushHistory();
    const dur = Math.max(0.05, clip.trimEnd - clip.trimStart) / clip.playbackRate;
    const newId = `clip_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    setClips((prev) => [
      ...prev,
      {
        ...clip,
        id: newId,
        name: `${clip.name} (copie)`,
        startTimeSec: Number((clip.startTimeSec + dur).toFixed(2)),
      },
    ]);
    setSelectedClipIds([newId]);
  };

  const splitSelectedClipAtPlayhead = () => {
    if (selectedClipIds.length !== 1) return;
    const target = clips.find((c) => c.id === selectedClipIds[0]);
    if (!target) return;
    const effectiveDur = Math.max(0.05, target.trimEnd - target.trimStart) / target.playbackRate;
    const clipEnd = target.startTimeSec + effectiveDur;
    if (playheadSec <= target.startTimeSec + 0.1 || playheadSec >= clipEnd - 0.1) {
      setNotice(
        isEn
          ? 'Move the red playhead inside the selected clip to split it.'
          : 'Placez la tête de lecture rouge à l’intérieur de l’extrait sélectionné pour le scinder.'
      );
      return;
    }

    pushHistory();
    const cutSourceOffset = (playheadSec - target.startTimeSec) * target.playbackRate;
    const splitPointInBuf = Number((target.trimStart + cutSourceOffset).toFixed(2));
    const rightId = `clip_${Date.now()}_r`;

    const leftPart: AudioClipItem = {
      ...target,
      trimEnd: splitPointInBuf,
    };
    const rightPart: AudioClipItem = {
      ...target,
      id: rightId,
      name: `${target.name} (2)`,
      startTimeSec: Number(playheadSec.toFixed(2)),
      trimStart: splitPointInBuf,
    };

    setClips((prev) => prev.flatMap((c) => (c.id === target.id ? [leftPart, rightPart] : [c])));
    setSelectedClipIds([rightId]);
    setNotice(isEn ? 'Clip split at playhead!' : 'Extrait scindé à la tête de lecture !');
  };

  const removeClip = (id: string) => {
    pushHistory();
    setClips((prev) => prev.filter((c) => c.id !== id));
    setSelectedClipIds((prev) => prev.filter((x) => x !== id));
  };

  const duplicateSelectedBatch = () => {
    if (selectedClipIds.length === 0) return;
    pushHistory();
    const newIds: string[] = [];
    const additions: AudioClipItem[] = [];
    clips
      .filter((c) => selectedClipIds.includes(c.id))
      .forEach((c, idx) => {
        const dur = Math.max(0.05, c.trimEnd - c.trimStart) / c.playbackRate;
        const nid = `clip_${Date.now()}_${idx}`;
        newIds.push(nid);
        additions.push({
          ...c,
          id: nid,
          name: `${c.name} (copie)`,
          startTimeSec: Number((c.startTimeSec + dur).toFixed(2)),
        });
      });
    setClips((prev) => [...prev, ...additions]);
    setSelectedClipIds(newIds);
  };

  const shiftSelectedBatch = (deltaSec: number) => {
    if (selectedClipIds.length === 0) return;
    pushHistory();
    setClips((prev) =>
      prev.map((c) =>
        selectedClipIds.includes(c.id)
          ? { ...c, startTimeSec: Math.max(0, Number((c.startTimeSec + deltaSec).toFixed(2))) }
          : c
      )
    );
  };

  const deleteSelectedBatch = () => {
    if (selectedClipIds.length === 0) return;
    pushHistory();
    setClips((prev) => prev.filter((c) => !selectedClipIds.includes(c.id)));
    setSelectedClipIds([]);
  };

  const chainTrackSequentially = (trackId: string) => {
    pushHistory();
    let cursor = 0;
    setClips((prev) =>
      prev.map((c) => {
        if (c.trackId !== trackId) return c;
        const updated = { ...c, startTimeSec: Number(cursor.toFixed(2)) };
        cursor += Math.max(0.05, c.trimEnd - c.trimStart) / c.playbackRate;
        return updated;
      })
    );
  };

  const addMarkerAtPlayhead = () => {
    pushHistory();
    const label = isEn ? `Cue ${markers.length + 1}` : `Repère ${markers.length + 1}`;
    setMarkers((prev) => [
      ...prev,
      {
        id: `mk_${Date.now()}`,
        timeSec: Number(playheadSec.toFixed(2)),
        label,
        color: TRACK_COLORS[prev.length % TRACK_COLORS.length],
      },
    ]);
  };

  const hasAnySolo = tracks.some((t) => t.solo);

  const isTrackAudible = (track: AudioTrack | undefined) => {
    if (!track) return false;
    if (track.muted) return false;
    if (hasAnySolo && !track.solo) return false;
    return true;
  };

  // Builds shared Master EQ + Reverb bus
  const createMasterBus = (ctx: BaseAudioContext) => {
    const busInput = ctx.createGain();
    busInput.gain.value = masterGain;

    const lowFilter = ctx.createBiquadFilter();
    lowFilter.type = 'lowshelf';
    lowFilter.frequency.value = 120;
    lowFilter.gain.value = masterFx.eqLowDb;

    const midFilter = ctx.createBiquadFilter();
    midFilter.type = 'peaking';
    midFilter.frequency.value = 1000;
    midFilter.Q.value = 1.0;
    midFilter.gain.value = masterFx.eqMidDb;

    const highFilter = ctx.createBiquadFilter();
    highFilter.type = 'highshelf';
    highFilter.frequency.value = 6500;
    highFilter.gain.value = masterFx.eqHighDb;

    busInput.connect(lowFilter);
    lowFilter.connect(midFilter);
    midFilter.connect(highFilter);

    const dryGain = ctx.createGain();
    dryGain.gain.value = Math.max(0.25, 1 - masterFx.reverbMix * 0.5);
    highFilter.connect(dryGain);
    dryGain.connect(ctx.destination);

    if (masterFx.reverbMix > 0.01) {
      const convolver = ctx.createConvolver();
      convolver.buffer = createReverbImpulse(ctx, 1.6, 2.5);
      const wetGain = ctx.createGain();
      wetGain.gain.value = masterFx.reverbMix;
      highFilter.connect(convolver);
      convolver.connect(wetGain);
      wetGain.connect(ctx.destination);
    }

    return busInput;
  };

  const stopPreview = () => {
    if (previewTimerRef.current) {
      clearInterval(previewTimerRef.current);
      previewTimerRef.current = null;
    }
    previewSourcesRef.current.forEach((src) => {
      try {
        src.stop();
      } catch {
        // noop
      }
    });
    previewSourcesRef.current = [];
    setIsPlayingPreview(false);
  };

  const handleTogglePreview = async () => {
    if (isPlayingPreview) {
      stopPreview();
      return;
    }
    if (clips.length === 0) return;

    const ctx = getAudioCtx();
    if (ctx.state === 'suspended') await ctx.resume();

    const startOffset = playheadSec >= Math.max(0.2, totalProjectDuration - 0.1) ? 0 : playheadSec;
    if (startOffset === 0) setPlayheadSec(0);

    const now = ctx.currentTime + 0.05;
    const masterBus = createMasterBus(ctx);
    const sources: AudioBufferSourceNode[] = [];

    for (const clip of clips) {
      const track = tracks.find((t) => t.id === clip.trackId);
      if (!isTrackAudible(track)) continue;

      const prepared = buildPreparedBuffer(ctx, clip);
      const realDur = prepared.duration / clip.playbackRate;
      const clipEnd = clip.startTimeSec + realDur;
      if (clipEnd <= startOffset) continue;

      const src = ctx.createBufferSource();
      src.buffer = prepared;
      src.playbackRate.value = clip.playbackRate;

      const gainNode = ctx.createGain();
      const targetVol = Math.max(0, clip.gain * (track?.volume ?? 1));
      const clipSkipSec = Math.max(0, startOffset - clip.startTimeSec);
      const delaySec = Math.max(0, clip.startTimeSec - startOffset);
      const startAt = now + delaySec;

      const fadeIn = Math.min(clip.fadeInSec, realDur / 2);
      const fadeOut = Math.min(clip.fadeOutSec, realDur / 2);
      const remainingRealDur = realDur - clipSkipSec;

      if (clipSkipSec === 0 && fadeIn > 0.01) {
        gainNode.gain.setValueAtTime(0.001, startAt);
        gainNode.gain.linearRampToValueAtTime(targetVol, startAt + fadeIn);
      } else {
        gainNode.gain.setValueAtTime(targetVol, startAt);
      }

      if (fadeOut > 0.01 && remainingRealDur > fadeOut) {
        const fadeOutStart = startAt + remainingRealDur - fadeOut;
        gainNode.gain.setValueAtTime(targetVol, fadeOutStart);
        gainNode.gain.linearRampToValueAtTime(0.001, startAt + remainingRealDur);
      }

      if (typeof ctx.createStereoPanner === 'function') {
        const panner = ctx.createStereoPanner();
        panner.pan.value = clip.pan;
        src.connect(gainNode);
        gainNode.connect(panner);
        panner.connect(masterBus);
      } else {
        src.connect(gainNode);
        gainNode.connect(masterBus);
      }

      const bufferOffset = clipSkipSec * clip.playbackRate;
      src.start(startAt, Math.min(prepared.duration - 0.02, bufferOffset));
      sources.push(src);
    }

    previewSourcesRef.current = sources;
    previewStartWallRef.current = performance.now();
    previewStartOffsetRef.current = startOffset;
    setIsPlayingPreview(true);

    previewTimerRef.current = window.setInterval(() => {
      const elapsed = previewStartOffsetRef.current + (performance.now() - previewStartWallRef.current) / 1000;
      if (elapsed >= totalProjectDuration + 0.1) {
        stopPreview();
        setPlayheadSec(0);
      } else {
        setPlayheadSec(elapsed);
      }
    }, 50);
  };

  const renderAudioMixBlob = async (
    format: 'wav' | 'mp3'
  ): Promise<{ blob: Blob; format: 'wav' | 'mp3' } | null> => {
    if (clips.length === 0) return null;
    stopPreview();
    setIsRendering(true);
    setNotice(null);

    try {
      const sampleRate = 44100;
      const baseCtx = getAudioCtx();

      const preparedClips = clips
        .map((clip) => {
          const track = tracks.find((t) => t.id === clip.trackId);
          if (!isTrackAudible(track)) return null;
          const prepared = buildPreparedBuffer(baseCtx, clip);
          return { clip, track: track!, prepared };
        })
        .filter((x): x is NonNullable<typeof x> => x !== null);

      if (preparedClips.length === 0) {
        throw new Error(
          isEn
            ? 'All tracks are muted. Unmute at least one track to export.'
            : 'Toutes les pistes sont en sourdine. Activez au moins une piste.'
        );
      }

      const maxDur = preparedClips.reduce((acc, item) => {
        const realDur = item.prepared.duration / item.clip.playbackRate;
        return Math.max(acc, item.clip.startTimeSec + realDur);
      }, 0.5);

      const totalFrames = Math.ceil((maxDur + 0.3) * sampleRate);
      const offline = new OfflineAudioContext(2, totalFrames, sampleRate);
      const masterBus = createMasterBus(offline);

      for (const { clip, track, prepared } of preparedClips) {
        const src = offline.createBufferSource();
        src.buffer = prepared;
        src.playbackRate.value = clip.playbackRate;

        const gainNode = offline.createGain();
        const targetVol = Math.max(0, clip.gain * track.volume);
        const realDur = prepared.duration / clip.playbackRate;
        const startAt = Math.max(0, clip.startTimeSec);
        const fadeIn = Math.min(clip.fadeInSec, realDur / 2);
        const fadeOut = Math.min(clip.fadeOutSec, realDur / 2);

        if (fadeIn > 0.01) {
          gainNode.gain.setValueAtTime(0.001, startAt);
          gainNode.gain.linearRampToValueAtTime(targetVol, startAt + fadeIn);
        } else {
          gainNode.gain.setValueAtTime(targetVol, startAt);
        }

        if (fadeOut > 0.01) {
          const fadeOutStart = Math.max(startAt + fadeIn, startAt + realDur - fadeOut);
          gainNode.gain.setValueAtTime(targetVol, fadeOutStart);
          gainNode.gain.linearRampToValueAtTime(0.001, startAt + realDur);
        }

        const panner = offline.createStereoPanner();
        panner.pan.value = clip.pan;
        src.connect(gainNode);
        gainNode.connect(panner);
        panner.connect(masterBus);
        src.start(startAt);
      }

      const rendered = await offline.startRendering();
      const outBlob =
        format === 'wav' ? encodeWavFromAudioBuffer(rendered) : encodeMp3FromAudioBuffer(rendered);
      return { blob: outBlob, format };
    } catch (err: unknown) {
      setNotice(err instanceof Error ? err.message : 'Erreur audio');
      return null;
    } finally {
      setIsRendering(false);
    }
  };

  const handleMixAndExport = async (format: 'wav' | 'mp3') => {
    const res = await renderAudioMixBlob(format);
    if (!res) return;
    if (exportedUrl) URL.revokeObjectURL(exportedUrl);
    const url = URL.createObjectURL(res.blob);
    setExportedUrl(url);
    setExportedBlob(res.blob);
    setExportedFormat(res.format);
    setNotice(
      isEn
        ? `Audio mixed & exported (${res.format.toUpperCase()})!`
        : `Mixage terminé avec EQ/Réverb et prêt en ${res.format.toUpperCase()} !`
    );
  };

  const handleSaveEditableProject = async () => {
    setIsSavingProject(true);
    try {
      const { json, mediaAssetKeys } = await serializeCurrentProject();
      const id = currentProjectId || `proj_audio_${Date.now()}`;
      const existing = savedAudioProjects.find((p) => p.id === id);
      const item: CreativeDesignItem = {
        id,
        title: projectTitle.trim() || 'Projet Audio SHALOM',
        templateType: 'encouragement',
        format: 'audio_multitrack',
        studioType: 'audio',
        thumbnailDataUrl: generateAudioCoverThumbnail(projectTitle, tracks.length, totalProjectDuration),
        mediaBlobKey: mediaAssetKeys[0] || '',
        mimeType: 'application/json',
        projectJson: json,
        mediaAssetKeys,
        durationSeconds: Math.max(1, Math.round(totalProjectDuration)),
        createdAt: existing?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await dbService.put(STORES.CREATIONS, item);
      setCurrentProjectId(id);
      setNotice(
        isEn
          ? 'Audio project saved! Reopen it anytime from Saved Projects.'
          : 'Projet audio sauvegardé ! Retrouvez-le dans « Projets Audio » pour reprendre plus tard.'
      );
      reloadData();
    } catch {
      setNotice(isEn ? 'Failed to save audio project.' : 'Erreur lors de la sauvegarde du projet.');
    } finally {
      setIsSavingProject(false);
    }
  };

  const handleLoadSavedProject = async (proj: CreativeDesignItem) => {
    if (!proj.projectJson) return;
    try {
      await deserializeAndLoadProject(proj.title, proj.projectJson, proj.id);
      setNotice(
        isEn ? `Project "${proj.title}" opened!` : `Projet « ${proj.title} » rouvert pour édition.`
      );
    } catch {
      setNotice(isEn ? 'Could not reopen this project.' : 'Impossible de rouvrir ce projet audio.');
    }
  };

  const handleDeleteSavedProject = async (id: string) => {
    await dbService.deleteItem(STORES.CREATIONS, id);
    if (currentProjectId === id) setCurrentProjectId(null);
    reloadData();
  };

  const handleSaveToParole = async () => {
    if (!exportedBlob) return;
    const blobKey = `parole_studio_${Date.now()}`;
    await dbService.saveMediaBlob(blobKey, exportedBlob, exportedBlob.type);
    const rec: RecordedParole = {
      id: `rec_studio_${Date.now()}`,
      title: projectTitle.trim() || 'Production Studio Audio',
      type: 'exhortation',
      speaker: userProfile?.fullName || 'Moi',
      activityGenre: 'autre',
      date: new Date().toISOString().split('T')[0],
      durationSeconds: Math.max(1, Math.round(totalProjectDuration)),
      mediaType: 'audio',
      mimeType: exportedBlob.type,
      blobKey,
      fileSizeFormatted: `${(exportedBlob.size / (1024 * 1024)).toFixed(2)} Mo`,
      createdAt: new Date().toISOString(),
    };
    await dbService.put(STORES.RECORDINGS, rec);
    setNotice(isEn ? 'Saved to Parole Divine!' : 'Enregistré dans Parole Divine !');
    reloadData();
  };

  const handleSaveToVault = async () => {
    if (!exportedBlob) return;
    const fileName = sanitizeFileName(projectTitle, 'shalom_audio', exportedFormat);
    const blobKey = `vault_audio_${Date.now()}`;
    await dbService.saveMediaBlob(blobKey, exportedBlob, exportedBlob.type);
    const doc: VaultDocument = {
      id: `vault_${Date.now()}`,
      title: projectTitle.trim() || 'Création Audio',
      category: 'autre',
      author: userProfile?.fullName || 'Moi',
      description: 'Création audio réalisée dans SHALOM Studio Audio',
      fileName,
      mimeType: exportedBlob.type,
      sizeBytes: exportedBlob.size,
      blobKey,
      createdAt: new Date().toISOString(),
    };
    await dbService.put(STORES.VAULT_DOCUMENTS, doc);
    setNotice(isEn ? 'Saved to Spiritual Vault!' : 'Ajouté dans Mon Coffre Spirituel !');
    reloadData();
  };

  const handleDownloadExported = async () => {
    if (!exportedBlob) return;
    const fileName = sanitizeFileName(projectTitle, 'shalom_audio', exportedFormat);
    const res = await downloadBlobToDevice(exportedBlob, fileName, exportedBlob.type);
    if (res.ok) {
      setNotice(
        isEn
          ? `Saved "${res.fileName}" to ${res.locationLabel}.`
          : `Fichier « ${res.fileName} » enregistré dans ${res.locationLabel} !`
      );
    } else if (res.error) {
      setNotice(res.error);
    }
  };

  const handleShareExported = async () => {
    if (!exportedBlob) return;
    const file = await normalizeMediaToShareFile(
      exportedBlob,
      projectTitle || 'shalom_audio',
      'audio',
      exportedBlob.type
    );
    setSharePayload({
      title: projectTitle,
      text: `🎙️ ${projectTitle}\n\nPartagé depuis SHALOM Studio Audio`,
      file,
    });
  };

  const handleShareWithoutSaving = async (format: 'mp3' | 'wav' = 'mp3') => {
    const res = exportedBlob
      ? { blob: exportedBlob, format: exportedFormat }
      : await renderAudioMixBlob(format);
    if (!res) return;
    const file = await normalizeMediaToShareFile(
      res.blob,
      projectTitle || 'shalom_audio',
      'audio',
      res.blob.type
    );
    setSharePayload({
      title: projectTitle,
      text: `🎙️ ${projectTitle}\n\nPartagé directement depuis SHALOM Studio Audio`,
      file,
    });
  };

  const handleShareLocalFileDirect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawFile = e.target.files?.[0];
    if (!rawFile) return;
    try {
      const verified = await readFileAsVerifiedBlob(rawFile);
      const mediaKind = verified.mimeType.startsWith('video/') ? 'video' : 'audio';
      const file = await normalizeMediaToShareFile(
        verified.blob,
        verified.fileName,
        mediaKind,
        verified.mimeType
      );
      setSharePayload({
        title: verified.fileName,
        text: `🎙️ ${verified.fileName}\n\nPartagé directement sans enregistrement depuis SHALOM Studio Audio`,
        file,
      });
    } catch (err) {
      setNotice(
        err instanceof Error
          ? err.message
          : isEn
            ? 'Could not read selected file.'
            : 'Impossible de lire ce fichier audio.'
      );
    }
    e.target.value = '';
  };

  // Pointer drag clip handlers on timeline
  const handleClipPointerDown = (e: React.PointerEvent<HTMLDivElement>, clip: AudioClipItem, trackLocked?: boolean) => {
    e.stopPropagation();
    if (e.shiftKey) {
      setSelectedClipIds((prev) =>
        prev.includes(clip.id) ? prev.filter((x) => x !== clip.id) : [...prev, clip.id]
      );
      return;
    }
    setSelectedClipIds([clip.id]);
    if (trackLocked) return;

    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    pushHistory();
    dragClipRef.current = {
      clipId: clip.id,
      startClientX: e.clientX,
      origStartSec: clip.startTimeSec,
    };
  };

  const handleClipPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragClipRef.current) return;
    const dx = e.clientX - dragClipRef.current.startClientX;
    const deltaSec = dx / zoomPxPerSec;
    let nextSec = Math.max(0, dragClipRef.current.origStartSec + deltaSec);
    if (snapEnabled) {
      nextSec = Math.round(nextSec * 4) / 4;
    } else {
      nextSec = Number(nextSec.toFixed(2));
    }
    const targetId = dragClipRef.current.clipId;
    setClips((prev) => prev.map((c) => (c.id === targetId ? { ...c, startTimeSec: nextSec } : c)));
  };

  const handleClipPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (dragClipRef.current) {
      try {
        (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {
        // noop
      }
      dragClipRef.current = null;
    }
  };

  const timelineSecondsSpan = Math.max(16, Math.ceil(totalProjectDuration + 4));
  const timelineWidthPx = Math.max(640, timelineSecondsSpan * zoomPxPerSec);
  const selectedClip = clips.find((c) => c.id === selectedClipIds[0]) || null;

  return (
    <div className="space-y-4">
      {notice && (
        <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/50 text-xs font-semibold text-emerald-700 dark:text-emerald-300 flex items-center justify-between gap-2">
          <span className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{notice}</span>
          </span>
          <button type="button" onClick={() => setNotice(null)} className="underline ml-2 shrink-0">
            OK
          </button>
        </div>
      )}

      {recoverableDraft && (
        <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-xs flex flex-wrap items-center justify-between gap-2">
          <span className="font-semibold text-amber-900 dark:text-amber-200">
            {isEn
              ? 'An unsaved audio studio session was found. Resume where you left off?'
              : 'Un brouillon audio automatique a été retrouvé. Reprendre votre montage ?'}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleRestoreDraft}
              className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-bold"
            >
              {isEn ? 'Resume' : 'Reprendre'}
            </button>
            <button
              type="button"
              onClick={() => setRecoverableDraft(false)}
              className="px-2.5 py-1.5 rounded-lg bg-slate-200 dark:bg-slate-800 font-semibold"
            >
              {isEn ? 'Dismiss' : 'Ignorer'}
            </button>
          </div>
        </div>
      )}

      {/* Canva-Style Top Audio Studio Command Bar */}
      <div className="p-3 rounded-2xl bg-[#071128] text-white border border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs shadow-sm">
        <div className="flex flex-wrap items-center gap-2 flex-1 min-w-[200px]">
          <FileAudio className="w-4 h-4 text-amber-400 shrink-0" />
          <input
            type="text"
            value={projectTitle}
            onChange={(e) => setProjectTitle(e.target.value)}
            className="px-2.5 py-1.5 rounded-lg bg-white/10 border border-white/15 font-bold text-white placeholder-white/50 min-w-[160px] max-w-[260px]"
            placeholder={isEn ? 'Project title...' : 'Titre du projet audio...'}
          />

          <div className="flex items-center gap-1 border-l border-white/15 pl-2">
            <button
              type="button"
              onClick={handleUndo}
              disabled={undoStack.length === 0}
              title={isEn ? 'Undo (Ctrl+Z)' : 'Annuler (Ctrl+Z)'}
              className="p-2 rounded-lg bg-white/10 hover:bg-white/20 disabled:opacity-35 transition"
            >
              <Undo2 className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={handleRedo}
              disabled={redoStack.length === 0}
              title={isEn ? 'Redo (Ctrl+Y)' : 'Rétablir (Ctrl+Y)'}
              className="p-2 rounded-lg bg-white/10 hover:bg-white/20 disabled:opacity-35 transition"
            >
              <Redo2 className="w-4 h-4" />
            </button>
          </div>

          <button
            type="button"
            onClick={() => setSnapEnabled((s) => !s)}
            className={`px-2.5 py-1.5 rounded-lg font-semibold flex items-center gap-1 whitespace-nowrap transition ${
              snapEnabled ? 'bg-blue-600 text-white' : 'bg-white/10 text-slate-300'
            }`}
            title={isEn ? 'Snap to 0.25s grid' : 'Aimant grille 0.25s'}
          >
            <Magnet className="w-3.5 h-3.5" />
            <span>{isEn ? 'Snap' : 'Aimant'}</span>
          </button>

          <button
            type="button"
            onClick={splitSelectedClipAtPlayhead}
            disabled={selectedClipIds.length !== 1}
            className="px-2.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 disabled:opacity-35 font-semibold flex items-center gap-1 whitespace-nowrap"
            title={isEn ? 'Split selected clip at red playhead' : 'Scinder l’extrait à la tête de lecture'}
          >
            <Scissors className="w-3.5 h-3.5 text-amber-400" />
            <span>{isEn ? 'Split' : 'Scinder'}</span>
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 bg-white/10 rounded-lg px-2 py-1">
            <button
              type="button"
              onClick={() => setZoomPxPerSec((z) => Math.max(24, z - 12))}
              className="p-1 hover:text-amber-400"
              title="Zoom -"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="tabular-nums text-[11px] font-bold w-11 text-center">
              {Math.round((zoomPxPerSec / 48) * 100)}%
            </span>
            <button
              type="button"
              onClick={() => setZoomPxPerSec((z) => Math.min(120, z + 12))}
              className="p-1 hover:text-amber-400"
              title="Zoom +"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
          </div>

          <button
            type="button"
            onClick={() => setShowPreviewModal(true)}
            disabled={clips.length === 0}
            className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 disabled:opacity-40 font-bold flex items-center gap-1.5 whitespace-nowrap"
          >
            <Eye className="w-3.5 h-3.5" />
            <span>{isEn ? 'Preview' : 'Aperçu'}</span>
          </button>

          <button
            type="button"
            onClick={handleSaveEditableProject}
            disabled={isSavingProject || clips.length === 0}
            className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-slate-950 font-bold flex items-center gap-1.5 whitespace-nowrap"
          >
            {isSavingProject ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            <span>{isEn ? 'Save Project' : 'Sauver projet'}</span>
          </button>
        </div>
      </div>

      {/* Main 2-Column Audio Studio Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        {/* Left Tool Sidebar (Canva-like tabs) */}
        <div className="lg:col-span-4 rounded-2xl bg-white dark:bg-[#0c1631] border border-slate-200/80 dark:border-slate-800/80 overflow-hidden text-xs">
          <div className="grid grid-cols-5 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/70">
            {[
              { id: 'elements', icon: Mic, label: isEn ? 'Sounds' : 'Sons' },
              { id: 'templates', icon: Sparkles, label: isEn ? 'Templates' : 'Modèles' },
              { id: 'script', icon: AlignLeft, label: 'Script' },
              { id: 'fx', icon: Sliders, label: 'Mix/FX' },
              { id: 'projects', icon: FolderOpen, label: isEn ? 'Saved' : 'Projets' },
            ].map((tab) => {
              const Icon = tab.icon;
              const active = activeToolTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveToolTab(tab.id as typeof activeToolTab)}
                  className={`py-2.5 px-1 flex flex-col items-center justify-center gap-1 font-bold transition ${
                    active
                      ? 'bg-white dark:bg-[#0c1631] text-blue-700 dark:text-amber-400 border-b-2 border-blue-700 dark:border-amber-400'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span className="text-[10px] leading-none">{tab.label}</span>
                </button>
              );
            })}
          </div>

          <div className="p-4 space-y-4 max-h-[540px] overflow-y-auto">
            {activeToolTab === 'templates' && (
              <div className="space-y-3">
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleSearchOnlineTemplates();
                  }}
                  className="flex gap-1.5"
                >
                  <div className="relative flex-1">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="text"
                      value={templateQuery}
                      onChange={(e) => setTemplateQuery(e.target.value)}
                      placeholder={
                        isEn
                          ? 'Search online (prayer, sermon, choir...)'
                          : 'Rechercher en ligne (prière, psaume, chœur...)'
                      }
                      className="w-full pl-8 pr-2.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-medium"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={isSearchingOnline}
                    className="px-3 py-2 rounded-xl bg-blue-700 hover:bg-blue-800 disabled:opacity-50 text-white font-bold flex items-center gap-1 whitespace-nowrap"
                  >
                    {isSearchingOnline ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Globe className="w-3.5 h-3.5" />
                    )}
                    <span>{isEn ? 'Search' : 'En ligne'}</span>
                  </button>
                </form>

                <div className="flex flex-wrap gap-1.5">
                  {['all', 'Prière', 'Verset', 'Méditation', 'Église', 'Louange'].map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => {
                        setTemplateCategory(cat);
                        handleSearchOnlineTemplates(templateQuery, cat);
                      }}
                      className={`px-2 py-1 rounded-lg text-[10px] font-bold transition whitespace-nowrap ${
                        templateCategory === cat
                          ? 'bg-blue-700 text-white'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                      }`}
                    >
                      {cat === 'all' ? (isEn ? 'All' : 'Tous') : cat}
                    </button>
                  ))}
                </div>

                {onlineStatusMsg && (
                  <p className="text-[11px] font-medium text-blue-700 dark:text-amber-300">
                    {onlineStatusMsg}
                  </p>
                )}

                {savedAudioTemplates.length > 0 && (
                  <div className="space-y-1.5 pb-2 border-b border-slate-100 dark:border-slate-800">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                      {isEn ? 'My Kept Online Templates' : 'Mes modèles conservés'} ({savedAudioTemplates.length})
                    </p>
                    {savedAudioTemplates.map((st) => (
                      <div
                        key={st.id}
                        className="relative p-2.5 rounded-xl border border-emerald-200 dark:border-emerald-900/50 bg-emerald-50/40 dark:bg-emerald-950/20 flex items-center justify-between gap-2"
                      >
                        <button
                          type="button"
                          onClick={() => handleApplySavedOnlineTemplate(st)}
                          className="flex-1 text-left min-w-0"
                        >
                          <div className="font-bold text-slate-900 dark:text-white truncate text-xs">
                            {st.title}
                          </div>
                          <div className="text-[10px] text-slate-500 truncate">{st.category}</div>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteSavedOnlineTemplate(st.id)}
                          aria-label="Supprimer modèle audio conservé"
                          className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 shrink-0"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {displayedAudioTemplates.map((tpl) => (
                  <button
                    key={tpl.id}
                    type="button"
                    onClick={() => handleApplyTemplate(tpl)}
                    className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-blue-500 bg-slate-50 dark:bg-slate-900/60 text-left space-y-1 transition"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-slate-900 dark:text-white truncate">
                        {isEn ? tpl.titleEn : tpl.titleFr}
                      </span>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {tpl.source && tpl.source !== 'local' && (
                          <span className="text-[10px] text-slate-500 dark:text-slate-400">
                            {tpl.source === 'online-live' ? 'IA' : 'En ligne'}
                          </span>
                        )}
                        <span
                          className="w-2.5 h-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: tpl.badgeColor }}
                        />
                      </div>
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      {isEn ? tpl.descEn : tpl.descFr}
                    </p>
                  </button>
                ))}

                {templateHasMore && (
                  <button
                    type="button"
                    disabled={isLoadingMoreTemplates}
                    onClick={() => handleSearchOnlineTemplates(templateQuery, templateCategory, templatePage + 1)}
                    className="w-full py-2.5 px-3 rounded-xl bg-slate-100 hover:bg-blue-50 dark:bg-slate-800 dark:hover:bg-slate-700 text-blue-700 dark:text-amber-400 font-bold text-xs flex items-center justify-center gap-1.5 transition"
                  >
                    {isLoadingMoreTemplates ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Plus className="w-3.5 h-3.5" />
                    )}
                    <span>{isEn ? 'Load more online templates' : 'Charger plus de modèles en ligne'}</span>
                  </button>
                )}
              </div>
            )}

            {activeToolTab === 'elements' && (
              <div className="space-y-4">
                <div>
                  <label className="block font-bold mb-1 text-slate-700 dark:text-slate-200">
                    {isEn ? 'Target Track' : 'Piste cible pour l’ajout'}
                  </label>
                  <select
                    value={selectedTrackId}
                    onChange={(e) => setSelectedTrackId(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 font-semibold"
                  >
                    {tracks.map((tr) => (
                      <option key={tr.id} value={tr.id}>
                        {tr.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-1 gap-2">
                  <button
                    type="button"
                    onClick={handleToggleMicRecord}
                    className={`w-full px-3.5 py-2.5 rounded-xl font-bold flex items-center justify-center gap-2 transition ${
                      isRecordingMic
                        ? 'bg-red-600 hover:bg-red-700 text-white animate-pulse'
                        : 'bg-blue-700 hover:bg-blue-800 text-white'
                    }`}
                  >
                    {isRecordingMic ? (
                      <>
                        <Square className="w-4 h-4 fill-current" />
                        <span>
                          {isEn ? `Stop Mic (${micSeconds}s)` : `Arrêter micro (${micSeconds}s)`}
                        </span>
                      </>
                    ) : (
                      <>
                        <Mic className="w-4 h-4" />
                        <span>{isEn ? 'Record Voice / Mic' : 'Enregistrer voix au micro'}</span>
                      </>
                    )}
                  </button>

                  <label className="w-full px-3.5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 font-semibold flex items-center justify-center gap-2 cursor-pointer">
                    <Upload className="w-4 h-4" />
                    <span>{isEn ? 'Import Audio File(s)' : 'Importer fichiers audio'}</span>
                    <input
                      type="file"
                      accept="audio/*"
                      multiple
                      onChange={handleImportAudioFiles}
                      className="hidden"
                    />
                  </label>

                  {recordings.length > 0 && (
                    <select
                      defaultValue=""
                      onChange={(e) => {
                        if (e.target.value) handleImportFromParole(e.target.value);
                        e.target.value = '';
                      }}
                      className="w-full px-3 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 font-semibold"
                    >
                      <option value="">
                        {isEn ? '+ Pull from Parole Divine' : '+ Importer depuis Parole Divine'}
                      </option>
                      {recordings.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.title} ({r.mediaType === 'video' ? 'vidéo→audio' : 'audio'})
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                {/* Built-in Offline Harmonic & Foley Library */}
                <div className="pt-3 border-t border-slate-200 dark:border-slate-800 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                      <Music className="w-3.5 h-3.5 text-amber-500" />
                      <span>{isEn ? 'Built-in Sound Elements' : 'Éléments sonores intégrés'}</span>
                    </span>
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        min={1}
                        max={30}
                        value={synthDuration}
                        onChange={(e) =>
                          setSynthDuration(Math.max(1, Math.min(30, parseInt(e.target.value, 10) || 4)))
                        }
                        className="w-12 px-1.5 py-1 rounded bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-center tabular-nums font-bold"
                      />
                      <span className="text-[11px] text-slate-500">s</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-1.5">
                    {(
                      [
                        { id: 'c_major', fr: 'Accord Do Majeur', en: 'C Major Pad' },
                        { id: 'g_warm', fr: 'Accord Sol Chaleur', en: 'G Warm Pad' },
                        { id: 'a_minor', fr: 'Accord La Mineur', en: 'A Minor Pad' },
                        { id: 'soft_bell', fr: 'Cloche Méditation', en: 'Meditation Bell' },
                        { id: 'chime', fr: 'Carillon Intro', en: 'Intro Chime' },
                        { id: 'swell', fr: 'Montée Douce', en: 'Warm Swell' },
                        { id: 'metronome', fr: 'Métronome 80 BPM', en: 'Metronome 80 BPM' },
                        { id: 'silence', fr: 'Silence Calibré', en: 'Clean Silence' },
                      ] as const
                    ).map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => {
                          setSynthPreset(item.id);
                          handleGenerateSynthClip(item.id);
                        }}
                        className="px-2.5 py-2 rounded-lg bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/30 dark:hover:bg-amber-900/40 border border-amber-200/80 dark:border-amber-900/50 text-amber-900 dark:text-amber-200 font-semibold text-left truncate"
                      >
                        + {isEn ? item.en : item.fr}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {activeToolTab === 'script' && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900 dark:text-white">
                      {isEn ? 'Teleprompter / Voice Script' : 'Prompteur / Script vocal'}
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setScriptFontSize((s) => Math.max(11, s - 2))}
                        className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 font-bold"
                      >
                        A-
                      </button>
                      <button
                        type="button"
                        onClick={() => setScriptFontSize((s) => Math.min(24, s + 2))}
                        className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 font-bold"
                      >
                        A+
                      </button>
                    </div>
                  </div>
                  {/* Formatage texte script : Gras, Italique, Souligné, Alignement */}
                  <div className="flex flex-wrap items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setScriptStyle((st) => ({ ...st, bold: !st.bold }))}
                      className={`px-2 py-1 rounded font-black text-[11px] ${
                        scriptStyle.bold
                          ? 'bg-blue-700 text-white'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200'
                      }`}
                      title="Gras"
                    >
                      G
                    </button>
                    <button
                      type="button"
                      onClick={() => setScriptStyle((st) => ({ ...st, italic: !st.italic }))}
                      className={`px-2 py-1 rounded italic font-serif font-bold text-[11px] ${
                        scriptStyle.italic
                          ? 'bg-blue-700 text-white'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200'
                      }`}
                      title="Italique"
                    >
                      I
                    </button>
                    <button
                      type="button"
                      onClick={() => setScriptStyle((st) => ({ ...st, underline: !st.underline }))}
                      className={`px-2 py-1 rounded underline font-bold text-[11px] ${
                        scriptStyle.underline
                          ? 'bg-blue-700 text-white'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200'
                      }`}
                      title="Souligné"
                    >
                      S
                    </button>
                    {(['left', 'center', 'right'] as const).map((al) => {
                      const Icon = al === 'left' ? AlignLeft : al === 'center' ? AlignCenter : AlignRight;
                      return (
                        <button
                          key={al}
                          type="button"
                          onClick={() => setScriptStyle((st) => ({ ...st, align: al }))}
                          className={`p-1 rounded ${
                            scriptStyle.align === al
                              ? 'bg-blue-700 text-white'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200'
                          }`}
                        >
                          <Icon className="w-3.5 h-3.5" />
                        </button>
                      );
                    })}
                  </div>
                  <textarea
                    rows={6}
                    value={scriptText}
                    onChange={(e) => setScriptText(e.target.value)}
                    style={{
                      fontSize: `${scriptFontSize}px`,
                      fontWeight: scriptStyle.bold ? 700 : 400,
                      fontStyle: scriptStyle.italic ? 'italic' : 'normal',
                      textDecorationLine: scriptStyle.underline ? 'underline' : 'none',
                      textAlign: scriptStyle.align,
                    }}
                    placeholder={
                      isEn
                        ? 'Write your sermon points, Bible verse, or script to read while recording...'
                        : 'Rédigez votre verset, exhortation ou texte à lire pendant l’enregistrement micro...'
                    }
                    className="w-full p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 leading-relaxed"
                  />
                </div>

                <div className="pt-2 border-t border-slate-200 dark:border-slate-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold flex items-center gap-1.5">
                      <Flag className="w-3.5 h-3.5 text-blue-600" />
                      <span>
                        {isEn
                          ? `Timeline Markers (${markers.length})`
                          : `Repères temporels (${markers.length})`}
                      </span>
                    </span>
                    <button
                      type="button"
                      onClick={addMarkerAtPlayhead}
                      className="px-2.5 py-1 rounded-lg bg-blue-700 text-white font-bold"
                    >
                      + @ {playheadSec.toFixed(1)}s
                    </button>
                  </div>

                  {markers.map((mk) => (
                    <div
                      key={mk.id}
                      className="flex items-center gap-2 p-2 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800"
                    >
                      <button
                        type="button"
                        onClick={() => setPlayheadSec(mk.timeSec)}
                        className="px-2 py-0.5 rounded bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 font-bold tabular-nums shrink-0"
                      >
                        {mk.timeSec.toFixed(1)}s
                      </button>
                      <input
                        type="text"
                        value={mk.label}
                        onChange={(e) =>
                          setMarkers((prev) =>
                            prev.map((m) => (m.id === mk.id ? { ...m, label: e.target.value } : m))
                          )
                        }
                        className="flex-1 bg-transparent font-semibold min-w-0 outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => setMarkers((prev) => prev.filter((m) => m.id !== mk.id))}
                        className="p-1 text-red-500"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeToolTab === 'fx' && (
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between font-bold mb-1">
                    <span>{isEn ? 'Master Output Volume' : 'Volume général (Master)'}</span>
                    <span className="tabular-nums">{Math.round(masterGain * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min={0.2}
                    max={1.6}
                    step={0.05}
                    value={masterGain}
                    onChange={(e) => setMasterGain(parseFloat(e.target.value))}
                    className="w-full accent-blue-700"
                  />
                </div>

                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900 dark:text-white">
                      {isEn ? 'Master 3-Band Equalizer' : 'Égaliseur 3 bandes (Master)'}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setMasterFx({ eqLowDb: 0, eqMidDb: 0, eqHighDb: 0, reverbMix: 0 })
                      }
                      className="text-[11px] text-blue-600 underline font-semibold"
                    >
                      Reset
                    </button>
                  </div>

                  <div>
                    <div className="flex justify-between text-[11px] font-semibold mb-0.5">
                      <span>{isEn ? 'Warmth / Bass (120Hz)' : 'Chaleur / Graves (120Hz)'}</span>
                      <span className="tabular-nums">{masterFx.eqLowDb > 0 ? `+${masterFx.eqLowDb}` : masterFx.eqLowDb} dB</span>
                    </div>
                    <input
                      type="range"
                      min={-12}
                      max={12}
                      step={1}
                      value={masterFx.eqLowDb}
                      onChange={(e) =>
                        setMasterFx((f) => ({ ...f, eqLowDb: parseInt(e.target.value, 10) }))
                      }
                      className="w-full accent-blue-700"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between text-[11px] font-semibold mb-0.5">
                      <span>{isEn ? 'Voice Presence (1kHz)' : 'Présence Voix (1kHz)'}</span>
                      <span className="tabular-nums">{masterFx.eqMidDb > 0 ? `+${masterFx.eqMidDb}` : masterFx.eqMidDb} dB</span>
                    </div>
                    <input
                      type="range"
                      min={-12}
                      max={12}
                      step={1}
                      value={masterFx.eqMidDb}
                      onChange={(e) =>
                        setMasterFx((f) => ({ ...f, eqMidDb: parseInt(e.target.value, 10) }))
                      }
                      className="w-full accent-blue-700"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between text-[11px] font-semibold mb-0.5">
                      <span>{isEn ? 'Clarity / Treble (6.5kHz)' : 'Clarté / Aigus (6.5kHz)'}</span>
                      <span className="tabular-nums">{masterFx.eqHighDb > 0 ? `+${masterFx.eqHighDb}` : masterFx.eqHighDb} dB</span>
                    </div>
                    <input
                      type="range"
                      min={-12}
                      max={12}
                      step={1}
                      value={masterFx.eqHighDb}
                      onChange={(e) =>
                        setMasterFx((f) => ({ ...f, eqHighDb: parseInt(e.target.value, 10) }))
                      }
                      className="w-full accent-blue-700"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between text-[11px] font-semibold mb-0.5">
                      <span>{isEn ? 'Sanctuary Reverb' : 'Réverbération Sanctuaire'}</span>
                      <span className="tabular-nums">{Math.round(masterFx.reverbMix * 100)}%</span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={0.65}
                      step={0.05}
                      value={masterFx.reverbMix}
                      onChange={(e) =>
                        setMasterFx((f) => ({ ...f, reverbMix: parseFloat(e.target.value) }))
                      }
                      className="w-full accent-amber-600"
                    />
                  </div>
                </div>

                {/* Multi-select Batch Controls */}
                <div className="p-3 rounded-xl bg-blue-50/70 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900/50 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold flex items-center gap-1.5 text-blue-900 dark:text-blue-200">
                      <CheckSquare className="w-3.5 h-3.5" />
                      <span>
                        {isEn
                          ? `Selected Clips: ${selectedClipIds.length}`
                          : `Sélection multiple : ${selectedClipIds.length} extrait(s)`}
                      </span>
                    </span>
                    {clips.length > 0 && (
                      <button
                        type="button"
                        onClick={() =>
                          setSelectedClipIds(
                            selectedClipIds.length === clips.length ? [] : clips.map((c) => c.id)
                          )
                        }
                        className="text-[11px] font-bold text-blue-700 dark:text-blue-400 underline"
                      >
                        {selectedClipIds.length === clips.length
                          ? isEn
                            ? 'Clear'
                            : 'Tout désélectionner'
                          : isEn
                            ? 'Select all'
                            : 'Tout sélectionner'}
                      </button>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-600 dark:text-slate-400">
                    {isEn
                      ? 'Tip: Hold Shift + Click clips on timeline to multi-select.'
                      : 'Astuce : Maj + Clic sur la timeline pour sélectionner plusieurs extraits.'}
                  </p>
                  {selectedClipIds.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      <button
                        type="button"
                        onClick={() => shiftSelectedBatch(-1)}
                        className="px-2 py-1 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-bold"
                      >
                        -1s
                      </button>
                      <button
                        type="button"
                        onClick={() => shiftSelectedBatch(1)}
                        className="px-2 py-1 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-bold"
                      >
                        +1s
                      </button>
                      <button
                        type="button"
                        onClick={duplicateSelectedBatch}
                        className="px-2.5 py-1 rounded bg-blue-700 text-white font-bold"
                      >
                        {isEn ? 'Duplicate' : 'Dupliquer'}
                      </button>
                      <button
                        type="button"
                        onClick={deleteSelectedBatch}
                        className="px-2.5 py-1 rounded bg-red-600 text-white font-bold"
                      >
                        {isEn ? 'Delete' : 'Supprimer'}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeToolTab === 'projects' && (
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-900 dark:text-white">
                    {isEn
                      ? `Saved Audio Projects (${savedAudioProjects.length})`
                      : `Projets Audio sauvegardés (${savedAudioProjects.length})`}
                  </span>
                  <button
                    type="button"
                    onClick={handleSaveEditableProject}
                    disabled={clips.length === 0}
                    className="px-2.5 py-1 rounded-lg bg-blue-700 disabled:opacity-40 text-white font-bold"
                  >
                    + {isEn ? 'Save current' : 'Sauver actuel'}
                  </button>
                </div>

                {savedAudioProjects.length === 0 ? (
                  <p className="text-[11px] text-slate-500 py-4 text-center">
                    {isEn
                      ? 'No saved audio projects yet. Save your project to resume it anytime.'
                      : 'Aucun projet audio sauvegardé. Cliquez sur « Sauver projet » pour reprendre plus tard.'}
                  </p>
                ) : (
                  savedAudioProjects.map((proj) => (
                    <div
                      key={proj.id}
                      className={`p-2.5 rounded-xl border flex items-center gap-2.5 ${
                        currentProjectId === proj.id
                          ? 'border-blue-500 bg-blue-50/40 dark:bg-blue-950/20'
                          : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60'
                      }`}
                    >
                      {proj.thumbnailDataUrl && (
                        <img
                          src={proj.thumbnailDataUrl}
                          alt={proj.title}
                          className="w-16 h-10 rounded-lg object-cover shrink-0"
                        />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="font-bold truncate text-slate-900 dark:text-white">{proj.title}</p>
                        <p className="text-[10px] text-slate-500 tabular-nums">
                          {proj.durationSeconds ? `${proj.durationSeconds}s · ` : ''}
                          {new Date(proj.updatedAt || proj.createdAt).toLocaleDateString('fr-FR')}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleLoadSavedProject(proj)}
                          className="px-2 py-1 rounded-lg bg-blue-700 text-white font-bold"
                        >
                          {isEn ? 'Open' : 'Modifier'}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteSavedProject(proj.id)}
                          className="p-1.5 rounded-lg text-red-600 hover:bg-red-50"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right Interactive Multi-Track Console & Draggable Timeline */}
        <div className="lg:col-span-8 space-y-4">
          <div className="p-4 rounded-2xl bg-white dark:bg-[#0c1631] border border-slate-200/80 dark:border-slate-800/80 space-y-3 text-xs">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-blue-600" />
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  {isEn ? 'Interactive Multi-Track Timeline' : 'Timeline Multipiste Interactive'}
                </h3>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleTogglePreview}
                  disabled={clips.length === 0}
                  className={`px-3.5 py-2 rounded-xl font-bold flex items-center gap-1.5 transition disabled:opacity-40 ${
                    isPlayingPreview
                      ? 'bg-red-600 text-white'
                      : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                  }`}
                >
                  {isPlayingPreview ? (
                    <>
                      <Square className="w-3.5 h-3.5 fill-current" />
                      <span>
                        {isEn ? 'Stop' : 'Arrêter'} ({playheadSec.toFixed(1)}s)
                      </span>
                    </>
                  ) : (
                    <>
                      <Play className="w-3.5 h-3.5 fill-current" />
                      <span>
                        {isEn ? 'Play Mix' : 'Écouter'} ({totalProjectDuration.toFixed(1)}s)
                      </span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={handleAddTrack}
                  className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 font-bold flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{isEn ? 'Add Track' : 'Ajouter piste'}</span>
                </button>
              </div>
            </div>

            {/* Horizontally Scrollable Zoomable Timeline Canvas */}
            <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-950 text-white">
              <div style={{ width: `${timelineWidthPx + 200}px` }} className="relative">
                {/* Clickable Time Ruler */}
                <div className="flex border-b border-slate-800 bg-slate-900/90 sticky top-0 z-20">
                  <div className="w-[200px] shrink-0 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 border-r border-slate-800 flex items-center justify-between">
                    <span>{isEn ? 'Tracks' : 'Pistes'}</span>
                    <span className="tabular-nums text-amber-400">{playheadSec.toFixed(2)}s</span>
                  </div>
                  <div
                    onClick={(e) => {
                      const rect = e.currentTarget.getBoundingClientRect();
                      const clickX = Math.max(0, e.clientX - rect.left);
                      setPlayheadSec(Number((clickX / zoomPxPerSec).toFixed(2)));
                    }}
                    className="flex-1 relative h-7 cursor-pointer select-none"
                    title={isEn ? 'Click anywhere to move playhead' : 'Cliquez pour placer la tête de lecture'}
                  >
                    {Array.from({ length: timelineSecondsSpan + 1 }).map((_, s) => (
                      <div
                        key={s}
                        style={{ left: `${s * zoomPxPerSec}px` }}
                        className="absolute top-0 bottom-0 border-l border-slate-700/70 pl-1 text-[10px] text-slate-400 tabular-nums pt-1"
                      >
                        {s}s
                      </div>
                    ))}
                    {markers.map((mk) => (
                      <div
                        key={mk.id}
                        style={{ left: `${mk.timeSec * zoomPxPerSec}px`, backgroundColor: mk.color }}
                        onClick={(e) => {
                          e.stopPropagation();
                          setPlayheadSec(mk.timeSec);
                        }}
                        className="absolute bottom-0 px-1.5 py-0.5 rounded-t text-[9px] font-bold text-slate-950 -translate-x-1/2 cursor-pointer"
                        title={`${mk.label} (${mk.timeSec}s)`}
                      >
                        {mk.label}
                      </div>
                    ))}
                    <div
                      style={{ left: `${playheadSec * zoomPxPerSec}px` }}
                      className="absolute top-0 bottom-0 w-0.5 bg-red-500 pointer-events-none"
                    />
                  </div>
                </div>

                {/* Track Rows */}
                {tracks.map((track, trackIdx) => {
                  const trackClips = clips.filter((c) => c.trackId === track.id);
                  return (
                    <div
                      key={track.id}
                      onClick={() => setSelectedTrackId(track.id)}
                      className={`flex border-b border-slate-800/80 ${
                        selectedTrackId === track.id ? 'bg-slate-900/70' : 'bg-slate-950'
                      }`}
                    >
                      {/* Fixed Left Track Control Column */}
                      <div className="w-[200px] shrink-0 p-2.5 border-r border-slate-800 space-y-1.5">
                        <div className="flex items-center gap-1">
                          <input
                            type="color"
                            value={track.color}
                            onChange={(e) => updateTrack(track.id, { color: e.target.value })}
                            className="w-5 h-5 rounded cursor-pointer border-0 bg-transparent shrink-0"
                          />
                          <input
                            type="text"
                            value={track.name}
                            onChange={(e) => updateTrack(track.id, { name: e.target.value })}
                            className="bg-transparent font-bold text-[11px] text-white flex-1 min-w-0 outline-none border-b border-transparent focus:border-blue-500"
                          />
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              moveTrackOrder(track.id, -1);
                            }}
                            disabled={trackIdx === 0}
                            title="Monter la piste"
                            className="p-0.5 text-slate-400 hover:text-white disabled:opacity-25"
                          >
                            <ArrowUp className="w-3 h-3" />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              moveTrackOrder(track.id, 1);
                            }}
                            disabled={trackIdx === tracks.length - 1}
                            title="Descendre la piste"
                            className="p-0.5 text-slate-400 hover:text-white disabled:opacity-25"
                          >
                            <ArrowDown className="w-3 h-3" />
                          </button>
                          {tracks.length > 1 && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                removeTrack(track.id);
                              }}
                              className="p-0.5 text-slate-400 hover:text-red-400"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          )}
                        </div>

                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              updateTrack(track.id, { muted: !track.muted });
                            }}
                            className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                              track.muted ? 'bg-red-600 text-white' : 'bg-slate-800 text-slate-300'
                            }`}
                          >
                            {track.muted ? <VolumeX className="w-3 h-3" /> : 'M'}
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              updateTrack(track.id, { solo: !track.solo });
                            }}
                            className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                              track.solo ? 'bg-amber-500 text-slate-950' : 'bg-slate-800 text-slate-300'
                            }`}
                          >
                            S
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              updateTrack(track.id, { locked: !track.locked });
                            }}
                            className={`p-1 rounded ${
                              track.locked ? 'bg-amber-500 text-slate-950' : 'bg-slate-800 text-slate-300'
                            }`}
                            title={track.locked ? 'Déverrouiller piste' : 'Verrouiller piste'}
                          >
                            {track.locked ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
                          </button>
                          <input
                            type="range"
                            min={0}
                            max={1.5}
                            step={0.05}
                            value={track.volume}
                            onChange={(e) =>
                              updateTrack(track.id, { volume: parseFloat(e.target.value) })
                            }
                            className="w-16 accent-blue-500 ml-auto"
                          />
                        </div>

                        {trackClips.length > 1 && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              chainTrackSequentially(track.id);
                            }}
                            className="w-full py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-[10px] font-semibold flex items-center justify-center gap-1 text-slate-300"
                          >
                            <AlignLeft className="w-3 h-3" />
                            <span>{isEn ? 'Chain' : 'Enchaîner bout à bout'}</span>
                          </button>
                        )}
                      </div>

                      {/* Draggable Track Lane */}
                      <div className="flex-1 relative h-16 touch-pan-y">
                        {trackClips.map((c) => {
                          const dur = Math.max(0.05, c.trimEnd - c.trimStart) / c.playbackRate;
                          const leftPx = c.startTimeSec * zoomPxPerSec;
                          const widthPx = Math.max(36, dur * zoomPxPerSec);
                          const isSelected = selectedClipIds.includes(c.id);
                          return (
                            <div
                              key={c.id}
                              onPointerDown={(e) => handleClipPointerDown(e, c, track.locked)}
                              onPointerMove={handleClipPointerMove}
                              onPointerUp={handleClipPointerUp}
                              style={{
                                left: `${leftPx}px`,
                                width: `${widthPx}px`,
                                backgroundColor: track.color,
                              }}
                              className={`absolute top-2 bottom-2 rounded-lg px-2 flex flex-col justify-center cursor-grab active:cursor-grabbing select-none touch-none transition-shadow ${
                                isSelected
                                  ? 'ring-2 ring-amber-400 shadow-lg brightness-110 z-10'
                                  : 'opacity-90 hover:opacity-100'
                              }`}
                              title={`${c.name} (${c.startTimeSec}s → ${(c.startTimeSec + dur).toFixed(1)}s)`}
                            >
                              <div className="text-[11px] font-bold text-white truncate flex items-center gap-1">
                                <span className="truncate">{c.name}</span>
                              </div>
                              <div className="text-[9px] text-white/80 tabular-nums">
                                {dur.toFixed(1)}s · {c.playbackRate}x
                              </div>
                            </div>
                          );
                        })}

                        {/* Global vertical playhead needle */}
                        <div
                          style={{ left: `${playheadSec * zoomPxPerSec}px` }}
                          className="absolute top-0 bottom-0 w-0.5 bg-red-500 pointer-events-none z-20"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Selected Clip Detailed Inspector */}
          {selectedClip ? (
            <div className="p-4 rounded-2xl bg-white dark:bg-[#0c1631] border border-slate-200/80 dark:border-slate-800/80 space-y-3 text-xs">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className="w-3 h-3 rounded-full shrink-0"
                    style={{
                      backgroundColor:
                        tracks.find((t) => t.id === selectedClip.trackId)?.color || '#2563eb',
                    }}
                  />
                  <input
                    type="text"
                    value={selectedClip.name}
                    onChange={(e) => updateClip(selectedClip.id, { name: e.target.value })}
                    className="font-bold text-sm text-slate-900 dark:text-white bg-transparent border-b border-transparent focus:border-blue-500 outline-none truncate"
                  />
                  <span className="text-slate-400 tabular-nums shrink-0">
                    ({selectedClip.buffer.duration.toFixed(1)}s brut)
                  </span>
                </div>

                <div className="flex items-center gap-1.5">
                  <select
                    value={selectedClip.trackId}
                    onChange={(e) => updateClip(selectedClip.id, { trackId: e.target.value })}
                    className="px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 font-semibold"
                  >
                    {tracks.map((tr) => (
                      <option key={tr.id} value={tr.id}>
                        {tr.name}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => duplicateClip(selectedClip)}
                    title={isEn ? 'Duplicate clip' : 'Dupliquer'}
                    className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => removeClip(selectedClip.id)}
                    className="p-1.5 rounded-lg text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <WaveformPreview
                buffer={selectedClip.buffer}
                trimStart={selectedClip.trimStart}
                trimEnd={selectedClip.trimEnd}
                color={tracks.find((t) => t.id === selectedClip.trackId)?.color || '#3b82f6'}
              />

              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                    {isEn ? 'Start (s)' : 'Position début (s)'}
                  </label>
                  <input
                    type="number"
                    step={0.1}
                    min={0}
                    value={selectedClip.startTimeSec}
                    onChange={(e) =>
                      updateClip(selectedClip.id, {
                        startTimeSec: Math.max(0, parseFloat(e.target.value) || 0),
                      })
                    }
                    className="w-full px-2.5 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 tabular-nums"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                    {isEn ? 'Trim In (s)' : 'Coupe début (s)'}
                  </label>
                  <input
                    type="number"
                    step={0.1}
                    min={0}
                    max={Math.max(0, selectedClip.trimEnd - 0.1)}
                    value={selectedClip.trimStart}
                    onChange={(e) =>
                      updateClip(selectedClip.id, {
                        trimStart: Math.max(0, parseFloat(e.target.value) || 0),
                      })
                    }
                    className="w-full px-2.5 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 tabular-nums"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                    {isEn ? 'Trim Out (s)' : 'Coupe fin (s)'}
                  </label>
                  <input
                    type="number"
                    step={0.1}
                    min={selectedClip.trimStart + 0.1}
                    max={Number(selectedClip.buffer.duration.toFixed(2))}
                    value={selectedClip.trimEnd}
                    onChange={(e) =>
                      updateClip(selectedClip.id, {
                        trimEnd: Math.min(
                          selectedClip.buffer.duration,
                          parseFloat(e.target.value) || selectedClip.buffer.duration
                        ),
                      })
                    }
                    className="w-full px-2.5 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 tabular-nums"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                    {isEn ? 'Fade In / Out (s)' : 'Fondu E / S (s)'}
                  </label>
                  <div className="grid grid-cols-2 gap-1">
                    <input
                      type="number"
                      step={0.1}
                      min={0}
                      max={5}
                      value={selectedClip.fadeInSec}
                      onChange={(e) =>
                        updateClip(selectedClip.id, {
                          fadeInSec: Math.max(0, parseFloat(e.target.value) || 0),
                        })
                      }
                      className="w-full px-2 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 tabular-nums"
                    />
                    <input
                      type="number"
                      step={0.1}
                      min={0}
                      max={5}
                      value={selectedClip.fadeOutSec}
                      onChange={(e) =>
                        updateClip(selectedClip.id, {
                          fadeOutSec: Math.max(0, parseFloat(e.target.value) || 0),
                        })
                      }
                      className="w-full px-2 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 tabular-nums"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                    {isEn ? 'Gain' : 'Volume'} ({Math.round(selectedClip.gain * 100)}%)
                  </label>
                  <input
                    type="range"
                    min={0}
                    max={2}
                    step={0.05}
                    value={selectedClip.gain}
                    onChange={(e) => updateClip(selectedClip.id, { gain: parseFloat(e.target.value) })}
                    className="w-full mt-2 accent-blue-700"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                    Pan ({selectedClip.pan === 0 ? 'C' : selectedClip.pan < 0 ? `G${Math.abs(Math.round(selectedClip.pan * 100))}` : `D${Math.round(selectedClip.pan * 100)}`})
                  </label>
                  <input
                    type="range"
                    min={-1}
                    max={1}
                    step={0.1}
                    value={selectedClip.pan}
                    onChange={(e) => updateClip(selectedClip.id, { pan: parseFloat(e.target.value) })}
                    className="w-full mt-2 accent-amber-600"
                  />
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] font-semibold text-slate-500">
                    {isEn ? 'Speed:' : 'Vitesse :'}
                  </span>
                  {[0.75, 0.9, 1.0, 1.15, 1.3].map((rate) => (
                    <button
                      key={rate}
                      type="button"
                      onClick={() => updateClip(selectedClip.id, { playbackRate: rate })}
                      className={`px-2 py-1 rounded-lg font-bold tabular-nums ${
                        selectedClip.playbackRate === rate
                          ? 'bg-blue-700 text-white'
                          : 'bg-slate-100 dark:bg-slate-800'
                      }`}
                    >
                      {rate}x
                    </button>
                  ))}
                </div>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedClip.removeSilence}
                    onChange={(e) =>
                      updateClip(selectedClip.id, { removeSilence: e.target.checked })
                    }
                    className="accent-blue-700 w-4 h-4"
                  />
                  <span className="font-semibold flex items-center gap-1 text-slate-700 dark:text-slate-200">
                    <Wand2 className="w-3.5 h-3.5 text-amber-500" />
                    <span>{isEn ? 'Auto-trim silences' : 'Supprimer les silences'}</span>
                  </span>
                </label>
              </div>
            </div>
          ) : (
            <div className="p-6 text-center rounded-2xl bg-white dark:bg-[#0c1631] border border-dashed border-slate-300 dark:border-slate-800 text-xs text-slate-500">
              {clips.length === 0
                ? isEn
                  ? 'Choose an Audio Template or record/import sounds from the left panel to begin.'
                  : 'Choisissez un Modèle Audio, enregistrez votre voix ou ajoutez des accords depuis le panneau gauche.'
                : isEn
                  ? 'Tap any clip on the timeline to trim, fade, speed up, or adjust volume.'
                  : 'Touchez un extrait sur la timeline pour le découper, déplacer, ajuster les fondus ou le volume.'}
            </div>
          )}

          {/* Export Controls */}
          {clips.length > 0 && (
            <div className="p-4 rounded-2xl bg-white dark:bg-[#0c1631] border border-slate-200/80 dark:border-slate-800/80 space-y-3">
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={isRendering}
                  onClick={() => handleMixAndExport('mp3')}
                  className="px-4 py-2.5 rounded-xl bg-blue-700 hover:bg-blue-800 disabled:opacity-60 text-white text-xs font-bold flex items-center gap-2 whitespace-nowrap"
                >
                  {isRendering ? <Loader2 className="w-4 h-4 animate-spin" /> : <Music className="w-4 h-4" />}
                  <span>{isEn ? 'Mix & Export MP3' : 'Assembler & Exporter MP3'}</span>
                </button>

                <button
                  type="button"
                  disabled={isRendering}
                  onClick={() => handleMixAndExport('wav')}
                  className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-900 disabled:opacity-60 text-white text-xs font-bold flex items-center gap-2 whitespace-nowrap"
                >
                  {isRendering ? <Loader2 className="w-4 h-4 animate-spin" /> : <Music className="w-4 h-4" />}
                  <span>{isEn ? 'Mix & Export WAV' : 'Assembler & Exporter WAV'}</span>
                </button>

                <button
                  type="button"
                  disabled={isRendering}
                  onClick={() => handleShareWithoutSaving('mp3')}
                  className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white text-xs font-bold flex items-center gap-2 whitespace-nowrap"
                >
                  <Share2 className="w-4 h-4" />
                  <span>{isEn ? 'Share without saving' : 'Partager sans enregistrer'}</span>
                </button>
              </div>

              {exportedUrl && (
                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3">
                  <audio src={exportedUrl} controls className="w-full" />
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={handleDownloadExported}
                      className="px-3.5 py-2 rounded-xl bg-slate-900 dark:bg-slate-700 text-white text-xs font-bold flex items-center gap-1.5 whitespace-nowrap"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>
                        {isEn ? 'Save to Downloads' : 'Télécharger'} (.{exportedFormat.toUpperCase()})
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveToParole}
                      className="px-3.5 py-2 rounded-xl bg-blue-700 hover:bg-blue-800 text-white text-xs font-bold flex items-center gap-1.5 whitespace-nowrap"
                    >
                      <Save className="w-3.5 h-3.5" />
                      <span>{isEn ? 'Parole Divine' : 'Dans Parole Divine'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveToVault}
                      className="px-3.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold flex items-center gap-1.5 whitespace-nowrap"
                    >
                      <Archive className="w-3.5 h-3.5" />
                      <span>{isEn ? 'Save to Vault' : 'Dans Mon Coffre'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleShareExported}
                      className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5 whitespace-nowrap"
                    >
                      <Share2 className="w-3.5 h-3.5" />
                      <span>{isEn ? 'Share' : 'Partager'}</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Direct Share Device File Without Saving */}
          <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-[#0c1631] border border-slate-200/80 dark:border-slate-800/80 flex flex-wrap items-center justify-between gap-2 text-xs">
            <span className="text-slate-600 dark:text-slate-300 font-medium">
              {isEn
                ? 'Need to share an existing audio file directly without saving it in SHALOM?'
                : 'Partager directement un fichier audio du téléphone sans l’enregistrer dans SHALOM :'}
            </span>
            <label className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold flex items-center gap-1.5 cursor-pointer whitespace-nowrap">
              <Share2 className="w-3.5 h-3.5" />
              <span>{isEn ? 'Share device file directly' : 'Partager un fichier du téléphone (sans enregistrer)'}</span>
              <input
                type="file"
                accept="audio/*,video/*"
                onChange={handleShareLocalFileDirect}
                className="hidden"
              />
            </label>
          </div>
        </div>
      </div>

      {/* Final Mix Preview Modal */}
      <Modal
        isOpen={showPreviewModal}
        onClose={() => setShowPreviewModal(false)}
        title={isEn ? 'Audio Studio Preview' : 'Aperçu final de votre création audio'}
        subtitle={`${projectTitle} · ${tracks.length} piste(s) · ${totalProjectDuration.toFixed(1)}s`}
        maxWidth="lg"
      >
        <div className="space-y-4 text-xs">
          <div className="p-4 rounded-xl bg-slate-950 text-white space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-bold text-amber-400">
                {isEn ? 'Master Mix Summary' : 'Résumé du mixage'}
              </span>
              <span className="tabular-nums text-slate-300">{totalProjectDuration.toFixed(1)}s</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] text-slate-300">
              <div className="p-2 rounded-lg bg-slate-900">EQ Graves: {masterFx.eqLowDb}dB</div>
              <div className="p-2 rounded-lg bg-slate-900">EQ Voix: {masterFx.eqMidDb}dB</div>
              <div className="p-2 rounded-lg bg-slate-900">EQ Aigus: {masterFx.eqHighDb}dB</div>
              <div className="p-2 rounded-lg bg-slate-900">Réverb: {Math.round(masterFx.reverbMix * 100)}%</div>
            </div>
            <button
              type="button"
              onClick={handleTogglePreview}
              className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold flex items-center justify-center gap-2"
            >
              {isPlayingPreview ? <Square className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current" />}
              <span>
                {isPlayingPreview
                  ? isEn
                    ? 'Stop Live Mix'
                    : 'Arrêter la lecture'
                  : isEn
                    ? 'Listen Live Mix'
                    : 'Écouter le mix complet'}
              </span>
            </button>
          </div>
          {exportedUrl && <audio src={exportedUrl} controls className="w-full" />}
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => setShowPreviewModal(false)}
              className="px-4 py-2 rounded-xl bg-slate-200 dark:bg-slate-800 font-bold flex items-center gap-1.5"
            >
              <X className="w-3.5 h-3.5" />
              <span>{isEn ? 'Close' : 'Fermer'}</span>
            </button>
          </div>
        </div>
      </Modal>

      <SocialShareModal
        isOpen={!!sharePayload}
        onClose={() => setSharePayload(null)}
        payload={sharePayload}
      />
    </div>
  );
};
