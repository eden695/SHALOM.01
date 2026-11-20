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
  ZoomIn,
  ZoomOut,
  Lock,
  Unlock,
  Flag,
  Sparkles,
  FolderHeart,
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
  ClipboardPaste,
  Headphones,
  LayoutTemplate,
  BookmarkPlus,
  Bold,
  Italic,
  Underline,
  FolderOpen,
  Pause,
} from 'lucide-react';
import { Mp3Encoder } from '@breezystack/lamejs';
import { useShalomDB } from '../../hooks/useShalomDB';
import { dbService, STORES } from '../../services/db';
import { useLanguage } from '../../contexts/LanguageContext';
import { CreativeDesignItem, RecordedParole, SavedStudioTemplate, VaultDocument } from '../../types';
import { SocialShareModal } from '../common/SocialShareModal';
import { SharePayload, normalizeMediaToShareFile } from '../../services/socialShare';
import {
  chooseShalomDownloadDirectory,
  downloadBlobToDevice,
  readFileAsVerifiedBlob,
  sanitizeFileName,
} from '../../services/fileTransfer';
import { ShalomFolderExplorerModal } from '../vault/ShalomFolderExplorerModal';
import { loadStudioDraft, saveStudioDraft } from '../../services/studioPersistence';
import { deleteSavedOnlineTemplate } from '../../services/studioTemplatesStore';
import {
  saveAssetResourceToShalom,
  saveTemplateBundleToShalom,
  fetchRemoteAssetVerifiedBlob,
} from '../../services/studios/offlineResources';
import { createSafeAudioContext } from '../../services/studios/canvasSafety';
import {
  searchOnlineTemplatesClient,
  searchOnlineMediaLibrary,
  OnlineMediaTrackResult,
} from '../../services/onlineStudioSearch';
import { Modal } from '../common/Modal';
import { StudioWorkspaceShell, StudioToolRailItem } from './shared/StudioWorkspaceShell';
import { WaveformClipView } from './shared/WaveformClipView';
import { ShalomResourcesPanel } from './shared/ShalomResourcesPanel';
import { TemplatePreviewCard } from './shared/TemplatePreviewCard';
import { HorizontalScrollRail } from './shared/HorizontalScrollRail';
import { StudioHomeScreen } from './shared/StudioHomeScreen';
import {
  TemplatePreviewModal,
  PreviewModalTemplateData,
} from './shared/TemplatePreviewModal';

type AudioToolTab =
  | 'templates'
  | 'record'
  | 'import'
  | 'synth'
  | 'online'
  | 'script'
  | 'fx'
  | 'shalom'
  | 'projects';

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
  reverbMix: number;
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
    scriptFr:
      'Shalom bien-aimés ! Aujourd’hui méditons ensemble sur Psaumes 23:1 : « L’Éternel est mon berger : je ne manquerai de rien. »\n\nPrenons un instant pour déposer nos fardeaux et accueillir Sa paix...',
    scriptEn:
      'Shalom beloved! Today let us meditate on Psalm 23:1: "The Lord is my shepherd; I shall not want."\n\nTake a quiet moment to lay down every burden and receive His peace...',
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
    scriptFr:
      'Inspirez profondément… « Je vous laisse la paix, je vous donne ma paix. » (Jean 14:27)\n\nLaissez cette vérité descendre dans votre cœur sans hâte.',
    scriptEn:
      'Breathe slowly… "Peace I leave with you, my peace I give to you." (John 14:27)\n\nLet this truth settle gently into your spirit.',
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
    scriptFr:
      'Rendez-vous spécial ce dimanche pour notre culte de louange et de prière ! Invitez un ami ou un membre de votre famille.',
    scriptEn:
      'Join us this Sunday for a special worship and prayer service! Invite a friend or family member.',
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
    const beatInterval = 60 / 80;
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

  // StudioWorkspaceShell tabs & inspector (opens on Studio Home Screen; drawers closed)
  const [isHomeView, setIsHomeView] = useState(true);
  const [activeToolTab, setActiveToolTab] = useState<AudioToolTab | null>(null);
  const [isInspectorOpen, setIsInspectorOpen] = useState(false);
  const [showShalomFolderModal, setShowShalomFolderModal] = useState(false);

  // Timeline view controls
  const [zoomPxPerSec, setZoomPxPerSec] = useState(48);
  const [snapEnabled, setSnapEnabled] = useState(true);
  const [isMultiSelectMode, setIsMultiSelectMode] = useState(false);
  const [copiedClips, setCopiedClips] = useState<AudioClipItem[]>([]);

  // Online templates search
  const [templateQuery, setTemplateQuery] = useState('');
  const [templateCategory, setTemplateCategory] = useState('all');
  const [onlineTemplates, setOnlineTemplates] = useState<AudioTemplateDef[]>([]);
  const [, setTemplatePage] = useState(1);
  const [templateHasMore, setTemplateHasMore] = useState(true);
  const [isSearchingOnline, setIsSearchingOnline] = useState(false);
  const [isLoadingMoreTemplates, setIsLoadingMoreTemplates] = useState(false);
  const [onlineStatusMsg, setOnlineStatusMsg] = useState<string | null>(null);
  const [savingResourceId, setSavingResourceId] = useState<string | null>(null);

  // Online audio library search
  const [onlineAudioQuery, setOnlineAudioQuery] = useState('');
  const [onlineAudioItems, setOnlineAudioItems] = useState<OnlineMediaTrackResult[]>([]);
  const [onlineAudioPage, setOnlineAudioPage] = useState(1);
  const [onlineAudioHasMore, setOnlineAudioHasMore] = useState(false);
  const [isSearchingOnlineAudio, setIsSearchingOnlineAudio] = useState(false);
  const [onlineAudioError, setOnlineAudioError] = useState<string | null>(null);
  const [loadingOnlineAudioId, setLoadingOnlineAudioId] = useState<string | null>(null);
  const [previewingTemplate, setPreviewingTemplate] = useState<AudioTemplateDef | null>(null);

  // Managed single online audio preview player (no overlapping tracks)
  const onlinePreviewAudioRef = useRef<HTMLAudioElement | null>(null);
  const [onlinePlayerState, setOnlinePlayerState] = useState<{
    itemId: string | null;
    playing: boolean;
    loading: boolean;
    currentTime: number;
    duration: number;
    error: string | null;
  }>({
    itemId: null,
    playing: false,
    loading: false,
    currentTime: 0,
    duration: 0,
    error: null,
  });

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
  const audioRulerRef = useRef<HTMLDivElement | null>(null);
  const isScrubbingAudioRef = useRef<boolean>(false);

  // Final preview modal + Export
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [isSavingProject, setIsSavingProject] = useState(false);
  const [isRendering, setIsRendering] = useState(false);
  const [exportedUrl, setExportedUrl] = useState<string | null>(null);
  const [exportedBlob, setExportedBlob] = useState<Blob | null>(null);
  const [exportedFormat, setExportedFormat] = useState<'wav' | 'mp3'>('mp3');
  const [notice, setNotice] = useState<string | null>(null);
  const [sharePayload, setSharePayload] = useState<SharePayload | null>(null);

  // Auto-draft recovery
  const [recoverableDraft, setRecoverableDraft] = useState<boolean>(false);
  const draftLoadedRef = useRef(false);

  const audioCtxRef = useRef<AudioContext | null>(null);

  const getAudioCtx = useCallback(() => {
    if (!audioCtxRef.current || audioCtxRef.current.state === 'closed') {
      const created = createSafeAudioContext();
      if (!created) {
        throw new Error(
          isEn
            ? 'Web Audio engine is unavailable on this WebView.'
            : 'Le moteur audio WebAudio est indisponible sur ce WebView.'
        );
      }
      audioCtxRef.current = created;
    }
    return audioCtxRef.current;
  }, [isEn]);

  const stopOnlinePreviewAudio = useCallback(() => {
    const audioEl = onlinePreviewAudioRef.current;
    if (audioEl) {
      try {
        audioEl.pause();
      } catch {
        // noop
      }
    }
    setOnlinePlayerState((prev) => ({
      ...prev,
      playing: false,
      loading: false,
    }));
  }, []);

  const toggleOnlineAudioPreview = useCallback(
    (item: OnlineMediaTrackResult) => {
      // Stop timeline playback so two players never overlap
      if (previewTimerRef.current) {
        clearInterval(previewTimerRef.current);
        previewTimerRef.current = null;
      }
      previewSourcesRef.current.forEach((s) => {
        try {
          s.stop();
        } catch {
          // noop
        }
      });
      previewSourcesRef.current = [];
      setIsPlayingPreview(false);

      let audioEl = onlinePreviewAudioRef.current;
      if (!audioEl) {
        audioEl = new Audio();
        audioEl.preload = 'metadata';
        onlinePreviewAudioRef.current = audioEl;
      }

      if (onlinePlayerState.itemId === item.id && audioEl.src) {
        if (onlinePlayerState.playing) {
          audioEl.pause();
          setOnlinePlayerState((p) => ({ ...p, playing: false, loading: false }));
        } else {
          setOnlinePlayerState((p) => ({ ...p, loading: true, error: null }));
          audioEl.play().catch(() => {
            setOnlinePlayerState((p) => ({
              ...p,
              playing: false,
              loading: false,
              error: isEn
                ? 'Online playback blocked or unsupported codec in this WebView.'
                : 'Lecture en ligne bloquée ou codec non supporté par ce lecteur.',
            }));
          });
        }
        return;
      }

      try {
        audioEl.pause();
      } catch {
        // noop
      }

      audioEl.onloadedmetadata = () => {
        const dur = Number.isFinite(audioEl!.duration) && audioEl!.duration > 0
          ? audioEl!.duration
          : item.durationSec || 0;
        setOnlinePlayerState((p) => (p.itemId === item.id ? { ...p, duration: dur } : p));
      };
      audioEl.ontimeupdate = () => {
        setOnlinePlayerState((p) =>
          p.itemId === item.id
            ? {
                ...p,
                currentTime: audioEl!.currentTime || 0,
                duration:
                  Number.isFinite(audioEl!.duration) && audioEl!.duration > 0
                    ? audioEl!.duration
                    : p.duration,
              }
            : p
        );
      };
      audioEl.onplaying = () => {
        setOnlinePlayerState((p) =>
          p.itemId === item.id ? { ...p, playing: true, loading: false, error: null } : p
        );
      };
      audioEl.onpause = () => {
        setOnlinePlayerState((p) =>
          p.itemId === item.id ? { ...p, playing: false, loading: false } : p
        );
      };
      audioEl.onended = () => {
        setOnlinePlayerState((p) =>
          p.itemId === item.id ? { ...p, playing: false, loading: false, currentTime: 0 } : p
        );
      };
      audioEl.onerror = () => {
        setOnlinePlayerState((p) =>
          p.itemId === item.id
            ? {
                ...p,
                playing: false,
                loading: false,
                error: isEn
                  ? 'Playback unavailable (network or WebView codec limitation).'
                  : 'Lecture directe impossible (réseau ou format non supporté par le lecteur).',
              }
            : p
        );
      };

      setOnlinePlayerState({
        itemId: item.id,
        playing: false,
        loading: true,
        currentTime: 0,
        duration: item.durationSec || 0,
        error: null,
      });

      audioEl.src = item.streamUrl;
      audioEl.load();
      audioEl.play().catch(() => {
        setOnlinePlayerState((p) =>
          p.itemId === item.id
            ? {
                ...p,
                playing: false,
                loading: false,
                error: isEn
                  ? 'Playback blocked by remote host or unsupported codec.'
                  : 'Lecture refusée par la source distante ou codec non pris en charge.',
              }
            : p
        );
      });
    },
    [onlinePlayerState.itemId, onlinePlayerState.playing, isEn]
  );

  const seekOnlineAudioPreview = useCallback((sec: number) => {
    const audioEl = onlinePreviewAudioRef.current;
    if (!audioEl) return;
    try {
      audioEl.currentTime = sec;
      setOnlinePlayerState((p) => ({ ...p, currentTime: sec }));
    } catch {
      // noop
    }
  }, []);

  useEffect(() => {
    if (activeToolTab !== 'online') {
      stopOnlinePreviewAudio();
    }
  }, [activeToolTab, stopOnlinePreviewAudio]);

  const scrubAudioFromClientX = useCallback(
    (clientX: number) => {
      const el = audioRulerRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const x = Math.max(0, clientX - rect.left);
      setPlayheadSec(Number((x / zoomPxPerSec).toFixed(2)));
    },
    [zoomPxPerSec]
  );

  useEffect(() => {
    const onMove = (ev: PointerEvent) => {
      if (!isScrubbingAudioRef.current) return;
      scrubAudioFromClientX(ev.clientX);
    };
    const onUp = () => {
      isScrubbingAudioRef.current = false;
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
  }, [scrubAudioFromClientX]);

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

  const handleCopySelectedClips = useCallback(() => {
    if (selectedClipIds.length === 0) return;
    const picked = clips.filter((c) => selectedClipIds.includes(c.id));
    if (picked.length === 0) return;
    setCopiedClips(picked.map((c) => ({ ...c })));
    setNotice(isEn ? `${picked.length} clip(s) copied.` : `${picked.length} extrait(s) copié(s).`);
  }, [selectedClipIds, clips, isEn]);

  const handlePasteCopiedClips = useCallback(() => {
    if (copiedClips.length === 0) return;
    pushHistory();
    const minOrigStart = Math.min(...copiedClips.map((c) => c.startTimeSec));
    const pasteOrigin = Number(playheadSec.toFixed(2));
    const newIds: string[] = [];
    const additions: AudioClipItem[] = copiedClips.map((c, idx) => {
      const nid = `clip_${Date.now()}_${idx}_${Math.random().toString(36).slice(2, 5)}`;
      newIds.push(nid);
      return {
        ...c,
        id: nid,
        name: c.name.endsWith('(copie)') ? c.name : `${c.name} (copie)`,
        startTimeSec: Number((pasteOrigin + Math.max(0, c.startTimeSec - minOrigStart)).toFixed(2)),
      };
    });
    setClips((prev) => [...prev, ...additions]);
    setSelectedClipIds(newIds);
    setNotice(
      isEn
        ? `${additions.length} clip(s) pasted at ${pasteOrigin}s.`
        : `${additions.length} extrait(s) collé(s) à ${pasteOrigin}s.`
    );
  }, [copiedClips, pushHistory, playheadSec, isEn]);

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
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c') {
        if (selectedClipIds.length > 0) {
          e.preventDefault();
          handleCopySelectedClips();
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'v') {
        if (copiedClips.length > 0) {
          e.preventDefault();
          handlePasteCopiedClips();
        }
      } else if (e.key === 'Delete' && selectedClipIds.length > 0) {
        e.preventDefault();
        pushHistory();
        setClips((prev) => prev.filter((c) => !selectedClipIds.includes(c.id)));
        setSelectedClipIds([]);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    handleUndo,
    handleRedo,
    selectedClipIds,
    pushHistory,
    handleCopySelectedClips,
    handlePasteCopiedClips,
    copiedClips.length,
  ]);

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
      if (onlinePreviewAudioRef.current) {
        try {
          onlinePreviewAudioRef.current.pause();
          onlinePreviewAudioRef.current.src = '';
        } catch {
          // noop
        }
      }
      micStreamRef.current?.getTracks().forEach((t) => t.stop());
      if (exportedUrl) URL.revokeObjectURL(exportedUrl);
    };
  }, [exportedUrl]);

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

  const deserializeAndLoadProject = async (
    title: string,
    projectJson: string,
    projectId: string | null
  ) => {
    const parsed = JSON.parse(projectJson) as SerializedAudioProject;
    if (!parsed || typeof parsed !== 'object') {
      throw new Error(isEn ? 'Invalid audio project format.' : 'Format de projet audio invalide.');
    }
    const ctx = getAudioCtx();
    const restoredClips: AudioClipItem[] = [];

    for (const sc of Array.isArray(parsed.clips) ? parsed.clips : []) {
      if (!sc?.assetKey) continue;
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
      setActiveToolTab(null);
      setIsHomeView(false);
      setIsInspectorOpen(false);
      setNotice(
        isEn ? 'Previous audio session restored.' : 'Brouillon audio restauré automatiquement !'
      );
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
    explicitGain = 1.0,
    assetKey?: string
  ) => {
    const tId = targetTrackId || selectedTrackId;
    const startAt = explicitStartSec !== undefined ? explicitStartSec : getNextStartForTrack(tId);
    const id = `clip_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const item: AudioClipItem = {
      id,
      trackId: tId,
      name,
      buffer,
      assetKey,
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
    setActiveToolTab(null);
    setIsHomeView(false);
    setIsInspectorOpen(false);
  };

  const decodeBlobToClip = async (
    blob: Blob,
    name: string,
    targetTrackId?: string,
    assetKey?: string
  ) => {
    const ctx = getAudioCtx();
    const arr = await blob.arrayBuffer();
    const buffer = await ctx.decodeAudioData(arr.slice(0));
    pushHistory();
    addBufferAsClip(buffer, name, targetTrackId, undefined, 1.0, assetKey);
  };

  const handleStartBlankAudioProject = () => {
    setCurrentProjectId(null);
    setProjectTitle(isEn ? 'Untitled Audio Project' : 'Nouveau projet audio');
    setTracks(DEFAULT_TRACKS.map((t) => ({ ...t })));
    setSelectedTrackId('track_1');
    setClips([]);
    setSelectedClipIds([]);
    setMarkers([]);
    setScriptText('');
    setPlayheadSec(0);
    setUndoStack([]);
    setRedoStack([]);
    setActiveToolTab(null);
    setIsInspectorOpen(false);
    setIsHomeView(false);
  };

  const handleApplyTemplate = async (tpl: AudioTemplateDef) => {
    try {
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
      setCurrentProjectId(null);
      setTracks(nextTracks);
      if (nextTracks[0]) setSelectedTrackId(nextTracks[0].id);
      setClips(nextClips);
      setMarkers(tpl.markers.map((m) => ({ ...m })));
      setScriptText(isEn ? tpl.scriptEn : tpl.scriptFr);
      setProjectTitle(isEn ? tpl.titleEn : tpl.titleFr);
      setSelectedClipIds(nextClips[0] ? [nextClips[0].id] : []);
      setActiveToolTab(null);
      setIsHomeView(false);
      setIsInspectorOpen(false);
      setNotice(
        isEn
          ? `Template "${tpl.titleEn}" loaded onto timeline!`
          : `Modèle « ${tpl.titleFr} » chargé sur la timeline !`
      );
    } catch (err) {
      setNotice(
        err instanceof Error
          ? err.message
          : isEn
            ? 'Could not initialize template audio tracks.'
            : 'Impossible d’initialiser ce modèle audio.'
      );
    }
  };

  const handleSaveTemplateToShalom = async (tpl: AudioTemplateDef) => {
    setSavingResourceId(tpl.id);
    try {
      const title = isEn ? tpl.titleEn : tpl.titleFr;
      await saveTemplateBundleToShalom({
        id: tpl.id,
        studioType: 'audio',
        title,
        category: tpl.category || 'Audio',
        templateObj: tpl as unknown as Record<string, unknown>,
        previewColor: tpl.badgeColor,
        previewDataUrl: generateAudioCoverThumbnail(
          title,
          tpl.tracks.length,
          tpl.synthAdditions.reduce((m, s) => Math.max(m, s.startTimeSec + s.duration), 8)
        ),
        source: tpl.source || 'online-catalog',
      });
      reloadData();
      setNotice(
        isEn
          ? `"${title}" saved into My SHALOM Resources (verified offline)!`
          : `« ${title} » enregistré dans « Mes ressources SHALOM » (vérifié hors-ligne) !`
      );
    } catch (err) {
      setNotice(
        err instanceof Error
          ? err.message
          : isEn
            ? 'Could not save template offline.'
            : 'Impossible d’enregistrer ce modèle hors-ligne.'
      );
    } finally {
      setSavingResourceId(null);
    }
  };

  const handleSaveOnlineAudioToShalom = async (item: OnlineMediaTrackResult) => {
    setSavingResourceId(item.id);
    try {
      await saveAssetResourceToShalom({
        id: item.id,
        studioType: 'audio',
        resourceType: 'audio',
        title: item.title,
        category: 'Audio en ligne',
        remoteUrl: item.streamUrl,
        attribution: item.author,
        license: item.license || 'Wikimedia Commons',
        source: 'online-live',
      });
      reloadData();
      setNotice(
        isEn
          ? `"${item.title}" saved in My SHALOM Resources (verified offline)!`
          : `« ${item.title} » enregistré dans « Mes ressources SHALOM » (vérifié hors-ligne) !`
      );
    } catch (err) {
      setNotice(
        err instanceof Error
          ? err.message
          : isEn
            ? 'Could not save remote audio offline.'
            : 'Impossible de télécharger ce son pour le mode hors-ligne.'
      );
    } finally {
      setSavingResourceId(null);
    }
  };

  const handleApplyShalomResource = async (savedItem: SavedStudioTemplate) => {
    try {
      if (savedItem.resourceType && savedItem.resourceType !== 'template') {
        const meta = JSON.parse(savedItem.templateJson) as {
          assetKey?: string;
          mimeType?: string;
        };
        if (!meta.assetKey) {
          throw new Error(isEn ? 'Missing asset key.' : 'Identifiant média manquant.');
        }
        const blob = await dbService.getMediaBlob(meta.assetKey);
        if (!blob) {
          throw new Error(isEn ? 'Offline audio blob missing.' : 'Fichier audio local introuvable.');
        }
        await decodeBlobToClip(blob, savedItem.title, undefined, meta.assetKey);
        setNotice(
          isEn
            ? `Inserted offline resource "${savedItem.title}".`
            : `Ressource hors-ligne « ${savedItem.title} » ajoutée à la piste !`
        );
      } else {
        const parsed = JSON.parse(savedItem.templateJson) as AudioTemplateDef;
        await handleApplyTemplate(parsed);
      }
    } catch (err) {
      setNotice(
        err instanceof Error
          ? err.message
          : isEn
            ? 'Could not open saved resource.'
            : 'Impossible d’ouvrir cette ressource enregistrée.'
      );
    }
  };

  const handleDeleteShalomResource = async (savedItem: SavedStudioTemplate) => {
    await deleteSavedOnlineTemplate(savedItem.id);
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
      await decodeBlobToClip(blob, rec.title, undefined, rec.blobKey);
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
    try {
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
    } catch (err) {
      setNotice(
        err instanceof Error
          ? err.message
          : isEn
            ? 'Could not synthesize audio clip.'
            : 'Impossible de générer la piste synthé.'
      );
    }
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
        const result = await searchOnlineTemplatesClient<AudioTemplateDef>({
          studioType: 'audio',
          query: q,
          category: cat,
          lang: isEn ? 'en' : 'fr',
          page: targetPage,
          excludeTitles,
        });
        const incoming = result.templates.map((tpl) => ({
          ...tpl,
          source: tpl.source || ('online-catalog' as const),
        }));
        setTemplatePage(targetPage);
        setTemplateHasMore(result.hasMore);
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
      } catch {
        setOnlineStatusMsg(
          isEn
            ? 'Offline mode: showing local & saved templates.'
            : 'Mode hors-ligne : modèles locaux et conservés affichés.'
        );
      } finally {
        setIsSearchingOnline(false);
        setIsLoadingMoreTemplates(false);
      }
    },
    [templateQuery, templateCategory, isEn, onlineTemplates]
  );

  const handleSearchOnlineAudio = useCallback(
    async (overrideQuery?: string, appendPage?: number) => {
      const q =
        (overrideQuery !== undefined ? overrideQuery : onlineAudioQuery).trim() || 'worship gospel';
      const targetPage = appendPage && appendPage > 1 ? appendPage : 1;
      setIsSearchingOnlineAudio(true);
      setOnlineAudioError(null);
      try {
        const res = await searchOnlineMediaLibrary({
          mediaKind: 'audio',
          query: q,
          page: targetPage,
          lang: isEn ? 'en' : 'fr',
        });
        setOnlineAudioPage(targetPage);
        setOnlineAudioHasMore(res.hasMore);
        setOnlineAudioItems((prev) => {
          if (targetPage === 1) return res.items;
          const seen = new Set(prev.map((i) => i.id));
          return [...prev, ...res.items.filter((i) => !seen.has(i.id))];
        });
        if (res.networkError && res.items.length === 0) {
          setOnlineAudioError(res.networkError);
        } else if (res.items.length === 0) {
          setOnlineAudioError(
            isEn
              ? 'No audio files found for this search.'
              : 'Aucun fichier audio trouvé pour cette recherche.'
          );
        }
      } catch (err) {
        setOnlineAudioError(
          err instanceof Error
            ? err.message
            : isEn
              ? 'Online audio search failed.'
              : 'Impossible de contacter la bibliothèque audio en ligne.'
        );
      } finally {
        setIsSearchingOnlineAudio(false);
      }
    },
    [onlineAudioQuery, isEn]
  );

  const handleInsertOnlineAudio = async (item: OnlineMediaTrackResult) => {
    setLoadingOnlineAudioId(item.id);
    setOnlineAudioError(null);
    try {
      const blob = await fetchRemoteAssetVerifiedBlob(item.streamUrl, 'audio');
      await decodeBlobToClip(blob, item.title);
      setNotice(
        isEn ? `Added "${item.title}" to track.` : `« ${item.title} » ajouté à la piste audio.`
      );
    } catch {
      setOnlineAudioError(
        isEn
          ? 'This remote audio file could not be decoded.'
          : 'Ce fichier audio distant n’a pas pu être décodé.'
      );
    } finally {
      setLoadingOnlineAudioId(null);
    }
  };

  const handleDownloadOnlineAudio = async (item: OnlineMediaTrackResult) => {
    setLoadingOnlineAudioId(item.id);
    try {
      const blob = await fetchRemoteAssetVerifiedBlob(item.streamUrl, 'audio');
      const ext = item.mimeType.includes('ogg')
        ? 'ogg'
        : item.mimeType.includes('wav')
          ? 'wav'
          : 'mp3';
      const fileName = sanitizeFileName(item.title, 'shalom_audio', ext);
      const res = await downloadBlobToDevice(blob, fileName, blob.type || item.mimeType);
      if (res.ok) {
        setNotice(
          isEn
            ? `Downloaded "${res.fileName}" to ${res.locationLabel}.`
            : `Audio « ${res.fileName} » enregistré dans ${res.locationLabel} !`
        );
      }
    } catch {
      setOnlineAudioError(
        isEn
          ? 'Could not download this remote file.'
          : 'Téléchargement direct impossible pour cette source.'
      );
    } finally {
      setLoadingOnlineAudioId(null);
    }
  };

  const handleShareOnlineAudioDirect = async (item: OnlineMediaTrackResult) => {
    setLoadingOnlineAudioId(item.id);
    try {
      const blob = await fetchRemoteAssetVerifiedBlob(item.streamUrl, 'audio');
      const ext = item.mimeType.includes('ogg')
        ? 'ogg'
        : item.mimeType.includes('wav')
          ? 'wav'
          : 'mp3';
      const fileName = sanitizeFileName(item.title, 'shalom_audio', ext);
      const file = await normalizeMediaToShareFile(
        blob,
        fileName,
        'audio',
        blob.type || item.mimeType
      );
      setSharePayload({
        title: item.title,
        text: `🎵 ${item.title}\n\nPartagé sans enregistrement depuis SHALOM Studio Audio`,
        file,
      });
    } catch {
      setSharePayload({
        title: item.title,
        text: `🎵 ${item.title}\n${item.streamUrl}`,
      });
    } finally {
      setLoadingOnlineAudioId(null);
    }
  };

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
      const hay =
        `${tpl.titleFr} ${tpl.titleEn} ${tpl.descFr} ${tpl.category || ''} ${(tpl.tags || []).join(' ')}`.toLowerCase();
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

    stopOnlinePreviewAudio();
    let ctx: AudioContext;
    try {
      ctx = getAudioCtx();
      if (ctx.state === 'suspended') await ctx.resume();
    } catch (err) {
      setNotice(err instanceof Error ? err.message : 'Erreur lecture audio');
      return;
    }

    const startOffset =
      playheadSec >= Math.max(0.2, totalProjectDuration - 0.1) ? 0 : playheadSec;
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
      const elapsed =
        previewStartOffsetRef.current + (performance.now() - previewStartWallRef.current) / 1000;
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
      const OfflineCtx =
        window.OfflineAudioContext ||
        (window as unknown as { webkitOfflineAudioContext?: typeof OfflineAudioContext })
          .webkitOfflineAudioContext;
      if (!OfflineCtx) {
        throw new Error(
          isEn
            ? 'Offline audio rendering is not supported on this WebView.'
            : 'Le rendu audio hors-ligne n’est pas supporté sur ce WebView.'
        );
      }
      const offline = new OfflineCtx(2, totalFrames, sampleRate);
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

        if (typeof offline.createStereoPanner === 'function') {
          const panner = offline.createStereoPanner();
          panner.pan.value = clip.pan;
          src.connect(gainNode);
          gainNode.connect(panner);
          panner.connect(masterBus);
        } else {
          src.connect(gainNode);
          gainNode.connect(masterBus);
        }
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
    setShowPreviewModal(true);
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
        thumbnailDataUrl: generateAudioCoverThumbnail(
          projectTitle,
          tracks.length,
          totalProjectDuration
        ),
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
          : 'Projet audio sauvegardé ! Retrouvez-le dans « Projets » pour reprendre plus tard.'
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
      setActiveToolTab(null);
      setIsHomeView(false);
      setIsInspectorOpen(false);
      setNotice(
        isEn
          ? `Project "${proj.title}" opened!`
          : `Projet « ${proj.title} » rouvert pour édition.`
      );
    } catch {
      setNotice(
        isEn ? 'Could not reopen this project.' : 'Impossible de rouvrir ce projet audio.'
      );
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

  const handleSelectClip = (clipId: string) => {
    if (isMultiSelectMode) {
      setSelectedClipIds((prev) =>
        prev.includes(clipId) ? prev.filter((x) => x !== clipId) : [...prev, clipId]
      );
    } else {
      setSelectedClipIds([clipId]);
      setIsInspectorOpen(true);
    }
  };

  const timelineSecondsSpan = Math.max(20, Math.ceil(totalProjectDuration + 6));
  const timelineWidthPx = Math.max(620, timelineSecondsSpan * zoomPxPerSec);
  const selectedClip = clips.find((c) => c.id === selectedClipIds[0]) || null;

  const toolItems: StudioToolRailItem[] = useMemo(
    () => [
      { id: 'templates', label: isEn ? 'Templates' : 'Modèles', icon: LayoutTemplate },
      { id: 'record', label: isEn ? 'Mic' : 'Micro', icon: Mic },
      { id: 'import', label: isEn ? 'Import' : 'Importer', icon: Upload },
      { id: 'synth', label: isEn ? 'Synth' : 'Synthé', icon: Music },
      { id: 'online', label: isEn ? 'Online' : 'En ligne', icon: Globe },
      { id: 'script', label: isEn ? 'Script' : 'Texte', icon: AlignLeft },
      { id: 'fx', label: isEn ? 'Mix & FX' : 'Mix FX', icon: Sliders },
      {
        id: 'shalom',
        label: 'SHALOM',
        icon: FolderHeart,
        badge: customTemplates.filter((t) => t.studioType === 'audio').length,
      },
      {
        id: 'projects',
        label: isEn ? 'Projects' : 'Projets',
        icon: Archive,
        badge: savedAudioProjects.length,
      },
    ],
    [isEn, customTemplates, savedAudioProjects.length]
  );

  // LEFT DRAWER PANELS
  const renderToolDrawerContent = () => {
    if (activeToolTab === 'templates') {
      return (
        <div className="space-y-3 text-xs">
          <div className="flex gap-1.5">
            <div className="relative flex-1">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={templateQuery}
                onChange={(e) => setTemplateQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSearchOnlineTemplates();
                }}
                placeholder={isEn ? 'Podcast, worship, meditation...' : 'Podcast, louange, méditation...'}
                className="w-full pl-8 pr-2.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
              />
            </div>
            <button
              type="button"
              onClick={() => handleSearchOnlineTemplates()}
              disabled={isSearchingOnline}
              className="px-3 py-2 rounded-xl bg-blue-700 hover:bg-blue-800 text-white font-bold flex items-center gap-1 shrink-0"
            >
              {isSearchingOnline ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Globe className="w-3.5 h-3.5" />}
            </button>
          </div>

          <HorizontalScrollRail wrapOnDesktop innerClassName="gap-1">
            {['all', 'Verset', 'Méditation', 'Église', 'Louange'].map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => {
                  setTemplateCategory(cat);
                  handleSearchOnlineTemplates(templateQuery, cat, 1);
                }}
                className={`shrink-0 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold whitespace-nowrap transition ${
                  templateCategory === cat
                    ? 'bg-blue-700 text-white'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                }`}
              >
                {cat === 'all' ? (isEn ? 'All' : 'Tous') : cat}
              </button>
            ))}
          </HorizontalScrollRail>

          {onlineStatusMsg && (
            <div className="text-[11px] font-medium text-blue-700 dark:text-blue-400">
              {onlineStatusMsg}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-2.5">
            {displayedAudioTemplates.map((tpl) => {
              const title = isEn ? tpl.titleEn : tpl.titleFr;
              const desc = isEn ? tpl.descEn : tpl.descFr;
              const isSavingThis = savingResourceId === tpl.id;
              const isSaved = customTemplates.some(
                (t) => t.id === tpl.id && t.studioType === 'audio'
              );
              return (
                <TemplatePreviewCard
                  key={tpl.id}
                  id={tpl.id}
                  kind="audio"
                  title={title}
                  category={tpl.category}
                  subtitle={desc}
                  badgeColor={tpl.badgeColor}
                  tracks={tpl.tracks}
                  synthAdditions={tpl.synthAdditions}
                  markers={tpl.markers}
                  isSaved={isSaved}
                  isSavingOffline={isSavingThis}
                  onSaveOffline={() => handleSaveTemplateToShalom(tpl)}
                  onSelectPreview={() => setPreviewingTemplate(tpl)}
                  isEn={isEn}
                />
              );
            })}
          </div>

          {templateHasMore && (
            <button
              type="button"
              disabled={isLoadingMoreTemplates}
              onClick={() => handleSearchOnlineTemplates(undefined, undefined, onlineTemplates.length ? 2 : 1)}
              className="w-full py-2 rounded-xl border border-blue-300 dark:border-blue-800 text-blue-700 dark:text-blue-400 font-bold hover:bg-blue-50 dark:hover:bg-blue-950/30"
            >
              {isLoadingMoreTemplates ? (isEn ? 'Loading...' : 'Chargement...') : isEn ? 'Load more templates' : 'Charger plus de modèles'}
            </button>
          )}
        </div>
      );
    }

    if (activeToolTab === 'record') {
      return (
        <div className="space-y-3 text-xs">
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2.5">
            <div className="font-bold text-slate-900 dark:text-white">
              {isEn ? 'Direct Voiceover / Sermons' : 'Enregistrement micro direct'}
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              {isEn
                ? 'Records straight onto your currently selected track.'
                : 'Enregistre directement sur la piste sélectionnée sur la timeline.'}
            </p>
            <button
              type="button"
              onClick={handleToggleMicRecord}
              className={`w-full min-h-[46px] px-4 py-2.5 rounded-xl font-bold flex items-center justify-center gap-2 transition ${
                isRecordingMic
                  ? 'bg-rose-600 hover:bg-rose-700 text-white animate-pulse'
                  : 'bg-blue-700 hover:bg-blue-800 text-white'
              }`}
            >
              {isRecordingMic ? <Square className="w-4 h-4 fill-current" /> : <Mic className="w-4 h-4" />}
              <span className="tabular-nums">
                {isRecordingMic
                  ? `${isEn ? 'Stop Recording' : 'Arrêter la prise'} (${micSeconds}s)`
                  : isEn
                    ? 'Record Voice'
                    : 'Enregistrer ma voix'}
              </span>
            </button>
          </div>
        </div>
      );
    }

    if (activeToolTab === 'import') {
      return (
        <div className="space-y-3 text-xs">
          <label className="w-full min-h-[46px] px-3 py-2.5 rounded-xl bg-blue-700 hover:bg-blue-800 text-white font-bold flex items-center justify-center gap-2 cursor-pointer">
            <Upload className="w-4 h-4" />
            <span>{isEn ? 'Import Audio Files (MP3/WAV)' : 'Importer des sons (MP3/WAV/M4A)'}</span>
            <input
              type="file"
              accept="audio/*"
              multiple
              onChange={handleImportAudioFiles}
              className="hidden"
            />
          </label>

          <div className="space-y-1.5">
            <div className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
              <FileAudio className="w-3.5 h-3.5 text-amber-500" />
              <span>{isEn ? 'From Parole Divine' : 'Depuis Parole Divine'}</span>
            </div>
            {recordings.filter((r) => r.mediaType === 'audio').length === 0 ? (
              <p className="text-[11px] text-slate-500 italic">
                {isEn ? 'No recordings in Parole Divine.' : 'Aucun enregistrement audio dans Parole Divine.'}
              </p>
            ) : (
              <div className="space-y-1.5 max-h-60 overflow-y-auto">
                {recordings
                  .filter((r) => r.mediaType === 'audio')
                  .slice(0, 12)
                  .map((r) => (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => handleImportFromParole(r.id)}
                      className="w-full text-left p-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-blue-400 flex items-center justify-between gap-2"
                    >
                      <span className="font-semibold truncate">{r.title}</span>
                      <span className="text-[10px] text-blue-600 font-bold shrink-0">+ Piste</span>
                    </button>
                  ))}
              </div>
            )}
          </div>
        </div>
      );
    }

    if (activeToolTab === 'synth') {
      return (
        <div className="space-y-3 text-xs">
          <div>
            <label className="block font-bold text-slate-700 dark:text-slate-200 mb-1">
              {isEn ? 'Acoustic Pad / Instrument' : 'Accord / Instrument Synthé'}
            </label>
            <select
              value={synthPreset}
              onChange={(e) => setSynthPreset(e.target.value as SynthPresetId)}
              className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700"
            >
              <option value="c_major">Accord Do majeur (Doux)</option>
              <option value="g_warm">Accord Sol chaleureux</option>
              <option value="a_minor">Accord La mineur (Prière)</option>
              <option value="soft_bell">Cloche méditation</option>
              <option value="chime">Carillon transition</option>
              <option value="swell">Montée lumineuse</option>
              <option value="metronome">Métronome 80 BPM</option>
              <option value="silence">Silence (Espace)</option>
            </select>
          </div>
          <div>
            <label className="block font-bold text-slate-700 dark:text-slate-200 mb-1 tabular-nums">
              {isEn ? 'Duration' : 'Durée'} : {synthDuration}s
            </label>
            <input
              type="range"
              min={1}
              max={30}
              value={synthDuration}
              onChange={(e) => setSynthDuration(Number(e.target.value))}
              className="w-full accent-blue-700"
            />
          </div>
          <button
            type="button"
            onClick={() => handleGenerateSynthClip()}
            className="w-full min-h-[44px] px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-extrabold flex items-center justify-center gap-2"
          >
            <Sparkles className="w-4 h-4" />
            <span>{isEn ? 'Generate & Insert' : 'Générer sur la piste'}</span>
          </button>
        </div>
      );
    }

    if (activeToolTab === 'online') {
      return (
        <div className="space-y-3 text-xs">
          <div className="flex gap-1.5">
            <div className="relative flex-1">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={onlineAudioQuery}
                onChange={(e) => setOnlineAudioQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSearchOnlineAudio();
                }}
                placeholder={isEn ? 'Piano, harp, bell, hymn...' : 'Piano, harpe, cloche, hymne...'}
                className="w-full pl-8 pr-2.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700"
              />
            </div>
            <button
              type="button"
              onClick={() => handleSearchOnlineAudio()}
              disabled={isSearchingOnlineAudio}
              className="px-3 py-2 rounded-xl bg-blue-700 hover:bg-blue-800 text-white font-bold flex items-center gap-1"
            >
              {isSearchingOnlineAudio ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Search className="w-3.5 h-3.5" />
              )}
            </button>
          </div>

          <HorizontalScrollRail wrapOnDesktop innerClassName="gap-1">
            {['piano', 'harp', 'choir', 'bell', 'rain', 'organ'].map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => {
                  setOnlineAudioQuery(tag);
                  handleSearchOnlineAudio(tag, 1);
                }}
                className="shrink-0 px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-blue-100 dark:hover:bg-blue-900/40 text-[11px] font-semibold whitespace-nowrap"
              >
                {tag}
              </button>
            ))}
          </HorizontalScrollRail>

          {onlineAudioError && (
            <div className="p-2 rounded-lg bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-300 text-[11px]">
              {onlineAudioError}
            </div>
          )}

          <div className="space-y-2.5">
            {onlineAudioItems.map((item) => {
              const isBusy = loadingOnlineAudioId === item.id;
              const isSaving = savingResourceId === item.id;
              const isThisActive = onlinePlayerState.itemId === item.id;
              const isThisPlaying = isThisActive && onlinePlayerState.playing;
              const isThisLoading = isThisActive && onlinePlayerState.loading;
              const activeDuration =
                isThisActive && onlinePlayerState.duration > 0
                  ? onlinePlayerState.duration
                  : item.durationSec || 0;
              const formatSec = (s: number) => {
                if (!Number.isFinite(s) || s <= 0) return '0:00';
                const total = Math.floor(s);
                const m = Math.floor(total / 60);
                const rem = total % 60;
                return `${m}:${rem < 10 ? '0' : ''}${rem}`;
              };
              const mimeLabel = item.mimeType.includes('ogg')
                ? 'OGG'
                : item.mimeType.includes('wav')
                  ? 'WAV'
                  : item.mimeType.includes('flac')
                    ? 'FLAC'
                    : item.mimeType.includes('mpeg') || item.mimeType.includes('mp3')
                      ? 'MP3'
                      : 'AUDIO';

              return (
                <div
                  key={item.id}
                  className={`p-2.5 rounded-xl border space-y-2 transition ${
                    isThisActive
                      ? 'bg-blue-50/70 dark:bg-blue-950/30 border-blue-400 dark:border-blue-700'
                      : 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="font-bold truncate text-slate-900 dark:text-white">
                        {item.title}
                      </div>
                      <div className="flex flex-wrap items-center gap-1 mt-1 text-[10px]">
                        <span className="px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold tabular-nums">
                          {activeDuration > 0 ? formatSec(activeDuration) : 'Flux audio'}
                        </span>
                        <span className="px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 font-bold">
                          {mimeLabel}
                        </span>
                        {(item.license || item.author) && (
                          <span className="text-slate-500 dark:text-slate-400 truncate max-w-[160px]">
                            {[item.author, item.license].filter(Boolean).join(' · ')}
                          </span>
                        )}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => toggleOnlineAudioPreview(item)}
                      className={`min-h-[38px] px-2.5 py-1.5 rounded-lg font-bold text-[11px] flex items-center gap-1 shrink-0 transition ${
                        isThisPlaying
                          ? 'bg-rose-600 hover:bg-rose-700 text-white'
                          : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                      }`}
                    >
                      {isThisLoading ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : isThisPlaying ? (
                        <Pause className="w-3.5 h-3.5 fill-current" />
                      ) : (
                        <Play className="w-3.5 h-3.5 fill-current" />
                      )}
                      <span>
                        {isThisPlaying
                          ? isEn
                            ? 'Pause'
                            : 'Pause'
                          : isEn
                            ? 'Preview'
                            : 'Écouter'}
                      </span>
                    </button>
                  </div>

                  {isThisActive && (
                    <div className="p-2 rounded-lg bg-white/80 dark:bg-[#081024] border border-slate-200 dark:border-slate-800 space-y-1.5">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold tabular-nums text-slate-600 dark:text-slate-300 w-9">
                          {formatSec(onlinePlayerState.currentTime)}
                        </span>
                        <input
                          type="range"
                          min={0}
                          max={Math.max(1, activeDuration || 30)}
                          step={0.25}
                          value={Math.min(
                            Math.max(1, activeDuration || 30),
                            onlinePlayerState.currentTime
                          )}
                          onChange={(e) => seekOnlineAudioPreview(Number(e.target.value))}
                          className="flex-1 accent-blue-700"
                          aria-label="Position lecture"
                        />
                        <span className="text-[10px] font-bold tabular-nums text-slate-500 w-9 text-right">
                          {activeDuration > 0 ? formatSec(activeDuration) : '--:--'}
                        </span>
                      </div>
                      {onlinePlayerState.error && (
                        <div className="text-[10px] font-semibold text-rose-600 dark:text-rose-400">
                          {onlinePlayerState.error}
                        </div>
                      )}
                    </div>
                  )}

                  <HorizontalScrollRail wrapOnDesktop innerClassName="gap-1">
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => handleInsertOnlineAudio(item)}
                      className="shrink-0 flex-1 min-h-[38px] px-2.5 py-1 rounded-lg bg-blue-700 hover:bg-blue-800 text-white font-bold text-[11px] flex items-center justify-center gap-1 whitespace-nowrap"
                    >
                      {isBusy ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
                      <span>{isEn ? 'Insert' : 'Piste'}</span>
                    </button>
                    <button
                      type="button"
                      disabled={isSaving}
                      onClick={() => handleSaveOnlineAudioToShalom(item)}
                      className="shrink-0 min-h-[38px] px-2.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-600 text-slate-950 font-extrabold text-[11px] flex items-center gap-1 whitespace-nowrap"
                    >
                      {isSaving ? <Loader2 className="w-3 h-3 animate-spin" /> : <BookmarkPlus className="w-3 h-3" />}
                      <span>SHALOM</span>
                    </button>
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => handleDownloadOnlineAudio(item)}
                      title="Télécharger"
                      className="shrink-0 min-h-[38px] px-2.5 py-1 rounded-lg bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => handleShareOnlineAudioDirect(item)}
                      title="Partager sans enregistrer"
                      className="shrink-0 min-h-[38px] px-2.5 py-1 rounded-lg bg-emerald-600 text-white"
                    >
                      <Share2 className="w-3.5 h-3.5" />
                    </button>
                  </HorizontalScrollRail>
                </div>
              );
            })}
          </div>

          {onlineAudioHasMore && (
            <button
              type="button"
              onClick={() => handleSearchOnlineAudio(undefined, onlineAudioPage + 1)}
              className="w-full py-2 rounded-xl border border-blue-300 text-blue-700 font-bold"
            >
              {isEn ? 'Load more sounds' : 'Charger plus de sons'}
            </button>
          )}
        </div>
      );
    }

    if (activeToolTab === 'script') {
      return (
        <div className="space-y-3 text-xs">
          <HorizontalScrollRail
            wrapOnDesktop
            innerClassName="gap-1 p-1.5"
            className="rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800"
          >
            <button
              type="button"
              onClick={() => setScriptStyle((s) => ({ ...s, bold: !s.bold }))}
              className={`shrink-0 min-w-[34px] min-h-[34px] rounded-lg flex items-center justify-center ${
                scriptStyle.bold ? 'bg-blue-700 text-white' : 'text-slate-600 dark:text-slate-300'
              }`}
              title="Gras"
            >
              <Bold className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setScriptStyle((s) => ({ ...s, italic: !s.italic }))}
              className={`shrink-0 min-w-[34px] min-h-[34px] rounded-lg flex items-center justify-center ${
                scriptStyle.italic ? 'bg-blue-700 text-white' : 'text-slate-600 dark:text-slate-300'
              }`}
              title="Italique"
            >
              <Italic className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setScriptStyle((s) => ({ ...s, underline: !s.underline }))}
              className={`shrink-0 min-w-[34px] min-h-[34px] rounded-lg flex items-center justify-center ${
                scriptStyle.underline ? 'bg-blue-700 text-white' : 'text-slate-600 dark:text-slate-300'
              }`}
              title="Souligné"
            >
              <Underline className="w-3.5 h-3.5" />
            </button>
            <span className="shrink-0 h-4 w-px bg-slate-300 dark:bg-slate-700 mx-0.5" />
            <button
              type="button"
              onClick={() => setScriptStyle((s) => ({ ...s, align: 'left' }))}
              className={`shrink-0 min-w-[34px] min-h-[34px] rounded-lg flex items-center justify-center ${
                scriptStyle.align === 'left' ? 'bg-blue-700 text-white' : 'text-slate-600 dark:text-slate-300'
              }`}
            >
              <AlignLeft className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setScriptStyle((s) => ({ ...s, align: 'center' }))}
              className={`shrink-0 min-w-[34px] min-h-[34px] rounded-lg flex items-center justify-center ${
                scriptStyle.align === 'center' ? 'bg-blue-700 text-white' : 'text-slate-600 dark:text-slate-300'
              }`}
            >
              <AlignCenter className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setScriptStyle((s) => ({ ...s, align: 'right' }))}
              className={`shrink-0 min-w-[34px] min-h-[34px] rounded-lg flex items-center justify-center ${
                scriptStyle.align === 'right' ? 'bg-blue-700 text-white' : 'text-slate-600 dark:text-slate-300'
              }`}
            >
              <AlignRight className="w-3.5 h-3.5" />
            </button>
            <select
              value={scriptFontSize}
              onChange={(e) => setScriptFontSize(Number(e.target.value))}
              className="shrink-0 ml-auto px-2 py-1 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[11px] font-bold"
            >
              {[12, 14, 16, 18, 22].map((sz) => (
                <option key={sz} value={sz}>
                  {sz}px
                </option>
              ))}
            </select>
          </HorizontalScrollRail>
          <textarea
            value={scriptText}
            onChange={(e) => setScriptText(e.target.value)}
            rows={10}
            placeholder={
              isEn
                ? 'Write your sermon, reading cue, or meditation prompt here...'
                : 'Rédigez votre texte de lecture, exhortation ou prompteur ici...'
            }
            style={{ fontSize: `${scriptFontSize}px` }}
            className={`w-full p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-600 ${
              scriptStyle.bold ? 'font-bold' : ''
            } ${scriptStyle.italic ? 'italic' : ''} ${
              scriptStyle.underline ? 'underline' : ''
            } text-${scriptStyle.align}`}
          />
        </div>
      );
    }

    if (activeToolTab === 'fx') {
      return (
        <div className="space-y-3 text-xs">
          <div>
            <label className="block font-bold mb-1 tabular-nums">
              Master Gain : {Math.round(masterGain * 100)}%
            </label>
            <input
              type="range"
              min={0.2}
              max={1.8}
              step={0.05}
              value={masterGain}
              onChange={(e) => setMasterGain(Number(e.target.value))}
              className="w-full accent-blue-700"
            />
          </div>
          <div>
            <label className="block font-bold mb-1 tabular-nums">
              EQ Graves (120Hz) : {masterFx.eqLowDb} dB
            </label>
            <input
              type="range"
              min={-12}
              max={12}
              step={1}
              value={masterFx.eqLowDb}
              onChange={(e) => setMasterFx((f) => ({ ...f, eqLowDb: Number(e.target.value) }))}
              className="w-full accent-blue-700"
            />
          </div>
          <div>
            <label className="block font-bold mb-1 tabular-nums">
              EQ Voix Médiums (1kHz) : {masterFx.eqMidDb} dB
            </label>
            <input
              type="range"
              min={-12}
              max={12}
              step={1}
              value={masterFx.eqMidDb}
              onChange={(e) => setMasterFx((f) => ({ ...f, eqMidDb: Number(e.target.value) }))}
              className="w-full accent-blue-700"
            />
          </div>
          <div>
            <label className="block font-bold mb-1 tabular-nums">
              EQ Aigus Clarté (6.5kHz) : {masterFx.eqHighDb} dB
            </label>
            <input
              type="range"
              min={-12}
              max={12}
              step={1}
              value={masterFx.eqHighDb}
              onChange={(e) => setMasterFx((f) => ({ ...f, eqHighDb: Number(e.target.value) }))}
              className="w-full accent-blue-700"
            />
          </div>
          <div>
            <label className="block font-bold mb-1 tabular-nums">
              Réverbération Salle : {Math.round(masterFx.reverbMix * 100)}%
            </label>
            <input
              type="range"
              min={0}
              max={0.6}
              step={0.02}
              value={masterFx.reverbMix}
              onChange={(e) => setMasterFx((f) => ({ ...f, reverbMix: Number(e.target.value) }))}
              className="w-full accent-amber-500"
            />
          </div>
        </div>
      );
    }

    if (activeToolTab === 'shalom') {
      return (
        <ShalomResourcesPanel
          studioType="audio"
          savedItems={customTemplates}
          isEn={isEn}
          onApplyItem={handleApplyShalomResource}
          onDeleteItem={handleDeleteShalomResource}
        />
      );
    }

    if (activeToolTab === 'projects') {
      return (
        <div className="space-y-2.5 text-xs">
          {savedAudioProjects.length === 0 ? (
            <p className="text-[11px] text-slate-500 italic p-3 text-center">
              {isEn ? 'No saved audio projects yet.' : 'Aucun projet audio sauvegardé pour l’instant.'}
            </p>
          ) : (
            savedAudioProjects.map((proj) => (
              <div
                key={proj.id}
                className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2"
              >
                <div className="min-w-0">
                  <div className="font-bold truncate">{proj.title}</div>
                  <div className="text-[10px] text-slate-500">
                    {proj.durationSeconds || 0}s · {new Date(proj.updatedAt || proj.createdAt).toLocaleDateString()}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleLoadSavedProject(proj)}
                    className="px-2.5 py-1.5 rounded-lg bg-blue-700 text-white font-bold text-[11px]"
                  >
                    {isEn ? 'Open' : 'Ouvrir'}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteSavedProject(proj.id)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      );
    }

    return null;
  };

  // RIGHT PROPERTIES INSPECTOR
  const renderInspectorContent = () => {
    if (!selectedClip) {
      return (
        <div className="p-4 text-center text-xs text-slate-500">
          {isEn
            ? 'Select a clip on the timeline to trim edges, fade, pan or adjust speed.'
            : 'Touchez un extrait sur la timeline pour rogner ses bords, ajuster le volume ou les fondus.'}
        </div>
      );
    }
    const maxDur = selectedClip.buffer.duration;
    return (
      <div className="space-y-3.5 text-xs">
        <div className="flex items-center justify-between gap-2">
          <div className="font-extrabold text-slate-900 dark:text-white truncate">
            {selectedClip.name}
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={() => duplicateClip(selectedClip)}
              title="Dupliquer"
              className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200"
            >
              <Copy className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => removeClip(selectedClip.id)}
              title="Supprimer"
              className="p-1.5 rounded-lg bg-rose-50 dark:bg-rose-950/30 text-rose-600"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        <WaveformPreview
          buffer={selectedClip.buffer}
          trimStart={selectedClip.trimStart}
          trimEnd={selectedClip.trimEnd}
          color={
            tracks.find((t) => t.id === selectedClip.trackId)?.color || '#2563eb'
          }
        />

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-1">
              {isEn ? 'Timeline Start (s)' : 'Position (s)'}
            </label>
            <input
              type="number"
              min={0}
              step={0.1}
              value={selectedClip.startTimeSec}
              onChange={(e) =>
                updateClip(selectedClip.id, {
                  startTimeSec: Math.max(0, Number(e.target.value) || 0),
                })
              }
              className="w-full px-2.5 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 tabular-nums"
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-1">
              {isEn ? 'Target Track' : 'Piste'}
            </label>
            <select
              value={selectedClip.trackId}
              onChange={(e) => updateClip(selectedClip.id, { trackId: e.target.value })}
              className="w-full px-2 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800"
            >
              {tracks.map((tr) => (
                <option key={tr.id} value={tr.id}>
                  {tr.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-1">
              {isEn ? 'Trim In (s)' : 'Coupe Début (s)'}
            </label>
            <input
              type="number"
              min={0}
              max={Math.max(0, selectedClip.trimEnd - 0.15)}
              step={0.05}
              value={selectedClip.trimStart}
              onChange={(e) =>
                updateClip(selectedClip.id, {
                  trimStart: Math.max(
                    0,
                    Math.min(selectedClip.trimEnd - 0.15, parseFloat(e.target.value) || 0)
                  ),
                })
              }
              className="w-full px-2.5 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 tabular-nums"
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-1">
              {isEn ? 'Trim Out (s)' : 'Coupe Fin (s)'}
            </label>
            <input
              type="number"
              min={selectedClip.trimStart + 0.15}
              max={Number(maxDur.toFixed(2))}
              step={0.05}
              value={selectedClip.trimEnd}
              onChange={(e) =>
                updateClip(selectedClip.id, {
                  trimEnd: Math.min(
                    maxDur,
                    Math.max(selectedClip.trimStart + 0.15, parseFloat(e.target.value) || maxDur)
                  ),
                })
              }
              className="w-full px-2.5 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 tabular-nums"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-1">
              Fade In (s)
            </label>
            <input
              type="number"
              step={0.1}
              min={0}
              max={5}
              value={selectedClip.fadeInSec}
              onChange={(e) =>
                updateClip(selectedClip.id, { fadeInSec: Math.max(0, parseFloat(e.target.value) || 0) })
              }
              className="w-full px-2.5 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 tabular-nums"
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-1">
              Fade Out (s)
            </label>
            <input
              type="number"
              step={0.1}
              min={0}
              max={5}
              value={selectedClip.fadeOutSec}
              onChange={(e) =>
                updateClip(selectedClip.id, { fadeOutSec: Math.max(0, parseFloat(e.target.value) || 0) })
              }
              className="w-full px-2.5 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 tabular-nums"
            />
          </div>
        </div>

        <div>
          <label className="block text-[11px] font-semibold text-slate-500 mb-1 tabular-nums">
            {isEn ? 'Gain' : 'Volume'} : {Math.round(selectedClip.gain * 100)}%
          </label>
          <input
            type="range"
            min={0}
            max={2}
            step={0.05}
            value={selectedClip.gain}
            onChange={(e) => updateClip(selectedClip.id, { gain: parseFloat(e.target.value) })}
            className="w-full accent-blue-700"
          />
        </div>

        <div>
          <label className="block text-[11px] font-semibold text-slate-500 mb-1 tabular-nums">
            Pan : {selectedClip.pan === 0 ? 'Centre' : selectedClip.pan < 0 ? `G${Math.abs(Math.round(selectedClip.pan * 100))}` : `D${Math.round(selectedClip.pan * 100)}`}
          </label>
          <input
            type="range"
            min={-1}
            max={1}
            step={0.1}
            value={selectedClip.pan}
            onChange={(e) => updateClip(selectedClip.id, { pan: parseFloat(e.target.value) })}
            className="w-full accent-amber-600"
          />
        </div>

        <div>
          <span className="block text-[11px] font-semibold text-slate-500 mb-1">
            {isEn ? 'Playback Speed' : 'Vitesse'}
          </span>
          <HorizontalScrollRail wrapOnDesktop innerClassName="gap-1">
            {[0.75, 0.9, 1.0, 1.15, 1.3].map((rate) => (
              <button
                key={rate}
                type="button"
                onClick={() => updateClip(selectedClip.id, { playbackRate: rate })}
                className={`shrink-0 px-2.5 py-1.5 rounded-lg font-bold tabular-nums whitespace-nowrap ${
                  selectedClip.playbackRate === rate
                    ? 'bg-blue-700 text-white'
                    : 'bg-slate-100 dark:bg-slate-800'
                }`}
              >
                {rate}x
              </button>
            ))}
          </HorizontalScrollRail>
        </div>

        <label className="flex items-center gap-2 cursor-pointer pt-1 border-t border-slate-100 dark:border-slate-800">
          <input
            type="checkbox"
            checked={selectedClip.removeSilence}
            onChange={(e) => updateClip(selectedClip.id, { removeSilence: e.target.checked })}
            className="accent-blue-700 w-4 h-4"
          />
          <span className="font-semibold flex items-center gap-1 text-slate-700 dark:text-slate-200">
            <Wand2 className="w-3.5 h-3.5 text-amber-500" />
            <span>{isEn ? 'Auto-trim silences' : 'Supprimer les silences'}</span>
          </span>
        </label>
      </div>
    );
  };

  // SELECTION TOOLBAR ABOVE TIMELINE
  const selectionToolbar = (
    <div className="flex flex-nowrap lg:flex-wrap items-center gap-1.5 w-max lg:w-full text-xs">
      <button
        type="button"
        onClick={handleTogglePreview}
        disabled={clips.length === 0}
        className={`shrink-0 min-h-[38px] px-3 py-1.5 rounded-lg font-bold flex items-center gap-1.5 whitespace-nowrap transition disabled:opacity-40 ${
          isPlayingPreview
            ? 'bg-rose-600 text-white'
            : 'bg-emerald-600 hover:bg-emerald-700 text-white'
        }`}
      >
        {isPlayingPreview ? <Square className="w-3.5 h-3.5 fill-current" /> : <Play className="w-3.5 h-3.5 fill-current" />}
        <span>{isPlayingPreview ? (isEn ? 'Stop' : 'Arrêter') : isEn ? 'Play' : 'Lire'}</span>
      </button>

      <button
        type="button"
        onClick={handleToggleMicRecord}
        className={`shrink-0 min-h-[38px] px-2.5 py-1.5 rounded-lg font-bold flex items-center gap-1.5 whitespace-nowrap ${
          isRecordingMic
            ? 'bg-rose-600 text-white animate-pulse'
            : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200'
        }`}
      >
        <Mic className="w-3.5 h-3.5" />
        <span className="tabular-nums">{isRecordingMic ? `${micSeconds}s` : 'Rec'}</span>
      </button>

      <span className="shrink-0 h-5 w-px bg-slate-200 dark:bg-slate-700 mx-0.5" />

      <button
        type="button"
        onClick={splitSelectedClipAtPlayhead}
        disabled={selectedClipIds.length !== 1}
        title="Scinder à la tête de lecture"
        className="shrink-0 min-h-[38px] min-w-[38px] px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-semibold flex items-center justify-center gap-1 whitespace-nowrap disabled:opacity-40"
      >
        <Scissors className="w-3.5 h-3.5" />
        <span>{isEn ? 'Split' : 'Scinder'}</span>
      </button>

      <button
        type="button"
        onClick={duplicateSelectedBatch}
        disabled={selectedClipIds.length === 0}
        className="shrink-0 min-h-[38px] min-w-[38px] px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-semibold flex items-center justify-center gap-1 whitespace-nowrap disabled:opacity-40"
      >
        <Copy className="w-3.5 h-3.5" />
        <span>{isEn ? 'Duplicate' : 'Dupliquer'}</span>
      </button>

      <button
        type="button"
        onClick={handleCopySelectedClips}
        disabled={selectedClipIds.length === 0}
        title="Ctrl+C"
        className="shrink-0 min-h-[38px] min-w-[38px] px-2 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-semibold flex items-center justify-center disabled:opacity-40"
      >
        <Copy className="w-3.5 h-3.5" />
      </button>

      <button
        type="button"
        onClick={handlePasteCopiedClips}
        disabled={copiedClips.length === 0}
        title="Ctrl+V"
        className="shrink-0 min-h-[38px] min-w-[38px] px-2 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-semibold flex items-center justify-center disabled:opacity-40"
      >
        <ClipboardPaste className="w-3.5 h-3.5" />
      </button>

      <button
        type="button"
        onClick={deleteSelectedBatch}
        disabled={selectedClipIds.length === 0}
        className="shrink-0 min-h-[38px] min-w-[38px] px-2 py-1.5 rounded-lg bg-rose-50 dark:bg-rose-950/30 text-rose-600 font-semibold flex items-center justify-center disabled:opacity-40"
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>

      <span className="shrink-0 h-5 w-px bg-slate-200 dark:bg-slate-700 mx-0.5" />

      <button
        type="button"
        onClick={() => setIsMultiSelectMode((m) => !m)}
        className={`shrink-0 min-h-[38px] min-w-[38px] px-2.5 py-1.5 rounded-lg font-semibold flex items-center justify-center gap-1 whitespace-nowrap ${
          isMultiSelectMode
            ? 'bg-blue-700 text-white'
            : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200'
        }`}
      >
        <CheckSquare className="w-3.5 h-3.5" />
        <span>{isEn ? 'Multi' : 'Multi'}</span>
      </button>

      <button
        type="button"
        onClick={() => setSnapEnabled((s) => !s)}
        className={`shrink-0 min-h-[38px] min-w-[38px] px-2.5 py-1.5 rounded-lg font-semibold flex items-center justify-center gap-1 ${
          snapEnabled
            ? 'bg-amber-500 text-slate-950'
            : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200'
        }`}
      >
        <Magnet className="w-3.5 h-3.5" />
      </button>

      <button
        type="button"
        onClick={addMarkerAtPlayhead}
        className="shrink-0 min-h-[38px] min-w-[38px] px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-semibold flex items-center justify-center gap-1 whitespace-nowrap"
      >
        <Flag className="w-3.5 h-3.5 text-amber-500" />
        <span>{isEn ? 'Cue' : 'Repère'}</span>
      </button>

      <div className="shrink-0 ml-auto flex items-center gap-1">
        <button
          type="button"
          onClick={() => setZoomPxPerSec((z) => Math.max(20, z - 12))}
          aria-label="Dézoomer"
          className="min-h-[36px] min-w-[36px] px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center"
        >
          <ZoomOut className="w-3.5 h-3.5" />
        </button>
        <span className="text-[11px] font-bold tabular-nums px-1">{zoomPxPerSec}px/s</span>
        <button
          type="button"
          onClick={() => setZoomPxPerSec((z) => Math.min(140, z + 12))}
          aria-label="Zoomer"
          className="min-h-[36px] min-w-[36px] px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center"
        >
          <ZoomIn className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={handleAddTrack}
          className="min-h-[36px] px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 font-bold flex items-center gap-1 whitespace-nowrap"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>{isEn ? 'Track' : 'Piste'}</span>
        </button>
      </div>
    </div>
  );

  // CENTER MULTI-TRACK DAW TIMELINE STAGE
  const centerStage = (
    <div className="w-full flex-1 flex flex-col gap-3">
      {notice && (
        <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/50 text-xs font-semibold text-emerald-700 dark:text-emerald-300 flex items-center justify-between gap-2">
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
        <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-xs flex flex-wrap items-center justify-between gap-2">
          <span className="font-semibold text-amber-900 dark:text-amber-200">
            {isEn
              ? 'An unsaved audio session was found. Resume?'
              : 'Un brouillon audio automatique a été retrouvé. Reprendre ?'}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleRestoreDraft}
              className="px-3 py-1 rounded-lg bg-amber-600 text-white font-bold"
            >
              {isEn ? 'Resume' : 'Reprendre'}
            </button>
            <button
              type="button"
              onClick={() => setRecoverableDraft(false)}
              className="px-2 py-1 text-slate-500 underline"
            >
              {isEn ? 'Dismiss' : 'Ignorer'}
            </button>
          </div>
        </div>
      )}

      {selectedClipIds.length > 1 && (
        <div className="px-3 py-2 rounded-xl bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 flex flex-wrap items-center gap-2 text-xs">
          <span className="font-bold text-blue-800 dark:text-blue-300">
            {selectedClipIds.length} {isEn ? 'selected' : 'sélectionnés'}
          </span>
          <button
            type="button"
            onClick={() => shiftSelectedBatch(-0.5)}
            className="px-2 py-1 rounded-lg bg-white dark:bg-slate-800 font-bold"
          >
            -0.5s
          </button>
          <button
            type="button"
            onClick={() => shiftSelectedBatch(0.5)}
            className="px-2 py-1 rounded-lg bg-white dark:bg-slate-800 font-bold"
          >
            +0.5s
          </button>
          <button
            type="button"
            onClick={() => setSelectedClipIds([])}
            className="ml-auto underline text-slate-500"
          >
            {isEn ? 'Clear' : 'Tout désélectionner'}
          </button>
        </div>
      )}

      {/* Multi-Track Interactive Timeline Matrix */}
      <div className="flex-1 min-h-[240px] sm:min-h-[340px] rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0b152c] overflow-hidden flex flex-col shadow-xs">
        <div className="flex flex-1 overflow-x-auto">
          {/* Left Sticky Track Headers Column */}
          <div className="sticky left-0 z-30 w-[124px] sm:w-[220px] shrink-0 border-r border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#091228] flex flex-col">
            <div className="h-9 px-2 sm:px-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between text-[10px] sm:text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              <span className="flex items-center gap-1 min-w-0">
                <Layers className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                <span className="truncate">{isEn ? 'Tracks' : 'Pistes'} ({tracks.length})</span>
              </span>
              <span className="tabular-nums text-blue-700 dark:text-blue-400 shrink-0">
                {playheadSec.toFixed(1)}s
              </span>
            </div>

            {tracks.map((tr, trIdx) => {
              const isSelectedTr = selectedTrackId === tr.id;
              return (
                <div
                  key={tr.id}
                  onClick={() => setSelectedTrackId(tr.id)}
                  className={`h-[86px] px-2 sm:px-2.5 py-2 border-b border-slate-200/80 dark:border-slate-800 flex flex-col justify-between cursor-pointer transition ${
                    isSelectedTr ? 'bg-blue-50/70 dark:bg-blue-950/30' : ''
                  }`}
                >
                  <div className="flex items-center justify-between gap-1">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: tr.color }}
                      />
                      <span className="text-[11px] font-bold text-slate-900 dark:text-white truncate">
                        {tr.name}
                      </span>
                    </div>
                    <div className="flex items-center gap-0.5 shrink-0">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          moveTrackOrder(tr.id, -1);
                        }}
                        disabled={trIdx === 0}
                        className="p-0.5 text-slate-400 hover:text-slate-700 disabled:opacity-25"
                      >
                        <ArrowUp className="w-3 h-3" />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          moveTrackOrder(tr.id, 1);
                        }}
                        disabled={trIdx === tracks.length - 1}
                        className="p-0.5 text-slate-400 hover:text-slate-700 disabled:opacity-25"
                      >
                        <ArrowDown className="w-3 h-3" />
                      </button>
                      {tracks.length > 1 && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            removeTrack(tr.id);
                          }}
                          className="p-0.5 text-slate-400 hover:text-rose-600"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        updateTrack(tr.id, { muted: !tr.muted });
                      }}
                      className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                        tr.muted
                          ? 'bg-rose-600 text-white'
                          : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                      }`}
                    >
                      {tr.muted ? <VolumeX className="w-3 h-3" /> : <Volume2 className="w-3 h-3" />}
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        updateTrack(tr.id, { solo: !tr.solo });
                      }}
                      className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                        tr.solo
                          ? 'bg-amber-500 text-slate-950'
                          : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                      }`}
                    >
                      S
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        updateTrack(tr.id, { locked: !tr.locked });
                      }}
                      className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                        tr.locked
                          ? 'bg-blue-700 text-white'
                          : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                      }`}
                    >
                      {tr.locked ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
                    </button>
                    <input
                      type="range"
                      min={0}
                      max={1.5}
                      step={0.05}
                      value={tr.volume}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => updateTrack(tr.id, { volume: parseFloat(e.target.value) })}
                      className="flex-1 min-w-0 accent-blue-700"
                    />
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        chainTrackSequentially(tr.id);
                      }}
                      title="Coller bout à bout"
                      className="px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-[9px] font-bold"
                    >
                      ≡
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Right Scrollable Ruler + Clip Lanes */}
          <div className="flex-1 overflow-x-auto relative bg-slate-100/70 dark:bg-[#060d1e]">
            <div style={{ width: `${timelineWidthPx}px` }} className="relative min-h-full">
              {/* Draggable Interactive Time Ruler */}
              <div
                ref={audioRulerRef}
                onPointerDown={(e) => {
                  e.stopPropagation();
                  isScrubbingAudioRef.current = true;
                  scrubAudioFromClientX(e.clientX);
                }}
                className="h-9 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0d1935] relative cursor-ew-resize select-none touch-none"
              >
                {Array.from({ length: timelineSecondsSpan + 1 }).map((_, sec) => (
                  <div
                    key={sec}
                    style={{ left: `${sec * zoomPxPerSec}px` }}
                    className="absolute top-0 bottom-0 border-l border-slate-300/60 dark:border-slate-700/60 pl-1 text-[10px] text-slate-500 tabular-nums pt-1"
                  >
                    {sec % 2 === 0 ? `${sec}s` : ''}
                  </div>
                ))}

                {markers.map((mk) => (
                  <button
                    key={mk.id}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setPlayheadSec(mk.timeSec);
                    }}
                    style={{ left: `${mk.timeSec * zoomPxPerSec}px`, backgroundColor: mk.color }}
                    className="absolute bottom-0.5 -translate-x-1/2 px-1.5 py-0.5 rounded text-[9px] font-bold text-slate-950 shadow-xs z-20"
                  >
                    {mk.label}
                  </button>
                ))}
              </div>

              {/* Track Clip Lanes with Real Waveforms & Edge Trimming */}
              {tracks.map((tr) => {
                const laneClips = clips.filter((c) => c.trackId === tr.id);
                return (
                  <div
                    key={tr.id}
                    onClick={() => setSelectedTrackId(tr.id)}
                    className={`h-[86px] border-b border-slate-200/70 dark:border-slate-800 relative ${
                      selectedTrackId === tr.id ? 'bg-blue-50/30 dark:bg-blue-950/10' : ''
                    }`}
                  >
                    {laneClips.map((clip) => {
                      const activeDur =
                        Math.max(0.15, clip.trimEnd - clip.trimStart) / clip.playbackRate;
                      return (
                        <WaveformClipView
                          key={clip.id}
                          id={clip.id}
                          name={clip.name}
                          color={tr.color}
                          buffer={clip.buffer}
                          leftPx={clip.startTimeSec * zoomPxPerSec}
                          widthPx={activeDur * zoomPxPerSec}
                          durationSec={clip.buffer.duration}
                          trimStartSec={clip.trimStart}
                          trimEndSec={clip.trimEnd}
                          fadeInSec={clip.fadeInSec}
                          fadeOutSec={clip.fadeOutSec}
                          muted={tr.muted}
                          locked={Boolean(tr.locked)}
                          selected={selectedClipIds.includes(clip.id)}
                          pxPerSec={zoomPxPerSec * clip.playbackRate}
                          startTimeSec={clip.startTimeSec}
                          onSelect={() => handleSelectClip(clip.id)}
                          onMoveCommit={(nextStart) => {
                            pushHistory();
                            const snapped = snapEnabled
                              ? Math.round(nextStart * 4) / 4
                              : nextStart;
                            updateClip(clip.id, { startTimeSec: Math.max(0, snapped) });
                          }}
                          onTrimCommit={(nextTrimStart, nextTrimEnd, nextStartSecDelta) => {
                            pushHistory();
                            const clampedStart = Math.max(
                              0,
                              Math.min(nextTrimEnd - 0.15, nextTrimStart)
                            );
                            const clampedEnd = Math.min(
                              clip.buffer.duration,
                              Math.max(clampedStart + 0.15, nextTrimEnd)
                            );
                            updateClip(clip.id, {
                              trimStart: clampedStart,
                              trimEnd: clampedEnd,
                              startTimeSec: Math.max(
                                0,
                                Number((clip.startTimeSec + nextStartSecDelta / clip.playbackRate).toFixed(2))
                              ),
                            });
                          }}
                        />
                      );
                    })}
                  </div>
                );
              })}

              {/* Global Vertical Playhead */}
              <div
                style={{ left: `${playheadSec * zoomPxPerSec}px` }}
                className="absolute top-0 bottom-0 w-0.5 bg-rose-500 pointer-events-none z-30 shadow-[0_0_8px_rgba(244,63,94,0.8)]"
              >
                <div className="w-3 h-3 -translate-x-1/2 rotate-45 bg-rose-500 rounded-xs" />
              </div>
            </div>
          </div>
        </div>

        {clips.length === 0 && (
          <div className="p-4 text-center text-xs text-slate-500 border-t border-slate-100 dark:border-slate-800">
            {isEn
              ? 'Select a Template, record with your mic, generate synth harmonies, or import sounds from the left rail.'
              : 'Choisissez un modèle, enregistrez votre voix, générez un accord ou importez un son depuis le panneau latéral.'}
          </div>
        )}
      </div>

      {/* Direct Share Device File Without Saving */}
      <div className="px-3 py-2.5 rounded-xl bg-white dark:bg-[#0c1631] border border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs">
        <span className="text-slate-600 dark:text-slate-300 font-medium flex items-center gap-1.5">
          <Headphones className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>
            {isEn
              ? 'Share a local audio file directly without saving in SHALOM:'
              : 'Partager directement un fichier audio du téléphone sans l’enregistrer dans SHALOM :'}
          </span>
        </span>
        <label className="min-h-[40px] px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold flex items-center gap-1.5 cursor-pointer">
          <Share2 className="w-3.5 h-3.5 shrink-0" />
          <span>{isEn ? 'Share file directly' : 'Partager fichier sans enregistrer'}</span>
          <input
            type="file"
            accept="audio/*,video/*"
            onChange={handleShareLocalFileDirect}
            className="hidden"
          />
        </label>
      </div>
    </div>
  );

  const bottomBar = (
    <HorizontalScrollRail
      wrapOnDesktop
      innerClassName="items-center justify-between w-full gap-2 text-xs"
    >
      <div className="shrink-0 flex items-center gap-2.5 tabular-nums font-semibold text-slate-600 dark:text-slate-300 whitespace-nowrap">
        <span>
          {isEn ? 'Playhead' : 'Curseur'} : {playheadSec.toFixed(2)}s
        </span>
        <span>·</span>
        <span>
          {isEn ? 'Duration' : 'Durée'} : {totalProjectDuration.toFixed(2)}s
        </span>
        <span>·</span>
        <span>
          {clips.length} {isEn ? 'clip(s)' : 'extrait(s)'}
        </span>
      </div>

      <div className="shrink-0 flex items-center gap-1.5">
        <button
          type="button"
          disabled={isRendering || clips.length === 0}
          onClick={() => handleMixAndExport('mp3')}
          className="shrink-0 min-h-[36px] px-3 py-1 rounded-lg bg-blue-700 hover:bg-blue-800 disabled:opacity-40 text-white font-bold flex items-center gap-1.5 whitespace-nowrap"
        >
          {isRendering ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Music className="w-3.5 h-3.5" />}
          <span>{isEn ? 'Export MP3' : 'Exporter MP3'}</span>
        </button>
        <button
          type="button"
          disabled={isRendering || clips.length === 0}
          onClick={() => handleMixAndExport('wav')}
          className="shrink-0 min-h-[36px] px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-900 disabled:opacity-40 text-white font-bold flex items-center gap-1.5 whitespace-nowrap"
        >
          <Download className="w-3.5 h-3.5" />
          <span>{isEn ? 'Export WAV' : 'Exporter WAV'}</span>
        </button>
      </div>
    </HorizontalScrollRail>
  );

  return (
    <>
      {isHomeView ? (
        <StudioHomeScreen
          kind="audio"
          isEn={isEn}
          hasActiveWork={clips.length > 0 || scriptText.trim().length > 0 || markers.length > 0}
          activeProjectTitle={projectTitle}
          activeSummary={`${tracks.length} ${isEn ? 'track(s)' : 'piste(s)'} · ${clips.length} ${
            isEn ? 'clip(s)' : 'extrait(s)'
          } · ${totalProjectDuration.toFixed(1)}s`}
          onCreateBlank={handleStartBlankAudioProject}
          onContinueWork={() => {
            setActiveToolTab(null);
            setIsInspectorOpen(false);
            setIsHomeView(false);
          }}
          onOpenTemplatesTool={() => {
            setIsHomeView(false);
            setActiveToolTab('templates');
          }}
          onOpenLibraryTool={() => {
            setIsHomeView(false);
            setActiveToolTab('record');
          }}
          libraryLabel={isEn ? 'Mic & Voice Recorder' : 'Micro & Voix'}
          onOpenShalomResources={() => {
            setIsHomeView(false);
            setActiveToolTab('shalom');
          }}
          onOpenAllSaved={() => {
            setIsHomeView(false);
            setActiveToolTab('projects');
          }}
          savedProjects={savedAudioProjects}
          onOpenSavedProject={handleLoadSavedProject}
          featuredTemplates={AUDIO_TEMPLATES.slice(0, 8).map((tpl) => ({
            id: tpl.id,
            title: isEn ? tpl.titleEn : tpl.titleFr,
            category: tpl.category,
            subtitle: `${tpl.tracks.length} pistes · ${tpl.synthAdditions.length} clips`,
            kind: 'audio' as const,
            badgeColor: tpl.badgeColor,
            tracks: tpl.tracks,
            synthAdditions: tpl.synthAdditions,
            markers: tpl.markers,
            onSelectPreview: () => setPreviewingTemplate(tpl),
          }))}
        />
      ) : (
        <StudioWorkspaceShell
          projectTitle={projectTitle}
          onProjectTitleChange={setProjectTitle}
          statusLine={`${tracks.length} pistes · ${totalProjectDuration.toFixed(1)}s`}
          onReturnHome={() => {
            setActiveToolTab(null);
            setIsInspectorOpen(false);
            setIsHomeView(true);
          }}
          canUndo={undoStack.length > 0}
          canRedo={redoStack.length > 0}
          onUndo={handleUndo}
          onRedo={handleRedo}
          onPreview={() => setShowPreviewModal(true)}
          onSaveProject={handleSaveEditableProject}
          isSavingProject={isSavingProject}
          onOpenShalomFolder={async () => {
            try {
              const outcome = await chooseShalomDownloadDirectory();
              if (outcome.folderLabel) {
                setNotice(
                  isEn
                    ? `DOSSIER SHALOM linked: ${outcome.folderLabel}`
                    : `Dossier SHALOM lié : ${outcome.folderLabel}`
                );
              }
              if (outcome.requiresVirtualExplorer) {
                setShowShalomFolderModal(true);
              }
            } catch {
              setShowShalomFolderModal(true);
            }
          }}
          onShare={() => handleShareWithoutSaving('mp3')}
          onPrimaryExport={() => handleMixAndExport('mp3')}
          primaryExportLabel="MP3"
          isExporting={isRendering}
          toolItems={toolItems}
          activeToolId={activeToolTab}
          onSelectTool={(id) => setActiveToolTab(id as AudioToolTab | null)}
          toolDrawerContent={renderToolDrawerContent()}
          selectionToolbar={selectionToolbar}
          centerStage={centerStage}
          bottomBar={bottomBar}
          inspectorTitle={isEn ? 'Clip Settings' : 'Réglages extrait'}
          inspectorContent={renderInspectorContent()}
          isInspectorOpen={isInspectorOpen}
          onToggleInspector={() => setIsInspectorOpen((v) => !v)}
        />
      )}

      {/* Final Mix Preview & Export Modal */}
      <Modal
        isOpen={showPreviewModal}
        onClose={() => setShowPreviewModal(false)}
        title={isEn ? 'Audio Studio Preview & Export' : 'Aperçu & Export Studio Audio'}
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
              <div className="p-2 rounded-lg bg-slate-900">
                Réverb: {Math.round(masterFx.reverbMix * 100)}%
              </div>
            </div>
            <button
              type="button"
              onClick={handleTogglePreview}
              className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold flex items-center justify-center gap-2"
            >
              {isPlayingPreview ? (
                <Square className="w-4 h-4 fill-current" />
              ) : (
                <Play className="w-4 h-4 fill-current" />
              )}
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

          {exportedUrl && (
            <div className="space-y-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
              <audio src={exportedUrl} controls className="w-full" />
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={handleDownloadExported}
                  className="px-3.5 py-2 rounded-xl bg-slate-900 dark:bg-slate-700 text-white font-bold flex items-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>
                    {isEn ? 'Save to device' : 'Télécharger'} (.{exportedFormat.toUpperCase()})
                  </span>
                </button>
                <button
                  type="button"
                  onClick={handleSaveToParole}
                  className="px-3.5 py-2 rounded-xl bg-blue-700 hover:bg-blue-800 text-white font-bold flex items-center gap-1.5"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{isEn ? 'Parole Divine' : 'Dans Parole Divine'}</span>
                </button>
                <button
                  type="button"
                  onClick={handleSaveToVault}
                  className="px-3.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold flex items-center gap-1.5"
                >
                  <Archive className="w-3.5 h-3.5" />
                  <span>{isEn ? 'Save to Vault' : 'Dans Mon Coffre'}</span>
                </button>
                <button
                  type="button"
                  onClick={handleShareExported}
                  className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold flex items-center gap-1.5"
                >
                  <Share2 className="w-3.5 h-3.5" />
                  <span>{isEn ? 'Share' : 'Partager'}</span>
                </button>
              </div>
            </div>
          )}

          <div className="flex justify-between items-center">
            <button
              type="button"
              onClick={() => setShowShalomFolderModal(true)}
              className="px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 font-bold flex items-center gap-1.5"
            >
              <FolderOpen className="w-3.5 h-3.5 text-blue-600" />
              <span>DOSSIER SHALOM</span>
            </button>
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

      <ShalomFolderExplorerModal
        isOpen={showShalomFolderModal}
        onClose={() => setShowShalomFolderModal(false)}
      />

      <TemplatePreviewModal
        template={
          previewingTemplate
            ? ({
                id: previewingTemplate.id,
                title: isEn ? previewingTemplate.titleEn : previewingTemplate.titleFr,
                category: previewingTemplate.category,
                description: isEn ? previewingTemplate.descEn : previewingTemplate.descFr,
                kind: 'audio',
                badgeColor: previewingTemplate.badgeColor,
                tracks: previewingTemplate.tracks,
                synthAdditions: previewingTemplate.synthAdditions,
                markers: previewingTemplate.markers,
                scriptText: isEn ? previewingTemplate.scriptEn : previewingTemplate.scriptFr,
                sourceLabel:
                  previewingTemplate.source === 'local'
                    ? isEn
                      ? 'Built-in SHALOM'
                      : 'Modèle SHALOM'
                    : isEn
                      ? 'Online Catalog'
                      : 'Catalogue en ligne',
                isSavedOffline: customTemplates.some(
                  (t) => t.id === previewingTemplate.id && t.studioType === 'audio'
                ),
                isSavingOffline: savingResourceId === previewingTemplate.id,
                rawTemplate: previewingTemplate,
              } satisfies PreviewModalTemplateData)
            : null
        }
        isEn={isEn}
        onClose={() => setPreviewingTemplate(null)}
        onUseTemplate={(tplModal) => {
          const raw = tplModal.rawTemplate as AudioTemplateDef;
          setPreviewingTemplate(null);
          handleApplyTemplate(raw);
        }}
        onSaveToShalom={(tplModal) => {
          const raw = tplModal.rawTemplate as AudioTemplateDef;
          handleSaveTemplateToShalom(raw);
        }}
      />

      <SocialShareModal
        isOpen={!!sharePayload}
        onClose={() => setSharePayload(null)}
        payload={sharePayload}
      />
    </>
  );
};
