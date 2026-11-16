import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import {
  Film,
  Upload,
  Music,
  ArrowUp,
  ArrowDown,
  Trash2,
  Download,
  Share2,
  Save,
  Loader2,
  CheckCircle2,
  Play,
  Square,
  Image as ImageIcon,
  Video as VideoIcon,
  Plus,
  Type,
  Shapes,
  Mic,
  Copy,
  Archive,
  Palette,
  Undo2,
  Redo2,
  Magnet,
  Sparkles,
  Eye,
  FolderOpen,
  Scissors,
  ZoomIn,
  ZoomOut,
  Camera,
  Layers,
  X,
  MoveUp,
  MoveDown,
  Search,
  Globe,
  GripVertical,
  AlignLeft,
  AlignCenter,
  AlignRight,
} from 'lucide-react';
import { useShalomDB } from '../../hooks/useShalomDB';
import { dbService, STORES } from '../../services/db';
import { useLanguage } from '../../contexts/LanguageContext';
import { CreativeDesignItem, RecordedParole, SavedStudioTemplate, VaultDocument } from '../../types';
import { SocialShareModal } from '../common/SocialShareModal';
import { SharePayload, normalizeMediaToShareFile } from '../../services/socialShare';
import { downloadBlobToDevice, readFileAsVerifiedBlob, sanitizeFileName } from '../../services/fileTransfer';
import {
  drawStudioVectorElement,
  SHALOM_COLOR_PALETTES,
  STUDIO_FONTS,
  StudioVectorElementKind,
  VECTOR_ELEMENT_CATALOG,
} from '../../services/studioGraphics';
import { loadStudioDraft, saveStudioDraft } from '../../services/studioPersistence';
import {
  saveOnlineTemplateLocally,
  deleteSavedOnlineTemplate,
} from '../../services/studioTemplatesStore';
import { Modal } from '../common/Modal';

type AspectMode = '9:16' | '16:9' | '1:1' | '4:5';
type SceneTransition = 'none' | 'fade' | 'slide' | 'zoom';
type SceneFilter = 'none' | 'warm' | 'bw' | 'vivid';
type OverlayAnimation = 'none' | 'fade-in' | 'slide-up';

interface VideoScene {
  id: string;
  kind: 'custom' | 'image' | 'video';
  name: string;
  durationSec: number;
  // Media persistence
  assetKey?: string;
  sourceBlob?: Blob;
  objectUrl?: string;
  imageEl?: HTMLImageElement;
  videoEl?: HTMLVideoElement;
  trimStartSec: number;
  trimEndSec: number;
  fitMode: 'contain' | 'cover';
  kenBurns: boolean;
  volume: number;
  playbackRate: number;
  transition: SceneTransition;
  filter: SceneFilter;
  // Custom blank/color/shape/text slide fields
  bgType: 'solid' | 'gradient';
  bgColor: string;
  bgColor2: string;
  shape: StudioVectorElementKind | 'none';
  shapeColor: string;
  text: string;
  textColor: string;
  fontSize: number;
  fontFamily: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  uppercase?: boolean;
  textAlign?: 'left' | 'center' | 'right';
  textShadow?: boolean;
}

interface OverlayLayer {
  id: string;
  kind: 'text' | 'shape' | 'image';
  label: string;
  startSec: number;
  endSec: number;
  xPct: number;
  yPct: number;
  size: number;
  rotationDeg: number;
  color: string;
  strokeColor?: string;
  bgBadge: boolean;
  bgBadgeColor?: string;
  opacity: number;
  animation: OverlayAnimation;
  text?: string;
  fontFamily?: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  uppercase?: boolean;
  textAlign?: 'left' | 'center' | 'right';
  textShadow?: boolean;
  shape?: StudioVectorElementKind;
  assetKey?: string;
  sourceBlob?: Blob;
  imageEl?: HTMLImageElement;
  objectUrl?: string;
}

interface VideoAudioTrack {
  id: string;
  name: string;
  assetKey?: string;
  sourceBlob?: Blob;
  objectUrl: string;
  startSec: number;
  volume: number;
}

interface VideoSnapshot {
  aspectMode: AspectMode;
  canvasBgColor: string;
  scenes: VideoScene[];
  overlays: OverlayLayer[];
  audioTracks: VideoAudioTrack[];
}

interface SerializedVideoScene {
  id: string;
  kind: 'custom' | 'image' | 'video';
  name: string;
  durationSec: number;
  assetKey?: string;
  trimStartSec: number;
  trimEndSec: number;
  fitMode: 'contain' | 'cover';
  kenBurns: boolean;
  volume: number;
  playbackRate: number;
  transition: SceneTransition;
  filter: SceneFilter;
  bgType: 'solid' | 'gradient';
  bgColor: string;
  bgColor2: string;
  shape: StudioVectorElementKind | 'none';
  shapeColor: string;
  text: string;
  textColor: string;
  fontSize: number;
  fontFamily: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  uppercase?: boolean;
  textAlign?: 'left' | 'center' | 'right';
  textShadow?: boolean;
}

interface SerializedOverlayLayer {
  id: string;
  kind: 'text' | 'shape' | 'image';
  label: string;
  startSec: number;
  endSec: number;
  xPct: number;
  yPct: number;
  size: number;
  rotationDeg: number;
  color: string;
  strokeColor?: string;
  bgBadge: boolean;
  bgBadgeColor?: string;
  opacity: number;
  animation: OverlayAnimation;
  text?: string;
  fontFamily?: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  uppercase?: boolean;
  textAlign?: 'left' | 'center' | 'right';
  textShadow?: boolean;
  shape?: StudioVectorElementKind;
  assetKey?: string;
}

interface SerializedVideoAudioTrack {
  id: string;
  name: string;
  assetKey?: string;
  startSec: number;
  volume: number;
}

interface SerializedVideoProject {
  version: 2;
  aspectMode: AspectMode;
  canvasBgColor: string;
  scenes: SerializedVideoScene[];
  overlays: SerializedOverlayLayer[];
  audioTracks: SerializedVideoAudioTrack[];
}

interface VideoTemplateDef {
  id: string;
  titleFr: string;
  titleEn: string;
  descFr: string;
  descEn: string;
  category?: string;
  tags?: string[];
  source?: 'local' | 'online-catalog' | 'online-live';
  aspect: AspectMode;
  bgColor: string;
  scenes: Omit<VideoScene, 'id'>[];
  overlays: Omit<OverlayLayer, 'id'>[];
}

const VIDEO_TEMPLATES: VideoTemplateDef[] = [
  {
    id: 'story_verse',
    titleFr: 'Story Verset Lumière (9:16)',
    titleEn: 'Light Verse Story (9:16)',
    descFr: '2 scènes fluides avec Croix dorée, texte animé et bannière de référence.',
    descEn: '2 smooth scenes with golden Cross, animated verse and reference badge.',
    category: 'Verset',
    tags: ['verset', 'story', 'lumiere', 'psaume'],
    source: 'local',
    aspect: '9:16',
    bgColor: '#071128',
    scenes: [
      {
        kind: 'custom',
        name: 'Ouverture Lumière',
        durationSec: 4,
        trimStartSec: 0,
        trimEndSec: 4,
        fitMode: 'cover',
        kenBurns: false,
        volume: 1,
        playbackRate: 1,
        transition: 'fade',
        filter: 'none',
        bgType: 'gradient',
        bgColor: '#071128',
        bgColor2: '#1e3a8a',
        shape: 'rays',
        shapeColor: '#fbbf24',
        text: 'PAROLE DU JOUR',
        textColor: '#ffffff',
        fontSize: 48,
        fontFamily: '"Outfit", sans-serif',
      },
      {
        kind: 'custom',
        name: 'Verset Central',
        durationSec: 6,
        trimStartSec: 0,
        trimEndSec: 6,
        fitMode: 'cover',
        kenBurns: false,
        volume: 1,
        playbackRate: 1,
        transition: 'zoom',
        filter: 'none',
        bgType: 'gradient',
        bgColor: '#0f172a',
        bgColor2: '#1d4ed8',
        shape: 'cross',
        shapeColor: '#fbbf24',
        text: '« L’Éternel est ma lumière et mon salut. »\nPsaumes 27:1',
        textColor: '#ffffff',
        fontSize: 42,
        fontFamily: 'Georgia, "Times New Roman", serif',
      },
    ],
    overlays: [
      {
        kind: 'text',
        label: 'Signature SHALOM',
        startSec: 0.5,
        endSec: 9.5,
        xPct: 50,
        yPct: 88,
        size: 26,
        rotationDeg: 0,
        color: '#fbbf24',
        bgBadge: true,
        opacity: 0.95,
        animation: 'slide-up',
        text: 'SHALOM · La foi au quotidien',
        fontFamily: '"Outfit", sans-serif',
      },
    ],
  },
  {
    id: 'church_event_169',
    titleFr: 'Annonce Culte / Événement (16:9)',
    titleEn: 'Church Event Announcement (16:9)',
    descFr: 'Format paysage grand écran pour projections et WhatsApp.',
    descEn: 'Widescreen landscape template for church projection & WhatsApp.',
    category: 'Église',
    tags: ['culte', 'evenement', 'annonce', 'eglise'],
    source: 'local',
    aspect: '16:9',
    bgColor: '#0b1f42',
    scenes: [
      {
        kind: 'custom',
        name: 'Titre Événement',
        durationSec: 4,
        trimStartSec: 0,
        trimEndSec: 4,
        fitMode: 'cover',
        kenBurns: false,
        volume: 1,
        playbackRate: 1,
        transition: 'slide',
        filter: 'none',
        bgType: 'gradient',
        bgColor: '#0b1f42',
        bgColor2: '#0f766e',
        shape: 'dove',
        shapeColor: '#fde68a',
        text: 'VEILLÉE DE PRIÈRE & LOUANGE',
        textColor: '#ffffff',
        fontSize: 54,
        fontFamily: '"Outfit", sans-serif',
      },
      {
        kind: 'custom',
        name: 'Détails & Horaires',
        durationSec: 5,
        trimStartSec: 0,
        trimEndSec: 5,
        fitMode: 'cover',
        kenBurns: false,
        volume: 1,
        playbackRate: 1,
        transition: 'fade',
        filter: 'none',
        bgType: 'gradient',
        bgColor: '#1e1b4b',
        bgColor2: '#1d4ed8',
        shape: 'bible',
        shapeColor: '#fbbf24',
        text: 'Ce Vendredi à 20h00\nEntrée libre · Tous bienvenus !',
        textColor: '#ffffff',
        fontSize: 44,
        fontFamily: '"Plus Jakarta Sans", sans-serif',
      },
    ],
    overlays: [],
  },
  {
    id: 'square_testimony',
    titleFr: 'Réel Témoignage Carré (1:1)',
    titleEn: 'Square Testimony Reel (1:1)',
    descFr: 'Carré polyvalent avec bannière inférieure et transition douce.',
    descEn: 'Versatile square layout with lower-third badge.',
    category: 'Témoignage',
    tags: ['temoignage', 'grace', 'carre', 'reel'],
    source: 'local',
    aspect: '1:1',
    bgColor: '#451a03',
    scenes: [
      {
        kind: 'custom',
        name: 'Accroche Témoignage',
        durationSec: 4.5,
        trimStartSec: 0,
        trimEndSec: 4.5,
        fitMode: 'cover',
        kenBurns: false,
        volume: 1,
        playbackRate: 1,
        transition: 'fade',
        filter: 'warm',
        bgType: 'gradient',
        bgColor: '#451a03',
        bgColor2: '#b45309',
        shape: 'heart',
        shapeColor: '#fef3c7',
        text: 'TÉMOIGNAGE DE GRÂCE',
        textColor: '#fffbeb',
        fontSize: 46,
        fontFamily: '"Outfit", sans-serif',
      },
    ],
    overlays: [
      {
        kind: 'text',
        label: 'Bandeau Orateur',
        startSec: 0,
        endSec: 4.5,
        xPct: 50,
        yPct: 84,
        size: 30,
        rotationDeg: 0,
        color: '#ffffff',
        bgBadge: true,
        opacity: 1,
        animation: 'fade-in',
        text: 'Dieu reste fidèle en tout temps',
        fontFamily: '"Outfit", sans-serif',
      },
    ],
  },
];

function getDims(mode: AspectMode): { w: number; h: number } {
  switch (mode) {
    case '16:9':
      return { w: 1280, h: 720 };
    case '1:1':
      return { w: 960, h: 960 };
    case '4:5':
      return { w: 864, h: 1080 };
    case '9:16':
    default:
      return { w: 720, h: 1280 };
  }
}

function wrapLines(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const paragraphs = text.split('\n');
  const lines: string[] = [];
  for (const para of paragraphs) {
    const words = para.split(' ');
    let current = '';
    for (const w of words) {
      const test = current ? `${current} ${w}` : w;
      if (ctx.measureText(test).width > maxWidth && current) {
        lines.push(current);
        current = w;
      } else {
        current = test;
      }
    }
    lines.push(current);
  }
  return lines;
}

function synthesizeAmbientWavBlob(kind: 'c_major' | 'g_warm', durationSec = 8): Blob {
  const sampleRate = 22050;
  const len = Math.floor(sampleRate * durationSec);
  const freqs = kind === 'c_major' ? [261.63, 329.63, 392.0] : [196.0, 246.94, 293.66];
  const dataByteSize = len * 2;
  const arrayBuffer = new ArrayBuffer(44 + dataByteSize);
  const view = new DataView(arrayBuffer);
  const writeStr = (o: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(o + i, s.charCodeAt(i));
  };
  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + dataByteSize, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeStr(36, 'data');
  view.setUint32(40, dataByteSize, true);

  let offset = 44;
  for (let i = 0; i < len; i++) {
    const t = i / sampleRate;
    const attack = Math.min(1, t / 0.5);
    const release = Math.min(1, (durationSec - t) / 0.8);
    const env = Math.max(0, Math.min(attack, release)) * 0.22;
    let sum = 0;
    for (const f of freqs) sum += Math.sin(2 * Math.PI * f * t);
    const sample = Math.max(-1, Math.min(1, (sum / freqs.length) * env));
    view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
    offset += 2;
  }
  return new Blob([arrayBuffer], { type: 'audio/wav' });
}

export const VideoStudioModule: React.FC = () => {
  const { lang } = useLanguage();
  const { userProfile, recordings, creations, customTemplates, reloadData } = useShalomDB();
  const isEn = lang === 'en';

  const savedVideoProjects = useMemo(
    () => creations.filter((c) => c.studioType === 'video'),
    [creations]
  );
  const savedVideoTemplates = useMemo(
    () => customTemplates.filter((t) => t.studioType === 'video'),
    [customTemplates]
  );

  const [currentProjectId, setCurrentProjectId] = useState<string | null>(null);
  const [aspectMode, setAspectMode] = useState<AspectMode>('9:16');
  const [canvasBgColor, setCanvasBgColor] = useState('#090d1a');
  const [projectTitle, setProjectTitle] = useState(
    isEn ? 'Untitled Video Project' : 'Nouvelle vidéo SHALOM'
  );

  const [scenes, setScenes] = useState<VideoScene[]>([]);
  const [overlays, setOverlays] = useState<OverlayLayer[]>([]);
  const [audioTracks, setAudioTracks] = useState<VideoAudioTrack[]>([]);

  // Selection & Canva-like workspace controls
  const [selectedSceneId, setSelectedSceneId] = useState<string | null>(null);
  const [selectedOverlayId, setSelectedOverlayId] = useState<string | null>(null);
  const [activeToolTab, setActiveToolTab] = useState<
    'templates' | 'scenes' | 'elements' | 'text' | 'audio' | 'layers' | 'projects'
  >('templates');
  const [snapEnabled, setSnapEnabled] = useState(true);
  const [timelineZoom, setTimelineZoom] = useState(44); // px per sec

  // Online templates search
  const [templateQuery, setTemplateQuery] = useState('');
  const [templateCategory, setTemplateCategory] = useState('all');
  const [onlineTemplates, setOnlineTemplates] = useState<VideoTemplateDef[]>([]);
  const [templatePage, setTemplatePage] = useState(1);
  const [templateHasMore, setTemplateHasMore] = useState(true);
  const [isSearchingOnline, setIsSearchingOnline] = useState(false);
  const [isLoadingMoreTemplates, setIsLoadingMoreTemplates] = useState(false);
  const [onlineStatusMsg, setOnlineStatusMsg] = useState<string | null>(null);
  const [draggedOverlayId, setDraggedOverlayId] = useState<string | null>(null);

  // Undo / Redo
  const [undoStack, setUndoStack] = useState<VideoSnapshot[]>([]);
  const [redoStack, setRedoStack] = useState<VideoSnapshot[]>([]);

  // Voiceover mic capture
  const [isRecordingVoiceover, setIsRecordingVoiceover] = useState(false);
  const [voSeconds, setVoSeconds] = useState(0);
  const voRecorderRef = useRef<MediaRecorder | null>(null);
  const voStreamRef = useRef<MediaStream | null>(null);
  const voChunksRef = useRef<Blob[]>([]);
  const voTimerRef = useRef<number | null>(null);

  // Preview & Export
  const [previewTimeSec, setPreviewTimeSec] = useState(0);
  const [isPlayingPreview, setIsPlayingPreview] = useState(false);
  const previewRafRef = useRef<number | null>(null);
  const [showPreviewModal, setShowPreviewModal] = useState(false);

  const [isSavingProject, setIsSavingProject] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [exportedVideoUrl, setExportedVideoUrl] = useState<string | null>(null);
  const [exportedVideoBlob, setExportedVideoBlob] = useState<Blob | null>(null);
  const [exportedMimeType, setExportedMimeType] = useState('video/webm');
  const [notice, setNotice] = useState<string | null>(null);
  const [sharePayload, setSharePayload] = useState<SharePayload | null>(null);

  // Auto-draft
  const [recoverableDraft, setRecoverableDraft] = useState(false);
  const draftCheckedRef = useRef(false);

  // Canvas direct manipulation state
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const cancelExportRef = useRef(false);
  const isExportingRef = useRef(false);
  const [showCenterGuides, setShowCenterGuides] = useState<{ x: boolean; y: boolean }>({
    x: false,
    y: false,
  });

  const dragActionRef = useRef<{
    overlayId: string;
    mode: 'move' | 'resize' | 'rotate';
    startX: number;
    startY: number;
    origXPct: number;
    origYPct: number;
    origSize: number;
    origRotation: number;
    centerPxX: number;
    centerPxY: number;
  } | null>(null);

  const dragTimelineOverlayRef = useRef<{
    overlayId: string;
    startClientX: number;
    origStartSec: number;
    durationSec: number;
  } | null>(null);

  const dims = getDims(aspectMode);

  const sceneTimingMap = useMemo(() => {
    let cursor = 0;
    return scenes.map((s) => {
      const dur =
        s.kind === 'video'
          ? Math.max(0.5, (s.trimEndSec - s.trimStartSec) / s.playbackRate)
          : Math.max(0.5, s.durationSec);
      const entry = { scene: s, start: cursor, end: cursor + dur, dur };
      cursor += dur;
      return entry;
    });
  }, [scenes]);

  const totalDurationSec = useMemo(
    () => (sceneTimingMap.length > 0 ? sceneTimingMap[sceneTimingMap.length - 1].end : 0),
    [sceneTimingMap]
  );

  const pushHistory = useCallback(() => {
    const snap: VideoSnapshot = {
      aspectMode,
      canvasBgColor,
      scenes: scenes.map((s) => ({ ...s })),
      overlays: overlays.map((o) => ({ ...o })),
      audioTracks: audioTracks.map((a) => ({ ...a })),
    };
    setUndoStack((prev) => [...prev.slice(-19), snap]);
    setRedoStack([]);
  }, [aspectMode, canvasBgColor, scenes, overlays, audioTracks]);

  const handleUndo = useCallback(() => {
    if (undoStack.length === 0) return;
    const prev = undoStack[undoStack.length - 1];
    setRedoStack((r) => [
      ...r.slice(-19),
      { aspectMode, canvasBgColor, scenes, overlays, audioTracks },
    ]);
    setUndoStack((u) => u.slice(0, -1));
    setAspectMode(prev.aspectMode);
    setCanvasBgColor(prev.canvasBgColor);
    setScenes(prev.scenes);
    setOverlays(prev.overlays);
    setAudioTracks(prev.audioTracks);
  }, [undoStack, aspectMode, canvasBgColor, scenes, overlays, audioTracks]);

  const handleRedo = useCallback(() => {
    if (redoStack.length === 0) return;
    const next = redoStack[redoStack.length - 1];
    setUndoStack((u) => [
      ...u.slice(-19),
      { aspectMode, canvasBgColor, scenes, overlays, audioTracks },
    ]);
    setRedoStack((r) => r.slice(0, -1));
    setAspectMode(next.aspectMode);
    setCanvasBgColor(next.canvasBgColor);
    setScenes(next.scenes);
    setOverlays(next.overlays);
    setAudioTracks(next.audioTracks);
  }, [redoStack, aspectMode, canvasBgColor, scenes, overlays, audioTracks]);

  // Keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) handleRedo();
        else handleUndo();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        handleRedo();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [handleUndo, handleRedo]);

  // Draft recovery check on mount
  useEffect(() => {
    if (draftCheckedRef.current) return;
    draftCheckedRef.current = true;
    loadStudioDraft('video').then((d) => {
      if (d && d.projectJson) {
        setRecoverableDraft(true);
      }
    });
  }, []);

  useEffect(() => {
    return () => {
      if (voTimerRef.current) clearInterval(voTimerRef.current);
      if (previewRafRef.current) cancelAnimationFrame(previewRafRef.current);
      voStreamRef.current?.getTracks().forEach((t) => t.stop());
      scenes.forEach((s) => s.objectUrl && URL.revokeObjectURL(s.objectUrl));
      overlays.forEach((o) => o.objectUrl && URL.revokeObjectURL(o.objectUrl));
      audioTracks.forEach((a) => URL.revokeObjectURL(a.objectUrl));
      if (exportedVideoUrl) URL.revokeObjectURL(exportedVideoUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Serialization helpers for editable Save & Auto-Draft
  const ensureBlobKey = async (
    existingKey: string | undefined,
    blob: Blob | undefined,
    objectUrl: string | undefined,
    prefix: string
  ): Promise<string | undefined> => {
    if (existingKey) {
      const ok = await dbService.verifyMediaBlob(existingKey);
      if (ok) return existingKey;
    }
    let b = blob;
    if (!b && objectUrl) {
      try {
        const resp = await fetch(objectUrl);
        b = await resp.blob();
      } catch {
        return undefined;
      }
    }
    if (!b || b.size === 0) return undefined;
    const key = `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    await dbService.saveMediaBlob(key, b, b.type || 'application/octet-stream');
    return key;
  };

  const serializeVideoProject = async (): Promise<{
    json: string;
    mediaAssetKeys: string[];
  }> => {
    const assetKeys: string[] = [];

    const serializedScenes: SerializedVideoScene[] = [];
    for (const s of scenes) {
      let aKey = s.assetKey;
      if (s.kind !== 'custom') {
        aKey = await ensureBlobKey(s.assetKey, s.sourceBlob, s.objectUrl, 'studio_vscene');
        if (aKey) {
          s.assetKey = aKey;
          assetKeys.push(aKey);
        }
      }
      serializedScenes.push({
        id: s.id,
        kind: s.kind,
        name: s.name,
        durationSec: s.durationSec,
        assetKey: aKey,
        trimStartSec: s.trimStartSec,
        trimEndSec: s.trimEndSec,
        fitMode: s.fitMode,
        kenBurns: s.kenBurns,
        volume: s.volume,
        playbackRate: s.playbackRate,
        transition: s.transition,
        filter: s.filter,
        bgType: s.bgType,
        bgColor: s.bgColor,
        bgColor2: s.bgColor2,
        shape: s.shape,
        shapeColor: s.shapeColor,
        text: s.text,
        textColor: s.textColor,
        fontSize: s.fontSize,
        fontFamily: s.fontFamily,
        bold: s.bold,
        italic: s.italic,
        underline: s.underline,
        uppercase: s.uppercase,
        textAlign: s.textAlign,
        textShadow: s.textShadow,
      });
    }

    const serializedOverlays: SerializedOverlayLayer[] = [];
    for (const o of overlays) {
      let aKey = o.assetKey;
      if (o.kind === 'image') {
        aKey = await ensureBlobKey(o.assetKey, o.sourceBlob, o.objectUrl, 'studio_vov');
        if (aKey) {
          o.assetKey = aKey;
          assetKeys.push(aKey);
        }
      }
      serializedOverlays.push({
        id: o.id,
        kind: o.kind,
        label: o.label,
        startSec: o.startSec,
        endSec: o.endSec,
        xPct: o.xPct,
        yPct: o.yPct,
        size: o.size,
        rotationDeg: o.rotationDeg,
        color: o.color,
        strokeColor: o.strokeColor,
        bgBadge: o.bgBadge,
        bgBadgeColor: o.bgBadgeColor,
        opacity: o.opacity,
        animation: o.animation,
        text: o.text,
        fontFamily: o.fontFamily,
        bold: o.bold,
        italic: o.italic,
        underline: o.underline,
        uppercase: o.uppercase,
        textAlign: o.textAlign,
        textShadow: o.textShadow,
        shape: o.shape,
        assetKey: aKey,
      });
    }

    const serializedAudio: SerializedVideoAudioTrack[] = [];
    for (const a of audioTracks) {
      const aKey = await ensureBlobKey(a.assetKey, a.sourceBlob, a.objectUrl, 'studio_vaud');
      if (aKey) {
        a.assetKey = aKey;
        assetKeys.push(aKey);
      }
      serializedAudio.push({
        id: a.id,
        name: a.name,
        assetKey: aKey,
        startSec: a.startSec,
        volume: a.volume,
      });
    }

    const payload: SerializedVideoProject = {
      version: 2,
      aspectMode,
      canvasBgColor,
      scenes: serializedScenes,
      overlays: serializedOverlays,
      audioTracks: serializedAudio,
    };
    return { json: JSON.stringify(payload), mediaAssetKeys: assetKeys };
  };

  const deserializeAndLoadVideoProject = async (
    title: string,
    projectJson: string,
    projectId: string | null
  ) => {
    const parsed = JSON.parse(projectJson) as SerializedVideoProject;
    const restoredScenes: VideoScene[] = [];

    for (const ss of parsed.scenes || []) {
      if (ss.kind === 'custom') {
        restoredScenes.push({ ...ss });
        continue;
      }
      if (!ss.assetKey) continue;
      const blob = await dbService.getMediaBlob(ss.assetKey);
      if (!blob) continue;
      const url = URL.createObjectURL(blob);
      if (ss.kind === 'image') {
        const img = await new Promise<HTMLImageElement>((res, rej) => {
          const el = new Image();
          el.onload = () => res(el);
          el.onerror = rej;
          el.src = url;
        }).catch(() => null);
        if (!img) continue;
        restoredScenes.push({ ...ss, objectUrl: url, imageEl: img, sourceBlob: blob });
      } else {
        const vid = await new Promise<HTMLVideoElement>((res, rej) => {
          const el = document.createElement('video');
          el.playsInline = true;
          el.muted = true;
          el.preload = 'auto';
          el.onloadedmetadata = () => res(el);
          el.onerror = rej;
          el.src = url;
        }).catch(() => null);
        if (!vid) continue;
        restoredScenes.push({ ...ss, objectUrl: url, videoEl: vid, sourceBlob: blob });
      }
    }

    const restoredOverlays: OverlayLayer[] = [];
    for (const so of parsed.overlays || []) {
      if (so.kind === 'image' && so.assetKey) {
        const blob = await dbService.getMediaBlob(so.assetKey);
        if (!blob) continue;
        const url = URL.createObjectURL(blob);
        const img = await new Promise<HTMLImageElement>((res, rej) => {
          const el = new Image();
          el.onload = () => res(el);
          el.onerror = rej;
          el.src = url;
        }).catch(() => null);
        if (!img) continue;
        restoredOverlays.push({ ...so, objectUrl: url, imageEl: img, sourceBlob: blob });
      } else {
        restoredOverlays.push({ ...so });
      }
    }

    const restoredAudio: VideoAudioTrack[] = [];
    for (const sa of parsed.audioTracks || []) {
      if (!sa.assetKey) continue;
      const blob = await dbService.getMediaBlob(sa.assetKey);
      if (!blob) continue;
      restoredAudio.push({
        id: sa.id,
        name: sa.name,
        assetKey: sa.assetKey,
        sourceBlob: blob,
        objectUrl: URL.createObjectURL(blob),
        startSec: sa.startSec,
        volume: sa.volume,
      });
    }

    setProjectTitle(title);
    setCurrentProjectId(projectId);
    setAspectMode(parsed.aspectMode || '9:16');
    setCanvasBgColor(parsed.canvasBgColor || '#090d1a');
    setScenes(restoredScenes);
    setOverlays(restoredOverlays);
    setAudioTracks(restoredAudio);
    setSelectedSceneId(restoredScenes[0]?.id || null);
    setSelectedOverlayId(restoredOverlays[0]?.id || null);
    setUndoStack([]);
    setRedoStack([]);
  };

  // Debounced auto-draft save
  useEffect(() => {
    if (scenes.length === 0 && overlays.length === 0 && audioTracks.length === 0) return;
    const t = window.setTimeout(async () => {
      try {
        const { json, mediaAssetKeys } = await serializeVideoProject();
        await saveStudioDraft('video', projectTitle, json, mediaAssetKeys);
      } catch {
        // ignore background draft failure
      }
    }, 2400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scenes, overlays, audioTracks, aspectMode, canvasBgColor, projectTitle]);

  const handleRestoreDraft = async () => {
    const draft = await loadStudioDraft('video');
    if (!draft) {
      setRecoverableDraft(false);
      return;
    }
    try {
      await deserializeAndLoadVideoProject(draft.title || 'Brouillon Vidéo', draft.projectJson, null);
      setRecoverableDraft(false);
      setNotice(isEn ? 'Previous video draft restored!' : 'Brouillon vidéo restauré !');
    } catch {
      setRecoverableDraft(false);
    }
  };

  const drawSceneFrame = (
    ctx: CanvasRenderingContext2D,
    scene: VideoScene,
    localElapsed: number,
    segDur: number,
    w: number,
    h: number
  ) => {
    ctx.save();

    // Scene transition & filter
    if (scene.filter === 'warm') ctx.filter = 'sepia(0.28) saturate(1.25)';
    else if (scene.filter === 'bw') ctx.filter = 'grayscale(1) contrast(1.08)';
    else if (scene.filter === 'vivid') ctx.filter = 'saturate(1.45) contrast(1.08)';
    else ctx.filter = 'none';

    const transDur = 0.45;
    if (scene.transition === 'fade' && localElapsed < transDur) {
      ctx.globalAlpha = Math.max(0.05, localElapsed / transDur);
    } else if (scene.transition === 'slide' && localElapsed < transDur) {
      const p = localElapsed / transDur;
      ctx.translate((1 - p) * w * 0.25, 0);
      ctx.globalAlpha = p;
    } else if (scene.transition === 'zoom' && localElapsed < transDur) {
      const p = localElapsed / transDur;
      const scale = 0.88 + 0.12 * p;
      ctx.translate(w / 2, h / 2);
      ctx.scale(scale, scale);
      ctx.translate(-w / 2, -h / 2);
      ctx.globalAlpha = p;
    }

    if (scene.kind === 'custom') {
      if (scene.bgType === 'gradient') {
        const g = ctx.createLinearGradient(0, 0, w, h);
        g.addColorStop(0, scene.bgColor);
        g.addColorStop(1, scene.bgColor2);
        ctx.fillStyle = g;
      } else {
        ctx.fillStyle = scene.bgColor;
      }
      ctx.fillRect(0, 0, w, h);

      if (scene.shape !== 'none') {
        ctx.save();
        ctx.translate(w / 2, h * 0.34);
        const sSize = Math.min(w, h) * 0.24;
        drawStudioVectorElement(ctx, scene.shape, sSize, sSize, scene.shapeColor, scene.shapeColor, 0);
        ctx.restore();
      }

      if (scene.text.trim()) {
        ctx.save();
        const isBold = scene.bold !== false;
        const isItalic = Boolean(scene.italic);
        const align = scene.textAlign || 'center';
        const rawText = scene.uppercase ? scene.text.toUpperCase() : scene.text;
        ctx.fillStyle = scene.textColor;
        ctx.textAlign = align;
        ctx.textBaseline = 'middle';
        ctx.font = `${isItalic ? 'italic ' : ''}${isBold ? '700 ' : '400 '}${scene.fontSize}px ${scene.fontFamily}`;
        if (scene.textShadow) {
          ctx.shadowColor = 'rgba(0,0,0,0.68)';
          ctx.shadowBlur = 12;
          ctx.shadowOffsetY = 3;
        }
        const lines = wrapLines(ctx, rawText, w - 100);
        const lineHeight = scene.fontSize * 1.25;
        const baseY = scene.shape === 'none' ? h * 0.5 : h * 0.65;
        const startY = baseY - ((lines.length - 1) * lineHeight) / 2;
        const anchorX = align === 'left' ? 54 : align === 'right' ? w - 54 : w / 2;
        lines.forEach((line, idx) => {
          const ly = startY + idx * lineHeight;
          ctx.fillText(line, anchorX, ly);
          if (scene.underline && line.trim()) {
            const lw = ctx.measureText(line).width;
            const lx =
              align === 'center' ? anchorX - lw / 2 : align === 'right' ? anchorX - lw : anchorX;
            ctx.save();
            ctx.shadowColor = 'transparent';
            ctx.strokeStyle = scene.textColor;
            ctx.lineWidth = Math.max(2, Math.round(scene.fontSize * 0.065));
            ctx.beginPath();
            ctx.moveTo(lx, ly + scene.fontSize * 0.44);
            ctx.lineTo(lx + lw, ly + scene.fontSize * 0.44);
            ctx.stroke();
            ctx.restore();
          }
        });
        ctx.restore();
      }
      ctx.restore();
      return;
    }

    const mediaEl = scene.kind === 'image' ? scene.imageEl : scene.videoEl;
    if (!mediaEl) {
      ctx.restore();
      return;
    }
    const srcW =
      scene.kind === 'image'
        ? (mediaEl as HTMLImageElement).width
        : (mediaEl as HTMLVideoElement).videoWidth || w;
    const srcH =
      scene.kind === 'image'
        ? (mediaEl as HTMLImageElement).height
        : (mediaEl as HTMLVideoElement).videoHeight || h;
    const sRatio = srcW / Math.max(1, srcH);
    const cRatio = w / h;

    let dw = w;
    let dh = h;
    if (scene.fitMode === 'contain') {
      if (sRatio > cRatio) {
        dw = w;
        dh = w / sRatio;
      } else {
        dh = h;
        dw = h * sRatio;
      }
    } else {
      if (sRatio > cRatio) {
        dh = h;
        dw = h * sRatio;
      } else {
        dw = w;
        dh = w / sRatio;
      }
    }

    const zoom = scene.kenBurns ? 1 + (localElapsed / Math.max(0.5, segDur)) * 0.08 : 1;
    dw *= zoom;
    dh *= zoom;
    const dx = (w - dw) / 2;
    const dy = (h - dh) / 2;
    ctx.drawImage(mediaEl, dx, dy, dw, dh);
    ctx.restore();
  };

  const getOverlayBoxDims = (
    ctx: CanvasRenderingContext2D,
    ov: OverlayLayer,
    w: number
  ): { boxW: number; boxH: number } => {
    if (ov.kind === 'text' && ov.text) {
      const isBold = ov.bold !== false;
      const isItalic = Boolean(ov.italic);
      const rawText = ov.uppercase ? ov.text.toUpperCase() : ov.text;
      ctx.font = `${isItalic ? 'italic ' : ''}${isBold ? '700 ' : '400 '}${ov.size}px ${ov.fontFamily || '"Outfit", sans-serif'}`;
      const lines = wrapLines(ctx, rawText, w - 80);
      const lh = ov.size * 1.25;
      const maxLineW = Math.max(...lines.map((l) => ctx.measureText(l).width), 60);
      return {
        boxW: Math.min(w - 40, maxLineW + (ov.bgBadge ? 48 : 20)),
        boxH: lines.length * lh + (ov.bgBadge ? 28 : 16),
      };
    }
    if (ov.kind === 'image' && ov.imageEl) {
      const ratio = ov.imageEl.width / Math.max(1, ov.imageEl.height);
      return { boxW: ov.size, boxH: ov.size / ratio };
    }
    return { boxW: ov.size, boxH: ov.size };
  };

  const drawOverlaysAtTime = (
    ctx: CanvasRenderingContext2D,
    timeSec: number,
    w: number,
    h: number,
    includeSelectionGizmos = false
  ) => {
    for (const ov of overlays) {
      if (timeSec < ov.startSec || timeSec > ov.endSec) continue;
      const cx = (ov.xPct / 100) * w;
      let cy = (ov.yPct / 100) * h;

      const elapsed = timeSec - ov.startSec;
      let animAlpha = 1;
      if (ov.animation === 'fade-in' && elapsed < 0.45) {
        animAlpha = Math.max(0.05, elapsed / 0.45);
      } else if (ov.animation === 'slide-up' && elapsed < 0.45) {
        const p = elapsed / 0.45;
        animAlpha = p;
        cy += (1 - p) * 32;
      }

      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(((ov.rotationDeg || 0) * Math.PI) / 180);
      ctx.globalAlpha = ov.opacity * animAlpha;

      const { boxW, boxH } = getOverlayBoxDims(ctx, ov, w);

      if (ov.kind === 'text' && ov.text) {
        const isBold = ov.bold !== false;
        const isItalic = Boolean(ov.italic);
        const align = ov.textAlign || 'center';
        const rawText = ov.uppercase ? ov.text.toUpperCase() : ov.text;
        ctx.font = `${isItalic ? 'italic ' : ''}${isBold ? '700 ' : '400 '}${ov.size}px ${ov.fontFamily || '"Outfit", sans-serif'}`;
        ctx.textAlign = align;
        ctx.textBaseline = 'middle';
        const lines = wrapLines(ctx, rawText, w - 80);
        const lh = ov.size * 1.25;
        if (ov.bgBadge) {
          ctx.fillStyle = ov.bgBadgeColor || 'rgba(8, 16, 36, 0.78)';
          ctx.beginPath();
          ctx.roundRect(-boxW / 2, -boxH / 2, boxW, boxH, 16);
          ctx.fill();
        }
        if (ov.textShadow) {
          ctx.shadowColor = 'rgba(0,0,0,0.68)';
          ctx.shadowBlur = 10;
          ctx.shadowOffsetY = 3;
        }
        ctx.fillStyle = ov.color;
        const startY = -((lines.length - 1) * lh) / 2;
        const padX = ov.bgBadge ? 22 : 10;
        const textAnchorX = align === 'left' ? -boxW / 2 + padX : align === 'right' ? boxW / 2 - padX : 0;
        lines.forEach((line, i) => {
          const ly = startY + i * lh;
          ctx.fillText(line, textAnchorX, ly);
          if (ov.underline && line.trim()) {
            const lw = ctx.measureText(line).width;
            const lx =
              align === 'center' ? textAnchorX - lw / 2 : align === 'right' ? textAnchorX - lw : textAnchorX;
            ctx.save();
            ctx.shadowColor = 'transparent';
            ctx.strokeStyle = ov.color;
            ctx.lineWidth = Math.max(2, Math.round(ov.size * 0.065));
            ctx.beginPath();
            ctx.moveTo(lx, ly + ov.size * 0.44);
            ctx.lineTo(lx + lw, ly + ov.size * 0.44);
            ctx.stroke();
            ctx.restore();
          }
        });
      } else if (ov.kind === 'shape' && ov.shape) {
        drawStudioVectorElement(
          ctx,
          ov.shape,
          ov.size,
          ov.size,
          ov.color,
          ov.strokeColor || '#ffffff',
          0
        );
      } else if (ov.kind === 'image' && ov.imageEl) {
        ctx.drawImage(ov.imageEl, -boxW / 2, -boxH / 2, boxW, boxH);
      }

      // Canva-style selection box + corner resize + top rotation handles
      if (includeSelectionGizmos && selectedOverlayId === ov.id) {
        ctx.globalAlpha = 1;
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 3;
        ctx.setLineDash([8, 6]);
        ctx.strokeRect(-boxW / 2 - 8, -boxH / 2 - 8, boxW + 16, boxH + 16);
        ctx.setLineDash([]);

        // Bottom-right resize knob
        ctx.fillStyle = '#ffffff';
        ctx.strokeStyle = '#1d4ed8';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(boxW / 2 + 8, boxH / 2 + 8, 12, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Top rotation handle
        ctx.beginPath();
        ctx.moveTo(0, -boxH / 2 - 8);
        ctx.lineTo(0, -boxH / 2 - 36);
        ctx.strokeStyle = '#fbbf24';
        ctx.lineWidth = 2.5;
        ctx.stroke();
        ctx.fillStyle = '#fbbf24';
        ctx.beginPath();
        ctx.arc(0, -boxH / 2 - 38, 11, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();
    }
  };

  // Render live canvas preview frame whenever state changes
  useEffect(() => {
    if (isExportingRef.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = dims.w;
    canvas.height = dims.h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = canvasBgColor;
    ctx.fillRect(0, 0, dims.w, dims.h);

    if (sceneTimingMap.length === 0) {
      drawOverlaysAtTime(ctx, previewTimeSec, dims.w, dims.h, true);
    } else {
      const match =
        sceneTimingMap.find((m) => previewTimeSec >= m.start && previewTimeSec <= m.end) ||
        sceneTimingMap[sceneTimingMap.length - 1];

      if (match) {
        const localElapsed = Math.max(0, previewTimeSec - match.start);
        if (match.scene.kind === 'video' && match.scene.videoEl && !isPlayingPreview) {
          const targetT = match.scene.trimStartSec + localElapsed * match.scene.playbackRate;
          if (Math.abs(match.scene.videoEl.currentTime - targetT) > 0.15) {
            match.scene.videoEl.currentTime = Math.min(match.scene.trimEndSec, targetT);
          }
        }
        drawSceneFrame(ctx, match.scene, localElapsed, match.dur, dims.w, dims.h);
      }
      drawOverlaysAtTime(ctx, previewTimeSec, dims.w, dims.h, true);
    }

    // Center snap guides when dragging overlays
    if (showCenterGuides.x) {
      ctx.save();
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 2;
      ctx.setLineDash([8, 8]);
      ctx.beginPath();
      ctx.moveTo(dims.w / 2, 0);
      ctx.lineTo(dims.w / 2, dims.h);
      ctx.stroke();
      ctx.restore();
    }
    if (showCenterGuides.y) {
      ctx.save();
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 2;
      ctx.setLineDash([8, 8]);
      ctx.beginPath();
      ctx.moveTo(0, dims.h / 2);
      ctx.lineTo(dims.w, dims.h / 2);
      ctx.stroke();
      ctx.restore();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    previewTimeSec,
    scenes,
    overlays,
    aspectMode,
    canvasBgColor,
    isPlayingPreview,
    selectedOverlayId,
    showCenterGuides,
  ]);

  // Direct Canvas Pointer Manipulation (Drag/Resize/Rotate overlays on video preview)
  const getCanvasPoint = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / Math.max(1, rect.width)) * dims.w,
      y: ((e.clientY - rect.top) / Math.max(1, rect.height)) * dims.h,
    };
  };

  const handleCanvasPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const pt = getCanvasPoint(e);
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!ctx) return;

    // 1. Check handles of currently selected overlay if visible at previewTimeSec
    const currentOv = overlays.find(
      (o) =>
        o.id === selectedOverlayId &&
        previewTimeSec >= o.startSec &&
        previewTimeSec <= o.endSec
    );
    if (currentOv) {
      const cx = (currentOv.xPct / 100) * dims.w;
      const cy = (currentOv.yPct / 100) * dims.h;
      const { boxW, boxH } = getOverlayBoxDims(ctx, currentOv, dims.w);
      const rad = ((currentOv.rotationDeg || 0) * Math.PI) / 180;
      const cos = Math.cos(-rad);
      const sin = Math.sin(-rad);
      const dx = pt.x - cx;
      const dy = pt.y - cy;
      const localX = dx * cos - dy * sin;
      const localY = dx * sin + dy * cos;

      // Top rotation handle check
      if (Math.hypot(localX - 0, localY - (-boxH / 2 - 38)) <= 24) {
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        pushHistory();
        dragActionRef.current = {
          overlayId: currentOv.id,
          mode: 'rotate',
          startX: pt.x,
          startY: pt.y,
          origXPct: currentOv.xPct,
          origYPct: currentOv.yPct,
          origSize: currentOv.size,
          origRotation: currentOv.rotationDeg || 0,
          centerPxX: cx,
          centerPxY: cy,
        };
        return;
      }

      // Bottom-right resize knob check
      if (Math.hypot(localX - (boxW / 2 + 8), localY - (boxH / 2 + 8)) <= 24) {
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        pushHistory();
        dragActionRef.current = {
          overlayId: currentOv.id,
          mode: 'resize',
          startX: pt.x,
          startY: pt.y,
          origXPct: currentOv.xPct,
          origYPct: currentOv.yPct,
          origSize: currentOv.size,
          origRotation: currentOv.rotationDeg || 0,
          centerPxX: cx,
          centerPxY: cy,
        };
        return;
      }
    }

    // 2. Hit test visible overlays top-to-bottom (rotation-aware)
    const visible = overlays
      .filter((o) => previewTimeSec >= o.startSec && previewTimeSec <= o.endSec)
      .reverse();

    for (const ov of visible) {
      const cx = (ov.xPct / 100) * dims.w;
      const cy = (ov.yPct / 100) * dims.h;
      const { boxW, boxH } = getOverlayBoxDims(ctx, ov, dims.w);
      const rad = ((ov.rotationDeg || 0) * Math.PI) / 180;
      const cos = Math.cos(-rad);
      const sin = Math.sin(-rad);
      const dx = pt.x - cx;
      const dy = pt.y - cy;
      const localX = dx * cos - dy * sin;
      const localY = dx * sin + dy * cos;
      if (Math.abs(localX) <= boxW / 2 + 16 && Math.abs(localY) <= boxH / 2 + 16) {
        setSelectedOverlayId(ov.id);
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        pushHistory();
        dragActionRef.current = {
          overlayId: ov.id,
          mode: 'move',
          startX: pt.x,
          startY: pt.y,
          origXPct: ov.xPct,
          origYPct: ov.yPct,
          origSize: ov.size,
          origRotation: ov.rotationDeg || 0,
          centerPxX: cx,
          centerPxY: cy,
        };
        return;
      }
    }

    setSelectedOverlayId(null);
  };

  const handleCanvasPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const act = dragActionRef.current;
    if (!act) return;
    const pt = getCanvasPoint(e);

    if (act.mode === 'move') {
      const dxPct = ((pt.x - act.startX) / dims.w) * 100;
      const dyPct = ((pt.y - act.startY) / dims.h) * 100;
      let nextX = Math.max(4, Math.min(96, act.origXPct + dxPct));
      let nextY = Math.max(4, Math.min(96, act.origYPct + dyPct));
      let snapX = false;
      let snapY = false;
      if (snapEnabled) {
        if (Math.abs(nextX - 50) < 2.2) {
          nextX = 50;
          snapX = true;
        }
        if (Math.abs(nextY - 50) < 2.2) {
          nextY = 50;
          snapY = true;
        }
      }
      setShowCenterGuides({ x: snapX, y: snapY });
      setOverlays((prev) =>
        prev.map((o) =>
          o.id === act.overlayId
            ? { ...o, xPct: Math.round(nextX), yPct: Math.round(nextY) }
            : o
        )
      );
    } else if (act.mode === 'resize') {
      const dist = Math.hypot(pt.x - act.startX, pt.y - act.startY);
      const sign = pt.x - act.startX + (pt.y - act.startY) >= 0 ? 1 : -1;
      const nextSize = Math.max(18, Math.min(340, Math.round(act.origSize + sign * dist * 0.45)));
      setOverlays((prev) =>
        prev.map((o) => (o.id === act.overlayId ? { ...o, size: nextSize } : o))
      );
    } else if (act.mode === 'rotate') {
      const angleRad = Math.atan2(pt.y - act.centerPxY, pt.x - act.centerPxX);
      let deg = Math.round((angleRad * 180) / Math.PI + 90);
      if (snapEnabled && Math.abs(deg % 45) < 5) {
        deg = Math.round(deg / 45) * 45;
      }
      setOverlays((prev) =>
        prev.map((o) => (o.id === act.overlayId ? { ...o, rotationDeg: deg } : o))
      );
    }
  };

  const handleCanvasPointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (dragActionRef.current) {
      try {
        (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {
        // noop
      }
      dragActionRef.current = null;
      setShowCenterGuides({ x: false, y: false });
    }
  };

  const handleTogglePreviewPlay = () => {
    if (isPlayingPreview) {
      if (previewRafRef.current) cancelAnimationFrame(previewRafRef.current);
      setIsPlayingPreview(false);
      return;
    }
    if (totalDurationSec <= 0) return;
    const startOffset = previewTimeSec >= totalDurationSec - 0.1 ? 0 : previewTimeSec;
    const wallStart = performance.now();
    setIsPlayingPreview(true);

    const step = () => {
      const t = startOffset + (performance.now() - wallStart) / 1000;
      if (t >= totalDurationSec) {
        setPreviewTimeSec(0);
        setIsPlayingPreview(false);
        return;
      }
      setPreviewTimeSec(t);
      previewRafRef.current = requestAnimationFrame(step);
    };
    previewRafRef.current = requestAnimationFrame(step);
  };

  const applyVideoTemplate = async (
    tpl: VideoTemplateDef,
    options?: { skipPersist?: boolean }
  ) => {
    pushHistory();
    const newScenes: VideoScene[] = tpl.scenes.map((s, idx) => ({
      ...s,
      id: `scene_${Date.now()}_${idx}`,
    }));
    const newOverlays: OverlayLayer[] = tpl.overlays.map((o, idx) => ({
      ...o,
      id: `ov_${Date.now()}_${idx}`,
    }));
    setAspectMode(tpl.aspect);
    setCanvasBgColor(tpl.bgColor);
    setScenes(newScenes);
    setOverlays(newOverlays);
    setProjectTitle(isEn ? tpl.titleEn : tpl.titleFr);
    setSelectedSceneId(newScenes[0]?.id || null);
    setSelectedOverlayId(newOverlays[0]?.id || null);
    setPreviewTimeSec(0);

    const isOnlineTpl =
      Boolean(tpl.source && tpl.source !== 'local') ||
      tpl.id.startsWith('live_') ||
      tpl.id.startsWith('proc_') ||
      tpl.id.startsWith('online_');
    if (isOnlineTpl && !options?.skipPersist) {
      try {
        await saveOnlineTemplateLocally({
          id: tpl.id,
          studioType: 'video',
          title: isEn ? tpl.titleEn : tpl.titleFr,
          category: tpl.category || 'En ligne',
          templateObj: tpl,
          previewColor: tpl.bgColor,
          source: tpl.source,
        });
        reloadData();
      } catch {
        // non-fatal
      }
    }

    setNotice(
      isEn
        ? `Video template "${tpl.titleEn}" loaded${isOnlineTpl && !options?.skipPersist ? ' and kept in My Templates' : ''}!`
        : `Modèle vidéo « ${tpl.titleFr} » appliqué${isOnlineTpl && !options?.skipPersist ? ' et conservé dans Vos modèles' : ''} !`
    );
  };

  const handleApplySavedOnlineTemplate = async (savedItem: SavedStudioTemplate) => {
    try {
      const parsed = JSON.parse(savedItem.templateJson) as VideoTemplateDef;
      await applyVideoTemplate(parsed, { skipPersist: true });
    } catch {
      setNotice(isEn ? 'Could not load saved template.' : 'Impossible d’ouvrir ce modèle enregistré.');
    }
  };

  const handleDeleteSavedOnlineTemplate = async (id: string) => {
    await deleteSavedOnlineTemplate(id);
    reloadData();
  };

  const addBlankCustomScene = () => {
    pushHistory();
    const id = `scene_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`;
    setScenes((prev) => [
      ...prev,
      {
        id,
        kind: 'custom',
        name: `${isEn ? 'Custom Scene' : 'Scène libre'} #${prev.length + 1}`,
        durationSec: 4,
        trimStartSec: 0,
        trimEndSec: 4,
        fitMode: 'cover',
        kenBurns: false,
        volume: 1,
        playbackRate: 1,
        transition: 'fade',
        filter: 'none',
        bgType: 'gradient',
        bgColor: '#0f172a',
        bgColor2: '#1e3a8a',
        shape: 'none',
        shapeColor: '#fbbf24',
        text: isEn ? 'Your custom text here' : 'Votre texte ici',
        textColor: '#ffffff',
        fontSize: 42,
        fontFamily: '"Outfit", sans-serif',
      },
    ]);
    setSelectedSceneId(id);
  };

  const addMediaBlob = async (blob: Blob, name: string, kindHint?: 'image' | 'video') => {
    const kind: 'image' | 'video' =
      kindHint || (blob.type.startsWith('video/') ? 'video' : 'image');
    const url = URL.createObjectURL(blob);

    if (kind === 'image') {
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const el = new Image();
        el.onload = () => resolve(el);
        el.onerror = reject;
        el.src = url;
      });
      pushHistory();
      const id = `scene_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`;
      setScenes((prev) => [
        ...prev,
        {
          id,
          kind: 'image',
          name,
          sourceBlob: blob,
          objectUrl: url,
          imageEl: img,
          durationSec: 4,
          trimStartSec: 0,
          trimEndSec: 4,
          fitMode: 'contain',
          kenBurns: true,
          volume: 1,
          playbackRate: 1,
          transition: 'fade',
          filter: 'none',
          bgType: 'solid',
          bgColor: '#000000',
          bgColor2: '#000000',
          shape: 'none',
          shapeColor: '#ffffff',
          text: '',
          textColor: '#ffffff',
          fontSize: 36,
          fontFamily: '"Outfit", sans-serif',
        },
      ]);
      setSelectedSceneId(id);
    } else {
      const video = await new Promise<HTMLVideoElement>((resolve, reject) => {
        const el = document.createElement('video');
        el.playsInline = true;
        el.muted = true;
        el.preload = 'auto';
        el.onloadedmetadata = () => resolve(el);
        el.onerror = reject;
        el.src = url;
      });
      const dur = Number.isFinite(video.duration) && video.duration > 0 ? video.duration : 5;
      pushHistory();
      const id = `scene_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`;
      setScenes((prev) => [
        ...prev,
        {
          id,
          kind: 'video',
          name,
          sourceBlob: blob,
          objectUrl: url,
          videoEl: video,
          durationSec: Number(dur.toFixed(1)),
          trimStartSec: 0,
          trimEndSec: Number(dur.toFixed(1)),
          fitMode: 'contain',
          kenBurns: false,
          volume: 1,
          playbackRate: 1,
          transition: 'none',
          filter: 'none',
          bgType: 'solid',
          bgColor: '#000000',
          bgColor2: '#000000',
          shape: 'none',
          shapeColor: '#ffffff',
          text: '',
          textColor: '#ffffff',
          fontSize: 36,
          fontFamily: '"Outfit", sans-serif',
        },
      ]);
      setSelectedSceneId(id);
    }
  };

  const handleImportMediaFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    for (let i = 0; i < files.length; i++) {
      try {
        const verified = await readFileAsVerifiedBlob(files[i]);
        await addMediaBlob(verified.blob, verified.fileName);
        setNotice(
          isEn
            ? `Added "${verified.fileName}" to timeline.`
            : `Média « ${verified.fileName} » ajouté aux séquences.`
        );
      } catch (err) {
        setNotice(
          err instanceof Error
            ? err.message
            : isEn
              ? `Unable to load ${files[i].name}`
              : `Impossible de charger ${files[i].name}`
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
    if (rec.mediaType === 'audio') {
      pushHistory();
      setAudioTracks((prev) => [
        ...prev,
        {
          id: `vaud_${Date.now()}`,
          name: rec.title,
          sourceBlob: blob,
          objectUrl: URL.createObjectURL(blob),
          startSec: 0,
          volume: 0.9,
        },
      ]);
      setNotice(isEn ? `Audio "${rec.title}" added.` : `Audio « ${rec.title} » ajouté.`);
      return;
    }
    await addMediaBlob(blob, rec.title, 'video');
  };

  const addTextPresetOverlay = (preset: 'title' | 'verse' | 'lower_third' | 'watermark') => {
    pushHistory();
    const dur = Math.max(4, totalDurationSec || 4);
    const id = `ov_${Date.now()}`;
    const configs: Record<typeof preset, Partial<OverlayLayer>> = {
      title: {
        label: isEn ? 'Main Title' : 'Titre impactant',
        yPct: 24,
        size: 48,
        color: '#ffffff',
        bgBadge: false,
        animation: 'slide-up',
        text: isEn ? 'YOUR TITLE HERE' : 'VOTRE TITRE ICI',
        fontFamily: '"Outfit", sans-serif',
      },
      verse: {
        label: isEn ? 'Bible Verse' : 'Verset biblique',
        yPct: 50,
        size: 36,
        color: '#fef3c7',
        bgBadge: true,
        animation: 'fade-in',
        text: '« Tout est possible à celui qui croit. » (Marc 9:23)',
        fontFamily: 'Georgia, "Times New Roman", serif',
      },
      lower_third: {
        label: isEn ? 'Lower Third' : 'Bandeau inférieur',
        yPct: 82,
        size: 28,
        color: '#ffffff',
        bgBadge: true,
        animation: 'slide-up',
        text: userProfile?.fullName ? `${userProfile.fullName} · SHALOM` : 'Orateur / Église',
        fontFamily: '"Plus Jakarta Sans", sans-serif',
      },
      watermark: {
        label: 'Filigrane SHALOM',
        xPct: 80,
        yPct: 10,
        size: 22,
        color: '#fbbf24',
        bgBadge: false,
        opacity: 0.85,
        animation: 'none',
        text: 'SHALOM',
        fontFamily: '"Outfit", sans-serif',
      },
    };
    const cfg = configs[preset];
    setOverlays((prev) => [
      ...prev,
      {
        id,
        kind: 'text',
        label: cfg.label || 'Texte',
        startSec: 0,
        endSec: Number(dur.toFixed(1)),
        xPct: cfg.xPct ?? 50,
        yPct: cfg.yPct ?? 50,
        size: cfg.size ?? 34,
        rotationDeg: 0,
        color: cfg.color ?? '#ffffff',
        bgBadge: cfg.bgBadge ?? true,
        opacity: cfg.opacity ?? 1,
        animation: cfg.animation ?? 'fade-in',
        text: cfg.text ?? 'Texte',
        fontFamily: cfg.fontFamily ?? '"Outfit", sans-serif',
      },
    ]);
    setSelectedOverlayId(id);
  };

  const addShapeElementOverlay = (shapeId: StudioVectorElementKind, label: string) => {
    pushHistory();
    const dur = Math.max(4, totalDurationSec || 4);
    const id = `ov_${Date.now()}`;
    setOverlays((prev) => [
      ...prev,
      {
        id,
        kind: 'shape',
        label,
        startSec: 0,
        endSec: Number(dur.toFixed(1)),
        xPct: 50,
        yPct: 24,
        size: 110,
        rotationDeg: 0,
        color: '#fbbf24',
        bgBadge: false,
        opacity: 0.95,
        animation: 'fade-in',
        shape: shapeId,
      },
    ]);
    setSelectedOverlayId(id);
  };

  const handleUploadImageOverlay = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const verified = await readFileAsVerifiedBlob(file);
      const url = URL.createObjectURL(verified.blob);
      const img = new Image();
      img.onload = () => {
        pushHistory();
        const dur = Math.max(4, totalDurationSec || 4);
        const id = `ov_${Date.now()}`;
        setOverlays((prev) => [
          ...prev,
          {
            id,
            kind: 'image',
            label: verified.fileName,
            startSec: 0,
            endSec: Number(dur.toFixed(1)),
            xPct: 82,
            yPct: 14,
            size: 120,
            rotationDeg: 0,
            color: '#ffffff',
            bgBadge: false,
            opacity: 1,
            animation: 'fade-in',
            sourceBlob: verified.blob,
            imageEl: img,
            objectUrl: url,
          },
        ]);
        setSelectedOverlayId(id);
      };
      img.src = url;
    } catch (err) {
      setNotice(err instanceof Error ? err.message : 'Erreur chargement image');
    }
    e.target.value = '';
  };

  const handleImportAudioTrack = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    pushHistory();
    for (let i = 0; i < files.length; i++) {
      try {
        const verified = await readFileAsVerifiedBlob(files[i]);
        setAudioTracks((prev) => [
          ...prev,
          {
            id: `vaud_${Date.now()}_${i}`,
            name: verified.fileName,
            sourceBlob: verified.blob,
            objectUrl: URL.createObjectURL(verified.blob),
            startSec: 0,
            volume: 0.55,
          },
        ]);
      } catch {
        // skip unreadable file
      }
    }
    e.target.value = '';
  };

  const handleAddBuiltInWorshipMusic = (kind: 'c_major' | 'g_warm') => {
    pushHistory();
    const dur = Math.max(6, Math.ceil(totalDurationSec || 8));
    const wav = synthesizeAmbientWavBlob(kind, dur);
    setAudioTracks((prev) => [
      ...prev,
      {
        id: `vaud_pad_${Date.now()}`,
        name: kind === 'c_major' ? `Fond Do Majeur (${dur}s)` : `Fond Sol Paix (${dur}s)`,
        sourceBlob: wav,
        objectUrl: URL.createObjectURL(wav),
        startSec: 0,
        volume: 0.5,
      },
    ]);
    setNotice(isEn ? 'Background worship pad added!' : 'Musique d’ambiance ajoutée à la vidéo !');
  };

  const handleToggleVoiceoverRecord = async () => {
    if (isRecordingVoiceover) {
      voRecorderRef.current?.stop();
      setIsRecordingVoiceover(false);
      if (voTimerRef.current) clearInterval(voTimerRef.current);
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      voStreamRef.current = stream;
      voChunksRef.current = [];
      const recorder = new MediaRecorder(stream);
      voRecorderRef.current = recorder;

      recorder.ondataavailable = (ev) => {
        if (ev.data.size > 0) voChunksRef.current.push(ev.data);
      };

      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(voChunksRef.current, { type: recorder.mimeType || 'audio/webm' });
        const url = URL.createObjectURL(blob);
        pushHistory();
        setAudioTracks((prev) => [
          ...prev,
          {
            id: `vaud_vo_${Date.now()}`,
            name: `${isEn ? 'Voiceover' : 'Voix-off'} #${prev.length + 1}`,
            sourceBlob: blob,
            objectUrl: url,
            startSec: Number(previewTimeSec.toFixed(1)),
            volume: 1.0,
          },
        ]);
      };

      recorder.start(250);
      setIsRecordingVoiceover(true);
      setVoSeconds(0);
      voTimerRef.current = window.setInterval(() => setVoSeconds((s) => s + 1), 1000);
    } catch {
      setNotice(isEn ? 'Microphone unavailable.' : 'Accès au microphone refusé ou indisponible.');
    }
  };

  const moveScene = (idx: number, dir: -1 | 1) => {
    const target = idx + dir;
    if (target < 0 || target >= scenes.length) return;
    pushHistory();
    setScenes((prev) => {
      const next = [...prev];
      const temp = next[idx];
      next[idx] = next[target];
      next[target] = temp;
      return next;
    });
  };

  const splitSceneInTwo = (scene: VideoScene) => {
    pushHistory();
    if (scene.kind === 'video') {
      const mid = Number(((scene.trimStartSec + scene.trimEndSec) / 2).toFixed(1));
      if (mid <= scene.trimStartSec + 0.3) return;
      const rightId = `scene_${Date.now()}_r`;
      const left: VideoScene = { ...scene, trimEndSec: mid };
      const right: VideoScene = {
        ...scene,
        id: rightId,
        name: `${scene.name} (2)`,
        trimStartSec: mid,
        objectUrl: undefined,
      };
      setScenes((prev) => prev.flatMap((s) => (s.id === scene.id ? [left, right] : [s])));
      setSelectedSceneId(rightId);
    } else {
      const half = Math.max(0.5, Number((scene.durationSec / 2).toFixed(1)));
      const rightId = `scene_${Date.now()}_r`;
      const left: VideoScene = { ...scene, durationSec: half };
      const right: VideoScene = {
        ...scene,
        id: rightId,
        name: `${scene.name} (2)`,
        durationSec: half,
        objectUrl: undefined,
      };
      setScenes((prev) => prev.flatMap((s) => (s.id === scene.id ? [left, right] : [s])));
      setSelectedSceneId(rightId);
    }
  };

  const updateScene = (id: string, patch: Partial<VideoScene>) => {
    setScenes((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  };

  const duplicateScene = (scene: VideoScene) => {
    pushHistory();
    const id = `scene_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`;
    setScenes((prev) => [
      ...prev,
      {
        ...scene,
        id,
        name: `${scene.name} (copie)`,
        objectUrl: undefined,
      },
    ]);
    setSelectedSceneId(id);
  };

  const removeScene = (id: string) => {
    pushHistory();
    setScenes((prev) => prev.filter((s) => s.id !== id));
    if (selectedSceneId === id) setSelectedSceneId(null);
  };

  const updateOverlay = (id: string, patch: Partial<OverlayLayer>) => {
    setOverlays((prev) => prev.map((o) => (o.id === id ? { ...o, ...patch } : o)));
  };

  const duplicateOverlay = (ov: OverlayLayer) => {
    pushHistory();
    const id = `ov_${Date.now()}`;
    setOverlays((prev) => [
      ...prev,
      {
        ...ov,
        id,
        label: `${ov.label} (copie)`,
        xPct: Math.min(90, ov.xPct + 4),
        yPct: Math.min(90, ov.yPct + 4),
        objectUrl: undefined,
      },
    ]);
    setSelectedOverlayId(id);
  };

  const moveOverlayOrder = (idx: number, dir: -1 | 1) => {
    const target = idx + dir;
    if (target < 0 || target >= overlays.length) return;
    pushHistory();
    setOverlays((prev) => {
      const next = [...prev];
      const temp = next[idx];
      next[idx] = next[target];
      next[target] = temp;
      return next;
    });
  };

  const reorderOverlayByDrop = (sourceId: string, targetId: string) => {
    if (!sourceId || !targetId || sourceId === targetId) return;
    pushHistory();
    setOverlays((prev) => {
      const fromIdx = prev.findIndex((o) => o.id === sourceId);
      const toIdx = prev.findIndex((o) => o.id === targetId);
      if (fromIdx === -1 || toIdx === -1) return prev;
      const copy = [...prev];
      const [moved] = copy.splice(fromIdx, 1);
      copy.splice(toIdx, 0, moved);
      return copy;
    });
  };

  const nudgeSelectedOverlay = (dxPct: number, dyPct: number) => {
    if (!selectedOverlayId) return;
    pushHistory();
    setOverlays((prev) =>
      prev.map((o) =>
        o.id === selectedOverlayId
          ? {
              ...o,
              xPct: Math.max(4, Math.min(96, o.xPct + dxPct)),
              yPct: Math.max(4, Math.min(96, o.yPct + dyPct)),
            }
          : o
      )
    );
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
            studioType: 'video',
            query: q,
            category: cat,
            lang: isEn ? 'en' : 'fr',
            page: targetPage,
            excludeTitles,
          }),
        });
        const data = await res.json();
        if (res.ok && data?.ok && Array.isArray(data.templates)) {
          const incoming = (data.templates as VideoTemplateDef[]).map((tpl) => ({
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
              ? `${nextTotal} online video template(s) loaded.`
              : `${nextTotal} modèle(s) vidéo chargé(s) en ligne.`
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

  const displayedVideoTemplates = useMemo(() => {
    const q = templateQuery.trim().toLowerCase();
    const cat = templateCategory;
    const matchFn = (tpl: VideoTemplateDef) => {
      const catMatch =
        cat === 'all' || (tpl.category || '').toLowerCase() === cat.toLowerCase();
      if (!catMatch) return false;
      if (!q) return true;
      const hay = `${tpl.titleFr} ${tpl.titleEn} ${tpl.descFr} ${tpl.category || ''} ${(tpl.tags || []).join(' ')}`.toLowerCase();
      return hay.includes(q);
    };
    const seen = new Set<string>();
    const combined: VideoTemplateDef[] = [];
    for (const tpl of onlineTemplates) {
      if (!seen.has(tpl.id)) {
        seen.add(tpl.id);
        combined.push(tpl);
      }
    }
    for (const tpl of VIDEO_TEMPLATES) {
      if (matchFn(tpl) && !seen.has(tpl.id)) {
        seen.add(tpl.id);
        combined.push(tpl);
      }
    }
    return combined;
  }, [onlineTemplates, templateQuery, templateCategory]);

  const removeOverlay = (id: string) => {
    pushHistory();
    setOverlays((prev) => prev.filter((o) => o.id !== id));
    if (selectedOverlayId === id) setSelectedOverlayId(null);
  };

  const updateAudioTrack = (id: string, patch: Partial<VideoAudioTrack>) => {
    setAudioTracks((prev) => prev.map((a) => (a.id === id ? { ...a, ...patch } : a)));
  };

  const removeAudioTrack = (id: string) => {
    pushHistory();
    setAudioTracks((prev) => prev.filter((a) => a.id !== id));
  };

  const handleSaveEditableProject = async () => {
    setIsSavingProject(true);
    try {
      const { json, mediaAssetKeys } = await serializeVideoProject();
      // Capture cover thumbnail without gizmos
      const canvas = canvasRef.current;
      let thumb = '';
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx && sceneTimingMap[0]) {
          drawSceneFrame(ctx, sceneTimingMap[0].scene, 0.4, sceneTimingMap[0].dur, dims.w, dims.h);
          drawOverlaysAtTime(ctx, 0.4, dims.w, dims.h, false);
        }
        thumb = canvas.toDataURL('image/png');
      }
      const id = currentProjectId || `proj_video_${Date.now()}`;
      const existing = savedVideoProjects.find((p) => p.id === id);
      const item: CreativeDesignItem = {
        id,
        title: projectTitle.trim() || 'Projet Vidéo SHALOM',
        templateType: 'encouragement',
        format: aspectMode,
        studioType: 'video',
        thumbnailDataUrl: thumb,
        mediaBlobKey: mediaAssetKeys[0] || '',
        mimeType: 'application/json',
        projectJson: json,
        mediaAssetKeys,
        durationSeconds: Math.max(1, Math.round(totalDurationSec)),
        createdAt: existing?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await dbService.put(STORES.CREATIONS, item);
      setCurrentProjectId(id);
      setNotice(
        isEn
          ? 'Video project saved! Reopen anytime from Saved Projects.'
          : 'Projet vidéo sauvegardé ! Reprenez votre montage à tout moment dans « Projets Vidéo ».'
      );
      reloadData();
    } catch {
      setNotice(isEn ? 'Failed to save video project.' : 'Erreur lors de la sauvegarde du projet vidéo.');
    } finally {
      setIsSavingProject(false);
    }
  };

  const handleLoadSavedProject = async (proj: CreativeDesignItem) => {
    if (!proj.projectJson) return;
    try {
      await deserializeAndLoadVideoProject(proj.title, proj.projectJson, proj.id);
      setNotice(isEn ? `Loaded "${proj.title}".` : `Projet « ${proj.title} » chargé !`);
    } catch {
      setNotice(isEn ? 'Could not reopen project.' : 'Impossible de rouvrir ce projet vidéo.');
    }
  };

  const handleDeleteSavedProject = async (id: string) => {
    await dbService.deleteItem(STORES.CREATIONS, id);
    if (currentProjectId === id) setCurrentProjectId(null);
    reloadData();
  };

  const handleExportSnapshotPng = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = canvasBgColor;
      ctx.fillRect(0, 0, dims.w, dims.h);
      const match =
        sceneTimingMap.find((m) => previewTimeSec >= m.start && previewTimeSec <= m.end) ||
        sceneTimingMap[0];
      if (match) {
        drawSceneFrame(
          ctx,
          match.scene,
          Math.max(0, previewTimeSec - match.start),
          match.dur,
          dims.w,
          dims.h
        );
      }
      drawOverlaysAtTime(ctx, previewTimeSec, dims.w, dims.h, false);
    }
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
    if (!blob) return;
    const fileName = sanitizeFileName(projectTitle, 'shalom_miniature', 'png');
    const res = await downloadBlobToDevice(blob, fileName, 'image/png');
    if (res.ok) {
      setNotice(
        isEn
          ? `Thumbnail saved to ${res.locationLabel}!`
          : `Capture PNG « ${res.fileName} » enregistrée dans ${res.locationLabel} !`
      );
    }
  };

  const renderVideoBlob = async (): Promise<{ blob: Blob; mimeType: string } | null> => {
    if (scenes.length === 0) {
      setNotice(
        isEn
          ? 'Add at least one scene (template, blank custom scene, photo, or video) first.'
          : 'Ajoutez d’abord au moins une scène (modèle, scène libre, photo ou vidéo).'
      );
      return null;
    }

    if (isPlayingPreview) handleTogglePreviewPlay();

    const canvas = canvasRef.current;
    if (!canvas) return null;
    canvas.width = dims.w;
    canvas.height = dims.h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    cancelExportRef.current = false;
    isExportingRef.current = true;
    setIsExporting(true);
    setExportProgress(0);
    setNotice(null);

    try {
      const videoStream = canvas.captureStream(30);
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const audioCtx = new AudioCtx();
      const destNode = audioCtx.createMediaStreamDestination();

      const scheduledAudioNodes: AudioBufferSourceNode[] = [];
      for (const track of audioTracks) {
        try {
          const resp = await fetch(track.objectUrl);
          const buf = await audioCtx.decodeAudioData(await resp.arrayBuffer());
          const src = audioCtx.createBufferSource();
          src.buffer = buf;
          const gain = audioCtx.createGain();
          gain.gain.value = track.volume;
          src.connect(gain);
          gain.connect(destNode);
          src.start(audioCtx.currentTime + track.startSec);
          scheduledAudioNodes.push(src);
        } catch {
          // ignore undecodable track
        }
      }

      const combinedStream = new MediaStream([
        ...videoStream.getVideoTracks(),
        ...destNode.stream.getAudioTracks(),
      ]);

      const preferredMime =
        ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'].find((m) =>
          MediaRecorder.isTypeSupported(m)
        ) || 'video/webm';

      const recorder = new MediaRecorder(combinedStream, {
        mimeType: preferredMime,
        videoBitsPerSecond: 2_800_000,
      });
      const chunks: BlobPart[] = [];
      recorder.ondataavailable = (ev) => {
        if (ev.data.size > 0) chunks.push(ev.data);
      };

      const recordingDone = new Promise<Blob>((resolve) => {
        recorder.onstop = () => resolve(new Blob(chunks, { type: preferredMime }));
      });

      recorder.start(250);

      const waitFrame = () => new Promise<void>((r) => requestAnimationFrame(() => r()));
      let elapsedGlobal = 0;

      for (const item of sceneTimingMap) {
        if (cancelExportRef.current) break;
        const { scene, dur } = item;

        let vidSourceNode: MediaElementAudioSourceNode | null = null;
        let vidGainNode: GainNode | null = null;

        if (scene.kind === 'video' && scene.videoEl) {
          const vid = scene.videoEl;
          vid.currentTime = scene.trimStartSec;
          vid.playbackRate = scene.playbackRate;
          vid.muted = false;
          try {
            vidSourceNode = audioCtx.createMediaElementSource(vid);
            vidGainNode = audioCtx.createGain();
            vidGainNode.gain.value = scene.volume;
            vidSourceNode.connect(vidGainNode);
            vidGainNode.connect(destNode);
          } catch {
            vid.muted = true;
          }
          await vid.play().catch(() => {});
        }

        const segStart = performance.now();
        while (!cancelExportRef.current) {
          const localElapsed = (performance.now() - segStart) / 1000;
          if (localElapsed >= dur) break;
          const globalTime = elapsedGlobal + localElapsed;
          ctx.fillStyle = canvasBgColor;
          ctx.fillRect(0, 0, dims.w, dims.h);
          drawSceneFrame(ctx, scene, localElapsed, dur, dims.w, dims.h);
          drawOverlaysAtTime(ctx, globalTime, dims.w, dims.h, false);
          setExportProgress(Math.min(99, Math.round((globalTime / Math.max(0.5, totalDurationSec)) * 100)));
          await waitFrame();
        }

        if (scene.kind === 'video' && scene.videoEl) {
          scene.videoEl.pause();
          vidSourceNode?.disconnect();
          vidGainNode?.disconnect();
        }

        elapsedGlobal += dur;
      }

      scheduledAudioNodes.forEach((n) => {
        try {
          n.stop();
        } catch {
          // noop
        }
      });

      recorder.stop();
      const finalBlob = await recordingDone;
      await audioCtx.close().catch(() => {});

      if (!cancelExportRef.current && finalBlob.size > 0) {
        setExportProgress(100);
        return { blob: finalBlob, mimeType: preferredMime };
      }
      return null;
    } catch (err: unknown) {
      setNotice(err instanceof Error ? err.message : 'Erreur export vidéo');
      return null;
    } finally {
      isExportingRef.current = false;
      setIsExporting(false);
    }
  };

  const handleExportVideo = async () => {
    const res = await renderVideoBlob();
    if (!res) return;
    if (exportedVideoUrl) URL.revokeObjectURL(exportedVideoUrl);
    setExportedVideoUrl(URL.createObjectURL(res.blob));
    setExportedVideoBlob(res.blob);
    setExportedMimeType(res.mimeType);
    setNotice(
      isEn
        ? 'Video rendered cleanly! Save to Downloads, library, or share.'
        : 'Vidéo exportée avec succès ! Téléchargez-la, archivez-la ou partagez-la.'
    );
  };

  const handleSaveToParole = async () => {
    if (!exportedVideoBlob) return;
    const blobKey = `parole_video_studio_${Date.now()}`;
    await dbService.saveMediaBlob(blobKey, exportedVideoBlob, exportedMimeType);
    const rec: RecordedParole = {
      id: `rec_vid_${Date.now()}`,
      title: projectTitle.trim() || 'Vidéo Studio',
      type: 'exhortation',
      speaker: userProfile?.fullName || 'Moi',
      activityGenre: 'autre',
      date: new Date().toISOString().split('T')[0],
      durationSeconds: Math.max(1, Math.round(totalDurationSec)),
      mediaType: 'video',
      mimeType: exportedMimeType,
      blobKey,
      fileSizeFormatted: `${(exportedVideoBlob.size / (1024 * 1024)).toFixed(2)} Mo`,
      createdAt: new Date().toISOString(),
    };
    await dbService.put(STORES.RECORDINGS, rec);
    setNotice(isEn ? 'Saved to Parole Divine!' : 'Vidéo enregistrée dans Parole Divine !');
    reloadData();
  };

  const handleSaveToVault = async () => {
    if (!exportedVideoBlob) return;
    const fileName = sanitizeFileName(projectTitle, 'shalom_video', 'webm');
    const blobKey = `vault_video_${Date.now()}`;
    await dbService.saveMediaBlob(blobKey, exportedVideoBlob, exportedMimeType);
    const doc: VaultDocument = {
      id: `vault_${Date.now()}`,
      title: projectTitle.trim() || 'Création Vidéo',
      category: 'autre',
      author: userProfile?.fullName || 'Moi',
      description: 'Création vidéo réalisée dans SHALOM Studio Vidéo',
      fileName,
      mimeType: exportedMimeType,
      sizeBytes: exportedVideoBlob.size,
      blobKey,
      createdAt: new Date().toISOString(),
    };
    await dbService.put(STORES.VAULT_DOCUMENTS, doc);
    setNotice(isEn ? 'Saved to Spiritual Vault!' : 'Vidéo ajoutée dans Mon Coffre Spirituel !');
    reloadData();
  };

  const handleDownloadVideo = async () => {
    if (!exportedVideoBlob) return;
    const fileName = sanitizeFileName(projectTitle, 'shalom_video', 'webm');
    const res = await downloadBlobToDevice(exportedVideoBlob, fileName, exportedMimeType);
    if (res.ok) {
      setNotice(
        isEn
          ? `Saved "${res.fileName}" to ${res.locationLabel}.`
          : `Vidéo « ${res.fileName} » enregistrée dans ${res.locationLabel} !`
      );
    } else if (res.error) {
      setNotice(res.error);
    }
  };

  const handleShareVideo = async () => {
    if (!exportedVideoBlob) return;
    const file = await normalizeMediaToShareFile(
      exportedVideoBlob,
      projectTitle || 'shalom_video',
      'video',
      exportedMimeType
    );
    setSharePayload({
      title: projectTitle,
      text: `🎬 ${projectTitle}\n\nPartagé depuis SHALOM Studio Vidéo`,
      file,
    });
  };

  const handleShareWithoutSaving = async () => {
    const res = exportedVideoBlob
      ? { blob: exportedVideoBlob, mimeType: exportedMimeType }
      : await renderVideoBlob();
    if (!res) return;
    const file = await normalizeMediaToShareFile(
      res.blob,
      projectTitle || 'shalom_video',
      'video',
      res.mimeType
    );
    setSharePayload({
      title: projectTitle,
      text: `🎬 ${projectTitle}\n\nPartagé directement depuis SHALOM Studio Vidéo`,
      file,
    });
  };

  const handleShareLocalMediaDirect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawFile = e.target.files?.[0];
    if (!rawFile) return;
    try {
      const verified = await readFileAsVerifiedBlob(rawFile);
      const mediaKind = verified.mimeType.startsWith('image/')
        ? 'image'
        : verified.mimeType.startsWith('audio/')
          ? 'audio'
          : 'video';
      const file = await normalizeMediaToShareFile(
        verified.blob,
        verified.fileName,
        mediaKind,
        verified.mimeType
      );
      setSharePayload({
        title: verified.fileName,
        text: `🎬 ${verified.fileName}\n\nPartagé directement sans enregistrement depuis SHALOM Studio Vidéo`,
        file,
      });
    } catch (err) {
      setNotice(
        err instanceof Error
          ? err.message
          : isEn
            ? 'Could not read selected file.'
            : 'Impossible de lire ce fichier média.'
      );
    }
    e.target.value = '';
  };

  const selectedScene = scenes.find((s) => s.id === selectedSceneId) || scenes[0] || null;
  const selectedOverlay = overlays.find((o) => o.id === selectedOverlayId) || null;
  const timelinePxWidth = Math.max(560, Math.ceil(Math.max(10, totalDurationSec + 2) * timelineZoom));

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
              ? 'An unsaved video draft was found. Resume editing?'
              : 'Un brouillon vidéo automatique a été retrouvé. Reprendre le montage ?'}
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

      {/* Canva-Style Top Video Command Bar */}
      <div className="p-3 rounded-2xl bg-[#071128] text-white border border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs shadow-sm">
        <div className="flex flex-wrap items-center gap-2 flex-1 min-w-[200px]">
          <Film className="w-4 h-4 text-amber-400 shrink-0" />
          <input
            type="text"
            value={projectTitle}
            onChange={(e) => setProjectTitle(e.target.value)}
            className="px-2.5 py-1.5 rounded-lg bg-white/10 border border-white/15 font-bold text-white min-w-[160px] max-w-[240px]"
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
            className={`px-2.5 py-1.5 rounded-lg font-semibold flex items-center gap-1 whitespace-nowrap ${
              snapEnabled ? 'bg-blue-600 text-white' : 'bg-white/10 text-slate-300'
            }`}
          >
            <Magnet className="w-3.5 h-3.5" />
            <span>{isEn ? 'Guides' : 'Guides'}</span>
          </button>

          <select
            value={aspectMode}
            onChange={(e) => {
              pushHistory();
              setAspectMode(e.target.value as AspectMode);
            }}
            className="px-2.5 py-1.5 rounded-lg bg-white/10 border border-white/15 font-bold text-white"
          >
            <option value="9:16" className="text-slate-900">9:16 Vertical (Story/Reel)</option>
            <option value="16:9" className="text-slate-900">16:9 Paysage (YouTube/Culte)</option>
            <option value="1:1" className="text-slate-900">1:1 Carré (Post)</option>
            <option value="4:5" className="text-slate-900">4:5 Portrait</option>
          </select>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleExportSnapshotPng}
            disabled={scenes.length === 0}
            className="px-2.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 disabled:opacity-40 font-semibold flex items-center gap-1 whitespace-nowrap"
          >
            <Camera className="w-3.5 h-3.5" />
            <span>PNG</span>
          </button>

          <button
            type="button"
            onClick={() => setShowPreviewModal(true)}
            disabled={scenes.length === 0}
            className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 disabled:opacity-40 font-bold flex items-center gap-1.5 whitespace-nowrap"
          >
            <Eye className="w-3.5 h-3.5" />
            <span>{isEn ? 'Preview' : 'Aperçu'}</span>
          </button>

          <button
            type="button"
            onClick={handleSaveEditableProject}
            disabled={isSavingProject || scenes.length === 0}
            className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-slate-950 font-bold flex items-center gap-1.5 whitespace-nowrap"
          >
            {isSavingProject ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            <span>{isEn ? 'Save Project' : 'Sauver projet'}</span>
          </button>
        </div>
      </div>

      {/* Main 2-Column Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Left Tool Tabs Panel */}
        <div className="lg:col-span-5 space-y-4">
          <div className="rounded-2xl bg-white dark:bg-[#0c1631] border border-slate-200/80 dark:border-slate-800/80 overflow-hidden text-xs">
            <div className="grid grid-cols-7 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/70">
              {[
                { id: 'templates', icon: Sparkles, label: isEn ? 'Templates' : 'Modèles' },
                { id: 'scenes', icon: Film, label: isEn ? 'Scenes' : 'Scènes' },
                { id: 'elements', icon: Shapes, label: isEn ? 'Elements' : 'Éléments' },
                { id: 'text', icon: Type, label: isEn ? 'Text' : 'Texte' },
                { id: 'audio', icon: Music, label: 'Audio' },
                { id: 'layers', icon: Layers, label: isEn ? 'Layers' : 'Calques' },
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
                    <span className="text-[10px] leading-none truncate max-w-full">{tab.label}</span>
                  </button>
                );
              })}
            </div>

            <div className="p-4 space-y-4 max-h-[540px] overflow-y-auto">
              {/* TAB 1: TEMPLATES (ONLINE + LOCAL SEARCH) */}
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
                            ? 'Search online (psalm, wedding, youth...)'
                            : 'Rechercher en ligne (psaume, mariage, jeûne...)'
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
                    {['all', 'Verset', 'Église', 'Événement', 'Prière', 'Témoignage', 'Vœux'].map((cat) => (
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

                  {savedVideoTemplates.length > 0 && (
                    <div className="space-y-1.5 pb-2 border-b border-slate-100 dark:border-slate-800">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                        {isEn ? 'My Kept Online Templates' : 'Mes modèles conservés'} ({savedVideoTemplates.length})
                      </p>
                      {savedVideoTemplates.map((st) => (
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
                            aria-label="Supprimer modèle vidéo conservé"
                            className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 shrink-0"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {displayedVideoTemplates.map((tpl) => (
                    <button
                      key={tpl.id}
                      type="button"
                      onClick={() => applyVideoTemplate(tpl)}
                      className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-blue-500 bg-slate-50 dark:bg-slate-900/60 text-left space-y-1 transition"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold text-slate-900 dark:text-white truncate">
                          {isEn ? tpl.titleEn : tpl.titleFr}
                        </span>
                        <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400 shrink-0">
                          {tpl.source === 'online-live'
                            ? 'IA · '
                            : tpl.source === 'online-catalog'
                              ? 'En ligne · '
                              : ''}
                          {tpl.aspect}
                        </span>
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

              {/* TAB 2: SCENES & MEDIA */}
              {activeToolTab === 'scenes' && (
                <div className="space-y-3">
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={addBlankCustomScene}
                      className="flex-1 px-3 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold flex items-center justify-center gap-1.5 whitespace-nowrap"
                    >
                      <Palette className="w-4 h-4" />
                      <span>{isEn ? '+ Blank Scene' : '+ Scène libre'}</span>
                    </button>

                    <label className="flex-1 px-3 py-2.5 rounded-xl bg-blue-700 hover:bg-blue-800 text-white font-bold flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap">
                      <Upload className="w-4 h-4" />
                      <span>{isEn ? '+ Photos / Videos' : '+ Vidéos / Photos'}</span>
                      <input
                        type="file"
                        accept="video/*,image/*"
                        multiple
                        onChange={handleImportMediaFiles}
                        className="hidden"
                      />
                    </label>
                  </div>

                  {recordings.length > 0 && (
                    <select
                      defaultValue=""
                      onChange={(e) => {
                        if (e.target.value) handleImportFromParole(e.target.value);
                        e.target.value = '';
                      }}
                      className="w-full px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 font-semibold"
                    >
                      <option value="">
                        {isEn ? '+ Pull from Parole Divine' : '+ Importer depuis Parole Divine'}
                      </option>
                      {recordings.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.title} ({r.mediaType})
                        </option>
                      ))}
                    </select>
                  )}

                  {/* Selected Scene Editor */}
                  {selectedScene ? (
                    <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3">
                      <div className="flex items-center justify-between gap-2">
                        <input
                          type="text"
                          value={selectedScene.name}
                          onChange={(e) => updateScene(selectedScene.id, { name: e.target.value })}
                          className="font-bold bg-transparent border-b border-transparent focus:border-blue-500 outline-none flex-1 min-w-0"
                        />
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => splitSceneInTwo(selectedScene)}
                            title={isEn ? 'Split Scene' : 'Scinder scène en 2'}
                            className="p-1.5 rounded bg-slate-200 dark:bg-slate-800"
                          >
                            <Scissors className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => duplicateScene(selectedScene)}
                            title={isEn ? 'Duplicate' : 'Dupliquer'}
                            className="p-1.5 rounded bg-slate-200 dark:bg-slate-800"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => removeScene(selectedScene.id)}
                            className="p-1.5 rounded text-red-600 hover:bg-red-50"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
                            {isEn ? 'Transition In' : 'Transition d’entrée'}
                          </label>
                          <select
                            value={selectedScene.transition}
                            onChange={(e) =>
                              updateScene(selectedScene.id, {
                                transition: e.target.value as SceneTransition,
                              })
                            }
                            className="w-full px-2 py-1.5 rounded-lg bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800"
                          >
                            <option value="none">{isEn ? 'None (Cut)' : 'Directe'}</option>
                            <option value="fade">{isEn ? 'Fade' : 'Fondu doux'}</option>
                            <option value="slide">{isEn ? 'Slide' : 'Glissement'}</option>
                            <option value="zoom">{isEn ? 'Zoom In' : 'Zoom d’entrée'}</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
                            {isEn ? 'Color Filter' : 'Filtre couleur'}
                          </label>
                          <select
                            value={selectedScene.filter}
                            onChange={(e) =>
                              updateScene(selectedScene.id, {
                                filter: e.target.value as SceneFilter,
                              })
                            }
                            className="w-full px-2 py-1.5 rounded-lg bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800"
                          >
                            <option value="none">{isEn ? 'Original' : 'Naturel'}</option>
                            <option value="warm">{isEn ? 'Warm Gold' : 'Lumière dorée'}</option>
                            <option value="vivid">{isEn ? 'Vivid' : 'Éclatant'}</option>
                            <option value="bw">{isEn ? 'Black & White' : 'Noir & Blanc'}</option>
                          </select>
                        </div>
                      </div>

                      {selectedScene.kind === 'custom' && (
                        <div className="space-y-2 pt-1">
                          <div className="flex items-center gap-2">
                            <select
                              value={selectedScene.bgType}
                              onChange={(e) =>
                                updateScene(selectedScene.id, {
                                  bgType: e.target.value as 'solid' | 'gradient',
                                })
                              }
                              className="px-2 py-1 rounded bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800"
                            >
                              <option value="solid">Fond uni</option>
                              <option value="gradient">Dégradé</option>
                            </select>
                            <input
                              type="color"
                              value={selectedScene.bgColor}
                              onChange={(e) => updateScene(selectedScene.id, { bgColor: e.target.value })}
                              className="w-7 h-7 rounded cursor-pointer"
                            />
                            {selectedScene.bgType === 'gradient' && (
                              <input
                                type="color"
                                value={selectedScene.bgColor2}
                                onChange={(e) =>
                                  updateScene(selectedScene.id, { bgColor2: e.target.value })
                                }
                                className="w-7 h-7 rounded cursor-pointer"
                              />
                            )}
                          </div>

                          <textarea
                            rows={2}
                            value={selectedScene.text}
                            onChange={(e) => updateScene(selectedScene.id, { text: e.target.value })}
                            placeholder="Texte central de la scène..."
                            className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800"
                          />

                          {/* Typographie enrichie scène libre : Gras, Italique, Souligné, Casse, Alignement, Police */}
                          <div className="flex flex-wrap gap-1">
                            <button
                              type="button"
                              onClick={() =>
                                updateScene(selectedScene.id, { bold: !(selectedScene.bold !== false) })
                              }
                              className={`px-2 py-1 rounded font-black text-[11px] ${
                                selectedScene.bold !== false
                                  ? 'bg-blue-700 text-white'
                                  : 'bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800'
                              }`}
                              title="Gras"
                            >
                              G
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                updateScene(selectedScene.id, { italic: !selectedScene.italic })
                              }
                              className={`px-2 py-1 rounded italic font-serif font-bold text-[11px] ${
                                selectedScene.italic
                                  ? 'bg-blue-700 text-white'
                                  : 'bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800'
                              }`}
                              title="Italique"
                            >
                              I
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                updateScene(selectedScene.id, { underline: !selectedScene.underline })
                              }
                              className={`px-2 py-1 rounded underline font-bold text-[11px] ${
                                selectedScene.underline
                                  ? 'bg-blue-700 text-white'
                                  : 'bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800'
                              }`}
                              title="Souligné"
                            >
                              S
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                updateScene(selectedScene.id, { uppercase: !selectedScene.uppercase })
                              }
                              className={`px-2 py-1 rounded font-bold text-[11px] ${
                                selectedScene.uppercase
                                  ? 'bg-blue-700 text-white'
                                  : 'bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800'
                              }`}
                              title="Majuscules"
                            >
                              AA
                            </button>
                            {(['left', 'center', 'right'] as const).map((al) => {
                              const Icon =
                                al === 'left' ? AlignLeft : al === 'center' ? AlignCenter : AlignRight;
                              const active = (selectedScene.textAlign || 'center') === al;
                              return (
                                <button
                                  key={al}
                                  type="button"
                                  onClick={() => updateScene(selectedScene.id, { textAlign: al })}
                                  className={`p-1 rounded ${
                                    active
                                      ? 'bg-blue-700 text-white'
                                      : 'bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800'
                                  }`}
                                >
                                  <Icon className="w-3.5 h-3.5" />
                                </button>
                              );
                            })}
                            <button
                              type="button"
                              onClick={() =>
                                updateScene(selectedScene.id, { textShadow: !selectedScene.textShadow })
                              }
                              className={`px-2 py-1 rounded font-semibold text-[11px] ${
                                selectedScene.textShadow
                                  ? 'bg-amber-600 text-white'
                                  : 'bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800'
                              }`}
                            >
                              {isEn ? 'Shadow' : 'Ombre'}
                            </button>
                          </div>

                          <select
                            value={selectedScene.fontFamily}
                            onChange={(e) => updateScene(selectedScene.id, { fontFamily: e.target.value })}
                            className="w-full px-2 py-1 rounded bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800"
                          >
                            {STUDIO_FONTS.map((f) => (
                              <option key={f.value} value={f.value}>
                                {f.label}
                              </option>
                            ))}
                          </select>

                          <div className="grid grid-cols-3 gap-2">
                            <div>
                              <label className="block text-[10px] text-slate-500">Durée (s)</label>
                              <input
                                type="number"
                                step={0.5}
                                min={0.5}
                                max={60}
                                value={selectedScene.durationSec}
                                onChange={(e) =>
                                  updateScene(selectedScene.id, {
                                    durationSec: Math.max(0.5, parseFloat(e.target.value) || 3),
                                  })
                                }
                                className="w-full px-2 py-1 rounded bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 tabular-nums"
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] text-slate-500">Taille texte</label>
                              <input
                                type="number"
                                step={2}
                                min={16}
                                max={120}
                                value={selectedScene.fontSize}
                                onChange={(e) =>
                                  updateScene(selectedScene.id, {
                                    fontSize: Math.max(16, parseInt(e.target.value, 10) || 40),
                                  })
                                }
                                className="w-full px-2 py-1 rounded bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 tabular-nums"
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] text-slate-500">Couleur texte</label>
                              <input
                                type="color"
                                value={selectedScene.textColor}
                                onChange={(e) =>
                                  updateScene(selectedScene.id, { textColor: e.target.value })
                                }
                                className="w-full h-7 rounded cursor-pointer"
                              />
                            </div>
                          </div>
                        </div>
                      )}

                      {selectedScene.kind === 'image' && (
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-[10px] text-slate-500">Durée (s)</label>
                            <input
                              type="number"
                              step={0.5}
                              min={0.5}
                              max={60}
                              value={selectedScene.durationSec}
                              onChange={(e) =>
                                updateScene(selectedScene.id, {
                                  durationSec: Math.max(0.5, parseFloat(e.target.value) || 4),
                                })
                              }
                              className="w-full px-2 py-1 rounded bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 tabular-nums"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] text-slate-500">Cadrage</label>
                            <select
                              value={selectedScene.fitMode}
                              onChange={(e) =>
                                updateScene(selectedScene.id, {
                                  fitMode: e.target.value as 'contain' | 'cover',
                                })
                              }
                              className="w-full px-2 py-1 rounded bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800"
                            >
                              <option value="contain">Image entière</option>
                              <option value="cover">Remplir cadre</option>
                            </select>
                          </div>
                          <label className="col-span-2 flex items-center gap-2 font-semibold cursor-pointer">
                            <input
                              type="checkbox"
                              checked={selectedScene.kenBurns}
                              onChange={(e) =>
                                updateScene(selectedScene.id, { kenBurns: e.target.checked })
                              }
                              className="accent-blue-700"
                            />
                            <span>{isEn ? 'Ken Burns Slow Zoom' : 'Animation Zoom cinématique'}</span>
                          </label>
                        </div>
                      )}

                      {selectedScene.kind === 'video' && (
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-[10px] text-slate-500">Début coupe (s)</label>
                            <input
                              type="number"
                              step={0.5}
                              min={0}
                              max={Math.max(0, selectedScene.trimEndSec - 0.5)}
                              value={selectedScene.trimStartSec}
                              onChange={(e) =>
                                updateScene(selectedScene.id, {
                                  trimStartSec: Math.max(0, parseFloat(e.target.value) || 0),
                                })
                              }
                              className="w-full px-2 py-1 rounded bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 tabular-nums"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] text-slate-500">Fin coupe (s)</label>
                            <input
                              type="number"
                              step={0.5}
                              min={selectedScene.trimStartSec + 0.5}
                              max={selectedScene.durationSec}
                              value={selectedScene.trimEndSec}
                              onChange={(e) =>
                                updateScene(selectedScene.id, {
                                  trimEndSec: Math.min(
                                    selectedScene.durationSec,
                                    Math.max(selectedScene.trimStartSec + 0.5, parseFloat(e.target.value) || 3)
                                  ),
                                })
                              }
                              className="w-full px-2 py-1 rounded bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 tabular-nums"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="text-[11px] text-slate-500 text-center py-2">
                      {isEn
                        ? 'Add a scene or select one in the timeline below to edit.'
                        : 'Ajoutez une scène ou cliquez sur une scène dans la timeline ci-dessous.'}
                    </p>
                  )}
                </div>
              )}

              {/* TAB 3: VECTOR ELEMENTS & STICKERS */}
              {activeToolTab === 'elements' && (
                <div className="space-y-3">
                  <p className="text-[11px] text-slate-500">
                    {isEn
                      ? 'Add Christian symbols & shapes (drag, resize, or rotate directly on canvas):'
                      : 'Ajoutez un symbole ou sticker (déplacez, redimensionnez et pivotez directement sur l’aperçu) :'}
                  </p>
                  <div className="grid grid-cols-4 gap-1.5">
                    {VECTOR_ELEMENT_CATALOG.map((el) => (
                      <button
                        key={el.id}
                        type="button"
                        onClick={() =>
                          addShapeElementOverlay(el.id, isEn ? el.labelEn : el.labelFr)
                        }
                        className="p-2 rounded-xl bg-slate-50 hover:bg-blue-50 dark:bg-slate-900 dark:hover:bg-blue-950/40 border border-slate-200 dark:border-slate-800 flex flex-col items-center gap-0.5 transition"
                      >
                        <span className="text-lg leading-none">{el.symbol}</span>
                        <span className="text-[10px] font-semibold truncate w-full text-center">
                          {isEn ? el.labelEn : el.labelFr}
                        </span>
                      </button>
                    ))}
                  </div>

                  <label className="w-full px-3 py-2.5 rounded-xl bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/50 text-blue-700 dark:text-blue-300 font-bold flex items-center justify-center gap-1.5 cursor-pointer">
                    <ImageIcon className="w-4 h-4" />
                    <span>{isEn ? '+ Import Logo / PNG Sticker' : '+ Importer Logo / Image superposée'}</span>
                    <input type="file" accept="image/*" onChange={handleUploadImageOverlay} className="hidden" />
                  </label>

                  <div className="pt-2 border-t border-slate-200 dark:border-slate-800 space-y-1.5">
                    <span className="text-[11px] font-bold text-slate-500">
                      {isEn ? 'Canvas Backdrop Color' : 'Couleur de fond générale'}
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {SHALOM_COLOR_PALETTES[0].colors.map((col) => (
                        <button
                          key={col}
                          type="button"
                          onClick={() => setCanvasBgColor(col)}
                          style={{ backgroundColor: col }}
                          className="w-6 h-6 rounded-lg border border-slate-300"
                        />
                      ))}
                      <input
                        type="color"
                        value={canvasBgColor}
                        onChange={(e) => setCanvasBgColor(e.target.value)}
                        className="w-7 h-6 rounded cursor-pointer"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 4: TEXT PRESETS & ANIMATIONS */}
              {activeToolTab === 'text' && (
                <div className="space-y-2.5">
                  <p className="text-[11px] text-slate-500">
                    {isEn ? 'Add animated timed typography layers:' : 'Ajoutez un calque texte animé :'}
                  </p>
                  <button
                    type="button"
                    onClick={() => addTextPresetOverlay('title')}
                    className="w-full p-3 rounded-xl bg-slate-50 hover:bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-left font-extrabold text-sm"
                  >
                    + {isEn ? 'Bold Headline Title' : 'Ajouter un grand titre'}
                  </button>
                  <button
                    type="button"
                    onClick={() => addTextPresetOverlay('verse')}
                    className="w-full p-3 rounded-xl bg-slate-50 hover:bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-left font-serif font-bold text-xs"
                  >
                    + {isEn ? 'Bible Verse Quote Badge' : 'Ajouter un verset avec fond'}
                  </button>
                  <button
                    type="button"
                    onClick={() => addTextPresetOverlay('lower_third')}
                    className="w-full p-2.5 rounded-xl bg-slate-50 hover:bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-left font-semibold"
                  >
                    + {isEn ? 'Speaker Lower-Third' : 'Bandeau nom d’orateur (bas)'}
                  </button>
                  <button
                    type="button"
                    onClick={() => addTextPresetOverlay('watermark')}
                    className="w-full p-2.5 rounded-xl bg-slate-50 hover:bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-left font-semibold text-amber-600"
                  >
                    + {isEn ? 'Corner Watermark' : 'Filigrane SHALOM discret'}
                  </button>
                </div>
              )}

              {/* TAB 5: AUDIO & VOICEOVER */}
              {activeToolTab === 'audio' && (
                <div className="space-y-3">
                  <button
                    type="button"
                    onClick={handleToggleVoiceoverRecord}
                    className={`w-full px-3 py-2.5 rounded-xl font-bold flex items-center justify-center gap-1.5 ${
                      isRecordingVoiceover
                        ? 'bg-red-600 text-white animate-pulse'
                        : 'bg-blue-700 hover:bg-blue-800 text-white'
                    }`}
                  >
                    {isRecordingVoiceover ? (
                      <>
                        <Square className="w-3.5 h-3.5 fill-current" />
                        <span>
                          {isEn ? `Stop Voiceover (${voSeconds}s)` : `Arrêter voix-off (${voSeconds}s)`}
                        </span>
                      </>
                    ) : (
                      <>
                        <Mic className="w-3.5 h-3.5" />
                        <span>{isEn ? 'Record Voiceover' : 'Enregistrer voix-off micro'}</span>
                      </>
                    )}
                  </button>

                  <label className="w-full px-3 py-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-900/50 font-bold flex items-center justify-center gap-1.5 cursor-pointer">
                    <Music className="w-3.5 h-3.5" />
                    <span>{isEn ? '+ Import Music / Audio' : '+ Importer Musique / Audio'}</span>
                    <input type="file" accept="audio/*" multiple onChange={handleImportAudioTrack} className="hidden" />
                  </label>

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => handleAddBuiltInWorshipMusic('c_major')}
                      className="px-2.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 font-semibold"
                    >
                      + Fond Do Majeur
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAddBuiltInWorshipMusic('g_warm')}
                      className="px-2.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 font-semibold"
                    >
                      + Fond Sol Paix
                    </button>
                  </div>

                  {audioTracks.map((tr) => (
                    <div
                      key={tr.id}
                      className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold truncate">{tr.name}</span>
                        <button
                          type="button"
                          onClick={() => removeAudioTrack(tr.id)}
                          className="p-1 text-red-600"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <div className="flex items-center gap-3">
                        <label className="flex items-center gap-1 text-[11px]">
                          <span>Début(s)</span>
                          <input
                            type="number"
                            min={0}
                            step={0.5}
                            value={tr.startSec}
                            onChange={(e) =>
                              updateAudioTrack(tr.id, {
                                startSec: Math.max(0, parseFloat(e.target.value) || 0),
                              })
                            }
                            className="w-14 px-1.5 py-1 rounded bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 tabular-nums"
                          />
                        </label>
                        <label className="flex items-center gap-1 text-[11px] flex-1">
                          <span>Vol {Math.round(tr.volume * 100)}%</span>
                          <input
                            type="range"
                            min={0}
                            max={1.5}
                            step={0.05}
                            value={tr.volume}
                            onChange={(e) =>
                              updateAudioTrack(tr.id, { volume: parseFloat(e.target.value) })
                            }
                            className="flex-1"
                          />
                        </label>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* TAB 6: LAYERS / CALQUES (Z-ORDER + DRAG & DROP + NUDGE) */}
              {activeToolTab === 'layers' && (
                <div className="space-y-2.5">
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    {isEn
                      ? 'Drag rows or use arrows to reorder stacked overlays cleanly.'
                      : 'Glissez les calques ou utilisez les flèches pour modifier leur ordre d’affichage.'}
                  </p>
                  {overlays.length === 0 ? (
                    <p className="text-[11px] text-slate-500 py-6 text-center">
                      {isEn
                        ? 'No overlays yet. Add text or shapes from Elements/Text tabs.'
                        : 'Aucun calque pour le moment. Ajoutez un texte ou un élément.'}
                    </p>
                  ) : (
                    <div className="space-y-1.5">
                      {[...overlays].reverse().map((ov) => {
                        const actualIdx = overlays.findIndex((item) => item.id === ov.id);
                        const isSel = selectedOverlayId === ov.id;
                        return (
                          <div
                            key={ov.id}
                            draggable
                            onDragStart={() => setDraggedOverlayId(ov.id)}
                            onDragOver={(e) => e.preventDefault()}
                            onDrop={() => {
                              if (draggedOverlayId) reorderOverlayByDrop(draggedOverlayId, ov.id);
                              setDraggedOverlayId(null);
                            }}
                            onDragEnd={() => setDraggedOverlayId(null)}
                            onClick={() => {
                              setSelectedOverlayId(ov.id);
                              setPreviewTimeSec(ov.startSec + 0.05);
                            }}
                            className={`p-2 rounded-xl border flex items-center gap-2 cursor-pointer transition ${
                              isSel
                                ? 'border-blue-600 bg-blue-50/70 dark:bg-blue-950/40'
                                : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60'
                            }`}
                          >
                            <GripVertical className="w-3.5 h-3.5 text-slate-400 shrink-0 cursor-grab" />
                            <div className="flex-1 min-w-0">
                              <p className="font-bold truncate text-slate-900 dark:text-white">
                                {ov.kind === 'text' ? `T · ${ov.text || ov.label}` : ov.label}
                              </p>
                              <p className="text-[10px] text-slate-500 tabular-nums">
                                {ov.startSec.toFixed(1)}s → {ov.endSec.toFixed(1)}s · X:{ov.xPct}% Y:{ov.yPct}%
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                moveOverlayOrder(actualIdx, 1);
                              }}
                              disabled={actualIdx === overlays.length - 1}
                              title="Monter au-dessus"
                              className="p-1 rounded bg-white dark:bg-slate-800 disabled:opacity-30"
                            >
                              <ArrowUp className="w-3 h-3" />
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                moveOverlayOrder(actualIdx, -1);
                              }}
                              disabled={actualIdx === 0}
                              title="Descendre en dessous"
                              className="p-1 rounded bg-white dark:bg-slate-800 disabled:opacity-30"
                            >
                              <ArrowDown className="w-3 h-3" />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* TAB 7: SAVED VIDEO PROJECTS */}
              {activeToolTab === 'projects' && (
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900 dark:text-white">
                      {isEn
                        ? `Saved Videos (${savedVideoProjects.length})`
                        : `Projets Vidéo sauvegardés (${savedVideoProjects.length})`}
                    </span>
                    <button
                      type="button"
                      onClick={handleSaveEditableProject}
                      disabled={scenes.length === 0}
                      className="px-2.5 py-1 rounded-lg bg-blue-700 disabled:opacity-40 text-white font-bold"
                    >
                      + {isEn ? 'Save current' : 'Sauver actuel'}
                    </button>
                  </div>

                  {savedVideoProjects.length === 0 ? (
                    <p className="text-[11px] text-slate-500 py-4 text-center">
                      {isEn
                        ? 'No saved video projects yet.'
                        : 'Aucun projet vidéo sauvegardé. Cliquez sur « Sauver projet » pour reprendre plus tard.'}
                    </p>
                  ) : (
                    savedVideoProjects.map((proj) => (
                      <div
                        key={proj.id}
                        className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 flex items-center gap-2.5"
                      >
                        {proj.thumbnailDataUrl && (
                          <img
                            src={proj.thumbnailDataUrl}
                            alt={proj.title}
                            className="w-12 h-14 rounded-lg object-cover bg-black shrink-0"
                          />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="font-bold truncate text-slate-900 dark:text-white">{proj.title}</p>
                          <p className="text-[10px] text-slate-500 tabular-nums">
                            {proj.format} · {proj.durationSeconds || 0}s
                          </p>
                        </div>
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
                          className="p-1.5 rounded-lg text-red-600"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Selected Overlay Property Inspector (if any overlay selected) */}
          {selectedOverlay && (
            <div className="p-4 rounded-2xl bg-white dark:bg-[#0c1631] border border-blue-300 dark:border-blue-800 space-y-2.5 text-xs">
              <div className="flex items-center justify-between gap-2">
                <span className="font-bold text-blue-700 dark:text-amber-400 truncate">
                  {isEn ? 'Selected Layer:' : 'Calque sélectionné :'} {selectedOverlay.label}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => {
                      const idx = overlays.findIndex((o) => o.id === selectedOverlay.id);
                      moveOverlayOrder(idx, 1);
                    }}
                    title="Avancer au-dessus"
                    className="p-1 rounded bg-slate-100 dark:bg-slate-800"
                  >
                    <MoveUp className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const idx = overlays.findIndex((o) => o.id === selectedOverlay.id);
                      moveOverlayOrder(idx, -1);
                    }}
                    title="Reculer en-dessous"
                    className="p-1 rounded bg-slate-100 dark:bg-slate-800"
                  >
                    <MoveDown className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => duplicateOverlay(selectedOverlay)}
                    className="p-1 rounded bg-slate-100 dark:bg-slate-800"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => removeOverlay(selectedOverlay.id)}
                    className="p-1 rounded text-red-600 hover:bg-red-50"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {selectedOverlay.kind === 'text' && (
                <div className="space-y-2">
                  <input
                    type="text"
                    value={selectedOverlay.text || ''}
                    onChange={(e) => updateOverlay(selectedOverlay.id, { text: e.target.value })}
                    className="w-full px-2.5 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800"
                  />
                  {/* Gras, Italique, Souligné, Majuscules, Alignement, Ombre */}
                  <div className="flex flex-wrap gap-1">
                    <button
                      type="button"
                      onClick={() =>
                        updateOverlay(selectedOverlay.id, { bold: !(selectedOverlay.bold !== false) })
                      }
                      className={`px-2 py-1 rounded font-black text-[11px] ${
                        selectedOverlay.bold !== false
                          ? 'bg-blue-700 text-white'
                          : 'bg-slate-100 dark:bg-slate-800'
                      }`}
                      title="Gras"
                    >
                      G
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        updateOverlay(selectedOverlay.id, { italic: !selectedOverlay.italic })
                      }
                      className={`px-2 py-1 rounded italic font-serif font-bold text-[11px] ${
                        selectedOverlay.italic
                          ? 'bg-blue-700 text-white'
                          : 'bg-slate-100 dark:bg-slate-800'
                      }`}
                      title="Italique"
                    >
                      I
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        updateOverlay(selectedOverlay.id, { underline: !selectedOverlay.underline })
                      }
                      className={`px-2 py-1 rounded underline font-bold text-[11px] ${
                        selectedOverlay.underline
                          ? 'bg-blue-700 text-white'
                          : 'bg-slate-100 dark:bg-slate-800'
                      }`}
                      title="Souligné"
                    >
                      S
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        updateOverlay(selectedOverlay.id, { uppercase: !selectedOverlay.uppercase })
                      }
                      className={`px-2 py-1 rounded font-bold text-[11px] ${
                        selectedOverlay.uppercase
                          ? 'bg-blue-700 text-white'
                          : 'bg-slate-100 dark:bg-slate-800'
                      }`}
                      title="Majuscules"
                    >
                      AA
                    </button>
                    {(['left', 'center', 'right'] as const).map((al) => {
                      const Icon = al === 'left' ? AlignLeft : al === 'center' ? AlignCenter : AlignRight;
                      const active = (selectedOverlay.textAlign || 'center') === al;
                      return (
                        <button
                          key={al}
                          type="button"
                          onClick={() => updateOverlay(selectedOverlay.id, { textAlign: al })}
                          className={`p-1 rounded ${
                            active ? 'bg-blue-700 text-white' : 'bg-slate-100 dark:bg-slate-800'
                          }`}
                        >
                          <Icon className="w-3.5 h-3.5" />
                        </button>
                      );
                    })}
                    <button
                      type="button"
                      onClick={() =>
                        updateOverlay(selectedOverlay.id, { textShadow: !selectedOverlay.textShadow })
                      }
                      className={`px-2 py-1 rounded font-semibold text-[11px] ${
                        selectedOverlay.textShadow
                          ? 'bg-amber-600 text-white'
                          : 'bg-slate-100 dark:bg-slate-800'
                      }`}
                    >
                      {isEn ? 'Shadow' : 'Ombre'}
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <select
                      value={selectedOverlay.fontFamily || STUDIO_FONTS[0].value}
                      onChange={(e) =>
                        updateOverlay(selectedOverlay.id, { fontFamily: e.target.value })
                      }
                      className="px-2 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800"
                    >
                      {STUDIO_FONTS.map((f) => (
                        <option key={f.value} value={f.value}>
                          {f.label}
                        </option>
                      ))}
                    </select>
                    <div className="flex items-center gap-1.5">
                      <label className="flex items-center gap-1.5 font-semibold cursor-pointer flex-1">
                        <input
                          type="checkbox"
                          checked={selectedOverlay.bgBadge}
                          onChange={(e) =>
                            updateOverlay(selectedOverlay.id, { bgBadge: e.target.checked })
                          }
                          className="accent-blue-700"
                        />
                        <span>{isEn ? 'Backdrop' : 'Fond'}</span>
                      </label>
                      {selectedOverlay.bgBadge && (
                        <input
                          type="color"
                          value={selectedOverlay.bgBadgeColor || '#081024'}
                          onChange={(e) =>
                            updateOverlay(selectedOverlay.id, { bgBadgeColor: e.target.value })
                          }
                          className="w-6 h-6 rounded cursor-pointer"
                        />
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Position X/Y directe et flèches de déplacement */}
              <div className="flex flex-wrap items-center justify-between gap-2 p-2 rounded-xl bg-slate-50 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800">
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-bold text-slate-500">X%</span>
                  <input
                    type="number"
                    min={4}
                    max={96}
                    value={selectedOverlay.xPct}
                    onChange={(e) =>
                      updateOverlay(selectedOverlay.id, {
                        xPct: Math.max(4, Math.min(96, parseInt(e.target.value, 10) || 50)),
                      })
                    }
                    className="w-12 px-1.5 py-0.5 rounded bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 tabular-nums text-[11px]"
                  />
                  <span className="text-[10px] font-bold text-slate-500">Y%</span>
                  <input
                    type="number"
                    min={4}
                    max={96}
                    value={selectedOverlay.yPct}
                    onChange={(e) =>
                      updateOverlay(selectedOverlay.id, {
                        yPct: Math.max(4, Math.min(96, parseInt(e.target.value, 10) || 50)),
                      })
                    }
                    className="w-12 px-1.5 py-0.5 rounded bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 tabular-nums text-[11px]"
                  />
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => nudgeSelectedOverlay(-3, 0)}
                    className="px-1.5 py-0.5 rounded bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-bold"
                  >
                    ←
                  </button>
                  <button
                    type="button"
                    onClick={() => nudgeSelectedOverlay(0, -3)}
                    className="px-1.5 py-0.5 rounded bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-bold"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    onClick={() => nudgeSelectedOverlay(0, 3)}
                    className="px-1.5 py-0.5 rounded bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-bold"
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    onClick={() => nudgeSelectedOverlay(3, 0)}
                    className="px-1.5 py-0.5 rounded bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-bold"
                  >
                    →
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-[10px] text-slate-500">Début (s)</label>
                  <input
                    type="number"
                    step={0.5}
                    min={0}
                    value={selectedOverlay.startSec}
                    onChange={(e) =>
                      updateOverlay(selectedOverlay.id, {
                        startSec: Math.max(0, parseFloat(e.target.value) || 0),
                      })
                    }
                    className="w-full px-2 py-1 rounded bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 tabular-nums"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-slate-500">Fin (s)</label>
                  <input
                    type="number"
                    step={0.5}
                    min={selectedOverlay.startSec + 0.5}
                    value={selectedOverlay.endSec}
                    onChange={(e) =>
                      updateOverlay(selectedOverlay.id, {
                        endSec: Math.max(
                          selectedOverlay.startSec + 0.5,
                          parseFloat(e.target.value) || 4
                        ),
                      })
                    }
                    className="w-full px-2 py-1 rounded bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 tabular-nums"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-slate-500">Animation</label>
                  <select
                    value={selectedOverlay.animation}
                    onChange={(e) =>
                      updateOverlay(selectedOverlay.id, {
                        animation: e.target.value as OverlayAnimation,
                      })
                    }
                    className="w-full px-2 py-1 rounded bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800"
                  >
                    <option value="none">Aucune</option>
                    <option value="fade-in">Fondu</option>
                    <option value="slide-up">Montée</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 items-center">
                <div>
                  <label className="block text-[10px] text-slate-500">
                    Taille ({selectedOverlay.size})
                  </label>
                  <input
                    type="range"
                    min={18}
                    max={300}
                    value={selectedOverlay.size}
                    onChange={(e) =>
                      updateOverlay(selectedOverlay.id, { size: parseInt(e.target.value, 10) })
                    }
                    className="w-full accent-blue-700"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-slate-500">
                    Rotation ({selectedOverlay.rotationDeg}°)
                  </label>
                  <input
                    type="range"
                    min={-180}
                    max={180}
                    value={selectedOverlay.rotationDeg}
                    onChange={(e) =>
                      updateOverlay(selectedOverlay.id, {
                        rotationDeg: parseInt(e.target.value, 10),
                      })
                    }
                    className="w-full accent-amber-500"
                  />
                </div>
                {selectedOverlay.kind !== 'image' && (
                  <div className="flex items-center gap-2 pt-3">
                    <input
                      type="color"
                      value={selectedOverlay.color}
                      onChange={(e) => updateOverlay(selectedOverlay.id, { color: e.target.value })}
                      className="w-8 h-7 rounded cursor-pointer"
                    />
                    <span className="text-[10px] font-mono">{selectedOverlay.color}</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Right Interactive Direct-Manipulation Canvas + Export */}
        <div className="lg:col-span-7 space-y-4">
          <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 flex flex-col items-center gap-3">
            <p className="text-[11px] text-slate-400">
              {isEn
                ? 'Touch & drag overlays directly on the video canvas to position, resize, or rotate.'
                : 'Touchez et glissez vos textes ou éléments directement sur l’écran pour les placer ou pivoter.'}
            </p>
            <canvas
              ref={canvasRef}
              width={dims.w}
              height={dims.h}
              onPointerDown={handleCanvasPointerDown}
              onPointerMove={handleCanvasPointerMove}
              onPointerUp={handleCanvasPointerUp}
              onPointerCancel={handleCanvasPointerUp}
              className="rounded-xl bg-black max-h-[420px] w-auto max-w-full cursor-move touch-none shadow-lg"
            />

            <div className="w-full flex items-center gap-2 text-xs text-white px-1">
              <button
                type="button"
                onClick={handleTogglePreviewPlay}
                disabled={totalDurationSec <= 0}
                className="px-3.5 py-1.5 rounded-lg bg-blue-700 hover:bg-blue-600 disabled:opacity-40 font-bold flex items-center gap-1 shrink-0"
              >
                {isPlayingPreview ? (
                  <>
                    <Square className="w-3.5 h-3.5 fill-current" />
                    <span>Stop</span>
                  </>
                ) : (
                  <>
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>{isEn ? 'Play' : 'Lire'}</span>
                  </>
                )}
              </button>
              <input
                type="range"
                min={0}
                max={Math.max(1, totalDurationSec)}
                step={0.05}
                value={Math.min(previewTimeSec, Math.max(1, totalDurationSec))}
                onChange={(e) => {
                  if (isPlayingPreview) handleTogglePreviewPlay();
                  setPreviewTimeSec(parseFloat(e.target.value));
                }}
                className="flex-1 accent-amber-400"
              />
              <span className="tabular-nums text-[11px] shrink-0">
                {previewTimeSec.toFixed(1)}s / {totalDurationSec.toFixed(1)}s
              </span>
            </div>
          </div>

          {!isExporting ? (
            <div className="space-y-2.5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={handleExportVideo}
                  className="w-full py-3 rounded-xl bg-blue-700 hover:bg-blue-800 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-sm"
                >
                  <Film className="w-4 h-4" />
                  <span>{isEn ? 'Render & Export Video (WebM)' : 'Assembler & Exporter la Vidéo (WebM)'}</span>
                </button>
                <button
                  type="button"
                  onClick={handleShareWithoutSaving}
                  className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-sm"
                >
                  <Share2 className="w-4 h-4" />
                  <span>{isEn ? 'Share without saving' : 'Partager sans enregistrer'}</span>
                </button>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-[#0c1631] border border-slate-200/80 dark:border-slate-800/80 flex flex-wrap items-center justify-between gap-2 text-xs">
                <span className="text-slate-600 dark:text-slate-300 font-medium">
                  {isEn
                    ? 'Share a video or media from your phone directly without saving in SHALOM:'
                    : 'Partager directement un média du téléphone sans l’enregistrer dans SHALOM :'}
                </span>
                <label className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold flex items-center gap-1.5 cursor-pointer whitespace-nowrap">
                  <Share2 className="w-3.5 h-3.5" />
                  <span>{isEn ? 'Share device media directly' : 'Partager une vidéo / média du téléphone (sans enregistrer)'}</span>
                  <input
                    type="file"
                    accept="video/*,image/*,audio/*"
                    onChange={handleShareLocalMediaDirect}
                    className="hidden"
                  />
                </label>
              </div>
            </div>
          ) : (
            <div className="p-4 rounded-xl bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900 space-y-2 text-xs">
              <div className="flex items-center justify-between font-bold text-blue-800 dark:text-blue-200">
                <span className="flex items-center gap-1.5">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>{isEn ? 'Rendering video...' : 'Assemblage vidéo en cours...'}</span>
                </span>
                <span className="tabular-nums">{exportProgress}%</span>
              </div>
              <div className="w-full h-2 rounded-full bg-blue-200 dark:bg-blue-900 overflow-hidden">
                <div style={{ width: `${exportProgress}%` }} className="h-full bg-blue-700 transition-all" />
              </div>
              <button
                type="button"
                onClick={() => {
                  cancelExportRef.current = true;
                }}
                className="text-red-600 font-semibold underline"
              >
                {isEn ? 'Cancel' : 'Annuler'}
              </button>
            </div>
          )}

          {exportedVideoUrl && (
            <div className="p-4 rounded-2xl bg-white dark:bg-[#0c1631] border border-slate-200/80 dark:border-slate-800/80 space-y-3">
              <video
                src={exportedVideoUrl}
                controls
                playsInline
                className="w-full max-h-60 rounded-xl bg-black"
              />
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={handleDownloadVideo}
                  className="px-3.5 py-2 rounded-xl bg-slate-900 dark:bg-slate-700 text-white text-xs font-bold flex items-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>{isEn ? 'Downloads Folder' : 'Télécharger (.webm)'}</span>
                </button>
                <button
                  type="button"
                  onClick={handleSaveToParole}
                  className="px-3.5 py-2 rounded-xl bg-blue-700 text-white text-xs font-bold flex items-center gap-1.5"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>Parole Divine</span>
                </button>
                <button
                  type="button"
                  onClick={handleSaveToVault}
                  className="px-3.5 py-2 rounded-xl bg-amber-600 text-white text-xs font-bold flex items-center gap-1.5"
                >
                  <Archive className="w-3.5 h-3.5" />
                  <span>{isEn ? 'Vault' : 'Mon Coffre'}</span>
                </button>
                <button
                  type="button"
                  onClick={handleShareVideo}
                  className="px-3.5 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold flex items-center gap-1.5"
                >
                  <Share2 className="w-3.5 h-3.5" />
                  <span>{isEn ? 'Share' : 'Partager'}</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Bottom Visual Multi-Track Video Timeline */}
      <div className="p-4 rounded-2xl bg-white dark:bg-[#0c1631] border border-slate-200/80 dark:border-slate-800/80 space-y-3 text-xs">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Layers className="w-4 h-4 text-blue-700 dark:text-blue-400" />
            <span>
              {isEn
                ? `Visual Multi-Track Timeline (${scenes.length} scene(s) · ${overlays.length} layer(s) · ${totalDurationSec.toFixed(1)}s)`
                : `Timeline Multi-Pistes (${scenes.length} scène(s) · ${overlays.length} calque(s) · ${totalDurationSec.toFixed(1)}s)`}
            </span>
          </h3>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setTimelineZoom((z) => Math.max(24, z - 10))}
              className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setTimelineZoom((z) => Math.min(96, z + 10))}
              className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={addBlankCustomScene}
              className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-bold flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{isEn ? 'Scene' : 'Scène'}</span>
            </button>
          </div>
        </div>

        <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-950 text-white">
          <div style={{ width: `${timelinePxWidth + 140}px` }} className="relative">
            {/* Clickable Ruler */}
            <div className="flex border-b border-slate-800 bg-slate-900">
              <div className="w-[140px] shrink-0 px-3 py-1.5 text-[10px] font-bold uppercase text-slate-400 border-r border-slate-800">
                {previewTimeSec.toFixed(1)}s
              </div>
              <div
                onClick={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const clickX = Math.max(0, e.clientX - rect.left);
                  setPreviewTimeSec(Number((clickX / timelineZoom).toFixed(2)));
                }}
                className="flex-1 relative h-6 cursor-pointer"
              >
                {Array.from({ length: Math.ceil(Math.max(10, totalDurationSec + 2)) }).map((_, s) => (
                  <div
                    key={s}
                    style={{ left: `${s * timelineZoom}px` }}
                    className="absolute top-0 bottom-0 border-l border-slate-700 pl-1 text-[10px] text-slate-400 tabular-nums"
                  >
                    {s}s
                  </div>
                ))}
                <div
                  style={{ left: `${previewTimeSec * timelineZoom}px` }}
                  className="absolute top-0 bottom-0 w-0.5 bg-red-500"
                />
              </div>
            </div>

            {/* Lane 1: Scenes */}
            <div className="flex border-b border-slate-800/80">
              <div className="w-[140px] shrink-0 px-3 py-3 border-r border-slate-800 font-bold text-[11px] flex items-center gap-1.5">
                <Film className="w-3.5 h-3.5 text-amber-400" />
                <span>{isEn ? 'Scenes' : 'Scènes'}</span>
              </div>
              <div className="flex-1 relative h-14">
                {sceneTimingMap.map((entry, idx) => (
                  <div
                    key={entry.scene.id}
                    onClick={() => {
                      setSelectedSceneId(entry.scene.id);
                      setPreviewTimeSec(entry.start + 0.05);
                    }}
                    style={{
                      left: `${entry.start * timelineZoom}px`,
                      width: `${Math.max(44, entry.dur * timelineZoom - 2)}px`,
                    }}
                    className={`absolute top-1.5 bottom-1.5 rounded-lg px-2 flex flex-col justify-center cursor-pointer transition ${
                      selectedSceneId === entry.scene.id
                        ? 'bg-blue-600 ring-2 ring-amber-400'
                        : 'bg-blue-900/80 hover:bg-blue-800'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span className="font-bold text-[10px] truncate">{entry.scene.name}</span>
                      <div className="flex items-center gap-0.5 shrink-0">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            moveScene(idx, -1);
                          }}
                          disabled={idx === 0}
                          className="p-0.5 hover:text-amber-300 disabled:opacity-30"
                        >
                          <ArrowUp className="w-2.5 h-2.5 -rotate-90" />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            moveScene(idx, 1);
                          }}
                          disabled={idx === scenes.length - 1}
                          className="p-0.5 hover:text-amber-300 disabled:opacity-30"
                        >
                          <ArrowDown className="w-2.5 h-2.5 -rotate-90" />
                        </button>
                      </div>
                    </div>
                    <span className="text-[9px] text-white/75 tabular-nums">{entry.dur.toFixed(1)}s</span>
                  </div>
                ))}
                <div
                  style={{ left: `${previewTimeSec * timelineZoom}px` }}
                  className="absolute top-0 bottom-0 w-0.5 bg-red-500 pointer-events-none z-10"
                />
              </div>
            </div>

            {/* Lane 2: Timed Overlays (Interactive Horizontal Drag) */}
            <div className="flex border-b border-slate-800/80">
              <div className="w-[140px] shrink-0 px-3 py-2.5 border-r border-slate-800 font-bold text-[11px] flex items-center gap-1.5">
                <Shapes className="w-3.5 h-3.5 text-emerald-400" />
                <span>{isEn ? 'Overlays' : 'Calques'}</span>
              </div>
              <div
                onPointerMove={(e) => {
                  const drag = dragTimelineOverlayRef.current;
                  if (!drag) return;
                  const deltaSec = (e.clientX - drag.startClientX) / timelineZoom;
                  let nextStart = Math.max(0, Number((drag.origStartSec + deltaSec).toFixed(1)));
                  if (snapEnabled && Math.abs(nextStart - previewTimeSec) < 0.25) {
                    nextStart = Number(previewTimeSec.toFixed(1));
                  }
                  const nextEnd = Number((nextStart + drag.durationSec).toFixed(1));
                  setOverlays((prev) =>
                    prev.map((o) =>
                      o.id === drag.overlayId ? { ...o, startSec: nextStart, endSec: nextEnd } : o
                    )
                  );
                }}
                onPointerUp={() => {
                  dragTimelineOverlayRef.current = null;
                }}
                onPointerCancel={() => {
                  dragTimelineOverlayRef.current = null;
                }}
                className="flex-1 relative h-11 touch-none"
              >
                {overlays.map((ov) => (
                  <div
                    key={ov.id}
                    onPointerDown={(e) => {
                      e.stopPropagation();
                      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
                      setSelectedOverlayId(ov.id);
                      setPreviewTimeSec(ov.startSec + 0.05);
                      pushHistory();
                      dragTimelineOverlayRef.current = {
                        overlayId: ov.id,
                        startClientX: e.clientX,
                        origStartSec: ov.startSec,
                        durationSec: Math.max(0.5, ov.endSec - ov.startSec),
                      };
                    }}
                    style={{
                      left: `${ov.startSec * timelineZoom}px`,
                      width: `${Math.max(40, (ov.endSec - ov.startSec) * timelineZoom)}px`,
                    }}
                    className={`absolute top-1.5 bottom-1.5 rounded-md px-2 flex items-center text-[10px] font-bold truncate cursor-grab active:cursor-grabbing select-none ${
                      selectedOverlayId === ov.id
                        ? 'bg-emerald-600 ring-2 ring-amber-400'
                        : 'bg-emerald-800/80 hover:bg-emerald-700'
                    }`}
                  >
                    {ov.label}
                  </div>
                ))}
                <div
                  style={{ left: `${previewTimeSec * timelineZoom}px` }}
                  className="absolute top-0 bottom-0 w-0.5 bg-red-500 pointer-events-none z-10"
                />
              </div>
            </div>

            {/* Lane 3: Audio */}
            <div className="flex">
              <div className="w-[140px] shrink-0 px-3 py-2.5 border-r border-slate-800 font-bold text-[11px] flex items-center gap-1.5">
                <Music className="w-3.5 h-3.5 text-purple-400" />
                <span>Audio</span>
              </div>
              <div className="flex-1 relative h-10">
                {audioTracks.map((tr) => (
                  <div
                    key={tr.id}
                    onClick={() => setActiveToolTab('audio')}
                    style={{
                      left: `${tr.startSec * timelineZoom}px`,
                      width: `${Math.max(90, 4 * timelineZoom)}px`,
                    }}
                    className="absolute top-1.5 bottom-1.5 rounded-md bg-purple-700/80 hover:bg-purple-600 px-2 flex items-center text-[10px] font-bold truncate cursor-pointer"
                  >
                    {tr.name}
                  </div>
                ))}
                <div
                  style={{ left: `${previewTimeSec * timelineZoom}px` }}
                  className="absolute top-0 bottom-0 w-0.5 bg-red-500 pointer-events-none z-10"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Preview Modal */}
      <Modal
        isOpen={showPreviewModal}
        onClose={() => setShowPreviewModal(false)}
        title={isEn ? 'Video Preview' : 'Aperçu du montage vidéo'}
        subtitle={`${projectTitle} · ${aspectMode} · ${totalDurationSec.toFixed(1)}s`}
        maxWidth="lg"
      >
        <div className="space-y-4 text-xs">
          {exportedVideoUrl ? (
            <video src={exportedVideoUrl} controls playsInline className="w-full max-h-80 rounded-xl bg-black" />
          ) : (
            <div className="p-4 rounded-xl bg-slate-950 text-white text-center space-y-3">
              <p className="text-slate-300">
                {isEn
                  ? 'Click "Render & Export Video" to generate the playable WebM video with mixed audio tracks.'
                  : 'Appuyez sur « Assembler & Exporter la Vidéo » pour générer le fichier WebM final avec audio mixé.'}
              </p>
              <button
                type="button"
                onClick={() => {
                  setShowPreviewModal(false);
                  handleExportVideo();
                }}
                className="px-4 py-2 rounded-xl bg-blue-700 text-white font-bold"
              >
                {isEn ? 'Render Now' : 'Lancer l’assemblage maintenant'}
              </button>
            </div>
          )}
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
