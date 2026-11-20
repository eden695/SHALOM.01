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
  Magnet,
  Sparkles,
  FolderOpen,
  Scissors,
  ZoomIn,
  ZoomOut,
  Camera,
  Layers,
  X,
  Search,
  Globe,
  GripVertical,
  AlignLeft,
  AlignCenter,
  AlignRight,
  ClipboardPaste,
  Edit3,
  LayoutTemplate,
  FolderHeart,
  BookmarkPlus,
  Bold,
  Italic,
  Underline,
  Volume2,
  VolumeX,
  Crop,
} from 'lucide-react';
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
import {
  drawStudioVectorElement,
  SHALOM_COLOR_PALETTES,
  STUDIO_BACKDROP_PHOTOS,
  STUDIO_FONTS,
  StudioVectorElementKind,
  VECTOR_ELEMENT_CATALOG,
} from '../../services/studioGraphics';
import { loadStudioDraft, saveStudioDraft } from '../../services/studioPersistence';
import { deleteSavedOnlineTemplate } from '../../services/studioTemplatesStore';
import {
  saveAssetResourceToShalom,
  saveTemplateBundleToShalom,
  fetchRemoteAssetVerifiedBlob,
} from '../../services/studios/offlineResources';
import {
  createSafeAudioContext,
  drawRoundedRectPath,
  safeApplyCanvasFilter,
  safeDrawMedia,
} from '../../services/studios/canvasSafety';
import {
  searchOnlineTemplatesClient,
  searchOnlineMediaLibrary,
  searchOnlineAssetsClient,
  fetchOnlineAssetBlobClient,
  OnlineMediaTrackResult,
  OnlineCreativeAsset,
} from '../../services/onlineStudioSearch';
import { Modal } from '../common/Modal';
import { StudioWorkspaceShell, StudioToolRailItem } from './shared/StudioWorkspaceShell';
import { StudioHomeScreen } from './shared/StudioHomeScreen';
import { HorizontalScrollRail } from './shared/HorizontalScrollRail';
import { VectorPreviewSvg } from './shared/VectorPreviewSvg';
import { WaveformClipView } from './shared/WaveformClipView';
import { ShalomResourcesPanel } from './shared/ShalomResourcesPanel';
import { TemplatePreviewCard } from './shared/TemplatePreviewCard';
import {
  TemplatePreviewModal,
  PreviewModalTemplateData,
} from './shared/TemplatePreviewModal';
import { ImageCropModal, NormalizedCropRect } from './shared/ImageCropModal';

type AspectMode = '9:16' | '16:9' | '1:1' | '4:5';
type SceneTransition = 'none' | 'fade' | 'slide' | 'zoom';
type SceneFilter = 'none' | 'warm' | 'bw' | 'vivid';
type OverlayAnimation = 'none' | 'fade-in' | 'slide-up';
type VideoToolTab =
  | 'templates'
  | 'media'
  | 'text'
  | 'elements'
  | 'audio'
  | 'online'
  | 'layers'
  | 'shalom'
  | 'projects';

interface VideoScene {
  id: string;
  kind: 'custom' | 'image' | 'video';
  name: string;
  durationSec: number;
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
  cropX?: number;
  cropY?: number;
  cropW?: number;
  cropH?: number;
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
  cropX?: number;
  cropY?: number;
  cropW?: number;
  cropH?: number;
}

interface VideoAudioTrack {
  id: string;
  name: string;
  assetKey?: string;
  sourceBlob?: Blob;
  objectUrl: string;
  audioBuffer?: AudioBuffer;
  startSec: number;
  trimStartSec: number;
  trimEndSec: number;
  fadeInSec: number;
  fadeOutSec: number;
  playbackRate: number;
  volume: number;
  muted?: boolean;
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
  cropX?: number;
  cropY?: number;
  cropW?: number;
  cropH?: number;
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
  cropX?: number;
  cropY?: number;
  cropW?: number;
  cropH?: number;
}

interface SerializedVideoAudioTrack {
  id: string;
  name: string;
  assetKey?: string;
  startSec: number;
  trimStartSec?: number;
  trimEndSec?: number;
  fadeInSec?: number;
  fadeOutSec?: number;
  playbackRate?: number;
  volume: number;
  muted?: boolean;
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

  const [currentProjectId, setCurrentProjectId] = useState<string | null>(null);
  const [aspectMode, setAspectMode] = useState<AspectMode>('9:16');
  const [canvasBgColor, setCanvasBgColor] = useState('#090d1a');
  const [projectTitle, setProjectTitle] = useState(
    isEn ? 'Untitled Video Project' : 'Nouvelle vidéo SHALOM'
  );

  const [scenes, setScenes] = useState<VideoScene[]>([]);
  const [overlays, setOverlays] = useState<OverlayLayer[]>([]);
  const [audioTracks, setAudioTracks] = useState<VideoAudioTrack[]>([]);

  // Selection & Workspace
  const [selectedSceneId, setSelectedSceneId] = useState<string | null>(null);
  const [selectedOverlayId, setSelectedOverlayId] = useState<string | null>(null);
  const [selectedAudioTrackId, setSelectedAudioTrackId] = useState<string | null>(null);
  const [isHomeView, setIsHomeView] = useState(true);
  const [activeToolTab, setActiveToolTab] = useState<VideoToolTab | null>(null);
  const [isInspectorOpen, setIsInspectorOpen] = useState(false);
  const [showShalomFolderModal, setShowShalomFolderModal] = useState(false);

  const [snapEnabled, setSnapEnabled] = useState(true);
  const [timelineZoom, setTimelineZoom] = useState(48);

  // Online templates search
  const [templateQuery, setTemplateQuery] = useState('');
  const [templateCategory, setTemplateCategory] = useState('all');
  const [onlineTemplates, setOnlineTemplates] = useState<VideoTemplateDef[]>([]);
  const [, setTemplatePage] = useState(1);
  const [templateHasMore, setTemplateHasMore] = useState(true);
  const [isSearchingOnline, setIsSearchingOnline] = useState(false);
  const [isLoadingMoreTemplates, setIsLoadingMoreTemplates] = useState(false);
  const [onlineStatusMsg, setOnlineStatusMsg] = useState<string | null>(null);
  const [savingResourceId, setSavingResourceId] = useState<string | null>(null);
  const [draggedOverlayId, setDraggedOverlayId] = useState<string | null>(null);
  const [draggedSceneId, setDraggedSceneId] = useState<string | null>(null);
  const [previewingTemplate, setPreviewingTemplate] = useState<VideoTemplateDef | null>(null);
  const [cropTarget, setCropTarget] = useState<
    { kind: 'scene'; id: string } | { kind: 'overlay'; id: string } | null
  >(null);

  // Online graphic elements (raster PNG/JPG/WebP, zero SVG)
  const [onlineElementQuery, setOnlineElementQuery] = useState('');
  const [onlineElements, setOnlineElements] = useState<OnlineCreativeAsset[]>([]);
  const [onlineElementPage, setOnlineElementPage] = useState(1);
  const [onlineElementHasMore, setOnlineElementHasMore] = useState(false);
  const [isSearchingElements, setIsSearchingElements] = useState(false);
  const [loadingElementAssetId, setLoadingElementAssetId] = useState<string | null>(null);
  const [elementsError, setElementsError] = useState<string | null>(null);

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

  // Preview playback + live audio sync
  const [previewTimeSec, setPreviewTimeSec] = useState(0);
  const [isPlayingPreview, setIsPlayingPreview] = useState(false);
  const previewRafRef = useRef<number | null>(null);
  const previewAudioCtxRef = useRef<AudioContext | null>(null);
  const previewAudioNodesRef = useRef<AudioBufferSourceNode[]>([]);
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

  // Canvas manipulation
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const timelineTrackRef = useRef<HTMLDivElement | null>(null);
  const isScrubbingRef = useRef(false);
  const cancelExportRef = useRef(false);
  const isExportingRef = useRef(false);
  const [showCenterGuides, setShowCenterGuides] = useState<{ x: boolean; y: boolean }>({
    x: false,
    y: false,
  });
  const [copiedScene, setCopiedScene] = useState<VideoScene | null>(null);
  const [copiedOverlay, setCopiedOverlay] = useState<OverlayLayer | null>(null);
  const [inlineEditTarget, setInlineEditTarget] = useState<
    { kind: 'overlay'; id: string } | { kind: 'scene'; id: string } | null
  >(null);
  const [inlineEditText, setInlineEditText] = useState('');
  const lastTapRef = useRef<{ key: string; time: number } | null>(null);

  // Online media search
  const [onlineVideoQuery, setOnlineVideoQuery] = useState('');
  const [onlineVideoItems, setOnlineVideoItems] = useState<OnlineMediaTrackResult[]>([]);
  const [onlineVideoPage, setOnlineVideoPage] = useState(1);
  const [onlineVideoHasMore, setOnlineVideoHasMore] = useState(false);
  const [isSearchingOnlineVideo, setIsSearchingOnlineVideo] = useState(false);
  const [onlineVideoError, setOnlineVideoError] = useState<string | null>(null);
  const [loadingOnlineVideoId, setLoadingOnlineVideoId] = useState<string | null>(null);

  // Timeline interactive drag/trim states
  const [timelineTrimHud, setTimelineTrimHud] = useState<string | null>(null);
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

  const timelineGestureRef = useRef<{
    kind:
      | 'overlay-move'
      | 'overlay-trim-left'
      | 'overlay-trim-right'
      | 'scene-trim-left'
      | 'scene-trim-right';
    targetId: string;
    startClientX: number;
    origStart: number;
    origEnd: number;
    origDuration: number;
    origTrimStartSec: number;
    origTrimEndSec: number;
    origPlaybackRate: number;
  } | null>(null);

  const dims = getDims(aspectMode);

  const decodeAudioBlobSafe = useCallback(async (blob: Blob): Promise<AudioBuffer | undefined> => {
    try {
      const ctx = createSafeAudioContext();
      if (!ctx) return undefined;
      const decoded = await ctx.decodeAudioData((await blob.arrayBuffer()).slice(0));
      await ctx.close().catch(() => {});
      return decoded;
    } catch {
      return undefined;
    }
  }, []);

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

  const handleCopySelection = useCallback(() => {
    if (selectedOverlayId) {
      const ov = overlays.find((o) => o.id === selectedOverlayId);
      if (ov) {
        setCopiedOverlay({ ...ov });
        setCopiedScene(null);
        setNotice(isEn ? 'Layer copied.' : 'Calque copié.');
        return;
      }
    }
    if (selectedSceneId) {
      const sc = scenes.find((s) => s.id === selectedSceneId);
      if (sc) {
        setCopiedScene({ ...sc });
        setCopiedOverlay(null);
        setNotice(isEn ? 'Scene copied.' : 'Scène copiée.');
      }
    }
  }, [selectedOverlayId, overlays, selectedSceneId, scenes, isEn]);

  const handlePasteSelection = useCallback(() => {
    if (copiedOverlay) {
      pushHistory();
      const nid = `ov_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`;
      const clonedUrl = copiedOverlay.sourceBlob
        ? URL.createObjectURL(copiedOverlay.sourceBlob)
        : copiedOverlay.objectUrl;
      setOverlays((prev) => [
        ...prev,
        {
          ...copiedOverlay,
          id: nid,
          label: copiedOverlay.label.endsWith('(copie)')
            ? copiedOverlay.label
            : `${copiedOverlay.label} (copie)`,
          xPct: Math.min(90, copiedOverlay.xPct + 4),
          yPct: Math.min(90, copiedOverlay.yPct + 4),
          objectUrl: clonedUrl,
        },
      ]);
      setSelectedOverlayId(nid);
      return;
    }
    if (copiedScene) {
      pushHistory();
      const nid = `scene_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`;
      const clonedUrl = copiedScene.sourceBlob
        ? URL.createObjectURL(copiedScene.sourceBlob)
        : copiedScene.objectUrl;
      setScenes((prev) => [
        ...prev,
        {
          ...copiedScene,
          id: nid,
          name: copiedScene.name.endsWith('(copie)')
            ? copiedScene.name
            : `${copiedScene.name} (copie)`,
          objectUrl: clonedUrl,
        },
      ]);
      setSelectedSceneId(nid);
    }
  }, [copiedOverlay, copiedScene, pushHistory]);

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
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c') {
        if (selectedOverlayId || selectedSceneId) {
          e.preventDefault();
          handleCopySelection();
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'v') {
        if (copiedOverlay || copiedScene) {
          e.preventDefault();
          handlePasteSelection();
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [
    handleUndo,
    handleRedo,
    selectedOverlayId,
    selectedSceneId,
    copiedOverlay,
    copiedScene,
    handleCopySelection,
    handlePasteSelection,
  ]);

  useEffect(() => {
    if (draftCheckedRef.current) return;
    draftCheckedRef.current = true;
    loadStudioDraft('video').then((d) => {
      if (d && d.projectJson) setRecoverableDraft(true);
    });
  }, []);

  const stopPreviewAudio = useCallback(() => {
    previewAudioNodesRef.current.forEach((n) => {
      try {
        n.stop();
      } catch {
        // noop
      }
    });
    previewAudioNodesRef.current = [];
    if (previewAudioCtxRef.current && previewAudioCtxRef.current.state !== 'closed') {
      previewAudioCtxRef.current.close().catch(() => {});
      previewAudioCtxRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      if (voTimerRef.current) clearInterval(voTimerRef.current);
      if (previewRafRef.current) cancelAnimationFrame(previewRafRef.current);
      stopPreviewAudio();
      voStreamRef.current?.getTracks().forEach((t) => t.stop());
      scenes.forEach((s) => s.objectUrl && URL.revokeObjectURL(s.objectUrl));
      overlays.forEach((o) => o.objectUrl && URL.revokeObjectURL(o.objectUrl));
      audioTracks.forEach((a) => URL.revokeObjectURL(a.objectUrl));
      if (exportedVideoUrl) URL.revokeObjectURL(exportedVideoUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
        cropX: s.cropX,
        cropY: s.cropY,
        cropW: s.cropW,
        cropH: s.cropH,
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
        cropX: o.cropX,
        cropY: o.cropY,
        cropW: o.cropW,
        cropH: o.cropH,
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
        trimStartSec: a.trimStartSec,
        trimEndSec: a.trimEndSec,
        fadeInSec: a.fadeInSec,
        fadeOutSec: a.fadeOutSec,
        playbackRate: a.playbackRate,
        volume: a.volume,
        muted: a.muted,
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
    if (!parsed || typeof parsed !== 'object') {
      throw new Error(isEn ? 'Invalid video project format.' : 'Format de projet vidéo invalide.');
    }
    const restoredScenes: VideoScene[] = [];

    for (const ss of Array.isArray(parsed.scenes) ? parsed.scenes : []) {
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
      const decoded = await decodeAudioBlobSafe(blob);
      const fallbackDur = decoded?.duration || 8;
      restoredAudio.push({
        id: sa.id,
        name: sa.name,
        assetKey: sa.assetKey,
        sourceBlob: blob,
        objectUrl: URL.createObjectURL(blob),
        audioBuffer: decoded,
        startSec: sa.startSec ?? 0,
        trimStartSec: sa.trimStartSec ?? 0,
        trimEndSec:
          sa.trimEndSec !== undefined
            ? Math.min(sa.trimEndSec, fallbackDur)
            : Number(fallbackDur.toFixed(2)),
        fadeInSec: sa.fadeInSec ?? 0.1,
        fadeOutSec: sa.fadeOutSec ?? 0.2,
        playbackRate: sa.playbackRate ?? 1.0,
        volume: sa.volume ?? 0.7,
        muted: Boolean(sa.muted),
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
    setSelectedAudioTrackId(restoredAudio[0]?.id || null);
    setUndoStack([]);
    setRedoStack([]);
  };

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

    if (scene.filter === 'warm') safeApplyCanvasFilter(ctx, 'sepia(0.28) saturate(1.25)');
    else if (scene.filter === 'bw') safeApplyCanvasFilter(ctx, 'grayscale(1) contrast(1.08)');
    else if (scene.filter === 'vivid') safeApplyCanvasFilter(ctx, 'saturate(1.45) contrast(1.08)');
    else safeApplyCanvasFilter(ctx, 'none');

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
        ? (mediaEl as HTMLImageElement).naturalWidth || (mediaEl as HTMLImageElement).width || w
        : (mediaEl as HTMLVideoElement).videoWidth || w;
    const srcH =
      scene.kind === 'image'
        ? (mediaEl as HTMLImageElement).naturalHeight || (mediaEl as HTMLImageElement).height || h
        : (mediaEl as HTMLVideoElement).videoHeight || h;
    const cxNorm = Math.max(0, Math.min(0.95, scene.cropX ?? 0));
    const cyNorm = Math.max(0, Math.min(0.95, scene.cropY ?? 0));
    const cwNorm = Math.max(0.05, Math.min(1 - cxNorm, scene.cropW ?? 1));
    const chNorm = Math.max(0.05, Math.min(1 - cyNorm, scene.cropH ?? 1));
    const sx = cxNorm * srcW;
    const sy = cyNorm * srcH;
    const sw = cwNorm * srcW;
    const sh = chNorm * srcH;
    const sRatio = sw / Math.max(1, sh);
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
    if (scene.kind === 'image' && (cxNorm > 0 || cyNorm > 0 || cwNorm < 1 || chNorm < 1)) {
      safeDrawMedia(ctx, mediaEl, sx, sy, sw, sh, dx, dy, dw, dh);
    } else {
      safeDrawMedia(ctx, mediaEl, dx, dy, dw, dh);
    }
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
      const natW = ov.imageEl.naturalWidth || ov.imageEl.width || 100;
      const natH = ov.imageEl.naturalHeight || ov.imageEl.height || 100;
      const sw = (ov.cropW ?? 1) * natW;
      const sh = (ov.cropH ?? 1) * natH;
      const ratio = sw / Math.max(1, sh);
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
          drawRoundedRectPath(ctx, -boxW / 2, -boxH / 2, boxW, boxH, 16);
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
        const textAnchorX =
          align === 'left' ? -boxW / 2 + padX : align === 'right' ? boxW / 2 - padX : 0;
        lines.forEach((line, i) => {
          const ly = startY + i * lh;
          ctx.fillText(line, textAnchorX, ly);
          if (ov.underline && line.trim()) {
            const lw = ctx.measureText(line).width;
            const lx =
              align === 'center'
                ? textAnchorX - lw / 2
                : align === 'right'
                  ? textAnchorX - lw
                  : textAnchorX;
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
        const natW = ov.imageEl.naturalWidth || ov.imageEl.width || 100;
        const natH = ov.imageEl.naturalHeight || ov.imageEl.height || 100;
        const cxNorm = Math.max(0, Math.min(0.95, ov.cropX ?? 0));
        const cyNorm = Math.max(0, Math.min(0.95, ov.cropY ?? 0));
        const cwNorm = Math.max(0.05, Math.min(1 - cxNorm, ov.cropW ?? 1));
        const chNorm = Math.max(0.05, Math.min(1 - cyNorm, ov.cropH ?? 1));
        if (cxNorm > 0 || cyNorm > 0 || cwNorm < 1 || chNorm < 1) {
          safeDrawMedia(
            ctx,
            ov.imageEl,
            cxNorm * natW,
            cyNorm * natH,
            cwNorm * natW,
            chNorm * natH,
            -boxW / 2,
            -boxH / 2,
            boxW,
            boxH
          );
        } else {
          safeDrawMedia(ctx, ov.imageEl, -boxW / 2, -boxH / 2, boxW, boxH);
        }
      }

      if (includeSelectionGizmos && selectedOverlayId === ov.id) {
        ctx.globalAlpha = 1;
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 3;
        ctx.setLineDash([8, 6]);
        ctx.strokeRect(-boxW / 2 - 8, -boxH / 2 - 8, boxW + 16, boxH + 16);
        ctx.setLineDash([]);

        ctx.fillStyle = '#ffffff';
        ctx.strokeStyle = '#1d4ed8';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(boxW / 2 + 8, boxH / 2 + 8, 12, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

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
        if (match.scene.kind === 'video' && match.scene.videoEl) {
          const targetT = Math.min(
            match.scene.trimEndSec,
            match.scene.trimStartSec + localElapsed * match.scene.playbackRate
          );
          if (!isPlayingPreview) {
            if (Math.abs(match.scene.videoEl.currentTime - targetT) > 0.15) {
              match.scene.videoEl.currentTime = targetT;
            }
          } else {
            match.scene.videoEl.playbackRate = match.scene.playbackRate;
            if (match.scene.videoEl.paused) {
              match.scene.videoEl.currentTime = targetT;
              match.scene.videoEl.play().catch(() => {});
            } else if (Math.abs(match.scene.videoEl.currentTime - targetT) > 0.35) {
              match.scene.videoEl.currentTime = targetT;
            }
          }
        }
        drawSceneFrame(ctx, match.scene, localElapsed, match.dur, dims.w, dims.h);
      }
      drawOverlaysAtTime(ctx, previewTimeSec, dims.w, dims.h, true);
    }

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
      const canvasRect = canvas?.getBoundingClientRect();
      const canvasScaleFactor =
        canvasRect && canvasRect.width > 0 ? dims.w / canvasRect.width : 1;
      const handleHitRadius = Math.max(
        24,
        (e.pointerType === 'touch' ? 26 : 14) * canvasScaleFactor
      );

      if (Math.hypot(localX - 0, localY - (-boxH / 2 - 38)) <= handleHitRadius) {
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

      if (Math.hypot(localX - (boxW / 2 + 8), localY - (boxH / 2 + 8)) <= handleHitRadius) {
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
        const now = Date.now();
        if (
          ov.kind === 'text' &&
          lastTapRef.current &&
          lastTapRef.current.key === `ov_${ov.id}` &&
          now - lastTapRef.current.time < 340
        ) {
          lastTapRef.current = null;
          setSelectedOverlayId(ov.id);
          setInlineEditTarget({ kind: 'overlay', id: ov.id });
          setInlineEditText(ov.text || '');
          return;
        }
        lastTapRef.current = { key: `ov_${ov.id}`, time: now };
        setSelectedOverlayId(ov.id);
        setSelectedAudioTrackId(null);
        setIsInspectorOpen(true);
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

    const now = Date.now();
    const activeEntry =
      sceneTimingMap.find((m) => previewTimeSec >= m.start && previewTimeSec <= m.end) ||
      sceneTimingMap[0];
    if (
      activeEntry?.scene.kind === 'custom' &&
      lastTapRef.current &&
      lastTapRef.current.key === `scene_${activeEntry.scene.id}` &&
      now - lastTapRef.current.time < 340
    ) {
      lastTapRef.current = null;
      setSelectedSceneId(activeEntry.scene.id);
      setInlineEditTarget({ kind: 'scene', id: activeEntry.scene.id });
      setInlineEditText(activeEntry.scene.text || '');
      return;
    }
    if (activeEntry?.scene.kind === 'custom') {
      lastTapRef.current = { key: `scene_${activeEntry.scene.id}`, time: now };
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

  const scheduleTrackOnContext = (
    ctx: BaseAudioContext,
    dest: AudioNode,
    tr: VideoAudioTrack,
    buf: AudioBuffer,
    timelineOffsetSec: number
  ): AudioBufferSourceNode | null => {
    if (tr.muted) return null;
    const rate = Math.max(0.5, tr.playbackRate || 1);
    const tStart = Math.max(0, Math.min(tr.trimStartSec || 0, buf.duration - 0.1));
    const tEnd = Math.max(tStart + 0.1, Math.min(tr.trimEndSec || buf.duration, buf.duration));
    const slicedDur = (tEnd - tStart) / rate;
    const clipEndTimeline = tr.startSec + slicedDur;
    if (clipEndTimeline <= timelineOffsetSec) return null;

    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.playbackRate.value = rate;

    const gain = ctx.createGain();
    const targetVol = Math.max(0, tr.volume);
    const skipTimeline = Math.max(0, timelineOffsetSec - tr.startSec);
    const delaySec = Math.max(0, tr.startSec - timelineOffsetSec);
    const startAt = ctx.currentTime + 0.04 + delaySec;
    const remDur = slicedDur - skipTimeline;
    const fadeIn = Math.min(tr.fadeInSec || 0, slicedDur / 2);
    const fadeOut = Math.min(tr.fadeOutSec || 0, slicedDur / 2);

    if (skipTimeline === 0 && fadeIn > 0.01) {
      gain.gain.setValueAtTime(0.001, startAt);
      gain.gain.linearRampToValueAtTime(targetVol, startAt + fadeIn);
    } else {
      gain.gain.setValueAtTime(targetVol, startAt);
    }

    if (fadeOut > 0.01 && remDur > fadeOut) {
      const fStart = startAt + remDur - fadeOut;
      gain.gain.setValueAtTime(targetVol, fStart);
      gain.gain.linearRampToValueAtTime(0.001, startAt + remDur);
    }

    src.connect(gain);
    gain.connect(dest);
    const bufferOffset = tStart + skipTimeline * rate;
    const bufferDurToPlay = Math.max(0.05, tEnd - bufferOffset);
    src.start(startAt, bufferOffset, bufferDurToPlay);
    return src;
  };

  const handleTogglePreviewPlay = async () => {
    if (isPlayingPreview) {
      if (previewRafRef.current) cancelAnimationFrame(previewRafRef.current);
      stopPreviewAudio();
      scenes.forEach((s) => s.videoEl?.pause());
      setIsPlayingPreview(false);
      return;
    }
    if (totalDurationSec <= 0) return;
    const startOffset = previewTimeSec >= totalDurationSec - 0.1 ? 0 : previewTimeSec;

    // Schedule decoded audio tracks during live preview
    if (audioTracks.length > 0) {
      try {
        const aCtx = createSafeAudioContext();
        if (aCtx) {
          if (aCtx.state === 'suspended') await aCtx.resume();
          previewAudioCtxRef.current = aCtx;
          const nodes: AudioBufferSourceNode[] = [];
          for (const tr of audioTracks) {
            const buf =
              tr.audioBuffer ||
              (tr.sourceBlob
                ? await aCtx.decodeAudioData((await tr.sourceBlob.arrayBuffer()).slice(0))
                : undefined);
            if (!buf) continue;
            const n = scheduleTrackOnContext(aCtx, aCtx.destination, tr, buf, startOffset);
            if (n) nodes.push(n);
          }
          previewAudioNodesRef.current = nodes;
        }
      } catch {
        // non-fatal audio preview error
      }
    }

    const wallStart = performance.now();
    setIsPlayingPreview(true);

    const step = () => {
      const t = startOffset + (performance.now() - wallStart) / 1000;
      if (t >= totalDurationSec) {
        stopPreviewAudio();
        scenes.forEach((s) => s.videoEl?.pause());
        setPreviewTimeSec(0);
        setIsPlayingPreview(false);
        return;
      }
      setPreviewTimeSec(t);
      previewRafRef.current = requestAnimationFrame(step);
    };
    previewRafRef.current = requestAnimationFrame(step);
  };

  const handleStartBlankVideoProject = () => {
    if (scenes.length > 0 || overlays.length > 0 || audioTracks.length > 0) pushHistory();
    const blankSceneId = `scene_${Date.now()}_blank`;
    setCurrentProjectId(null);
    setProjectTitle(isEn ? 'Untitled Video Project' : 'Nouvelle vidéo SHALOM');
    setAspectMode('9:16');
    setCanvasBgColor('#090d1a');
    setScenes([
      {
        id: blankSceneId,
        kind: 'custom',
        name: isEn ? 'Scene #1' : 'Scène #1',
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
    setOverlays([]);
    setAudioTracks([]);
    setSelectedSceneId(blankSceneId);
    setSelectedOverlayId(null);
    setSelectedAudioTrackId(null);
    setPreviewTimeSec(0);
    setActiveToolTab(null);
    setIsHomeView(false);
    setNotice(isEn ? 'New blank video timeline ready!' : 'Nouveau montage vierge prêt !');
  };

  const applyVideoTemplate = async (tpl: VideoTemplateDef) => {
    pushHistory();
    const newScenes: VideoScene[] = tpl.scenes.map((s, idx) => ({
      ...s,
      id: `scene_${Date.now()}_${idx}`,
    }));
    const newOverlays: OverlayLayer[] = tpl.overlays.map((o, idx) => ({
      ...o,
      id: `ov_${Date.now()}_${idx}`,
    }));
    setCurrentProjectId(null);
    setAspectMode(tpl.aspect);
    setCanvasBgColor(tpl.bgColor);
    setScenes(newScenes);
    setOverlays(newOverlays);
    setProjectTitle(isEn ? tpl.titleEn : tpl.titleFr);
    setSelectedSceneId(newScenes[0]?.id || null);
    setSelectedOverlayId(newOverlays[0]?.id || null);
    setPreviewTimeSec(0);
    setActiveToolTab(null);
    setIsHomeView(false);
    setNotice(
      isEn
        ? `Video template "${tpl.titleEn}" loaded onto timeline!`
        : `Modèle vidéo « ${tpl.titleFr} » chargé sur le montage !`
    );
  };

  const handleSaveTemplateToShalom = async (tpl: VideoTemplateDef) => {
    setSavingResourceId(tpl.id);
    try {
      const title = isEn ? tpl.titleEn : tpl.titleFr;
      await saveTemplateBundleToShalom({
        id: tpl.id,
        studioType: 'video',
        title,
        category: tpl.category || 'Vidéo',
        templateObj: tpl as unknown as Record<string, unknown>,
        previewColor: tpl.bgColor,
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
            ? 'Failed to bundle template offline.'
            : 'Impossible de sauvegarder ce modèle hors-ligne.'
      );
    } finally {
      setSavingResourceId(null);
    }
  };

  const addMediaBlob = async (
    blob: Blob,
    name: string,
    kindHint?: 'image' | 'video',
    existingAssetKey?: string
  ) => {
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
          assetKey: existingAssetKey,
          sourceBlob: blob,
          objectUrl: url,
          imageEl: img,
          durationSec: 4,
          trimStartSec: 0,
          trimEndSec: 4,
          fitMode: 'cover',
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
      setIsInspectorOpen(false);
      setActiveToolTab(null);
      setIsHomeView(false);
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
          assetKey: existingAssetKey,
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
      setIsInspectorOpen(false);
      setActiveToolTab(null);
      setIsHomeView(false);
    }
  };

  const addAudioBlobAsTrack = async (blob: Blob, name: string, volume = 0.7, startSec = 0, assetKey?: string) => {
    const buf = await decodeAudioBlobSafe(blob);
    const dur = buf?.duration ? Number(buf.duration.toFixed(2)) : 8;
    const id = `vaud_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`;
    const track: VideoAudioTrack = {
      id,
      name,
      assetKey,
      sourceBlob: blob,
      objectUrl: URL.createObjectURL(blob),
      audioBuffer: buf,
      startSec,
      trimStartSec: 0,
      trimEndSec: dur,
      fadeInSec: 0.1,
      fadeOutSec: 0.2,
      playbackRate: 1.0,
      volume,
      muted: false,
    };
    setAudioTracks((prev) => [...prev, track]);
    setSelectedAudioTrackId(id);
    setSelectedOverlayId(null);
    setSelectedSceneId(null);
    setIsInspectorOpen(false);
    setActiveToolTab(null);
    setIsHomeView(false);
  };

  const handleSaveOnlineMediaToShalom = async (item: OnlineMediaTrackResult) => {
    setSavingResourceId(item.id);
    try {
      const resourceType =
        item.kind === 'image' ? 'image' : item.kind === 'audio' ? 'audio' : 'video';
      await saveAssetResourceToShalom({
        id: item.id,
        studioType: 'video',
        resourceType,
        title: item.title,
        category: item.kind === 'image' ? 'Décor Vidéo' : 'Média Vidéo',
        remoteUrl: item.streamUrl,
        attribution: item.author,
        license: item.license || 'Wikimedia Commons',
        source: 'online-live',
      });
      reloadData();
      setNotice(
        isEn
          ? `"${item.title}" saved into My SHALOM Resources (verified offline)!`
          : `« ${item.title} » enregistré dans « Mes ressources SHALOM » (vérifié hors-ligne) !`
      );
    } catch (err) {
      setNotice(
        err instanceof Error
          ? err.message
          : isEn
            ? 'Could not save remote media offline.'
            : 'Impossible de télécharger ce média pour le mode hors-ligne.'
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
          resourceType?: string;
        };
        if (!meta.assetKey) throw new Error('Clé média introuvable.');
        const blob = await dbService.getMediaBlob(meta.assetKey);
        if (!blob) throw new Error('Média local introuvable.');
        if (meta.resourceType === 'audio') {
          pushHistory();
          await addAudioBlobAsTrack(blob, savedItem.title, 0.75, 0, meta.assetKey);
        } else {
          await addMediaBlob(
            blob,
            savedItem.title,
            meta.resourceType === 'video' ? 'video' : 'image',
            meta.assetKey
          );
        }
        setNotice(
          isEn
            ? `Inserted offline resource "${savedItem.title}".`
            : `Ressource hors-ligne « ${savedItem.title} » insérée !`
        );
      } else {
        const parsed = JSON.parse(savedItem.templateJson) as VideoTemplateDef;
        await applyVideoTemplate(parsed);
      }
    } catch (err) {
      setNotice(
        err instanceof Error
          ? err.message
          : isEn
            ? 'Could not open saved resource.'
            : 'Impossible d’ouvrir cette ressource.'
      );
    }
  };

  const handleDeleteShalomResource = async (savedItem: SavedStudioTemplate) => {
    await deleteSavedOnlineTemplate(savedItem.id);
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
    setSelectedOverlayId(null);
    setIsInspectorOpen(false);
    setActiveToolTab(null);
    setIsHomeView(false);
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

  const handleImportBuiltInBackdropScene = async (item: (typeof STUDIO_BACKDROP_PHOTOS)[number]) => {
    try {
      const resp = await fetch(item.src);
      if (!resp.ok) throw new Error('Image locale inaccessible');
      const blob = await resp.blob();
      await addMediaBlob(blob, isEn ? item.nameEn : item.nameFr, 'image');
      setNotice(
        isEn
          ? `Added scene backdrop "${item.nameEn}".`
          : `Décor « ${item.nameFr} » ajouté en scène animée !`
      );
    } catch {
      setNotice(isEn ? 'Failed to load local backdrop.' : 'Impossible de charger le décor local.');
    }
  };

  const handleImportFromParole = async (recId: string) => {
    const rec = recordings.find((r) => r.id === recId);
    if (!rec?.blobKey) return;
    const blob = await dbService.getMediaBlob(rec.blobKey);
    if (!blob) return;
    if (rec.mediaType === 'audio') {
      pushHistory();
      await addAudioBlobAsTrack(blob, rec.title, 0.9, 0, rec.blobKey);
      setNotice(isEn ? `Audio "${rec.title}" added.` : `Audio « ${rec.title} » ajouté.`);
      return;
    }
    await addMediaBlob(blob, rec.title, 'video', rec.blobKey);
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
    setSelectedAudioTrackId(null);
    setIsInspectorOpen(false);
    setActiveToolTab(null);
    setIsHomeView(false);
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
    setSelectedAudioTrackId(null);
    setIsInspectorOpen(false);
    setActiveToolTab(null);
    setIsHomeView(false);
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
        setIsInspectorOpen(false);
        setActiveToolTab(null);
        setIsHomeView(false);
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
        await addAudioBlobAsTrack(verified.blob, verified.fileName, 0.6, 0);
      } catch {
        // skip unreadable
      }
    }
    e.target.value = '';
  };

  const handleAddBuiltInWorshipMusic = async (kind: 'c_major' | 'g_warm') => {
    pushHistory();
    const dur = Math.max(6, Math.ceil(totalDurationSec || 8));
    const wav = synthesizeAmbientWavBlob(kind, dur);
    await addAudioBlobAsTrack(
      wav,
      kind === 'c_major' ? `Fond Do Majeur (${dur}s)` : `Fond Sol Paix (${dur}s)`,
      0.55,
      0
    );
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

      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(voChunksRef.current, { type: recorder.mimeType || 'audio/webm' });
        pushHistory();
        await addAudioBlobAsTrack(
          blob,
          `${isEn ? 'Voiceover' : 'Voix-off'} #${audioTracks.length + 1}`,
          1.0,
          Number(previewTimeSec.toFixed(1))
        );
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

  const reorderSceneByDrop = (sourceId: string, targetId: string) => {
    if (!sourceId || !targetId || sourceId === targetId) return;
    pushHistory();
    setScenes((prev) => {
      const fromIdx = prev.findIndex((s) => s.id === sourceId);
      const toIdx = prev.findIndex((s) => s.id === targetId);
      if (fromIdx === -1 || toIdx === -1) return prev;
      const copy = [...prev];
      const [moved] = copy.splice(fromIdx, 1);
      copy.splice(toIdx, 0, moved);
      return copy;
    });
  };

  const splitSceneInTwo = (scene: VideoScene) => {
    const entry = sceneTimingMap.find((m) => m.scene.id === scene.id);
    if (!entry) return;
    if (previewTimeSec <= entry.start + 0.25 || previewTimeSec >= entry.end - 0.25) {
      setNotice(
        isEn
          ? 'Place the red playhead inside the selected scene to split cleanly at that exact point.'
          : 'Placez le curseur rouge à l’intérieur de la scène sélectionnée pour la scinder exactement à cet endroit.'
      );
      return;
    }

    pushHistory();
    const leftDur = Math.max(0.4, Number((previewTimeSec - entry.start).toFixed(2)));
    const rightDur = Math.max(0.4, Number((entry.end - previewTimeSec).toFixed(2)));
    const rightId = `scene_${Date.now()}_r`;

    if (scene.kind === 'video') {
      const cutSourceSec = Number(
        Math.min(
          scene.trimEndSec - 0.3,
          Math.max(scene.trimStartSec + 0.3, scene.trimStartSec + leftDur * scene.playbackRate)
        ).toFixed(2)
      );
      const left: VideoScene = { ...scene, trimEndSec: cutSourceSec };
      const right: VideoScene = {
        ...scene,
        id: rightId,
        name: `${scene.name} (2)`,
        trimStartSec: cutSourceSec,
        objectUrl: undefined,
      };
      setScenes((prev) => prev.flatMap((s) => (s.id === scene.id ? [left, right] : [s])));
      setSelectedSceneId(rightId);
    } else {
      const left: VideoScene = { ...scene, durationSec: leftDur };
      const right: VideoScene = {
        ...scene,
        id: rightId,
        name: `${scene.name} (2)`,
        durationSec: rightDur,
        objectUrl: undefined,
      };
      setScenes((prev) => prev.flatMap((s) => (s.id === scene.id ? [left, right] : [s])));
      setSelectedSceneId(rightId);
    }
    setNotice(isEn ? 'Scene split cleanly at playhead!' : 'Scène scindée au curseur rouge !');
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

  const commitInlineVideoTextEditor = () => {
    if (!inlineEditTarget) return;
    pushHistory();
    if (inlineEditTarget.kind === 'overlay') {
      updateOverlay(inlineEditTarget.id, { text: inlineEditText });
    } else {
      updateScene(inlineEditTarget.id, { text: inlineEditText });
    }
    setInlineEditTarget(null);
  };

  const handleSearchOnlineVideoMedia = useCallback(
    async (overrideQuery?: string, appendPage?: number) => {
      const q =
        (overrideQuery !== undefined ? overrideQuery : onlineVideoQuery).trim() ||
        'sky clouds light';
      const targetPage = appendPage && appendPage > 1 ? appendPage : 1;
      setIsSearchingOnlineVideo(true);
      setOnlineVideoError(null);
      try {
        const res = await searchOnlineMediaLibrary({
          mediaKind: 'video',
          query: q,
          page: targetPage,
          lang: isEn ? 'en' : 'fr',
        });
        setOnlineVideoPage(targetPage);
        setOnlineVideoHasMore(res.hasMore);
        setOnlineVideoItems((prev) => {
          if (targetPage === 1) return res.items;
          const seen = new Set(prev.map((i) => i.id));
          return [...prev, ...res.items.filter((i) => !seen.has(i.id))];
        });
        if (res.networkError && res.items.length === 0) {
          setOnlineVideoError(res.networkError);
        } else if (res.items.length === 0) {
          setOnlineVideoError(
            isEn
              ? 'No clips or photos found for this query.'
              : 'Aucun clip ou photo trouvé pour cette recherche.'
          );
        }
      } catch (err) {
        setOnlineVideoError(
          err instanceof Error
            ? err.message
            : isEn
              ? 'Online media search failed.'
              : 'Impossible de contacter la médiathèque en ligne.'
        );
      } finally {
        setIsSearchingOnlineVideo(false);
      }
    },
    [onlineVideoQuery, isEn]
  );

  const handleInsertOnlineMediaToScene = async (item: OnlineMediaTrackResult) => {
    setLoadingOnlineVideoId(item.id);
    setOnlineVideoError(null);
    try {
      const blob = await fetchRemoteAssetVerifiedBlob(
        item.streamUrl,
        item.kind === 'image' ? 'image' : 'video'
      );
      await addMediaBlob(blob, item.title, item.kind === 'image' ? 'image' : 'video');
      setNotice(
        isEn ? `Added "${item.title}" as a scene.` : `« ${item.title} » ajouté comme scène.`
      );
    } catch {
      setOnlineVideoError(
        isEn
          ? 'Could not import this remote clip directly into canvas.'
          : 'Impossible d’importer ce média distant sur le canevas.'
      );
    } finally {
      setLoadingOnlineVideoId(null);
    }
  };

  const handleDownloadOnlineMedia = async (item: OnlineMediaTrackResult) => {
    setLoadingOnlineVideoId(item.id);
    try {
      const blob = await fetchRemoteAssetVerifiedBlob(
        item.streamUrl,
        item.kind === 'image' ? 'image' : 'video'
      );
      const ext =
        item.kind === 'image'
          ? 'jpg'
          : item.mimeType.includes('webm')
            ? 'webm'
            : 'mp4';
      const fileName = sanitizeFileName(item.title, 'shalom_media', ext);
      const res = await downloadBlobToDevice(blob, fileName, blob.type || item.mimeType);
      if (res.ok) {
        setNotice(
          isEn
            ? `Saved "${res.fileName}" to ${res.locationLabel}.`
            : `Média « ${res.fileName} » enregistré dans ${res.locationLabel} !`
        );
      }
    } catch {
      setOnlineVideoError(
        isEn
          ? 'Could not download this remote file.'
          : 'Téléchargement direct impossible pour cette source.'
      );
    } finally {
      setLoadingOnlineVideoId(null);
    }
  };

  const handleShareOnlineMediaDirect = async (item: OnlineMediaTrackResult) => {
    setLoadingOnlineVideoId(item.id);
    try {
      const blob = await fetchRemoteAssetVerifiedBlob(
        item.streamUrl,
        item.kind === 'image' ? 'image' : 'video'
      );
      const ext =
        item.kind === 'image'
          ? 'jpg'
          : item.mimeType.includes('webm')
            ? 'webm'
            : 'mp4';
      const fileName = sanitizeFileName(item.title, 'shalom_media', ext);
      const file = await normalizeMediaToShareFile(
        blob,
        fileName,
        item.kind === 'image' ? 'image' : 'video',
        blob.type || item.mimeType
      );
      setSharePayload({
        title: item.title,
        text: `🎬 ${item.title}\n\nPartagé sans enregistrement depuis SHALOM Studio Vidéo`,
        file,
      });
    } catch {
      setSharePayload({
        title: item.title,
        text: `🎬 ${item.title}\n${item.streamUrl}`,
      });
    } finally {
      setLoadingOnlineVideoId(null);
    }
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
        const result = await searchOnlineTemplatesClient<VideoTemplateDef>({
          studioType: 'video',
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
            ? `${nextTotal} online video template(s) loaded.`
            : `${nextTotal} modèle(s) vidéo chargé(s) en ligne.`
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
      const hay =
        `${tpl.titleFr} ${tpl.titleEn} ${tpl.descFr} ${tpl.category || ''} ${(tpl.tags || []).join(' ')}`.toLowerCase();
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
    if (selectedAudioTrackId === id) setSelectedAudioTrackId(null);
  };

  const splitAudioTrackAtPlayhead = (tr: VideoAudioTrack) => {
    const bufDur = tr.audioBuffer?.duration || Math.max(tr.trimEndSec || 6, 6);
    const rate = Math.max(0.5, tr.playbackRate || 1);
    const activeDur = Math.max(0.2, (tr.trimEndSec ?? bufDur) - (tr.trimStartSec ?? 0)) / rate;
    const trEnd = tr.startSec + activeDur;
    if (previewTimeSec <= tr.startSec + 0.15 || previewTimeSec >= trEnd - 0.15) {
      setNotice(
        isEn
          ? 'Place the red playhead inside the selected audio track to split it.'
          : 'Placez le curseur rouge à l’intérieur de la piste audio sélectionnée pour la scinder.'
      );
      return;
    }
    pushHistory();
    const cutSourceOffset = (previewTimeSec - tr.startSec) * rate;
    const splitPointInBuf = Number(((tr.trimStartSec ?? 0) + cutSourceOffset).toFixed(2));
    const rightId = `vaud_${Date.now()}_r`;
    const left: VideoAudioTrack = { ...tr, trimEndSec: splitPointInBuf };
    const right: VideoAudioTrack = {
      ...tr,
      id: rightId,
      name: `${tr.name} (2)`,
      startSec: Number(previewTimeSec.toFixed(2)),
      trimStartSec: splitPointInBuf,
      objectUrl: tr.sourceBlob ? URL.createObjectURL(tr.sourceBlob) : tr.objectUrl,
    };
    setAudioTracks((prev) => prev.flatMap((a) => (a.id === tr.id ? [left, right] : [a])));
    setSelectedAudioTrackId(rightId);
    setNotice(isEn ? 'Audio track split at playhead!' : 'Piste audio scindée au curseur rouge !');
  };

  const handleSearchOnlineElements = useCallback(
    async (overrideQuery?: string, appendPage?: number) => {
      const q =
        (overrideQuery !== undefined ? overrideQuery : onlineElementQuery).trim() || 'dove cross';
      const targetPage = appendPage && appendPage > 1 ? appendPage : 1;
      setIsSearchingElements(true);
      setElementsError(null);
      try {
        const res = await searchOnlineAssetsClient({
          assetType: 'elements',
          query: q,
          page: targetPage,
          lang: isEn ? 'en' : 'fr',
        });
        setOnlineElementPage(targetPage);
        setOnlineElementHasMore(res.hasMore);
        setOnlineElements((prev) => {
          if (targetPage === 1) return res.assets;
          const seen = new Set(prev.map((a) => a.id));
          return [...prev, ...res.assets.filter((a) => !seen.has(a.id))];
        });
        if (res.networkError) {
          setElementsError(res.networkError);
        } else if (res.assets.length === 0) {
          setElementsError(
            isEn ? 'No graphic elements found.' : 'Aucun élément graphique trouvé.'
          );
        }
      } catch (err) {
        setElementsError(
          err instanceof Error
            ? err.message
            : isEn
              ? 'Online element search failed.'
              : 'Impossible de rechercher les éléments en ligne.'
        );
      } finally {
        setIsSearchingElements(false);
      }
    },
    [onlineElementQuery, isEn]
  );

  const handleInsertOnlineElementOverlay = async (asset: OnlineCreativeAsset) => {
    setLoadingElementAssetId(asset.id);
    setElementsError(null);
    try {
      const blob = await fetchOnlineAssetBlobClient(asset);
      const url = URL.createObjectURL(blob);
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const el = new Image();
        el.onload = () => resolve(el);
        el.onerror = reject;
        el.src = url;
      });
      pushHistory();
      const dur = Math.max(4, totalDurationSec || 4);
      const id = `ov_${Date.now()}`;
      setOverlays((prev) => [
        ...prev,
        {
          id,
          kind: 'image',
          label: asset.title,
          startSec: 0,
          endSec: Number(dur.toFixed(1)),
          xPct: 50,
          yPct: 45,
          size: 160,
          rotationDeg: 0,
          color: '#ffffff',
          bgBadge: false,
          opacity: 1,
          animation: 'fade-in',
          sourceBlob: blob,
          imageEl: img,
          objectUrl: url,
        },
      ]);
      setSelectedOverlayId(id);
      setSelectedAudioTrackId(null);
      setSelectedSceneId(null);
      setIsInspectorOpen(false);
      setActiveToolTab(null);
      setIsHomeView(false);
      setNotice(
        isEn
          ? `Added "${asset.title}" overlay onto timeline.`
          : `Élément « ${asset.title} » ajouté sur la vidéo !`
      );
    } catch (err) {
      setElementsError(
        err instanceof Error
          ? err.message
          : isEn
            ? 'Could not download graphic element.'
            : 'Impossible de charger cet élément graphique.'
      );
    } finally {
      setLoadingElementAssetId(null);
    }
  };

  const handleSaveElementAssetToShalom = async (asset: OnlineCreativeAsset) => {
    setSavingResourceId(asset.id);
    try {
      await saveAssetResourceToShalom({
        id: asset.id,
        studioType: 'video',
        resourceType: 'image',
        title: asset.title,
        category: 'Élément Vidéo',
        remoteUrl: asset.fullUrl,
        attribution: asset.author,
        license: asset.license || 'Wikimedia / Openverse',
        source: 'online-live',
      });
      reloadData();
      setNotice(
        isEn
          ? `"${asset.title}" saved in SHALOM Resources!`
          : `« ${asset.title} » enregistré dans « Mes ressources SHALOM » !`
      );
    } catch (err) {
      setNotice(
        err instanceof Error
          ? err.message
          : isEn
            ? 'Could not save element.'
            : 'Impossible de conserver cet élément.'
      );
    } finally {
      setSavingResourceId(null);
    }
  };

  const handleReplaceImageOverlay = async (ovId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const verified = await readFileAsVerifiedBlob(file);
      const url = URL.createObjectURL(verified.blob);
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const el = new Image();
        el.onload = () => resolve(el);
        el.onerror = reject;
        el.src = url;
      });
      pushHistory();
      updateOverlay(ovId, {
        label: verified.fileName,
        sourceBlob: verified.blob,
        imageEl: img,
        objectUrl: url,
        assetKey: undefined,
        cropX: 0,
        cropY: 0,
        cropW: 1,
        cropH: 1,
      });
      setNotice(isEn ? 'Overlay image replaced!' : 'Image du calque remplacée !');
    } catch {
      setNotice(isEn ? 'Failed to load replacement image.' : 'Impossible de remplacer cette image.');
    }
    e.target.value = '';
  };

  const handleReplaceImageScene = async (sceneId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const verified = await readFileAsVerifiedBlob(file);
      const url = URL.createObjectURL(verified.blob);
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const el = new Image();
        el.onload = () => resolve(el);
        el.onerror = reject;
        el.src = url;
      });
      pushHistory();
      updateScene(sceneId, {
        name: verified.fileName,
        sourceBlob: verified.blob,
        imageEl: img,
        objectUrl: url,
        assetKey: undefined,
        cropX: 0,
        cropY: 0,
        cropW: 1,
        cropH: 1,
      });
      setNotice(isEn ? 'Scene photo replaced!' : 'Photo de la scène remplacée !');
    } catch {
      setNotice(isEn ? 'Failed to replace photo.' : 'Impossible de remplacer la photo.');
    }
    e.target.value = '';
  };

  const handleSaveEditableProject = async () => {
    setIsSavingProject(true);
    try {
      const { json, mediaAssetKeys } = await serializeVideoProject();
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
          : 'Projet vidéo sauvegardé ! Reprenez votre montage à tout moment dans « Projets ».'
      );
      reloadData();
    } catch {
      setNotice(
        isEn ? 'Failed to save video project.' : 'Erreur lors de la sauvegarde du projet vidéo.'
      );
    } finally {
      setIsSavingProject(false);
    }
  };

  const handleLoadSavedProject = async (proj: CreativeDesignItem) => {
    if (!proj.projectJson) return;
    try {
      await deserializeAndLoadVideoProject(proj.title, proj.projectJson, proj.id);
      setActiveToolTab(null);
      setIsHomeView(false);
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

    if (isPlayingPreview) await handleTogglePreviewPlay();

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
      if (
        typeof (canvas as HTMLCanvasElement & { captureStream?: unknown }).captureStream !==
          'function' ||
        typeof MediaRecorder === 'undefined'
      ) {
        throw new Error(
          isEn
            ? 'Video recording (captureStream/MediaRecorder) is unavailable on this WebView.'
            : 'L’export vidéo WebM n’est pas supporté sur ce navigateur/WebView.'
        );
      }
      const videoStream = canvas.captureStream(30);
      const audioCtx = createSafeAudioContext();
      const destNode = audioCtx ? audioCtx.createMediaStreamDestination() : null;

      const scheduledAudioNodes: AudioBufferSourceNode[] = [];
      if (audioCtx && destNode) {
        for (const track of audioTracks) {
          if (track.muted) continue;
          try {
            const buf =
              track.audioBuffer ||
              (await audioCtx.decodeAudioData(
                await (await fetch(track.objectUrl)).arrayBuffer()
              ));
            const node = scheduleTrackOnContext(audioCtx, destNode, track, buf, 0);
            if (node) scheduledAudioNodes.push(node);
          } catch {
            // ignore undecodable track
          }
        }
      }

      const combinedStream = new MediaStream([
        ...videoStream.getVideoTracks(),
        ...(destNode ? destNode.stream.getAudioTracks() : []),
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
          vid.muted = !audioCtx || !destNode;
          if (audioCtx && destNode) {
            try {
              vidSourceNode = audioCtx.createMediaElementSource(vid);
              vidGainNode = audioCtx.createGain();
              vidGainNode.gain.value = scene.volume;
              vidSourceNode.connect(vidGainNode);
              vidGainNode.connect(destNode);
            } catch {
              vid.muted = true;
            }
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
          setExportProgress(
            Math.min(99, Math.round((globalTime / Math.max(0.5, totalDurationSec)) * 100))
          );
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
      if (audioCtx) await audioCtx.close().catch(() => {});

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
    setShowPreviewModal(true);
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

  const scrubTimelineFromClientX = useCallback(
    (clientX: number) => {
      const trackEl = timelineTrackRef.current;
      if (!trackEl) return;
      const rect = trackEl.getBoundingClientRect();
      const x = Math.max(0, clientX - rect.left);
      const sec = Number((x / Math.max(12, timelineZoom)).toFixed(2));
      setPreviewTimeSec(Math.min(Math.max(0.5, totalDurationSec + 2), Math.max(0, sec)));
    },
    [timelineZoom, totalDurationSec]
  );

  // Interactive Timeline Pointer Gesture Window Listeners (Playhead Scrubbing + Scene left/right trim + Overlay move/left/right trim)
  useEffect(() => {
    const onMove = (ev: PointerEvent) => {
      if (isScrubbingRef.current) {
        scrubTimelineFromClientX(ev.clientX);
        return;
      }

      const g = timelineGestureRef.current;
      if (!g) return;
      const deltaSec = (ev.clientX - g.startClientX) / Math.max(12, timelineZoom);

      if (g.kind === 'overlay-move') {
        let nextStart = Math.max(0, Number((g.origStart + deltaSec).toFixed(2)));
        if (snapEnabled && Math.abs(nextStart - previewTimeSec) < 0.25) {
          nextStart = Number(previewTimeSec.toFixed(2));
        }
        const dur = Math.max(0.4, g.origEnd - g.origStart);
        setOverlays((prev) =>
          prev.map((o) =>
            o.id === g.targetId
              ? { ...o, startSec: nextStart, endSec: Number((nextStart + dur).toFixed(2)) }
              : o
          )
        );
        setTimelineTrimHud(`${dur.toFixed(1)}s`);
      } else if (g.kind === 'overlay-trim-left') {
        const nextStart = Math.max(0, Math.min(g.origEnd - 0.4, Number((g.origStart + deltaSec).toFixed(2))));
        setOverlays((prev) =>
          prev.map((o) => (o.id === g.targetId ? { ...o, startSec: nextStart } : o))
        );
        setTimelineTrimHud(`${(g.origEnd - nextStart).toFixed(1)}s`);
      } else if (g.kind === 'overlay-trim-right') {
        const nextEnd = Math.max(g.origStart + 0.4, Number((g.origEnd + deltaSec).toFixed(2)));
        setOverlays((prev) =>
          prev.map((o) => (o.id === g.targetId ? { ...o, endSec: nextEnd } : o))
        );
        setTimelineTrimHud(`${(nextEnd - g.origStart).toFixed(1)}s`);
      } else if (g.kind === 'scene-trim-left') {
        setScenes((prev) =>
          prev.map((s) => {
            if (s.id !== g.targetId) return s;
            if (s.kind === 'video') {
              const nextTrimStart = Math.max(
                0,
                Math.min(
                  g.origTrimEndSec - 0.5,
                  Number((g.origTrimStartSec + deltaSec * g.origPlaybackRate).toFixed(1))
                )
              );
              const nextDur = (g.origTrimEndSec - nextTrimStart) / Math.max(0.25, g.origPlaybackRate);
              setTimelineTrimHud(`${nextDur.toFixed(1)}s`);
              return { ...s, trimStartSec: nextTrimStart };
            }
            const nextDur = Math.max(0.5, Number((g.origDuration - deltaSec).toFixed(1)));
            setTimelineTrimHud(`${nextDur.toFixed(1)}s`);
            return { ...s, durationSec: nextDur };
          })
        );
      } else if (g.kind === 'scene-trim-right') {
        const nextDur = Math.max(0.5, Number((g.origDuration + deltaSec).toFixed(1)));
        setScenes((prev) =>
          prev.map((s) => {
            if (s.id !== g.targetId) return s;
            if (s.kind === 'video') {
              const maxVidEnd = s.videoEl?.duration && Number.isFinite(s.videoEl.duration)
                ? s.videoEl.duration
                : s.trimStartSec + 60;
              const nextTrimEnd = Math.min(
                maxVidEnd,
                Math.max(s.trimStartSec + 0.5, Number((s.trimStartSec + nextDur * s.playbackRate).toFixed(1)))
              );
              return { ...s, trimEndSec: nextTrimEnd };
            }
            return { ...s, durationSec: nextDur };
          })
        );
        setTimelineTrimHud(`${nextDur.toFixed(1)}s`);
      }
    };

    const onUp = () => {
      isScrubbingRef.current = false;
      timelineGestureRef.current = null;
      setTimelineTrimHud(null);
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
  }, [timelineZoom, snapEnabled, previewTimeSec, scrubTimelineFromClientX]);

  const selectedScene = scenes.find((s) => s.id === selectedSceneId) || null;
  const selectedOverlay = overlays.find((o) => o.id === selectedOverlayId) || null;
  const selectedAudioTrack = audioTracks.find((a) => a.id === selectedAudioTrackId) || null;

  const toolItems: StudioToolRailItem[] = useMemo(
    () => [
      { id: 'templates', label: isEn ? 'Templates' : 'Modèles', icon: LayoutTemplate },
      { id: 'media', label: isEn ? 'Scenes' : 'Scènes', icon: Film, badge: scenes.length },
      { id: 'text', label: isEn ? 'Text' : 'Texte', icon: Type },
      { id: 'elements', label: isEn ? 'Elements' : 'Éléments', icon: Shapes },
      { id: 'audio', label: isEn ? 'Audio' : 'Audio', icon: Music, badge: audioTracks.length },
      { id: 'online', label: isEn ? 'Online' : 'En ligne', icon: Globe },
      { id: 'layers', label: isEn ? 'Layers' : 'Calques', icon: Layers, badge: overlays.length },
      {
        id: 'shalom',
        label: 'SHALOM',
        icon: FolderHeart,
        badge: customTemplates.filter((t) => t.studioType === 'video').length,
      },
      {
        id: 'projects',
        label: isEn ? 'Projects' : 'Projets',
        icon: Archive,
        badge: savedVideoProjects.length,
      },
    ],
    [isEn, scenes.length, audioTracks.length, overlays.length, customTemplates, savedVideoProjects.length]
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
                placeholder={isEn ? 'Verse, church, reel...' : 'Verset, culte, témoignage...'}
                className="w-full pl-8 pr-2.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700"
              />
            </div>
            <button
              type="button"
              onClick={() => handleSearchOnlineTemplates()}
              disabled={isSearchingOnline}
              className="px-3 py-2 rounded-xl bg-blue-700 text-white font-bold"
            >
              {isSearchingOnline ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Globe className="w-3.5 h-3.5" />}
            </button>
          </div>

          <HorizontalScrollRail wrapOnDesktop innerClassName="gap-1">
            {['all', 'Verset', 'Église', 'Témoignage'].map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => {
                  setTemplateCategory(cat);
                  handleSearchOnlineTemplates(templateQuery, cat, 1);
                }}
                className={`shrink-0 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold whitespace-nowrap ${
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
            <div className="text-[11px] text-blue-600 dark:text-blue-400 font-medium">
              {onlineStatusMsg}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-2.5">
            {displayedVideoTemplates.map((tpl) => {
              const title = isEn ? tpl.titleEn : tpl.titleFr;
              const desc = isEn ? tpl.descEn : tpl.descFr;
              const isSaving = savingResourceId === tpl.id;
              const isSaved = customTemplates.some(
                (t) => t.id === tpl.id && t.studioType === 'video'
              );
              return (
                <TemplatePreviewCard
                  key={tpl.id}
                  id={tpl.id}
                  kind="video"
                  title={title}
                  category={tpl.category}
                  subtitle={desc}
                  aspect={tpl.aspect}
                  bgColor1={tpl.bgColor}
                  scenes={tpl.scenes as unknown as Array<Record<string, unknown>>}
                  overlays={tpl.overlays as unknown as Array<Record<string, unknown>>}
                  isSaved={isSaved}
                  isSavingOffline={isSaving}
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
              onClick={() =>
                handleSearchOnlineTemplates(undefined, undefined, onlineTemplates.length ? 2 : 1)
              }
              className="w-full py-2 rounded-xl border border-blue-300 dark:border-blue-800 text-blue-700 dark:text-blue-400 font-bold"
            >
              {isLoadingMoreTemplates ? (isEn ? 'Loading...' : 'Chargement...') : isEn ? 'Load more' : 'Charger plus'}
            </button>
          )}
        </div>
      );
    }

    if (activeToolTab === 'media') {
      return (
        <div className="space-y-3 text-xs">
          <div className="grid grid-cols-2 gap-2">
            <label className="min-h-[44px] px-2.5 py-2 rounded-xl bg-blue-700 hover:bg-blue-800 text-white font-bold flex items-center justify-center gap-1.5 cursor-pointer text-center">
              <Upload className="w-4 h-4 shrink-0" />
              <span>{isEn ? 'Photos/Videos' : 'Vidéo / Photo'}</span>
              <input
                type="file"
                accept="image/*,video/*"
                multiple
                onChange={handleImportMediaFiles}
                className="hidden"
              />
            </label>
            <button
              type="button"
              onClick={addBlankCustomScene}
              className="min-h-[44px] px-2.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-extrabold flex items-center justify-center gap-1.5"
            >
              <Plus className="w-4 h-4 shrink-0" />
              <span>{isEn ? 'Title Slide' : 'Scène Texte'}</span>
            </button>
          </div>

          <div className="space-y-1.5">
            <div className="font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
              <ImageIcon className="w-3.5 h-3.5 text-amber-500" />
              <span>{isEn ? 'Editorial Backdrops (Offline)' : 'Décors animés hors-ligne'}</span>
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              {STUDIO_BACKDROP_PHOTOS.map((bg) => (
                <button
                  key={bg.id}
                  type="button"
                  onClick={() => handleImportBuiltInBackdropScene(bg)}
                  className="group relative h-20 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700"
                >
                  <img
                    src={bg.src}
                    alt={isEn ? bg.nameEn : bg.nameFr}
                    className="w-full h-full object-cover group-hover:scale-105 transition"
                  />
                  <div className="absolute inset-x-0 bottom-0 bg-slate-950/75 px-1.5 py-0.5 text-[10px] font-bold text-white truncate">
                    {isEn ? bg.nameEn : bg.nameFr}
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
              <VideoIcon className="w-3.5 h-3.5 text-blue-500" />
              <span>{isEn ? 'Parole Divine Clips' : 'Depuis Parole Divine'}</span>
            </div>
            {recordings.length === 0 ? (
              <p className="text-[11px] text-slate-500 italic">
                {isEn ? 'No recordings in Parole Divine.' : 'Aucun enregistrement disponible.'}
              </p>
            ) : (
              <div className="space-y-1 max-h-44 overflow-y-auto">
                {recordings.slice(0, 10).map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => handleImportFromParole(r.id)}
                    className="w-full text-left p-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-blue-400 flex items-center justify-between gap-2"
                  >
                    <span className="font-semibold truncate">{r.title}</span>
                    <span className="text-[10px] font-bold text-blue-600 shrink-0">
                      + {r.mediaType === 'audio' ? 'Audio' : 'Scène'}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      );
    }

    if (activeToolTab === 'text') {
      return (
        <div className="space-y-2.5 text-xs">
          <div className="font-bold text-slate-800 dark:text-slate-100">
            {isEn ? 'Add Animated Text Overlay' : 'Ajouter un calque texte animé'}
          </div>
          {[
            { id: 'title' as const, label: isEn ? 'Impact Title' : 'Titre impactant', desc: 'Grand format haut' },
            { id: 'verse' as const, label: isEn ? 'Bible Verse Card' : 'Verset biblique', desc: 'Cartouche élégant' },
            { id: 'lower_third' as const, label: isEn ? 'Speaker Banner' : 'Bandeau Orateur', desc: 'Tiers inférieur' },
            { id: 'watermark' as const, label: 'Signature SHALOM', desc: 'Discret en coin' },
          ].map((preset) => (
            <button
              key={preset.id}
              type="button"
              onClick={() => addTextPresetOverlay(preset.id)}
              className="w-full text-left p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-blue-500 flex items-center justify-between"
            >
              <div>
                <div className="font-bold text-slate-900 dark:text-white">{preset.label}</div>
                <div className="text-[10px] text-slate-500">{preset.desc}</div>
              </div>
              <Plus className="w-4 h-4 text-blue-600" />
            </button>
          ))}
        </div>
      );
    }

    if (activeToolTab === 'elements') {
      return (
        <div className="space-y-3 text-xs">
          <label className="w-full min-h-[44px] px-3 py-2 rounded-xl bg-blue-700 hover:bg-blue-800 text-white font-bold flex items-center justify-center gap-2 cursor-pointer">
            <ImageIcon className="w-4 h-4" />
            <span>{isEn ? 'Overlay PNG / Logo' : 'Importer un logo / image calque'}</span>
            <input
              type="file"
              accept="image/*"
              onChange={handleUploadImageOverlay}
              className="hidden"
            />
          </label>

          {/* Online PNG & Illustrated Elements Search (Zero SVG) */}
          <div className="pt-2 border-t border-slate-200 dark:border-slate-800 space-y-2">
            <div className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
              <Globe className="w-3.5 h-3.5 text-blue-600" />
              <span>
                {isEn
                  ? 'Online Graphic Elements (PNG & Illustrations)'
                  : 'Éléments graphiques en ligne (PNG & Illustrations)'}
              </span>
            </div>
            <div className="flex gap-1.5">
              <input
                type="text"
                value={onlineElementQuery}
                onChange={(e) => setOnlineElementQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearchOnlineElements()}
                placeholder={isEn ? 'dove, bible, cross, flowers...' : 'colombe, livre, croix, lumière...'}
                className="flex-1 px-2.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700"
              />
              <button
                type="button"
                onClick={() => handleSearchOnlineElements()}
                disabled={isSearchingElements}
                className="px-3 py-2 rounded-xl bg-blue-700 text-white font-bold"
              >
                {isSearchingElements ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
              </button>
            </div>
            {elementsError && (
              <div className="p-2 rounded-lg bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-300 text-[11px]">
                {elementsError}
              </div>
            )}
            <div className="grid grid-cols-3 gap-1.5">
              {onlineElements.map((asset) => (
                <div
                  key={asset.id}
                  className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-1.5 flex flex-col items-center gap-1"
                >
                  <button
                    type="button"
                    disabled={loadingElementAssetId === asset.id}
                    onClick={() => handleInsertOnlineElementOverlay(asset)}
                    className="w-full h-14 flex items-center justify-center bg-slate-50 dark:bg-slate-950 rounded-lg overflow-hidden"
                    title={asset.title}
                  >
                    {loadingElementAssetId === asset.id ? (
                      <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                    ) : (
                      <img src={asset.previewUrl} alt={asset.title} className="w-11 h-11 object-contain" />
                    )}
                  </button>
                  <span className="text-[9px] text-slate-600 dark:text-slate-300 truncate w-full text-center">
                    {asset.title}
                  </span>
                  <button
                    type="button"
                    disabled={savingResourceId === asset.id}
                    onClick={() => handleSaveElementAssetToShalom(asset)}
                    className="w-full py-1 rounded-md bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 text-[9px] font-bold truncate px-1"
                  >
                    {savingResourceId === asset.id ? '...' : '+ SHALOM'}
                  </button>
                </div>
              ))}
            </div>
            {onlineElementHasMore && onlineElements.length > 0 && (
              <button
                type="button"
                onClick={() => handleSearchOnlineElements(undefined, onlineElementPage + 1)}
                className="w-full py-2 rounded-xl border border-blue-300 text-blue-700 font-bold"
              >
                {isEn ? 'Load more elements' : 'Charger plus d’éléments'}
              </button>
            )}
          </div>

          <div className="pt-2 border-t border-slate-200 dark:border-slate-800 space-y-2">
            <div className="font-bold text-slate-800 dark:text-slate-100">
              {isEn ? 'SHALOM Geometric Shapes' : 'Formes & Symboles SHALOM'}
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              {VECTOR_ELEMENT_CATALOG.map((el) => (
                <button
                  key={el.id}
                  type="button"
                  onClick={() => addShapeElementOverlay(el.id, isEn ? el.labelEn : el.labelFr)}
                  className="p-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-amber-500 flex flex-col items-center gap-1"
                >
                  <VectorPreviewSvg kind={el.id} className="w-7 h-7" primaryColor="#d97706" strokeColor="#1e3a8a" />
                  <span className="text-[10px] font-semibold truncate w-full text-center">
                    {isEn ? el.labelEn : el.labelFr}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      );
    }

    if (activeToolTab === 'audio') {
      return (
        <div className="space-y-3 text-xs">
          <div className="grid grid-cols-2 gap-1.5">
            <button
              type="button"
              onClick={handleToggleVoiceoverRecord}
              className={`min-h-[44px] px-2.5 py-2 rounded-xl font-bold flex items-center justify-center gap-1.5 ${
                isRecordingVoiceover
                  ? 'bg-rose-600 text-white animate-pulse'
                  : 'bg-blue-700 hover:bg-blue-800 text-white'
              }`}
            >
              {isRecordingVoiceover ? <Square className="w-4 h-4 fill-current" /> : <Mic className="w-4 h-4" />}
              <span className="tabular-nums">
                {isRecordingVoiceover ? `Stop (${voSeconds}s)` : isEn ? 'Voiceover' : 'Voix-off'}
              </span>
            </button>

            <label className="min-h-[44px] px-2.5 py-2 rounded-xl bg-slate-900 dark:bg-slate-800 text-white font-bold flex items-center justify-center gap-1.5 cursor-pointer">
              <Upload className="w-4 h-4" />
              <span>{isEn ? 'Audio File' : 'MP3/WAV'}</span>
              <input
                type="file"
                accept="audio/*"
                multiple
                onChange={handleImportAudioTrack}
                className="hidden"
              />
            </label>
          </div>

          <div className="space-y-1.5">
            <div className="font-bold text-slate-700 dark:text-slate-200">
              {isEn ? 'Built-in Ambient Worship Music' : 'Fonds musicaux intégrés'}
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              <button
                type="button"
                onClick={() => handleAddBuiltInWorshipMusic('c_major')}
                className="p-2 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 font-bold text-amber-800 dark:text-amber-300"
              >
                + Do Majeur
              </button>
              <button
                type="button"
                onClick={() => handleAddBuiltInWorshipMusic('g_warm')}
                className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 font-bold text-emerald-800 dark:text-emerald-300"
              >
                + Sol Paix
              </button>
            </div>
          </div>

          {audioTracks.length > 0 && (
            <div className="space-y-1.5">
              <div className="font-bold">{isEn ? 'Audio Lanes' : 'Pistes audio'}</div>
              {audioTracks.map((tr) => (
                <div
                  key={tr.id}
                  onClick={() => {
                    setSelectedAudioTrackId(tr.id);
                    setSelectedOverlayId(null);
                    setIsInspectorOpen(true);
                  }}
                  className={`p-2 rounded-xl border cursor-pointer flex items-center justify-between gap-2 ${
                    selectedAudioTrackId === tr.id
                      ? 'bg-purple-50 dark:bg-purple-950/30 border-purple-400'
                      : 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800'
                  }`}
                >
                  <span className="truncate font-semibold">{tr.name}</span>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        updateAudioTrack(tr.id, { muted: !tr.muted });
                      }}
                      className="p-1 text-slate-500"
                    >
                      {tr.muted ? <VolumeX className="w-3.5 h-3.5 text-rose-500" /> : <Volume2 className="w-3.5 h-3.5" />}
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeAudioTrack(tr.id);
                      }}
                      className="p-1 text-rose-500"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
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
                value={onlineVideoQuery}
                onChange={(e) => setOnlineVideoQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSearchOnlineVideoMedia();
                }}
                placeholder={isEn ? 'Sky, sunset, nature, church...' : 'Ciel, aurore, nature, église...'}
                className="w-full pl-8 pr-2.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700"
              />
            </div>
            <button
              type="button"
              onClick={() => handleSearchOnlineVideoMedia()}
              disabled={isSearchingOnlineVideo}
              className="px-3 py-2 rounded-xl bg-blue-700 text-white font-bold"
            >
              {isSearchingOnlineVideo ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
            </button>
          </div>

          <HorizontalScrollRail wrapOnDesktop innerClassName="gap-1">
            {['sunrise', 'clouds', 'ocean', 'flowers', 'candles', 'church'].map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => {
                  setOnlineVideoQuery(tag);
                  handleSearchOnlineVideoMedia(tag, 1);
                }}
                className="shrink-0 px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-[11px] font-semibold whitespace-nowrap"
              >
                {tag}
              </button>
            ))}
          </HorizontalScrollRail>

          {onlineVideoError && (
            <div className="p-2 rounded-lg bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-300 text-[11px]">
              {onlineVideoError}
            </div>
          )}

          <div className="space-y-2">
            {onlineVideoItems.map((item) => {
              const isBusy = loadingOnlineVideoId === item.id;
              const isSaving = savingResourceId === item.id;
              return (
                <div
                  key={item.id}
                  className="p-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2"
                >
                  {item.previewUrl && (
                    <img
                      src={item.previewUrl}
                      alt={item.title}
                      className="w-full h-24 object-cover rounded-lg"
                    />
                  )}
                  <div className="font-bold truncate">{item.title}</div>
                  <div className="flex flex-wrap gap-1">
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => handleInsertOnlineMediaToScene(item)}
                      className="flex-1 min-h-[34px] px-2 py-1 rounded-lg bg-blue-700 text-white font-bold text-[11px]"
                    >
                      {isBusy ? '...' : isEn ? '+ Scene' : '+ Scène'}
                    </button>
                    <button
                      type="button"
                      disabled={isSaving}
                      onClick={() => handleSaveOnlineMediaToShalom(item)}
                      className="min-h-[34px] px-2 py-1 rounded-lg bg-amber-500 text-slate-950 font-extrabold text-[11px] flex items-center gap-1"
                    >
                      {isSaving ? <Loader2 className="w-3 h-3 animate-spin" /> : <BookmarkPlus className="w-3 h-3" />}
                      <span>SHALOM</span>
                    </button>
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => handleDownloadOnlineMedia(item)}
                      className="min-h-[34px] px-2 py-1 rounded-lg bg-slate-200 dark:bg-slate-800"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => handleShareOnlineMediaDirect(item)}
                      className="min-h-[34px] px-2 py-1 rounded-lg bg-emerald-600 text-white"
                    >
                      <Share2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {onlineVideoHasMore && (
            <button
              type="button"
              onClick={() => handleSearchOnlineVideoMedia(undefined, onlineVideoPage + 1)}
              className="w-full py-2 rounded-xl border border-blue-300 text-blue-700 font-bold"
            >
              {isEn ? 'Load more' : 'Charger plus'}
            </button>
          )}
        </div>
      );
    }

    if (activeToolTab === 'layers') {
      return (
        <div className="space-y-2 text-xs">
          <div className="font-bold text-slate-800 dark:text-slate-100">
            {isEn ? 'Overlay Stacking Order' : 'Ordre des calques vidéo'} ({overlays.length})
          </div>
          {overlays.length === 0 ? (
            <p className="text-[11px] text-slate-500 italic">
              {isEn ? 'No overlays added yet.' : 'Aucun calque superposé pour l’instant.'}
            </p>
          ) : (
            <div className="space-y-1.5">
              {overlays.map((ov, idx) => (
                <div
                  key={ov.id}
                  draggable
                  onDragStart={() => setDraggedOverlayId(ov.id)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => {
                    if (draggedOverlayId) reorderOverlayByDrop(draggedOverlayId, ov.id);
                    setDraggedOverlayId(null);
                  }}
                  onClick={() => {
                    setSelectedOverlayId(ov.id);
                    setPreviewTimeSec(ov.startSec + 0.05);
                    setIsInspectorOpen(true);
                  }}
                  className={`p-2 rounded-xl border cursor-pointer flex items-center justify-between gap-1.5 ${
                    selectedOverlayId === ov.id
                      ? 'bg-blue-50 dark:bg-blue-950/30 border-blue-500'
                      : 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800'
                  }`}
                >
                  <div className="flex items-center gap-1.5 min-w-0">
                    <GripVertical className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span className="font-bold truncate">{ov.label}</span>
                  </div>
                  <div className="flex items-center gap-0.5 shrink-0">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        moveOverlayOrder(idx, -1);
                      }}
                      disabled={idx === 0}
                      className="p-1 text-slate-500 disabled:opacity-30"
                    >
                      <ArrowUp className="w-3 h-3" />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        moveOverlayOrder(idx, 1);
                      }}
                      disabled={idx === overlays.length - 1}
                      className="p-1 text-slate-500 disabled:opacity-30"
                    >
                      <ArrowDown className="w-3 h-3" />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeOverlay(ov.id);
                      }}
                      className="p-1 text-rose-500"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      );
    }

    if (activeToolTab === 'shalom') {
      return (
        <ShalomResourcesPanel
          studioType="video"
          savedItems={customTemplates}
          isEn={isEn}
          onApplyItem={handleApplyShalomResource}
          onDeleteItem={handleDeleteShalomResource}
        />
      );
    }

    if (activeToolTab === 'projects') {
      return (
        <div className="space-y-2 text-xs">
          {savedVideoProjects.length === 0 ? (
            <p className="text-[11px] text-slate-500 italic text-center p-3">
              {isEn ? 'No saved video projects yet.' : 'Aucun projet vidéo sauvegardé.'}
            </p>
          ) : (
            savedVideoProjects.map((proj) => (
              <div
                key={proj.id}
                className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2"
              >
                <div className="min-w-0">
                  <div className="font-bold truncate">{proj.title}</div>
                  <div className="text-[10px] text-slate-500">
                    {proj.format} · {proj.durationSeconds || 0}s
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

  // RIGHT INSPECTOR PANEL (Overlay / Audio Track / Scene)
  const renderInspectorContent = () => {
    if (selectedOverlay) {
      return (
        <div className="space-y-3 text-xs">
          <div className="flex items-center justify-between gap-2">
            <span className="font-extrabold truncate">{selectedOverlay.label}</span>
            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={() => duplicateOverlay(selectedOverlay)}
                className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800"
              >
                <Copy className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => removeOverlay(selectedOverlay.id)}
                className="p-1.5 rounded-lg bg-rose-50 dark:bg-rose-950/30 text-rose-600"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {selectedOverlay.kind === 'text' && (
            <>
              <textarea
                rows={3}
                value={selectedOverlay.text || ''}
                onChange={(e) => updateOverlay(selectedOverlay.id, { text: e.target.value })}
                className="w-full p-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700"
              />
              <div className="flex flex-wrap gap-1">
                <button
                  type="button"
                  onClick={() =>
                    updateOverlay(selectedOverlay.id, { bold: selectedOverlay.bold === false })
                  }
                  className={`p-1.5 rounded-lg ${
                    selectedOverlay.bold !== false ? 'bg-blue-700 text-white' : 'bg-slate-100 dark:bg-slate-800'
                  }`}
                >
                  <Bold className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => updateOverlay(selectedOverlay.id, { italic: !selectedOverlay.italic })}
                  className={`p-1.5 rounded-lg ${
                    selectedOverlay.italic ? 'bg-blue-700 text-white' : 'bg-slate-100 dark:bg-slate-800'
                  }`}
                >
                  <Italic className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() =>
                    updateOverlay(selectedOverlay.id, { underline: !selectedOverlay.underline })
                  }
                  className={`p-1.5 rounded-lg ${
                    selectedOverlay.underline ? 'bg-blue-700 text-white' : 'bg-slate-100 dark:bg-slate-800'
                  }`}
                >
                  <Underline className="w-3.5 h-3.5" />
                </button>
                {(['left', 'center', 'right'] as const).map((al) => (
                  <button
                    key={al}
                    type="button"
                    onClick={() => updateOverlay(selectedOverlay.id, { textAlign: al })}
                    className={`p-1.5 rounded-lg ${
                      (selectedOverlay.textAlign || 'center') === al
                        ? 'bg-blue-700 text-white'
                        : 'bg-slate-100 dark:bg-slate-800'
                    }`}
                  >
                    {al === 'left' ? (
                      <AlignLeft className="w-3.5 h-3.5" />
                    ) : al === 'center' ? (
                      <AlignCenter className="w-3.5 h-3.5" />
                    ) : (
                      <AlignRight className="w-3.5 h-3.5" />
                    )}
                  </button>
                ))}
              </div>
              <select
                value={selectedOverlay.fontFamily || '"Outfit", sans-serif'}
                onChange={(e) => updateOverlay(selectedOverlay.id, { fontFamily: e.target.value })}
                className="w-full px-2.5 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700"
              >
                {STUDIO_FONTS.map((f) => (
                  <option key={f.value} value={f.value}>
                    {f.label}
                  </option>
                ))}
              </select>
            </>
          )}

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                {isEn ? 'Start (s)' : 'Début (s)'}
              </label>
              <input
                type="number"
                step={0.1}
                min={0}
                value={selectedOverlay.startSec}
                onChange={(e) =>
                  updateOverlay(selectedOverlay.id, {
                    startSec: Math.max(0, Number(e.target.value) || 0),
                  })
                }
                className="w-full px-2 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 tabular-nums"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                {isEn ? 'End (s)' : 'Fin (s)'}
              </label>
              <input
                type="number"
                step={0.1}
                min={selectedOverlay.startSec + 0.3}
                value={selectedOverlay.endSec}
                onChange={(e) =>
                  updateOverlay(selectedOverlay.id, {
                    endSec: Math.max(selectedOverlay.startSec + 0.3, Number(e.target.value) || 1),
                  })
                }
                className="w-full px-2 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 tabular-nums"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                {isEn ? 'Size' : 'Taille'} ({selectedOverlay.size})
              </label>
              <input
                type="range"
                min={18}
                max={340}
                value={selectedOverlay.size}
                onChange={(e) => updateOverlay(selectedOverlay.id, { size: Number(e.target.value) })}
                className="w-full accent-blue-700"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                {selectedOverlay.kind === 'image'
                  ? `${isEn ? 'Opacity' : 'Opacité'} (${Math.round(selectedOverlay.opacity * 100)}%)`
                  : isEn
                    ? 'Color'
                    : 'Couleur'}
              </label>
              {selectedOverlay.kind === 'image' ? (
                <input
                  type="range"
                  min={0.1}
                  max={1}
                  step={0.05}
                  value={selectedOverlay.opacity}
                  onChange={(e) =>
                    updateOverlay(selectedOverlay.id, { opacity: Number(e.target.value) })
                  }
                  className="w-full mt-2 accent-blue-700"
                />
              ) : (
                <input
                  type="color"
                  value={selectedOverlay.color}
                  onChange={(e) => updateOverlay(selectedOverlay.id, { color: e.target.value })}
                  className="w-full h-8 rounded-lg cursor-pointer"
                />
              )}
            </div>
          </div>

          {selectedOverlay.kind === 'image' && selectedOverlay.imageEl && (
            <div className="grid grid-cols-2 gap-1.5">
              <button
                type="button"
                onClick={() => setCropTarget({ kind: 'overlay', id: selectedOverlay.id })}
                className="min-h-[38px] px-2.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold flex items-center justify-center gap-1"
              >
                <Crop className="w-3.5 h-3.5" />
                <span>{isEn ? 'Crop' : 'Recadrer'}</span>
              </button>
              <label className="min-h-[38px] px-2.5 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 font-bold flex items-center justify-center gap-1 cursor-pointer">
                <ImageIcon className="w-3.5 h-3.5" />
                <span>{isEn ? 'Replace' : 'Remplacer'}</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleReplaceImageOverlay(selectedOverlay.id, e)}
                  className="hidden"
                />
              </label>
            </div>
          )}

          <div className="flex flex-wrap gap-1.5">
            {(['none', 'fade-in', 'slide-up'] as OverlayAnimation[]).map((an) => (
              <button
                key={an}
                type="button"
                onClick={() => updateOverlay(selectedOverlay.id, { animation: an })}
                className={`px-2 py-1 rounded-lg font-semibold ${
                  selectedOverlay.animation === an
                    ? 'bg-amber-500 text-slate-950'
                    : 'bg-slate-100 dark:bg-slate-800'
                }`}
              >
                {an}
              </button>
            ))}
          </div>
        </div>
      );
    }

    if (selectedAudioTrack) {
      const bufDur = selectedAudioTrack.audioBuffer?.duration || Math.max(selectedAudioTrack.trimEndSec, 8);
      return (
        <div className="space-y-3 text-xs">
          <div className="flex items-center justify-between gap-2">
            <span className="font-extrabold truncate">{selectedAudioTrack.name}</span>
            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={() => splitAudioTrackAtPlayhead(selectedAudioTrack)}
                title={isEn ? 'Split at playhead' : 'Scinder au curseur'}
                className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800"
              >
                <Scissors className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => removeAudioTrack(selectedAudioTrack.id)}
                className="p-1.5 rounded-lg bg-rose-50 text-rose-600"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[11px] text-slate-500 mb-1">Début timeline (s)</label>
              <input
                type="number"
                min={0}
                step={0.1}
                value={selectedAudioTrack.startSec}
                onChange={(e) =>
                  updateAudioTrack(selectedAudioTrack.id, {
                    startSec: Math.max(0, Number(e.target.value) || 0),
                  })
                }
                className="w-full px-2 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 tabular-nums"
              />
            </div>
            <div>
              <label className="block text-[11px] text-slate-500 mb-1">
                Volume ({Math.round(selectedAudioTrack.volume * 100)}%)
              </label>
              <input
                type="range"
                min={0}
                max={1.5}
                step={0.05}
                value={selectedAudioTrack.volume}
                onChange={(e) =>
                  updateAudioTrack(selectedAudioTrack.id, { volume: Number(e.target.value) })
                }
                className="w-full mt-2 accent-blue-700"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[11px] text-slate-500 mb-1">Trim In (s)</label>
              <input
                type="number"
                min={0}
                max={Math.max(0, selectedAudioTrack.trimEndSec - 0.2)}
                step={0.1}
                value={selectedAudioTrack.trimStartSec}
                onChange={(e) =>
                  updateAudioTrack(selectedAudioTrack.id, {
                    trimStartSec: Math.max(
                      0,
                      Math.min(selectedAudioTrack.trimEndSec - 0.2, Number(e.target.value) || 0)
                    ),
                  })
                }
                className="w-full px-2 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 tabular-nums"
              />
            </div>
            <div>
              <label className="block text-[11px] text-slate-500 mb-1">Trim Out (s)</label>
              <input
                type="number"
                min={selectedAudioTrack.trimStartSec + 0.2}
                max={Number(bufDur.toFixed(2))}
                step={0.1}
                value={selectedAudioTrack.trimEndSec}
                onChange={(e) =>
                  updateAudioTrack(selectedAudioTrack.id, {
                    trimEndSec: Math.min(
                      bufDur,
                      Math.max(selectedAudioTrack.trimStartSec + 0.2, Number(e.target.value) || bufDur)
                    ),
                  })
                }
                className="w-full px-2 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 tabular-nums"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[11px] text-slate-500 mb-1">Fade In (s)</label>
              <input
                type="number"
                min={0}
                max={5}
                step={0.1}
                value={selectedAudioTrack.fadeInSec}
                onChange={(e) =>
                  updateAudioTrack(selectedAudioTrack.id, {
                    fadeInSec: Math.max(0, Number(e.target.value) || 0),
                  })
                }
                className="w-full px-2 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 tabular-nums"
              />
            </div>
            <div>
              <label className="block text-[11px] text-slate-500 mb-1">Fade Out (s)</label>
              <input
                type="number"
                min={0}
                max={5}
                step={0.1}
                value={selectedAudioTrack.fadeOutSec}
                onChange={(e) =>
                  updateAudioTrack(selectedAudioTrack.id, {
                    fadeOutSec: Math.max(0, Number(e.target.value) || 0),
                  })
                }
                className="w-full px-2 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 tabular-nums"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] text-slate-500 mb-1 tabular-nums">
              {isEn ? 'Speed' : 'Vitesse'} ({(selectedAudioTrack.playbackRate || 1).toFixed(2)}x)
            </label>
            <input
              type="range"
              min={0.5}
              max={1.75}
              step={0.05}
              value={selectedAudioTrack.playbackRate || 1}
              onChange={(e) =>
                updateAudioTrack(selectedAudioTrack.id, { playbackRate: Number(e.target.value) })
              }
              className="w-full accent-blue-700"
            />
          </div>
        </div>
      );
    }

    if (selectedScene) {
      return (
        <div className="space-y-3 text-xs">
          <div className="flex items-center justify-between gap-2">
            <span className="font-extrabold truncate">{selectedScene.name}</span>
            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={() => splitSceneInTwo(selectedScene)}
                title={isEn ? 'Split at playhead' : 'Scinder au curseur rouge'}
                className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800"
              >
                <Scissors className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => duplicateScene(selectedScene)}
                className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800"
              >
                <Copy className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => removeScene(selectedScene.id)}
                className="p-1.5 rounded-lg bg-rose-50 text-rose-600"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {selectedScene.kind === 'custom' && (
            <>
              <textarea
                rows={3}
                value={selectedScene.text}
                onChange={(e) => updateScene(selectedScene.id, { text: e.target.value })}
                className="w-full p-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700"
              />
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] text-slate-500 mb-1">Fond 1</label>
                  <input
                    type="color"
                    value={selectedScene.bgColor}
                    onChange={(e) => updateScene(selectedScene.id, { bgColor: e.target.value })}
                    className="w-full h-8 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-500 mb-1">Fond 2</label>
                  <input
                    type="color"
                    value={selectedScene.bgColor2}
                    onChange={(e) => updateScene(selectedScene.id, { bgColor2: e.target.value })}
                    className="w-full h-8 rounded-lg"
                  />
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {SHALOM_COLOR_PALETTES.map((pal) => (
                  <button
                    key={pal.name}
                    type="button"
                    onClick={() =>
                      updateScene(selectedScene.id, {
                        bgType: 'gradient',
                        bgColor: pal.colors[0],
                        bgColor2: pal.colors[1],
                        textColor: pal.colors[3] || '#ffffff',
                        shapeColor: pal.colors[2] || '#f59e0b',
                      })
                    }
                    className="w-7 h-7 rounded-full border border-white/60 shadow-xs"
                    style={{ background: `linear-gradient(135deg, ${pal.colors[0]}, ${pal.colors[1]})` }}
                    title={pal.name}
                  />
                ))}
              </div>
            </>
          )}

          {selectedScene.kind === 'image' && selectedScene.imageEl && (
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  onClick={() => setCropTarget({ kind: 'scene', id: selectedScene.id })}
                  className="min-h-[38px] px-2.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold flex items-center justify-center gap-1"
                >
                  <Crop className="w-3.5 h-3.5" />
                  <span>{isEn ? 'Crop' : 'Recadrer'}</span>
                </button>
                <label className="min-h-[38px] px-2.5 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 font-bold flex items-center justify-center gap-1 cursor-pointer">
                  <ImageIcon className="w-3.5 h-3.5" />
                  <span>{isEn ? 'Replace' : 'Remplacer'}</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleReplaceImageScene(selectedScene.id, e)}
                    className="hidden"
                  />
                </label>
              </div>
              <div className="flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() =>
                    updateScene(selectedScene.id, {
                      fitMode: selectedScene.fitMode === 'cover' ? 'contain' : 'cover',
                    })
                  }
                  className="flex-1 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 font-semibold"
                >
                  {selectedScene.fitMode === 'cover' ? 'Remplir (Cover)' : 'Ajuster (Contain)'}
                </button>
                <button
                  type="button"
                  onClick={() =>
                    updateScene(selectedScene.id, { kenBurns: !selectedScene.kenBurns })
                  }
                  className={`flex-1 py-1.5 rounded-lg font-semibold ${
                    selectedScene.kenBurns ? 'bg-blue-700 text-white' : 'bg-slate-100 dark:bg-slate-800'
                  }`}
                >
                  Zoom Ken Burns
                </button>
              </div>
            </div>
          )}

          {selectedScene.kind === 'video' ? (
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] text-slate-500 mb-1">Trim In (s)</label>
                  <input
                    type="number"
                    step={0.1}
                    min={0}
                    value={selectedScene.trimStartSec}
                    onChange={(e) =>
                      updateScene(selectedScene.id, {
                        trimStartSec: Math.max(0, Number(e.target.value) || 0),
                      })
                    }
                    className="w-full px-2 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 tabular-nums"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-500 mb-1">Trim Out (s)</label>
                  <input
                    type="number"
                    step={0.1}
                    min={selectedScene.trimStartSec + 0.5}
                    value={selectedScene.trimEndSec}
                    onChange={(e) =>
                      updateScene(selectedScene.id, {
                        trimEndSec: Math.max(selectedScene.trimStartSec + 0.5, Number(e.target.value) || 1),
                      })
                    }
                    className="w-full px-2 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 tabular-nums"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] text-slate-500 mb-1 tabular-nums">
                    Volume ({Math.round(selectedScene.volume * 100)}%)
                  </label>
                  <input
                    type="range"
                    min={0}
                    max={1.5}
                    step={0.05}
                    value={selectedScene.volume}
                    onChange={(e) =>
                      updateScene(selectedScene.id, { volume: Number(e.target.value) })
                    }
                    className="w-full accent-blue-700"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-500 mb-1 tabular-nums">
                    {isEn ? 'Speed' : 'Vitesse'} ({selectedScene.playbackRate.toFixed(2)}x)
                  </label>
                  <input
                    type="range"
                    min={0.5}
                    max={2}
                    step={0.1}
                    value={selectedScene.playbackRate}
                    onChange={(e) =>
                      updateScene(selectedScene.id, { playbackRate: Number(e.target.value) })
                    }
                    className="w-full accent-blue-700"
                  />
                </div>
              </div>
            </div>
          ) : (
            <div>
              <label className="block text-[11px] text-slate-500 mb-1 tabular-nums">
                {isEn ? 'Duration' : 'Durée'} : {selectedScene.durationSec}s
              </label>
              <input
                type="range"
                min={1}
                max={20}
                step={0.5}
                value={selectedScene.durationSec}
                onChange={(e) =>
                  updateScene(selectedScene.id, { durationSec: Number(e.target.value) })
                }
                className="w-full accent-blue-700"
              />
            </div>
          )}

          <div>
            <span className="block text-[11px] font-semibold text-slate-500 mb-1">Transition</span>
            <div className="flex flex-wrap gap-1">
              {(['none', 'fade', 'slide', 'zoom'] as SceneTransition[]).map((tr) => (
                <button
                  key={tr}
                  type="button"
                  onClick={() => updateScene(selectedScene.id, { transition: tr })}
                  className={`px-2 py-1 rounded-lg font-semibold ${
                    selectedScene.transition === tr
                      ? 'bg-blue-700 text-white'
                      : 'bg-slate-100 dark:bg-slate-800'
                  }`}
                >
                  {tr}
                </button>
              ))}
            </div>
          </div>

          <div>
            <span className="block text-[11px] font-semibold text-slate-500 mb-1">Filtre</span>
            <div className="flex flex-wrap gap-1">
              {(['none', 'warm', 'bw', 'vivid'] as SceneFilter[]).map((fl) => (
                <button
                  key={fl}
                  type="button"
                  onClick={() => updateScene(selectedScene.id, { filter: fl })}
                  className={`px-2 py-1 rounded-lg font-semibold ${
                    selectedScene.filter === fl
                      ? 'bg-amber-500 text-slate-950'
                      : 'bg-slate-100 dark:bg-slate-800'
                  }`}
                >
                  {fl}
                </button>
              ))}
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="p-4 text-center text-xs text-slate-500">
        {isEn
          ? 'Tap any scene, text overlay, graphic element or audio track to edit its properties.'
          : 'Sélectionnez une scène, un calque texte/image/forme ou une piste audio pour ajuster ses propriétés.'}
      </div>
    );
  };

  // SELECTION TOOLBAR ABOVE CANVAS
  const selectionToolbar = (
    <div className="flex flex-nowrap lg:flex-wrap items-center gap-1.5 w-max lg:w-full text-xs">
      <button
        type="button"
        onClick={handleTogglePreviewPlay}
        disabled={totalDurationSec <= 0}
        className={`shrink-0 min-h-[38px] px-3 py-1.5 rounded-lg font-bold flex items-center gap-1.5 whitespace-nowrap disabled:opacity-40 ${
          isPlayingPreview ? 'bg-rose-600 text-white' : 'bg-emerald-600 hover:bg-emerald-700 text-white'
        }`}
      >
        {isPlayingPreview ? <Square className="w-3.5 h-3.5 fill-current" /> : <Play className="w-3.5 h-3.5 fill-current" />}
        <span>{isPlayingPreview ? (isEn ? 'Stop' : 'Arrêter') : isEn ? 'Play' : 'Lire'}</span>
      </button>

      <div className="shrink-0 flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg">
        {(['9:16', '16:9', '1:1', '4:5'] as AspectMode[]).map((mode) => (
          <button
            key={mode}
            type="button"
            onClick={() => {
              pushHistory();
              setAspectMode(mode);
            }}
            className={`min-h-[32px] px-2 py-1 rounded-md text-[11px] font-bold whitespace-nowrap ${
              aspectMode === mode
                ? 'bg-white dark:bg-blue-700 text-blue-700 dark:text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-300'
            }`}
          >
            {mode}
          </button>
        ))}
      </div>

      <button
        type="button"
        onClick={() => setSnapEnabled((s) => !s)}
        className={`shrink-0 min-h-[36px] min-w-[36px] px-2.5 py-1 rounded-lg font-semibold flex items-center justify-center gap-1 ${
          snapEnabled
            ? 'bg-amber-500 text-slate-950'
            : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
        }`}
      >
        <Magnet className="w-3.5 h-3.5" />
      </button>

      <button
        type="button"
        onClick={handleCopySelection}
        disabled={!selectedOverlayId && !selectedSceneId}
        title="Ctrl+C"
        className="shrink-0 min-h-[36px] min-w-[36px] px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center disabled:opacity-40"
      >
        <Copy className="w-3.5 h-3.5" />
      </button>

      <button
        type="button"
        onClick={handlePasteSelection}
        disabled={!copiedOverlay && !copiedScene}
        title="Ctrl+V"
        className="shrink-0 min-h-[36px] min-w-[36px] px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center disabled:opacity-40"
      >
        <ClipboardPaste className="w-3.5 h-3.5" />
      </button>

      <button
        type="button"
        onClick={handleExportSnapshotPng}
        disabled={scenes.length === 0}
        title="Capture PNG"
        className="shrink-0 min-h-[36px] px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 font-semibold flex items-center gap-1 whitespace-nowrap disabled:opacity-40"
      >
        <Camera className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">PNG</span>
      </button>

      <div className="shrink-0 ml-auto flex items-center gap-1">
        <button
          type="button"
          onClick={() => setTimelineZoom((z) => Math.max(20, z - 10))}
          className="min-h-[36px] min-w-[36px] px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center"
        >
          <ZoomOut className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={() => setTimelineZoom((z) => Math.min(120, z + 10))}
          className="min-h-[36px] min-w-[36px] px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center"
        >
          <ZoomIn className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );

  // CENTER MONITOR + INTERACTIVE MULTI-LANE VIDEO TIMELINE
  const timelineSpanSec = Math.max(16, Math.ceil(totalDurationSec + 4));
  const timelineWidthPx = Math.max(580, timelineSpanSec * timelineZoom);

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
              ? 'An unsaved video session was found. Resume?'
              : 'Un brouillon vidéo automatique a été retrouvé. Reprendre ?'}
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

      {isExporting && (
        <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 flex items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 font-bold text-blue-800 dark:text-blue-200">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className="tabular-nums">
              {isEn ? 'Rendering WebM Video...' : 'Assemblage vidéo WebM...'} {exportProgress}%
            </span>
          </div>
          <button
            type="button"
            onClick={() => {
              cancelExportRef.current = true;
            }}
            className="px-2.5 py-1 rounded-lg bg-rose-600 text-white font-bold"
          >
            {isEn ? 'Cancel' : 'Annuler'}
          </button>
        </div>
      )}

      {/* Video Monitor Stage */}
      <div className="flex flex-col items-center justify-center rounded-2xl bg-slate-950 border border-slate-800 p-2.5 sm:p-3 relative min-h-[190px] sm:min-h-[260px]">
        <div className="relative flex items-center justify-center max-h-[32dvh] sm:max-h-[380px]">
          <canvas
            ref={canvasRef}
            onPointerDown={handleCanvasPointerDown}
            onPointerMove={handleCanvasPointerMove}
            onPointerUp={handleCanvasPointerUp}
            onPointerCancel={handleCanvasPointerUp}
            className="max-h-[30dvh] sm:max-h-[340px] lg:max-h-[360px] max-w-full rounded-xl shadow-2xl border border-slate-800 touch-none cursor-move bg-black"
          />

          {inlineEditTarget && (
            <div className="absolute inset-x-4 bottom-4 p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-blue-500 shadow-xl flex gap-2 z-30 text-xs">
              <input
                type="text"
                autoFocus
                value={inlineEditText}
                onChange={(e) => setInlineEditText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') commitInlineVideoTextEditor();
                  if (e.key === 'Escape') setInlineEditTarget(null);
                }}
                className="flex-1 px-2.5 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700"
              />
              <button
                type="button"
                onClick={commitInlineVideoTextEditor}
                className="px-3 py-1.5 rounded-lg bg-blue-700 text-white font-bold"
              >
                OK
              </button>
            </div>
          )}
        </div>

        <div className="mt-2 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[11px] text-slate-400">
          <span className="tabular-nums font-bold text-amber-400">
            {previewTimeSec.toFixed(1)}s / {totalDurationSec.toFixed(1)}s
          </span>
          <span className="flex items-center gap-1">
            <Edit3 className="w-3 h-3 shrink-0" />
            <span className="sm:hidden">
              {isEn ? 'Double-tap text to edit' : 'Double-tap = éditer texte'}
            </span>
            <span className="hidden sm:inline">
              {isEn ? 'Double-tap text on canvas to edit inline' : 'Double-clic sur le texte pour éditer'}
            </span>
          </span>
        </div>
      </div>

      {/* Multi-Lane Synchronized Video Timeline (Scenes + Overlays + Real Waveform Audio) */}
      <div className="rounded-2xl bg-[#070f22] text-white border border-slate-800 overflow-hidden relative">
        {timelineTrimHud && (
          <div className="absolute top-2 right-3 z-40 px-2.5 py-1 rounded-lg bg-amber-500 text-slate-950 font-extrabold text-[11px] tabular-nums shadow-lg">
            Durée : {timelineTrimHud}
          </div>
        )}

        <div className="overflow-x-auto">
          <div style={{ width: `${timelineWidthPx + 88}px` }} className="relative min-w-full">
            {/* Interactive Draggable Time Ruler */}
            <div className="flex border-b border-slate-800 bg-[#0b1734]">
              <div className="sticky left-0 z-30 bg-[#0b1734] w-[88px] sm:w-[140px] shrink-0 px-2 sm:px-3 py-2 border-r border-slate-800 text-[10px] font-extrabold uppercase tracking-wider text-slate-400 truncate">
                {aspectMode}
                <span className="hidden sm:inline"> Timeline</span>
              </div>
              <div
                ref={timelineTrackRef}
                onPointerDown={(e) => {
                  e.stopPropagation();
                  if (isPlayingPreview) {
                    if (previewRafRef.current) cancelAnimationFrame(previewRafRef.current);
                    stopPreviewAudio();
                    scenes.forEach((s) => s.videoEl?.pause());
                    setIsPlayingPreview(false);
                  }
                  isScrubbingRef.current = true;
                  scrubTimelineFromClientX(e.clientX);
                }}
                className="flex-1 relative h-9 cursor-ew-resize select-none touch-none"
              >
                {Array.from({ length: timelineSpanSec + 1 }).map((_, sec) => (
                  <div
                    key={sec}
                    style={{ left: `${sec * timelineZoom}px` }}
                    className="absolute top-0 bottom-0 border-l border-slate-700/60 pl-1 text-[10px] text-slate-400 tabular-nums pt-2 pointer-events-none"
                  >
                    {sec % 2 === 0 ? `${sec}s` : ''}
                  </div>
                ))}
                {/* Draggable Red Playhead Handle on Ruler */}
                <div
                  style={{ left: `${previewTimeSec * timelineZoom}px` }}
                  className="absolute top-0 bottom-0 -translate-x-1/2 w-6 flex items-start justify-center cursor-ew-resize z-40 touch-none"
                >
                  <div className="w-3.5 h-3.5 mt-0.5 rotate-45 bg-rose-500 border border-white rounded-xs shadow-md" />
                </div>
              </div>
            </div>

            {/* Lane 1: Scenes (Drag-and-drop reorder + Left & Right Interactive Trim Handles) */}
            <div className="flex border-b border-slate-800/80">
              <div className="sticky left-0 z-30 bg-[#070f22] w-[88px] sm:w-[140px] shrink-0 px-2 sm:px-3 py-2.5 border-r border-slate-800 font-bold text-[10px] sm:text-[11px] flex items-center gap-1 sm:gap-1.5">
                <Film className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span className="truncate">{isEn ? 'Scenes' : 'Scènes'}</span>
              </div>
              <div className="flex-1 relative h-14">
                {sceneTimingMap.map((entry, idx) => (
                  <div
                    key={entry.scene.id}
                    draggable
                    onDragStart={() => setDraggedSceneId(entry.scene.id)}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={() => {
                      if (draggedSceneId) reorderSceneByDrop(draggedSceneId, entry.scene.id);
                      setDraggedSceneId(null);
                    }}
                    onClick={() => {
                      setSelectedSceneId(entry.scene.id);
                      setSelectedOverlayId(null);
                      setSelectedAudioTrackId(null);
                      setPreviewTimeSec(entry.start + 0.05);
                      setIsInspectorOpen(true);
                    }}
                    style={{
                      left: `${entry.start * timelineZoom}px`,
                      width: `${Math.max(52, entry.dur * timelineZoom)}px`,
                    }}
                    className={`absolute top-1.5 bottom-1.5 rounded-lg px-3.5 py-1 cursor-grab active:cursor-grabbing flex flex-col justify-between transition select-none ${
                      selectedSceneId === entry.scene.id
                        ? 'bg-blue-700 ring-2 ring-amber-400 z-20'
                        : 'bg-slate-800 hover:bg-slate-700 z-10'
                    }`}
                  >
                    {/* Left Interactive Scene Trim Handle */}
                    <div
                      onPointerDown={(e) => {
                        e.stopPropagation();
                        pushHistory();
                        timelineGestureRef.current = {
                          kind: 'scene-trim-left',
                          targetId: entry.scene.id,
                          startClientX: e.clientX,
                          origStart: entry.start,
                          origEnd: entry.end,
                          origDuration: entry.dur,
                          origTrimStartSec: entry.scene.trimStartSec,
                          origTrimEndSec: entry.scene.trimEndSec,
                          origPlaybackRate: entry.scene.playbackRate || 1,
                        };
                      }}
                      className="absolute left-0 top-0 bottom-0 w-6 sm:w-4 flex items-center justify-center cursor-ew-resize touch-none"
                    >
                      <div className="w-1 h-6 rounded-full bg-white/90" />
                    </div>

                    <div className="flex items-center justify-between gap-1 text-[10px] font-bold truncate">
                      <span className="truncate">{entry.scene.name}</span>
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

                    {/* Right Interactive Scene Trim Handle */}
                    <div
                      onPointerDown={(e) => {
                        e.stopPropagation();
                        pushHistory();
                        timelineGestureRef.current = {
                          kind: 'scene-trim-right',
                          targetId: entry.scene.id,
                          startClientX: e.clientX,
                          origStart: entry.start,
                          origEnd: entry.end,
                          origDuration: entry.dur,
                          origTrimStartSec: entry.scene.trimStartSec,
                          origTrimEndSec: entry.scene.trimEndSec,
                          origPlaybackRate: entry.scene.playbackRate || 1,
                        };
                      }}
                      className="absolute right-0 top-0 bottom-0 w-6 sm:w-4 flex items-center justify-center cursor-ew-resize touch-none"
                    >
                      <div className="w-1 h-6 rounded-full bg-white/90" />
                    </div>
                  </div>
                ))}
                <div
                  style={{ left: `${previewTimeSec * timelineZoom}px` }}
                  className="absolute top-0 bottom-0 w-0.5 bg-rose-500 pointer-events-none z-30"
                />
              </div>
            </div>

            {/* Lane 2: Overlays (Drag Move + Interactive Left/Right Edge Trim Handles) */}
            <div className="flex border-b border-slate-800/80">
              <div className="sticky left-0 z-30 bg-[#070f22] w-[88px] sm:w-[140px] shrink-0 px-2 sm:px-3 py-2.5 border-r border-slate-800 font-bold text-[10px] sm:text-[11px] flex items-center gap-1 sm:gap-1.5">
                <Shapes className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span className="truncate">{isEn ? 'Overlays' : 'Calques'}</span>
              </div>
              <div className="flex-1 relative h-12">
                {overlays.map((ov) => (
                  <div
                    key={ov.id}
                    onPointerDown={(e) => {
                      e.stopPropagation();
                      setSelectedOverlayId(ov.id);
                      setSelectedAudioTrackId(null);
                      setPreviewTimeSec(ov.startSec + 0.05);
                      setIsInspectorOpen(true);
                      pushHistory();
                      timelineGestureRef.current = {
                        kind: 'overlay-move',
                        targetId: ov.id,
                        startClientX: e.clientX,
                        origStart: ov.startSec,
                        origEnd: ov.endSec,
                        origDuration: Math.max(0.4, ov.endSec - ov.startSec),
                        origTrimStartSec: 0,
                        origTrimEndSec: 0,
                        origPlaybackRate: 1,
                      };
                    }}
                    style={{
                      left: `${ov.startSec * timelineZoom}px`,
                      width: `${Math.max(48, (ov.endSec - ov.startSec) * timelineZoom)}px`,
                    }}
                    className={`absolute top-1.5 bottom-1.5 rounded-lg px-3 flex items-center text-[10px] font-bold truncate cursor-grab active:cursor-grabbing select-none touch-none ${
                      selectedOverlayId === ov.id
                        ? 'bg-emerald-600 ring-2 ring-amber-400 z-20'
                        : 'bg-emerald-800/85 hover:bg-emerald-700 z-10'
                    }`}
                  >
                    <div
                      onPointerDown={(e) => {
                        e.stopPropagation();
                        pushHistory();
                        timelineGestureRef.current = {
                          kind: 'overlay-trim-left',
                          targetId: ov.id,
                          startClientX: e.clientX,
                          origStart: ov.startSec,
                          origEnd: ov.endSec,
                          origDuration: Math.max(0.4, ov.endSec - ov.startSec),
                          origTrimStartSec: 0,
                          origTrimEndSec: 0,
                          origPlaybackRate: 1,
                        };
                      }}
                      className="absolute left-0 top-0 bottom-0 w-6 sm:w-4 flex items-center justify-center cursor-ew-resize touch-none"
                    >
                      <div className="w-1 h-5 rounded-full bg-white/90" />
                    </div>
                    <span className="truncate px-1">{ov.label}</span>
                    <div
                      onPointerDown={(e) => {
                        e.stopPropagation();
                        pushHistory();
                        timelineGestureRef.current = {
                          kind: 'overlay-trim-right',
                          targetId: ov.id,
                          startClientX: e.clientX,
                          origStart: ov.startSec,
                          origEnd: ov.endSec,
                          origDuration: Math.max(0.4, ov.endSec - ov.startSec),
                          origTrimStartSec: 0,
                          origTrimEndSec: 0,
                          origPlaybackRate: 1,
                        };
                      }}
                      className="absolute right-0 top-0 bottom-0 w-6 sm:w-4 flex items-center justify-center cursor-ew-resize touch-none"
                    >
                      <div className="w-1 h-5 rounded-full bg-white/90" />
                    </div>
                  </div>
                ))}
                <div
                  style={{ left: `${previewTimeSec * timelineZoom}px` }}
                  className="absolute top-0 bottom-0 w-0.5 bg-rose-500 pointer-events-none z-30"
                />
              </div>
            </div>

            {/* Lane 3: Real Audio Waveforms + Interactive Edge Trimming */}
            <div className="flex">
              <div className="sticky left-0 z-30 bg-[#070f22] w-[88px] sm:w-[140px] shrink-0 px-2 sm:px-3 py-2.5 border-r border-slate-800 font-bold text-[10px] sm:text-[11px] flex items-center gap-1 sm:gap-1.5">
                <Music className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                <span className="truncate">Audio</span>
              </div>
              <div className="flex-1 relative h-14">
                {audioTracks.map((tr) => {
                  const bufDur = tr.audioBuffer?.duration || Math.max(tr.trimEndSec || 6, 6);
                  const trimS = tr.trimStartSec ?? 0;
                  const trimE = tr.trimEndSec ?? bufDur;
                  const activeDur = Math.max(0.2, trimE - trimS) / Math.max(0.5, tr.playbackRate || 1);
                  return (
                    <WaveformClipView
                      key={tr.id}
                      id={tr.id}
                      name={tr.name}
                      color="#7c3aed"
                      buffer={tr.audioBuffer}
                      leftPx={tr.startSec * timelineZoom}
                      widthPx={activeDur * timelineZoom}
                      durationSec={bufDur}
                      trimStartSec={trimS}
                      trimEndSec={trimE}
                      fadeInSec={tr.fadeInSec}
                      fadeOutSec={tr.fadeOutSec}
                      muted={Boolean(tr.muted)}
                      selected={selectedAudioTrackId === tr.id}
                      pxPerSec={timelineZoom * Math.max(0.5, tr.playbackRate || 1)}
                      startTimeSec={tr.startSec}
                      onSelect={() => {
                        setSelectedAudioTrackId(tr.id);
                        setSelectedOverlayId(null);
                        setSelectedSceneId(null);
                        setIsInspectorOpen(true);
                      }}
                      onMoveCommit={(nextStart) => {
                        pushHistory();
                        updateAudioTrack(tr.id, { startSec: Math.max(0, nextStart) });
                      }}
                      onTrimCommit={(nextTrimS, nextTrimE, nextStartDelta) => {
                        pushHistory();
                        updateAudioTrack(tr.id, {
                          trimStartSec: Math.max(0, nextTrimS),
                          trimEndSec: Math.min(bufDur, Math.max(nextTrimS + 0.2, nextTrimE)),
                          startSec: Math.max(0, Number((tr.startSec + nextStartDelta).toFixed(2))),
                        });
                      }}
                    />
                  );
                })}
                <div
                  style={{ left: `${previewTimeSec * timelineZoom}px` }}
                  className="absolute top-0 bottom-0 w-0.5 bg-rose-500 pointer-events-none z-30"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Direct Share Device File Without Saving */}
      <div className="px-3 py-2.5 rounded-xl bg-white dark:bg-[#0c1631] border border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs">
        <span className="text-slate-600 dark:text-slate-300 font-medium">
          {isEn
            ? 'Share an existing video or photo directly without saving it in SHALOM:'
            : 'Partager directement une vidéo ou photo du téléphone sans l’enregistrer dans SHALOM :'}
        </span>
        <label className="min-h-[40px] px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold flex items-center gap-1.5 cursor-pointer">
          <Share2 className="w-3.5 h-3.5 shrink-0" />
          <span>{isEn ? 'Share file directly' : 'Partager fichier sans enregistrer'}</span>
          <input
            type="file"
            accept="video/*,image/*,audio/*"
            onChange={handleShareLocalMediaDirect}
            className="hidden"
          />
        </label>
      </div>
    </div>
  );

  const bottomBar = (
    <HorizontalScrollRail wrapOnDesktop innerClassName="justify-between w-full gap-2" className="text-xs">
      <div className="flex items-center gap-2 sm:gap-3 tabular-nums font-semibold text-slate-600 dark:text-slate-300 whitespace-nowrap shrink-0">
        <span>{aspectMode}</span>
        <span>·</span>
        <span>{scenes.length} scène(s)</span>
        <span>·</span>
        <span>{overlays.length} calque(s)</span>
        <span>·</span>
        <span>{totalDurationSec.toFixed(1)}s</span>
      </div>

      <button
        type="button"
        disabled={isExporting || scenes.length === 0}
        onClick={handleExportVideo}
        className="shrink-0 min-h-[36px] px-3.5 py-1 rounded-lg bg-blue-700 hover:bg-blue-800 disabled:opacity-40 text-white font-bold flex items-center gap-1.5 whitespace-nowrap"
      >
        {isExporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Film className="w-3.5 h-3.5" />}
        <span>{isEn ? 'Render WebM Video' : 'Assembler & Exporter WebM'}</span>
      </button>
    </HorizontalScrollRail>
  );

  const hasActiveWork = scenes.length > 0 || overlays.length > 0 || audioTracks.length > 0;
  const homeFeaturedTemplates = VIDEO_TEMPLATES.slice(0, 8).map((tpl) => ({
    id: tpl.id,
    kind: 'video' as const,
    title: isEn ? tpl.titleEn : tpl.titleFr,
    category: tpl.category,
    subtitle: isEn ? tpl.descEn : tpl.descFr,
    aspect: tpl.aspect,
    bgColor1: tpl.bgColor,
    scenes: tpl.scenes as unknown as Array<Record<string, unknown>>,
    overlays: tpl.overlays as unknown as Array<Record<string, unknown>>,
    onSelectPreview: () => setPreviewingTemplate(tpl),
  }));

  return (
    <>
      {isHomeView ? (
        <StudioHomeScreen
          kind="video"
          isEn={isEn}
          hasActiveWork={hasActiveWork}
          activeProjectTitle={projectTitle}
          activeSummary={`${aspectMode} · ${scenes.length} scène(s) · ${totalDurationSec.toFixed(1)}s`}
          onCreateBlank={handleStartBlankVideoProject}
          onContinueWork={() => {
            setActiveToolTab(null);
            setIsHomeView(false);
          }}
          onOpenTemplatesTool={() => {
            setIsHomeView(false);
            setActiveToolTab('templates');
          }}
          onOpenLibraryTool={() => {
            setIsHomeView(false);
            setActiveToolTab('media');
          }}
          libraryLabel={isEn ? 'Media & Scenes' : 'Médias & Scènes'}
          onOpenShalomResources={() => {
            setIsHomeView(false);
            setActiveToolTab('shalom');
          }}
          onOpenAllSaved={() => {
            setIsHomeView(false);
            setActiveToolTab('projects');
          }}
          savedProjects={savedVideoProjects}
          onOpenSavedProject={handleLoadSavedProject}
          featuredTemplates={homeFeaturedTemplates}
        />
      ) : (
        <StudioWorkspaceShell
          projectTitle={projectTitle}
          onProjectTitleChange={setProjectTitle}
          statusLine={`${aspectMode} · ${scenes.length} scène(s) · ${totalDurationSec.toFixed(1)}s`}
          canUndo={undoStack.length > 0}
          canRedo={redoStack.length > 0}
          onUndo={handleUndo}
          onRedo={handleRedo}
          onReturnHome={() => {
            setActiveToolTab(null);
            setIsHomeView(true);
          }}
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
          onShare={handleShareWithoutSaving}
          onPrimaryExport={handleExportVideo}
          primaryExportLabel="WebM"
          isExporting={isExporting}
          toolItems={toolItems}
          activeToolId={activeToolTab}
          onSelectTool={(id) => setActiveToolTab(id as VideoToolTab | null)}
          toolDrawerContent={renderToolDrawerContent()}
          selectionToolbar={selectionToolbar}
          centerStage={centerStage}
          bottomBar={bottomBar}
          inspectorTitle={
            selectedOverlay
              ? isEn
                ? 'Overlay Properties'
                : 'Propriétés Calque'
              : selectedAudioTrack
                ? isEn
                  ? 'Audio Properties'
                  : 'Propriétés Audio'
                : isEn
                  ? 'Scene Properties'
                  : 'Propriétés Scène'
          }
          inspectorContent={renderInspectorContent()}
          isInspectorOpen={isInspectorOpen}
          onToggleInspector={() => setIsInspectorOpen((v) => !v)}
        />
      )}

      {/* Preview & Export Modal */}
      <Modal
        isOpen={showPreviewModal}
        onClose={() => setShowPreviewModal(false)}
        title={isEn ? 'Video Preview & Export' : 'Aperçu & Export du montage vidéo'}
        subtitle={`${projectTitle} · ${aspectMode} · ${totalDurationSec.toFixed(1)}s`}
        maxWidth="lg"
      >
        <div className="space-y-4 text-xs">
          {exportedVideoUrl ? (
            <div className="space-y-3">
              <video
                src={exportedVideoUrl}
                controls
                playsInline
                className="w-full max-h-[44dvh] sm:max-h-80 rounded-xl bg-black"
              />
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={handleDownloadVideo}
                  className="px-3.5 py-2 rounded-xl bg-slate-900 text-white font-bold flex items-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>{isEn ? 'Save WebM' : 'Télécharger (.webm)'}</span>
                </button>
                <button
                  type="button"
                  onClick={handleSaveToParole}
                  className="px-3.5 py-2 rounded-xl bg-blue-700 text-white font-bold flex items-center gap-1.5"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>Parole Divine</span>
                </button>
                <button
                  type="button"
                  onClick={handleSaveToVault}
                  className="px-3.5 py-2 rounded-xl bg-amber-600 text-white font-bold flex items-center gap-1.5"
                >
                  <Archive className="w-3.5 h-3.5" />
                  <span>{isEn ? 'Save to Vault' : 'Dans Mon Coffre'}</span>
                </button>
                <button
                  type="button"
                  onClick={handleShareVideo}
                  className="px-3.5 py-2 rounded-xl bg-emerald-600 text-white font-bold flex items-center gap-1.5"
                >
                  <Share2 className="w-3.5 h-3.5" />
                  <span>{isEn ? 'Share' : 'Partager'}</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="p-4 rounded-xl bg-slate-950 text-white text-center space-y-3">
              <Sparkles className="w-6 h-6 text-amber-400 mx-auto" />
              <p className="text-slate-300">
                {isEn
                  ? 'Click "Render WebM Video" to generate the playable WebM video with mixed audio tracks.'
                  : 'Appuyez sur « Assembler & Exporter WebM » pour générer la vidéo finale avec audio mixé.'}
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
                kind: 'video',
                aspect: previewingTemplate.aspect,
                bgColor1: previewingTemplate.bgColor,
                scenes: previewingTemplate.scenes as unknown as Array<Record<string, unknown>>,
                overlays: previewingTemplate.overlays as unknown as Array<Record<string, unknown>>,
                sourceLabel:
                  previewingTemplate.source === 'local'
                    ? isEn
                      ? 'Built-in SHALOM'
                      : 'Modèle SHALOM'
                    : isEn
                      ? 'Online Catalog'
                      : 'Catalogue en ligne',
                isSavedOffline: customTemplates.some(
                  (t) => t.id === previewingTemplate.id && t.studioType === 'video'
                ),
                isSavingOffline: savingResourceId === previewingTemplate.id,
                rawTemplate: previewingTemplate,
              } satisfies PreviewModalTemplateData)
            : null
        }
        isEn={isEn}
        onClose={() => setPreviewingTemplate(null)}
        onUseTemplate={(tplModal) => {
          const raw = tplModal.rawTemplate as VideoTemplateDef;
          setPreviewingTemplate(null);
          applyVideoTemplate(raw);
        }}
        onSaveToShalom={(tplModal) => {
          const raw = tplModal.rawTemplate as VideoTemplateDef;
          handleSaveTemplateToShalom(raw);
        }}
      />

      <ImageCropModal
        isOpen={Boolean(cropTarget)}
        imageEl={
          cropTarget?.kind === 'overlay'
            ? overlays.find((o) => o.id === cropTarget.id)?.imageEl || null
            : cropTarget?.kind === 'scene'
              ? scenes.find((s) => s.id === cropTarget.id)?.imageEl || null
              : null
        }
        initialCrop={
          cropTarget?.kind === 'overlay'
            ? overlays.find((o) => o.id === cropTarget.id)
            : cropTarget?.kind === 'scene'
              ? scenes.find((s) => s.id === cropTarget.id)
              : undefined
        }
        isEn={isEn}
        onClose={() => setCropTarget(null)}
        onApply={(crop: NormalizedCropRect) => {
          if (!cropTarget) return;
          pushHistory();
          if (cropTarget.kind === 'overlay') {
            updateOverlay(cropTarget.id, crop);
          } else {
            updateScene(cropTarget.id, crop);
          }
          setCropTarget(null);
          setNotice(isEn ? 'Image cropped!' : 'Image recadrée !');
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
