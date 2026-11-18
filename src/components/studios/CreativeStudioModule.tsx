import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  Type,
  Shapes,
  Image as ImageIcon,
  Pencil,
  Trash2,
  ArrowUp,
  ArrowDown,
  Copy,
  Download,
  Share2,
  RotateCcw,
  Eraser,
  CheckCircle2,
  Sparkles,
  CheckSquare,
  Square,
  ZoomIn,
  ZoomOut,
  Layers,
  LayoutTemplate,
  Palette,
  Lock,
  Unlock,
  Eye,
  EyeOff,
  Magnet,
  AlignHorizontalJustifyCenter,
  AlignVerticalJustifyCenter,
  AlignHorizontalJustifyStart,
  AlignHorizontalJustifyEnd,
  FileText,
  FolderOpen,
  FolderHeart,
  Search,
  Globe,
  GripVertical,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Loader2,
  Plus,
  ClipboardPaste,
  Edit3,
  Hand,
  Group,
  Ungroup,
  BookmarkPlus,
  Archive,
  Crop,
  Play,
  Pause,
  ChevronLeft,
  ChevronRight,
  MonitorPlay,
  RefreshCw,
} from 'lucide-react';
import { useShalomDB } from '../../hooks/useShalomDB';
import { dbService, STORES } from '../../services/db';
import { useLanguage } from '../../contexts/LanguageContext';
import { CreativeDesignItem, SavedStudioTemplate } from '../../types';
import { ConfirmDialog } from '../common/ConfirmDialog';
import { Modal } from '../common/Modal';
import { SocialShareModal } from '../common/SocialShareModal';
import { ShalomFolderExplorerModal } from '../vault/ShalomFolderExplorerModal';
import { SharePayload } from '../../services/socialShare';
import { chooseShalomDownloadDirectory, downloadBlobToDevice } from '../../services/fileTransfer';
import {
  searchOnlineAssetsClient,
  searchOnlineTemplatesClient,
  fetchOnlineAssetBlobClient,
} from '../../services/onlineStudioSearch';
import {
  drawStudioVectorElement,
  exportCanvasesToMultiPagePdfBlob,
  SHALOM_COLOR_PALETTES,
  STUDIO_BACKDROP_PHOTOS,
  STUDIO_FONTS,
  StudioVectorElementKind,
  VECTOR_ELEMENT_CATALOG,
} from '../../services/studioGraphics';
import { computeSmartSnap, SnapGuideLine, generateGroupId } from '../../services/studios/canvasGeometry';
import {
  drawRoundedRectPath,
  safeApplyCanvasFilter,
  safeDrawMedia,
  safeSetLetterSpacing,
} from '../../services/studios/canvasSafety';
import {
  saveAssetResourceToShalom,
  saveTemplateBundleToShalom,
} from '../../services/studios/offlineResources';
import { loadStudioDraft, saveStudioDraft } from '../../services/studioPersistence';
import { deleteSavedOnlineTemplate } from '../../services/studioTemplatesStore';
import { StudioWorkspaceShell, StudioToolRailItem } from './shared/StudioWorkspaceShell';
import { VectorPreviewSvg } from './shared/VectorPreviewSvg';
import { ShalomResourcesPanel } from './shared/ShalomResourcesPanel';
import { TemplatePreviewCard } from './shared/TemplatePreviewCard';
import { TemplatePreviewModal, PreviewModalTemplateData } from './shared/TemplatePreviewModal';
import { ImageCropModal, NormalizedCropRect } from './shared/ImageCropModal';

type FormatRatio = 'square' | 'portrait' | 'story' | 'landscape' | 'a4';
type StudioToolTab =
  | 'templates'
  | 'elements'
  | 'text'
  | 'images'
  | 'bg'
  | 'draw'
  | 'layers'
  | 'shalom'
  | 'creations';

interface BaseLayer {
  id: string;
  groupId?: string;
  x: number;
  y: number;
  rotation: number;
  opacity: number;
  visible?: boolean;
  locked?: boolean;
}

interface TextLayer extends BaseLayer {
  kind: 'text';
  text: string;
  fontFamily: string;
  fontSize: number;
  color: string;
  bold: boolean;
  italic: boolean;
  underline?: boolean;
  strikethrough?: boolean;
  uppercase?: boolean;
  align: 'left' | 'center' | 'right';
  bgColor: string;
  bgEnabled: boolean;
  shadow: boolean;
  strokeColor?: string;
  strokeWidth?: number;
  lineHeight?: number;
  letterSpacing?: number;
}

interface ShapeLayer extends BaseLayer {
  kind: 'shape';
  shape: StudioVectorElementKind;
  width: number;
  height: number;
  fillColor: string;
  secondaryColor?: string;
  strokeColor: string;
  strokeWidth: number;
}

interface ImageLayer extends BaseLayer {
  kind: 'image';
  imageEl: HTMLImageElement;
  assetKey?: string;
  svgMarkup?: string;
  label: string;
  width: number;
  height: number;
  circular: boolean;
  filter?: 'none' | 'grayscale' | 'sepia' | 'warm' | 'bright';
  cropX?: number;
  cropY?: number;
  cropW?: number;
  cropH?: number;
}

interface DrawStroke {
  id: string;
  color: string;
  size: number;
  points: Array<{ x: number; y: number }>;
}

type StudioLayer = TextLayer | ShapeLayer | ImageLayer;

interface SerializedLayer {
  kind: 'text' | 'shape' | 'image';
  id: string;
  groupId?: string;
  x: number;
  y: number;
  rotation: number;
  opacity: number;
  visible?: boolean;
  locked?: boolean;
  text?: string;
  fontFamily?: string;
  fontSize?: number;
  color?: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strikethrough?: boolean;
  uppercase?: boolean;
  align?: 'left' | 'center' | 'right';
  bgColor?: string;
  bgEnabled?: boolean;
  shadow?: boolean;
  strokeColor?: string;
  strokeWidth?: number;
  lineHeight?: number;
  letterSpacing?: number;
  shape?: StudioVectorElementKind;
  width?: number;
  height?: number;
  fillColor?: string;
  secondaryColor?: string;
  assetKey?: string;
  svgMarkup?: string;
  label?: string;
  circular?: boolean;
  filter?: 'none' | 'grayscale' | 'sepia' | 'warm' | 'bright';
  cropX?: number;
  cropY?: number;
  cropW?: number;
  cropH?: number;
}

type SlideTransition = 'none' | 'fade' | 'slide' | 'zoom';

interface DesignPage {
  id: string;
  name: string;
  transition?: SlideTransition;
  bgType: 'solid' | 'gradient' | 'image';
  bgColor1: string;
  bgColor2: string;
  bgAngle: number;
  bgImageEl: HTMLImageElement | null;
  bgImageAssetKey?: string;
  bgImageOverlay: number;
  layers: StudioLayer[];
  strokes: DrawStroke[];
}

interface SerializedDesignPage {
  id: string;
  name: string;
  transition?: SlideTransition;
  bgType: 'solid' | 'gradient' | 'image';
  bgColor1: string;
  bgColor2: string;
  bgAngle: number;
  bgImageAssetKey?: string;
  bgImageOverlay: number;
  layers: SerializedLayer[];
  strokes: DrawStroke[];
}

interface ProjectSnapshot {
  version?: number;
  designTitle: string;
  formatRatio: FormatRatio;
  activePageIndex?: number;
  pages?: SerializedDesignPage[];
  // Legacy v1 single-page compatibility fields
  bgType?: 'solid' | 'gradient' | 'image';
  bgColor1?: string;
  bgColor2?: string;
  bgAngle?: number;
  bgImageAssetKey?: string;
  bgImageOverlay?: number;
  layers?: SerializedLayer[];
  strokes?: DrawStroke[];
}

const FORMAT_DIMS: Record<FormatRatio, { w: number; h: number; label: string }> = {
  square: { w: 1080, h: 1080, label: '1:1 Carré (1080×1080)' },
  portrait: { w: 1080, h: 1350, label: '4:5 Portrait (1080×1350)' },
  story: { w: 1080, h: 1920, label: '9:16 Story (1080×1920)' },
  landscape: { w: 1280, h: 720, label: '16:9 Paysage (1280×720)' },
  a4: { w: 1240, h: 1754, label: 'A4 Affiche (1240×1754)' },
};

interface DesignTemplate {
  id: string;
  nameFr: string;
  nameEn: string;
  category: string;
  format: FormatRatio;
  bgType: 'solid' | 'gradient' | 'image';
  bgColor1: string;
  bgColor2: string;
  bgAngle: number;
  bgRemoteImageUrl?: string;
  bgImageAssetKey?: string;
  source?: 'local' | 'online-catalog' | 'online-live';
  layers: SerializedLayer[];
  pages?: SerializedDesignPage[];
}

interface OnlineAssetItem {
  id: string;
  assetType: 'elements' | 'images' | 'backgrounds';
  title: string;
  previewUrl: string;
  fullUrl: string;
  mimeType?: string;
  isBitmap?: boolean;
  width?: number;
  height?: number;
  source: string;
  author?: string;
  license?: string;
}

const DESIGN_TEMPLATES: DesignTemplate[] = [
  {
    id: 'blank',
    nameFr: 'Canevas Vierge',
    nameEn: 'Blank Canvas',
    category: 'Libre',
    format: 'square',
    bgType: 'solid',
    bgColor1: '#ffffff',
    bgColor2: '#f1f5f9',
    bgAngle: 135,
    layers: [],
  },
  {
    id: 'verse_royal',
    nameFr: 'Verset Royal & Or',
    nameEn: 'Royal Gold Verse',
    category: 'Verset',
    format: 'square',
    bgType: 'gradient',
    bgColor1: '#0b1f42',
    bgColor2: '#1d4ed8',
    bgAngle: 135,
    layers: [
      {
        kind: 'shape',
        id: 'tpl_frame',
        shape: 'frame',
        x: 540,
        y: 540,
        width: 960,
        height: 960,
        fillColor: '#fbbf24',
        strokeColor: '#fbbf24',
        strokeWidth: 0,
        rotation: 0,
        opacity: 0.35,
      },
      {
        kind: 'shape',
        id: 'tpl_cross',
        shape: 'cross',
        x: 540,
        y: 230,
        width: 120,
        height: 145,
        fillColor: '#fbbf24',
        strokeColor: '#ffffff',
        strokeWidth: 0,
        rotation: 0,
        opacity: 0.95,
      },
      {
        kind: 'text',
        id: 'tpl_txt',
        x: 540,
        y: 520,
        text: '« L’Éternel est mon berger :\nje ne manquerai de rien. »',
        fontFamily: 'Georgia, "Times New Roman", serif',
        fontSize: 58,
        color: '#ffffff',
        bold: true,
        italic: true,
        align: 'center',
        bgColor: '#0b1f42',
        bgEnabled: false,
        shadow: true,
        rotation: 0,
        opacity: 1,
      },
      {
        kind: 'shape',
        id: 'tpl_div',
        shape: 'line',
        x: 540,
        y: 720,
        width: 280,
        height: 16,
        fillColor: '#fbbf24',
        strokeColor: '#fbbf24',
        strokeWidth: 0,
        rotation: 0,
        opacity: 0.85,
      },
      {
        kind: 'text',
        id: 'tpl_ref',
        x: 540,
        y: 800,
        text: 'Psaume 23 : 1',
        fontFamily: '"Outfit", sans-serif',
        fontSize: 38,
        color: '#fbbf24',
        bold: true,
        italic: false,
        align: 'center',
        bgColor: '#0b1f42',
        bgEnabled: false,
        shadow: false,
        rotation: 0,
        opacity: 1,
      },
    ],
  },
  {
    id: 'sunday_invite',
    nameFr: 'Invitation Culte',
    nameEn: 'Sunday Service Invite',
    category: 'Invitation',
    format: 'portrait',
    bgType: 'gradient',
    bgColor1: '#1e1b4b',
    bgColor2: '#7c3aed',
    bgAngle: 160,
    layers: [
      {
        kind: 'shape',
        id: 'inv_rays',
        shape: 'rays',
        x: 540,
        y: 260,
        width: 340,
        height: 340,
        fillColor: '#fde68a',
        strokeColor: '#ffffff',
        strokeWidth: 0,
        rotation: 0,
        opacity: 0.25,
      },
      {
        kind: 'shape',
        id: 'inv_dove',
        shape: 'dove',
        x: 540,
        y: 260,
        width: 220,
        height: 190,
        fillColor: '#ffffff',
        strokeColor: '#fbbf24',
        strokeWidth: 0,
        rotation: 0,
        opacity: 0.95,
      },
      {
        kind: 'text',
        id: 'inv_title',
        x: 540,
        y: 590,
        text: 'CULTE DE\nLOUANGE & PAROLE',
        fontFamily: '"Outfit", sans-serif',
        fontSize: 78,
        color: '#ffffff',
        bold: true,
        italic: false,
        align: 'center',
        bgColor: '#000000',
        bgEnabled: false,
        shadow: true,
        rotation: 0,
        opacity: 1,
      },
      {
        kind: 'text',
        id: 'inv_info',
        x: 540,
        y: 940,
        text: 'DIMANCHE · 09H30 · BIENVENUE À TOUS',
        fontFamily: '"Plus Jakarta Sans", sans-serif',
        fontSize: 36,
        color: '#0b1f42',
        bold: true,
        italic: false,
        align: 'center',
        bgColor: '#fbbf24',
        bgEnabled: true,
        shadow: false,
        rotation: 0,
        opacity: 1,
      },
    ],
  },
  {
    id: 'story_prayer',
    nameFr: 'Story Prière Matin',
    nameEn: 'Morning Prayer Story',
    category: 'Réseaux sociaux',
    format: 'story',
    bgType: 'gradient',
    bgColor1: '#064e3b',
    bgColor2: '#0f766e',
    bgAngle: 170,
    layers: [
      {
        kind: 'shape',
        id: 'stp_frame',
        shape: 'frame',
        x: 540,
        y: 960,
        width: 960,
        height: 1740,
        fillColor: '#fde68a',
        strokeColor: '#fde68a',
        strokeWidth: 0,
        rotation: 0,
        opacity: 0.25,
      },
      {
        kind: 'shape',
        id: 'stp_bible',
        shape: 'bible',
        x: 540,
        y: 440,
        width: 240,
        height: 200,
        fillColor: '#fef3c7',
        strokeColor: '#d97706',
        strokeWidth: 0,
        rotation: 0,
        opacity: 0.95,
      },
      {
        kind: 'text',
        id: 'stp_txt',
        x: 540,
        y: 910,
        text: 'PRIÈRE DU MATIN\n\nSeigneur, bénis cette journée\net remplis nos cœurs de Ta paix.',
        fontFamily: 'Georgia, "Times New Roman", serif',
        fontSize: 54,
        color: '#ffffff',
        bold: true,
        italic: false,
        align: 'center',
        bgColor: '#064e3b',
        bgEnabled: false,
        shadow: true,
        rotation: 0,
        opacity: 1,
      },
    ],
  },
  {
    id: 'verse_blessing',
    nameFr: 'Carte Bénédiction',
    nameEn: 'Blessing Card',
    category: 'Carte',
    format: 'square',
    bgType: 'gradient',
    bgColor1: '#451a03',
    bgColor2: '#b45309',
    bgAngle: 145,
    layers: [
      {
        kind: 'shape',
        id: 'vb_wreath',
        shape: 'wreath',
        x: 540,
        y: 250,
        width: 210,
        height: 210,
        fillColor: '#a7f3d0',
        strokeColor: '#fbbf24',
        strokeWidth: 0,
        rotation: 0,
        opacity: 0.95,
      },
      {
        kind: 'text',
        id: 'vb_title',
        x: 540,
        y: 520,
        text: 'Que l’Éternel te bénisse\net qu’Il te garde !',
        fontFamily: 'Georgia, "Times New Roman", serif',
        fontSize: 64,
        color: '#fffbeb',
        bold: true,
        italic: true,
        align: 'center',
        bgColor: '#000000',
        bgEnabled: false,
        shadow: true,
        rotation: 0,
        opacity: 1,
      },
      {
        kind: 'text',
        id: 'vb_ref',
        x: 540,
        y: 780,
        text: 'Nombres 6 : 24–26 · SHALOM',
        fontFamily: '"Plus Jakarta Sans", sans-serif',
        fontSize: 34,
        color: '#fde68a',
        bold: true,
        italic: false,
        align: 'center',
        bgColor: '#000000',
        bgEnabled: false,
        shadow: false,
        rotation: 0,
        opacity: 1,
      },
    ],
  },
  {
    id: 'a4_programme',
    nameFr: 'Affiche Programme A4',
    nameEn: 'A4 Event Poster',
    category: 'Affiche',
    format: 'a4',
    bgType: 'gradient',
    bgColor1: '#0f172a',
    bgColor2: '#1e3a8a',
    bgAngle: 180,
    layers: [
      {
        kind: 'shape',
        id: 'a4_bar',
        shape: 'roundRect',
        x: 620,
        y: 280,
        width: 1020,
        height: 220,
        fillColor: '#fbbf24',
        strokeColor: '#ffffff',
        strokeWidth: 0,
        rotation: 0,
        opacity: 1,
      },
      {
        kind: 'text',
        id: 'a4_head',
        x: 620,
        y: 280,
        text: 'GRANDE CONFÉRENCE',
        fontFamily: '"Outfit", sans-serif',
        fontSize: 64,
        color: '#0b1f42',
        bold: true,
        italic: false,
        align: 'center',
        bgColor: '#fbbf24',
        bgEnabled: false,
        shadow: false,
        rotation: 0,
        opacity: 1,
      },
      {
        kind: 'text',
        id: 'a4_mid',
        x: 620,
        y: 820,
        text: 'Thème : Bâtir sur le Roc\n\nDate · Heure · Lieu',
        fontFamily: '"Plus Jakarta Sans", sans-serif',
        fontSize: 52,
        color: '#ffffff',
        bold: true,
        italic: false,
        align: 'center',
        bgColor: '#000000',
        bgEnabled: false,
        shadow: true,
        rotation: 0,
        opacity: 1,
      },
    ],
  },
];

function serializeLayers(layers: StudioLayer[]): SerializedLayer[] {
  return layers.map((l) => {
    if (l.kind === 'image') {
      return {
        kind: 'image',
        id: l.id,
        groupId: l.groupId,
        x: l.x,
        y: l.y,
        rotation: l.rotation,
        opacity: l.opacity,
        visible: l.visible,
        locked: l.locked,
        assetKey: l.assetKey,
        svgMarkup: l.svgMarkup,
        label: l.label,
        width: l.width,
        height: l.height,
        circular: l.circular,
        filter: l.filter,
        cropX: l.cropX,
        cropY: l.cropY,
        cropW: l.cropW,
        cropH: l.cropH,
      };
    }
    return { ...l };
  });
}

function loadImageFromBlob(blob: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

function loadImageFromUrl(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

async function hydrateLayers(serialized: SerializedLayer[]): Promise<StudioLayer[]> {
  const out: StudioLayer[] = [];
  if (!Array.isArray(serialized)) return out;
  for (const s of serialized) {
    if (!s || typeof s !== 'object') continue;
    if (s.kind === 'text') {
      out.push({
        id: s.id || `txt_${Date.now()}`,
        groupId: s.groupId,
        kind: 'text',
        x: Number(s.x) || 540,
        y: Number(s.y) || 540,
        rotation: s.rotation || 0,
        opacity: s.opacity ?? 1,
        visible: s.visible ?? true,
        locked: s.locked ?? false,
        text: s.text || '',
        fontFamily: s.fontFamily || STUDIO_FONTS[0].value,
        fontSize: s.fontSize || 48,
        color: s.color || '#ffffff',
        bold: !!s.bold,
        italic: !!s.italic,
        underline: !!s.underline,
        strikethrough: !!s.strikethrough,
        uppercase: !!s.uppercase,
        align: s.align || 'center',
        bgColor: s.bgColor || '#0b1f42',
        bgEnabled: !!s.bgEnabled,
        shadow: !!s.shadow,
        strokeColor: s.strokeColor || '#000000',
        strokeWidth: s.strokeWidth || 0,
        lineHeight: s.lineHeight || 1.28,
        letterSpacing: s.letterSpacing || 0,
      });
    } else if (s.kind === 'shape') {
      out.push({
        id: s.id || `shp_${Date.now()}`,
        groupId: s.groupId,
        kind: 'shape',
        shape: s.shape || 'rect',
        x: Number(s.x) || 540,
        y: Number(s.y) || 540,
        width: s.width || 220,
        height: s.height || 220,
        fillColor: s.fillColor || '#1d4ed8',
        secondaryColor: s.secondaryColor,
        strokeColor: s.strokeColor || '#fbbf24',
        strokeWidth: s.strokeWidth ?? 0,
        rotation: s.rotation || 0,
        opacity: s.opacity ?? 1,
        visible: s.visible ?? true,
        locked: s.locked ?? false,
      });
    } else if (s.kind === 'image') {
      let blob: Blob | null = null;
      try {
        if (s.assetKey) {
          blob = (await dbService.getMediaBlob(s.assetKey)) || null;
        } else if (s.svgMarkup) {
          blob = new Blob([s.svgMarkup], { type: 'image/svg+xml;charset=utf-8' });
        }
      } catch {
        blob = null;
      }
      if (blob) {
        try {
          const img = await loadImageFromBlob(blob);
          out.push({
            id: s.id || `img_${Date.now()}`,
            groupId: s.groupId,
            kind: 'image',
            imageEl: img,
            assetKey: s.assetKey,
            svgMarkup: s.svgMarkup,
            label: s.label || 'Image',
            width: s.width || 320,
            height: s.height || 320,
            circular: !!s.circular,
            filter: s.filter || 'none',
            cropX: s.cropX,
            cropY: s.cropY,
            cropW: s.cropW,
            cropH: s.cropH,
            x: Number(s.x) || 540,
            y: Number(s.y) || 540,
            rotation: s.rotation || 0,
            opacity: s.opacity ?? 1,
            visible: s.visible ?? true,
            locked: s.locked ?? false,
          });
        } catch {
          // skip unreadable image
        }
      }
    }
  }
  return out;
}

function createBlankPage(index: number, isPresentation = false): DesignPage {
  return {
    id: `pg_${Date.now()}_${index}_${Math.random().toString(36).slice(2, 5)}`,
    name: isPresentation ? `Diapo ${index + 1}` : `Page ${index + 1}`,
    transition: isPresentation ? 'fade' : 'none',
    bgType: isPresentation ? 'gradient' : 'solid',
    bgColor1: isPresentation ? '#0b1f42' : '#ffffff',
    bgColor2: isPresentation ? '#1e3a8a' : '#173c7a',
    bgAngle: 135,
    bgImageEl: null,
    bgImageAssetKey: undefined,
    bgImageOverlay: 0.2,
    layers: [],
    strokes: [],
  };
}

export interface CreativeStudioModuleProps {
  mode?: 'design' | 'presentation';
}

export const CreativeStudioModule: React.FC<CreativeStudioModuleProps> = ({ mode = 'design' }) => {
  const studioMode: 'design' | 'presentation' = mode === 'presentation' ? 'presentation' : 'design';
  const isPresentation = studioMode === 'presentation';

  const { lang } = useLanguage();
  const { creations, customTemplates, reloadData } = useShalomDB();
  const isEn = lang === 'en';

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const replaceImageInputRef = useRef<HTMLInputElement | null>(null);
  const draftRestoredRef = useRef(false);

  const [activeToolTab, setActiveToolTab] = useState<StudioToolTab | null>('templates');
  const [isInspectorOpen, setIsInspectorOpen] = useState(false);
  const [editingCreationId, setEditingCreationId] = useState<string | null>(null);
  const [designTitle, setDesignTitle] = useState(
    isPresentation ? (isEn ? 'My Presentation' : 'Ma présentation') : isEn ? 'My Creation' : 'Ma création'
  );
  const [formatRatio, setFormatRatio] = useState<FormatRatio>(isPresentation ? 'landscape' : 'square');

  // Multi-page / Multi-slide deck state
  const [pages, setPages] = useState<DesignPage[]>(() => [createBlankPage(0, isPresentation)]);
  const [activePageIndex, setActivePageIndex] = useState(0);

  const activePage = pages[activePageIndex] || pages[0] || createBlankPage(0, isPresentation);
  const bgType = activePage.bgType;
  const bgColor1 = activePage.bgColor1;
  const bgColor2 = activePage.bgColor2;
  const bgAngle = activePage.bgAngle;
  const bgImageEl = activePage.bgImageEl;
  const bgImageAssetKey = activePage.bgImageAssetKey;
  const bgImageOverlay = activePage.bgImageOverlay;
  const layers = activePage.layers;
  const strokes = activePage.strokes;

  // Helpers that mutate active page cleanly
  const updateActivePage = useCallback(
    (updater: (page: DesignPage) => DesignPage) => {
      setPages((prev) =>
        prev.map((pg, idx) => (idx === activePageIndex ? updater(pg) : pg))
      );
    },
    [activePageIndex]
  );

  const setLayers = useCallback(
    (arg: StudioLayer[] | ((prev: StudioLayer[]) => StudioLayer[])) => {
      updateActivePage((pg) => ({
        ...pg,
        layers: typeof arg === 'function' ? arg(pg.layers) : arg,
      }));
    },
    [updateActivePage]
  );

  const setStrokes = useCallback(
    (arg: DrawStroke[] | ((prev: DrawStroke[]) => DrawStroke[])) => {
      updateActivePage((pg) => ({
        ...pg,
        strokes: typeof arg === 'function' ? arg(pg.strokes) : arg,
      }));
    },
    [updateActivePage]
  );

  const setBgType = (v: 'solid' | 'gradient' | 'image') =>
    updateActivePage((pg) => ({ ...pg, bgType: v }));
  const setBgColor1 = (v: string) => updateActivePage((pg) => ({ ...pg, bgColor1: v }));
  const setBgColor2 = (v: string) => updateActivePage((pg) => ({ ...pg, bgColor2: v }));
  const setBgAngle = (v: number) => updateActivePage((pg) => ({ ...pg, bgAngle: v }));
  const setBgImageEl = (v: HTMLImageElement | null) =>
    updateActivePage((pg) => ({ ...pg, bgImageEl: v }));
  const setBgImageAssetKey = (v: string | undefined) =>
    updateActivePage((pg) => ({ ...pg, bgImageAssetKey: v }));
  const setBgImageOverlay = (v: number) =>
    updateActivePage((pg) => ({ ...pg, bgImageOverlay: v }));

  const [selectedLayerIds, setSelectedLayerIds] = useState<string[]>([]);
  const [workspaceZoom, setWorkspaceZoom] = useState<number>(100);
  const [panOffset, setPanOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isPanMode, setIsPanMode] = useState(false);
  const [snapEnabled, setSnapEnabled] = useState(true);
  const [snapGuides, setSnapGuides] = useState<SnapGuideLine[]>([]);

  // Undo / Redo history stacks
  const [historyPast, setHistoryPast] = useState<ProjectSnapshot[]>([]);
  const [historyFuture, setHistoryFuture] = useState<ProjectSnapshot[]>([]);
  const skipHistoryRef = useRef(false);

  // Freehand drawing
  const [isDrawMode, setIsDrawMode] = useState(false);
  const [brushColor, setBrushColor] = useState('#0b1f42');
  const [brushSize, setBrushSize] = useState(10);
  const activeStrokeRef = useRef<DrawStroke | null>(null);

  // Pointer interaction state (drag / handle resize / handle rotate / pan)
  const interactionRef = useRef<
    | {
        mode: 'drag';
        layerIds: string[];
        startX: number;
        startY: number;
        initialPos: Record<string, { x: number; y: number }>;
      }
    | {
        mode: 'resize';
        layerId: string;
        startDist: number;
        startFontSize?: number;
        startW?: number;
        startH?: number;
      }
    | {
        mode: 'rotate';
        layerId: string;
        cx: number;
        cy: number;
      }
    | {
        mode: 'pan';
        startClientX: number;
        startClientY: number;
        origPanX: number;
        origPanY: number;
      }
    | null
  >(null);

  const pinchStateRef = useRef<{
    startDist: number;
    layerId: string;
    startFontSize?: number;
    startWidth?: number;
    startHeight?: number;
  } | null>(null);

  const [notice, setNotice] = useState<string | null>(null);
  const [previewDataUrl, setPreviewDataUrl] = useState<string | null>(null);
  const [sharePayload, setSharePayload] = useState<SharePayload | null>(null);
  const [savedPreviews, setSavedPreviews] = useState<Record<string, string>>({});
  const [selectedCreationIds, setSelectedCreationIds] = useState<string[]>([]);
  const [confirmDeleteCreations, setConfirmDeleteCreations] = useState<CreativeDesignItem[] | null>(
    null
  );
  const [folderExplorerOpen, setFolderExplorerOpen] = useState(false);

  // Vector category filter
  const [vectorCategoryFilter, setVectorCategoryFilter] = useState<string>('all');

  // Template search & online discovery state
  const [templateQuery, setTemplateQuery] = useState('');
  const [templateCategory, setTemplateCategory] = useState('all');
  const [onlineTemplates, setOnlineTemplates] = useState<DesignTemplate[]>([]);
  const [templatePage, setTemplatePage] = useState(1);
  const [templateHasMore, setTemplateHasMore] = useState(true);
  const [isSearchingOnline, setIsSearchingOnline] = useState(false);
  const [isLoadingMoreTemplates, setIsLoadingMoreTemplates] = useState(false);
  const [onlineStatusMsg, setOnlineStatusMsg] = useState<string | null>(null);
  const [savingShalomId, setSavingShalomId] = useState<string | null>(null);

  // Online Elements / Images / Backgrounds discovery state
  const [onlineElementQuery, setOnlineElementQuery] = useState('');
  const [onlineElements, setOnlineElements] = useState<OnlineAssetItem[]>([]);
  const [onlineElementPage, setOnlineElementPage] = useState(1);
  const [onlineElementHasMore, setOnlineElementHasMore] = useState(true);
  const [isSearchingElements, setIsSearchingElements] = useState(false);

  const [onlineImageQuery, setOnlineImageQuery] = useState('');
  const [onlineImages, setOnlineImages] = useState<OnlineAssetItem[]>([]);
  const [onlineImagePage, setOnlineImagePage] = useState(1);
  const [onlineImageHasMore, setOnlineImageHasMore] = useState(true);
  const [isSearchingImages, setIsSearchingImages] = useState(false);

  const [onlineBgQuery, setOnlineBgQuery] = useState('');
  const [onlineBackgrounds, setOnlineBackgrounds] = useState<OnlineAssetItem[]>([]);
  const [onlineBgPage, setOnlineBgPage] = useState(1);
  const [onlineBgHasMore, setOnlineBgHasMore] = useState(true);
  const [isSearchingBgs, setIsSearchingBgs] = useState(false);
  const [loadingAssetId, setLoadingAssetId] = useState<string | null>(null);

  // Modal / Presentation Slideshow & Image Crop state
  const [previewingTemplate, setPreviewingTemplate] = useState<DesignTemplate | null>(null);
  const [cropTargetLayerId, setCropTargetLayerId] = useState<string | null>(null);
  const [draggingPageIdx, setDraggingPageIdx] = useState<number | null>(null);
  const [slideshowOpen, setSlideshowOpen] = useState(false);
  const [slideshowIndex, setSlideshowIndex] = useState(0);
  const [slideshowPlaying, setSlideshowPlaying] = useState(false);
  const [slideshowSlideUrls, setSlideshowSlideUrls] = useState<string[]>([]);

  // Layer panel drag-and-drop, clipboard, touch multi-select & inline text editing state
  const [draggingLayerId, setDraggingLayerId] = useState<string | null>(null);
  const [dragOverLayerId, setDragOverLayerId] = useState<string | null>(null);
  const [copiedLayers, setCopiedLayers] = useState<StudioLayer[]>([]);
  const [isMultiSelectMode, setIsMultiSelectMode] = useState(false);
  const [inlineEditLayerId, setInlineEditLayerId] = useState<string | null>(null);
  const [inlineEditText, setInlineEditText] = useState('');
  const lastCanvasTapRef = useRef<{ layerId: string; ts: number } | null>(null);

  const dims = FORMAT_DIMS[formatRatio] || FORMAT_DIMS.square;
  const primarySelectedId = selectedLayerIds[selectedLayerIds.length - 1] || null;
  const selectedLayer = layers.find((l) => l.id === primarySelectedId) || null;
  const cropTargetLayer =
    (cropTargetLayerId
      ? layers.find((l): l is ImageLayer => l.id === cropTargetLayerId && l.kind === 'image')
      : null) || null;

  const selectedGroupIds = useMemo(() => {
    const s = new Set<string>();
    layers.forEach((l) => {
      if (selectedLayerIds.includes(l.id) && l.groupId) s.add(l.groupId);
    });
    return Array.from(s);
  }, [layers, selectedLayerIds]);

  const designCreations = useMemo(
    () =>
      creations.filter((c) =>
        isPresentation ? c.studioType === 'presentation' : !c.studioType || c.studioType === 'design'
      ),
    [creations, isPresentation]
  );

  const createCurrentSnapshot = useCallback((): ProjectSnapshot => {
    return {
      version: 3,
      designTitle,
      formatRatio,
      activePageIndex,
      pages: pages.map((pg) => ({
        id: pg.id,
        name: pg.name,
        transition: pg.transition,
        bgType: pg.bgType,
        bgColor1: pg.bgColor1,
        bgColor2: pg.bgColor2,
        bgAngle: pg.bgAngle,
        bgImageAssetKey: pg.bgImageAssetKey,
        bgImageOverlay: pg.bgImageOverlay,
        layers: serializeLayers(pg.layers),
        strokes: pg.strokes.map((s) => ({ ...s, points: [...s.points] })),
      })),
    };
  }, [designTitle, formatRatio, activePageIndex, pages]);

  const pushUndoSnapshot = useCallback(() => {
    if (skipHistoryRef.current) return;
    const snap = createCurrentSnapshot();
    setHistoryPast((prev) => [...prev.slice(-24), snap]);
    setHistoryFuture([]);
  }, [createCurrentSnapshot]);

  const applySnapshot = useCallback(
    async (snap: ProjectSnapshot) => {
      if (!snap || typeof snap !== 'object') return;
      skipHistoryRef.current = true;
      setDesignTitle(
        snap.designTitle ||
          (isPresentation ? (isEn ? 'My Presentation' : 'Ma présentation') : isEn ? 'My Creation' : 'Ma création')
      );
      setFormatRatio(snap.formatRatio || (isPresentation ? 'landscape' : 'square'));

      const serializePages: SerializedDesignPage[] =
        Array.isArray(snap.pages) && snap.pages.length > 0
          ? snap.pages
          : [
              {
                id: `pg_${Date.now()}`,
                name: isPresentation ? 'Diapo 1' : 'Page 1',
                transition: isPresentation ? 'fade' : 'none',
                bgType: snap.bgType || (isPresentation ? 'gradient' : 'solid'),
                bgColor1: snap.bgColor1 || (isPresentation ? '#0b1f42' : '#ffffff'),
                bgColor2: snap.bgColor2 || '#173c7a',
                bgAngle: snap.bgAngle ?? 135,
                bgImageAssetKey: snap.bgImageAssetKey,
                bgImageOverlay: snap.bgImageOverlay ?? 0.2,
                layers: Array.isArray(snap.layers) ? snap.layers : [],
                strokes: Array.isArray(snap.strokes) ? snap.strokes : [],
              },
            ];

      const hydratedPages: DesignPage[] = [];
      for (let i = 0; i < serializePages.length; i++) {
        const sp = serializePages[i];
        if (!sp || typeof sp !== 'object') continue;
        let bgImg: HTMLImageElement | null = null;
        if (sp.bgImageAssetKey) {
          try {
            const b = await dbService.getMediaBlob(sp.bgImageAssetKey);
            if (b) {
              bgImg = await loadImageFromBlob(b).catch(() => null);
            }
          } catch {
            bgImg = null;
          }
        }
        const hydratedLayers = await hydrateLayers(Array.isArray(sp.layers) ? sp.layers : []);
        hydratedPages.push({
          id: sp.id || `pg_${i}`,
          name: sp.name || (isPresentation ? `Diapo ${i + 1}` : `Page ${i + 1}`),
          transition: sp.transition || (isPresentation ? 'fade' : 'none'),
          bgType: sp.bgType || 'solid',
          bgColor1: sp.bgColor1 || '#ffffff',
          bgColor2: sp.bgColor2 || '#173c7a',
          bgAngle: sp.bgAngle ?? 135,
          bgImageEl: bgImg,
          bgImageAssetKey: sp.bgImageAssetKey,
          bgImageOverlay: sp.bgImageOverlay ?? 0.2,
          layers: hydratedLayers,
          strokes: Array.isArray(sp.strokes) ? sp.strokes : [],
        });
      }

      const finalPages = hydratedPages.length > 0 ? hydratedPages : [createBlankPage(0, isPresentation)];
      setPages(finalPages);
      setActivePageIndex(
        Math.max(0, Math.min(finalPages.length - 1, Number(snap.activePageIndex) || 0))
      );
      setSelectedLayerIds([]);
      window.setTimeout(() => {
        skipHistoryRef.current = false;
      }, 50);
    },
    [isPresentation, isEn]
  );

  const handleUndo = useCallback(async () => {
    if (historyPast.length === 0) return;
    const current = createCurrentSnapshot();
    const target = historyPast[historyPast.length - 1];
    setHistoryPast((prev) => prev.slice(0, -1));
    setHistoryFuture((prev) => [current, ...prev.slice(0, 24)]);
    await applySnapshot(target);
  }, [historyPast, createCurrentSnapshot, applySnapshot]);

  const handleRedo = useCallback(async () => {
    if (historyFuture.length === 0) return;
    const current = createCurrentSnapshot();
    const target = historyFuture[0];
    setHistoryFuture((prev) => prev.slice(1));
    setHistoryPast((prev) => [...prev.slice(-24), current]);
    await applySnapshot(target);
  }, [historyFuture, createCurrentSnapshot, applySnapshot]);

  // Auto-restore draft for this specific studio mode
  useEffect(() => {
    let active = true;
    (async () => {
      const draft = await loadStudioDraft(studioMode);
      if (draft?.projectJson && active && !draftRestoredRef.current) {
        try {
          const parsed = JSON.parse(draft.projectJson) as ProjectSnapshot;
          await applySnapshot(parsed);
        } catch {
          // ignore malformed draft
        }
      }
      draftRestoredRef.current = true;
    })();
    return () => {
      active = false;
    };
  }, [applySnapshot, studioMode]);

  // Debounced draft auto-save
  useEffect(() => {
    if (!draftRestoredRef.current) return;
    const snap = createCurrentSnapshot();
    const assetKeys = new Set<string>();
    (snap.pages || []).forEach((pg) => {
      if (pg.bgImageAssetKey) assetKeys.add(pg.bgImageAssetKey);
      pg.layers.forEach((l) => {
        if (l.assetKey) assetKeys.add(l.assetKey);
      });
    });
    const timer = window.setTimeout(() => {
      saveStudioDraft(studioMode, snap.designTitle, JSON.stringify(snap), Array.from(assetKeys)).catch(
        () => {}
      );
    }, 450);
    return () => clearTimeout(timer);
  }, [createCurrentSnapshot, studioMode]);

  const handleCopySelectedLayers = useCallback(() => {
    const picked = layers.filter((l) => selectedLayerIds.includes(l.id));
    if (picked.length === 0) return;
    setCopiedLayers(picked.map((l) => ({ ...l } as StudioLayer)));
    setNotice(isEn ? `Copied ${picked.length} layer(s).` : `${picked.length} calque(s) copié(s).`);
  }, [layers, selectedLayerIds, isEn]);

  const handlePasteCopiedLayers = useCallback(() => {
    if (copiedLayers.length === 0) return;
    pushUndoSnapshot();
    const newIds: string[] = [];
    const pasted: StudioLayer[] = copiedLayers.map((l, idx) => {
      const nid = `${l.kind}_${Date.now()}_p${idx}`;
      newIds.push(nid);
      return {
        ...l,
        id: nid,
        groupId: undefined,
        x: Math.min(dims.w - 40, l.x + 48),
        y: Math.min(dims.h - 40, l.y + 48),
        locked: false,
      } as StudioLayer;
    });
    setLayers((prev) => [...prev, ...pasted]);
    setSelectedLayerIds(newIds);
  }, [copiedLayers, dims.w, dims.h, pushUndoSnapshot, setLayers]);

  const handleGroupSelected = useCallback(() => {
    if (selectedLayerIds.length < 2) return;
    pushUndoSnapshot();
    const gid = generateGroupId();
    setLayers((prev) =>
      prev.map((l) => (selectedLayerIds.includes(l.id) ? { ...l, groupId: gid } : l))
    );
    setNotice(isEn ? 'Layers grouped.' : 'Calques groupés ensemble.');
  }, [selectedLayerIds, pushUndoSnapshot, setLayers, isEn]);

  const handleUngroupSelected = useCallback(() => {
    if (selectedGroupIds.length === 0) return;
    pushUndoSnapshot();
    setLayers((prev) =>
      prev.map((l) =>
        l.groupId && selectedGroupIds.includes(l.groupId) ? { ...l, groupId: undefined } : l
      )
    );
    setNotice(isEn ? 'Group ungrouped.' : 'Groupe dissocié.');
  }, [selectedGroupIds, pushUndoSnapshot, setLayers, isEn]);

  const openInlineTextEditor = useCallback((layer: TextLayer) => {
    if (layer.locked) return;
    setInlineEditLayerId(layer.id);
    setInlineEditText(layer.text);
    setSelectedLayerIds([layer.id]);
  }, []);

  const commitInlineTextEditor = useCallback(() => {
    if (!inlineEditLayerId) return;
    pushUndoSnapshot();
    setLayers((prev) =>
      prev.map((l) =>
        l.id === inlineEditLayerId && l.kind === 'text' ? { ...l, text: inlineEditText } : l
      )
    );
    setInlineEditLayerId(null);
  }, [inlineEditLayerId, inlineEditText, pushUndoSnapshot, setLayers]);

  const duplicateSelectedLayers = useCallback(() => {
    if (selectedLayerIds.length === 0) return;
    pushUndoSnapshot();
    const newIds: string[] = [];
    const copies: StudioLayer[] = [];
    layers.forEach((l, idx) => {
      if (selectedLayerIds.includes(l.id)) {
        const nid = `${l.kind}_${Date.now()}_${idx}`;
        newIds.push(nid);
        copies.push({
          ...l,
          id: nid,
          groupId: undefined,
          x: l.x + 40,
          y: l.y + 40,
          locked: false,
        } as StudioLayer);
      }
    });
    setLayers((prev) => [...prev, ...copies]);
    setSelectedLayerIds(newIds);
  }, [selectedLayerIds, pushUndoSnapshot, layers, setLayers]);

  // Keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) handleRedo();
        else handleUndo();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        handleRedo();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c') {
        if (selectedLayerIds.length > 0) {
          e.preventDefault();
          handleCopySelectedLayers();
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'v') {
        if (copiedLayers.length > 0) {
          e.preventDefault();
          handlePasteCopiedLayers();
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd') {
        if (selectedLayerIds.length > 0) {
          e.preventDefault();
          duplicateSelectedLayers();
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'g') {
        e.preventDefault();
        if (e.shiftKey) handleUngroupSelected();
        else handleGroupSelected();
      } else if (
        ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key) &&
        selectedLayerIds.length > 0
      ) {
        e.preventDefault();
        const step = e.shiftKey ? 15 : 3;
        const dx = e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0;
        const dy = e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0;
        setLayers((prev) =>
          prev.map((l) =>
            selectedLayerIds.includes(l.id) && !l.locked ? { ...l, x: l.x + dx, y: l.y + dy } : l
          )
        );
      } else if ((e.key === 'Delete' || e.key === 'Backspace') && selectedLayerIds.length > 0) {
        e.preventDefault();
        pushUndoSnapshot();
        setLayers((prev) => prev.filter((l) => !selectedLayerIds.includes(l.id) || l.locked));
        setSelectedLayerIds([]);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [
    handleUndo,
    handleRedo,
    handleCopySelectedLayers,
    handlePasteCopiedLayers,
    duplicateSelectedLayers,
    handleGroupSelected,
    handleUngroupSelected,
    copiedLayers.length,
    selectedLayerIds,
    pushUndoSnapshot,
    setLayers,
  ]);

  // Open inspector automatically when selecting an item on desktop if useful
  useEffect(() => {
    if (selectedLayer && typeof window !== 'undefined' && window.innerWidth >= 1280) {
      setIsInspectorOpen(true);
    }
  }, [selectedLayer?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    let cancelled = false;
    const urls: string[] = [];
    (async () => {
      const next: Record<string, string> = {};
      for (const item of designCreations) {
        if (!item.mediaBlobKey) continue;
        try {
          const blob = await dbService.getMediaBlob(item.mediaBlobKey);
          if (blob && !cancelled) {
            const url = URL.createObjectURL(blob);
            urls.push(url);
            next[item.id] = url;
          }
        } catch {
          // ignore unreadable preview
        }
      }
      if (!cancelled) setSavedPreviews(next);
    })();
    return () => {
      cancelled = true;
      urls.forEach((u) => URL.revokeObjectURL(u));
    };
  }, [designCreations]);

  const getLayerBoundingBox = useCallback(
    (ctx: CanvasRenderingContext2D, layer: StudioLayer): { w: number; h: number } => {
      if (layer.kind === 'text') {
        ctx.save();
        ctx.font = `${layer.italic ? 'italic ' : ''}${layer.bold ? '700 ' : '400 '}${layer.fontSize}px ${layer.fontFamily}`;
        if (layer.letterSpacing) {
          safeSetLetterSpacing(ctx, layer.letterSpacing);
        }
        const display = layer.uppercase ? layer.text.toUpperCase() : layer.text;
        const lines = display.split('\n');
        const maxW = Math.max(120, ...lines.map((ln) => ctx.measureText(ln).width)) + 48;
        const lhRatio = layer.lineHeight || 1.28;
        const h = Math.max(64, lines.length * layer.fontSize * lhRatio + 28);
        ctx.restore();
        return { w: maxW, h };
      }
      return { w: layer.width, h: layer.height };
    },
    []
  );

  // Pure page renderer (used for main interactive canvas, offscreen multi-page PDF, and presentation slideshow)
  const renderPageToCanvas = useCallback(
    (
      canvas: HTMLCanvasElement,
      page: DesignPage,
      showSelectionBox: boolean
    ) => {
      canvas.width = dims.w;
      canvas.height = dims.h;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // 1. Background
      if (page.bgType === 'solid') {
        ctx.fillStyle = page.bgColor1;
        ctx.fillRect(0, 0, dims.w, dims.h);
      } else if (page.bgType === 'gradient') {
        const rad = (page.bgAngle * Math.PI) / 180;
        const cx = dims.w / 2;
        const cy = dims.h / 2;
        const r = Math.max(dims.w, dims.h) / 2;
        const grad = ctx.createLinearGradient(
          cx - Math.cos(rad) * r,
          cy - Math.sin(rad) * r,
          cx + Math.cos(rad) * r,
          cy + Math.sin(rad) * r
        );
        grad.addColorStop(0, page.bgColor1);
        grad.addColorStop(1, page.bgColor2);
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, dims.w, dims.h);
      } else if (page.bgType === 'image' && page.bgImageEl) {
        ctx.fillStyle = page.bgColor1;
        ctx.fillRect(0, 0, dims.w, dims.h);
        const bw = page.bgImageEl.naturalWidth || page.bgImageEl.width || dims.w;
        const bh = page.bgImageEl.naturalHeight || page.bgImageEl.height || dims.h;
        const iRatio = bw / Math.max(1, bh);
        const cRatio = dims.w / dims.h;
        let dw = dims.w;
        let dh = dims.h;
        let dx = 0;
        let dy = 0;
        if (iRatio > cRatio) {
          dh = dims.h;
          dw = dims.h * iRatio;
          dx = (dims.w - dw) / 2;
        } else {
          dw = dims.w;
          dh = dims.w / iRatio;
          dy = (dims.h - dh) / 2;
        }
        safeDrawMedia(ctx, page.bgImageEl, dx, dy, dw, dh);
        if (page.bgImageOverlay > 0) {
          ctx.fillStyle = `rgba(0,0,0,${page.bgImageOverlay})`;
          ctx.fillRect(0, 0, dims.w, dims.h);
        }
      } else {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, dims.w, dims.h);
      }

      // 2. Layers
      for (const layer of page.layers) {
        if (layer.visible === false) continue;
        ctx.save();
        ctx.globalAlpha = layer.opacity;
        ctx.translate(layer.x, layer.y);
        ctx.rotate((layer.rotation * Math.PI) / 180);

        if (layer.kind === 'shape') {
          drawStudioVectorElement(
            ctx,
            layer.shape,
            layer.width,
            layer.height,
            layer.fillColor,
            layer.strokeColor,
            layer.strokeWidth,
            layer.secondaryColor
          );
        } else if (layer.kind === 'image') {
          const hw = layer.width / 2;
          const hh = layer.height / 2;
          if (layer.filter === 'grayscale') safeApplyCanvasFilter(ctx, 'grayscale(100%)');
          else if (layer.filter === 'sepia') safeApplyCanvasFilter(ctx, 'sepia(85%)');
          else if (layer.filter === 'warm') safeApplyCanvasFilter(ctx, 'saturate(135%) contrast(105%)');
          else if (layer.filter === 'bright') safeApplyCanvasFilter(ctx, 'brightness(118%) contrast(105%)');
          if (layer.circular) {
            ctx.beginPath();
            ctx.ellipse(0, 0, hw, hh, 0, 0, Math.PI * 2);
            ctx.closePath();
            ctx.clip();
          }
          const natW = layer.imageEl.naturalWidth || layer.imageEl.width || 0;
          const natH = layer.imageEl.naturalHeight || layer.imageEl.height || 0;
          const cx = Math.max(0, Math.min(0.95, layer.cropX ?? 0));
          const cy = Math.max(0, Math.min(0.95, layer.cropY ?? 0));
          const cw = Math.max(0.05, Math.min(1 - cx, layer.cropW ?? 1));
          const ch = Math.max(0.05, Math.min(1 - cy, layer.cropH ?? 1));
          if (natW > 0 && natH > 0) {
            safeDrawMedia(
              ctx,
              layer.imageEl,
              cx * natW,
              cy * natH,
              cw * natW,
              ch * natH,
              -hw,
              -hh,
              layer.width,
              layer.height
            );
          }
          safeApplyCanvasFilter(ctx, 'none');
        } else if (layer.kind === 'text') {
          ctx.font = `${layer.italic ? 'italic ' : ''}${layer.bold ? '700 ' : '400 '}${layer.fontSize}px ${layer.fontFamily}`;
          safeSetLetterSpacing(ctx, layer.letterSpacing || 0);
          ctx.textAlign = layer.align;
          ctx.textBaseline = 'middle';
          const displayText = layer.uppercase ? layer.text.toUpperCase() : layer.text;
          const lines = displayText.split('\n');
          const lineH = layer.fontSize * (layer.lineHeight || 1.28);
          const maxLineW = Math.max(40, ...lines.map((ln) => ctx.measureText(ln).width));
          const totalH = lines.length * lineH;

          if (layer.bgEnabled) {
            ctx.fillStyle = layer.bgColor;
            ctx.beginPath();
            drawRoundedRectPath(ctx, -maxLineW / 2 - 26, -totalH / 2 - 14, maxLineW + 52, totalH + 28, 18);
            ctx.fill();
          }

          if (layer.shadow) {
            ctx.shadowColor = 'rgba(0,0,0,0.45)';
            ctx.shadowBlur = 14;
            ctx.shadowOffsetY = 5;
          }

          const startY = -((lines.length - 1) * lineH) / 2;
          lines.forEach((ln, idx) => {
            const tx =
              layer.align === 'left' ? -maxLineW / 2 : layer.align === 'right' ? maxLineW / 2 : 0;
            const ty = startY + idx * lineH;
            if ((layer.strokeWidth || 0) > 0) {
              ctx.strokeStyle = layer.strokeColor || '#000000';
              ctx.lineWidth = layer.strokeWidth || 2;
              ctx.lineJoin = 'round';
              ctx.strokeText(ln, tx, ty);
            }
            ctx.fillStyle = layer.color;
            ctx.fillText(ln, tx, ty);

            if (layer.underline || layer.strikethrough) {
              const lw = ctx.measureText(ln).width;
              const xStart =
                layer.align === 'left' ? tx : layer.align === 'right' ? tx - lw : tx - lw / 2;
              ctx.save();
              ctx.shadowColor = 'transparent';
              ctx.strokeStyle = layer.color;
              ctx.lineWidth = Math.max(2, Math.round(layer.fontSize * 0.06));
              if (layer.underline) {
                const uy = ty + layer.fontSize * 0.44;
                ctx.beginPath();
                ctx.moveTo(xStart, uy);
                ctx.lineTo(xStart + lw, uy);
                ctx.stroke();
              }
              if (layer.strikethrough) {
                ctx.beginPath();
                ctx.moveTo(xStart, ty);
                ctx.lineTo(xStart + lw, ty);
                ctx.stroke();
              }
              ctx.restore();
            }
          });
        }

        // Selection box + corner resize & top rotate handles
        if (showSelectionBox && selectedLayerIds.includes(layer.id)) {
          const box = getLayerBoundingBox(ctx, layer);
          const hw = box.w / 2 + 12;
          const hh = box.h / 2 + 12;

          ctx.shadowColor = 'transparent';
          ctx.strokeStyle = layer.locked
            ? '#f59e0b'
            : layer.groupId
              ? '#8b5cf6'
              : '#2563eb';
          ctx.lineWidth = 3;
          ctx.setLineDash([10, 6]);
          ctx.strokeRect(-hw, -hh, hw * 2, hh * 2);

          if (!layer.locked && layer.id === primarySelectedId) {
            ctx.setLineDash([]);
            ctx.fillStyle = '#ffffff';
            ctx.strokeStyle = '#2563eb';
            ctx.lineWidth = 3;
            const corners = [
              [-hw, -hh],
              [hw, -hh],
              [hw, hh],
              [-hw, hh],
            ];
            for (const [cx, cy] of corners) {
              ctx.beginPath();
              ctx.arc(cx, cy, 13, 0, Math.PI * 2);
              ctx.fill();
              ctx.stroke();
            }
            ctx.beginPath();
            ctx.moveTo(0, -hh);
            ctx.lineTo(0, -hh - 36);
            ctx.stroke();
            ctx.beginPath();
            ctx.arc(0, -hh - 44, 14, 0, Math.PI * 2);
            ctx.fillStyle = '#fbbf24';
            ctx.fill();
            ctx.stroke();
          }
        }

        ctx.restore();
      }

      // 3. Freehand strokes
      const allStrokes =
        showSelectionBox && activeStrokeRef.current
          ? [...page.strokes, activeStrokeRef.current]
          : page.strokes;
      for (const s of allStrokes) {
        if (s.points.length < 2) continue;
        ctx.save();
        ctx.strokeStyle = s.color;
        ctx.lineWidth = s.size;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(s.points[0].x, s.points[0].y);
        for (let i = 1; i < s.points.length; i++) {
          ctx.lineTo(s.points[i].x, s.points[i].y);
        }
        ctx.stroke();
        ctx.restore();
      }

      // 4. Multi-Axis Smart Snap Guides
      if (showSelectionBox && snapEnabled && snapGuides.length > 0) {
        for (const g of snapGuides) {
          ctx.save();
          ctx.strokeStyle = g.kind === 'layer' ? '#f43f5e' : '#38bdf8';
          ctx.lineWidth = g.kind === 'center' ? 2.5 : 2;
          ctx.setLineDash(g.kind === 'layer' ? [6, 4] : [8, 6]);
          ctx.beginPath();
          if (g.axis === 'x') {
            ctx.moveTo(g.pos, 0);
            ctx.lineTo(g.pos, dims.h);
          } else {
            ctx.moveTo(0, g.pos);
            ctx.lineTo(dims.w, g.pos);
          }
          ctx.stroke();
          ctx.restore();
        }
      }
    },
    [dims, selectedLayerIds, primarySelectedId, snapEnabled, snapGuides, getLayerBoundingBox]
  );

  const renderCanvas = useCallback(
    (showSelectionBox = true) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      renderPageToCanvas(canvas, activePage, showSelectionBox);
    },
    [renderPageToCanvas, activePage]
  );

  useEffect(() => {
    renderCanvas(true);
  }, [renderCanvas]);

  const getCanvasPoint = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * dims.w,
      y: ((e.clientY - rect.top) / rect.height) * dims.h,
    };
  };

  const toLayerLocal = (pt: { x: number; y: number }, layer: StudioLayer) => {
    const dx = pt.x - layer.x;
    const dy = pt.y - layer.y;
    const rad = -(layer.rotation * Math.PI) / 180;
    return {
      lx: dx * Math.cos(rad) - dy * Math.sin(rad),
      ly: dx * Math.sin(rad) + dy * Math.cos(rad),
    };
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (pinchStateRef.current) return;
    if (isPanMode || e.button === 1) {
      interactionRef.current = {
        mode: 'pan',
        startClientX: e.clientX,
        startClientY: e.clientY,
        origPanX: panOffset.x,
        origPanY: panOffset.y,
      };
      return;
    }

    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    const pt = getCanvasPoint(e);

    if (isDrawMode) {
      try {
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      } catch {
        // noop
      }
      pushUndoSnapshot();
      const stroke: DrawStroke = {
        id: `stk_${Date.now()}`,
        color: brushColor,
        size: brushSize,
        points: [pt],
      };
      activeStrokeRef.current = stroke;
      renderCanvas(true);
      return;
    }

    if (selectedLayer && !selectedLayer.locked && ctx) {
      const box = getLayerBoundingBox(ctx, selectedLayer);
      const hw = box.w / 2 + 12;
      const hh = box.h / 2 + 12;
      const { lx, ly } = toLayerLocal(pt, selectedLayer);

      if (Math.hypot(lx, ly - (-hh - 44)) <= 34) {
        try {
          (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        } catch {
          // noop
        }
        pushUndoSnapshot();
        interactionRef.current = {
          mode: 'rotate',
          layerId: selectedLayer.id,
          cx: selectedLayer.x,
          cy: selectedLayer.y,
        };
        return;
      }

      const corners = [
        [-hw, -hh],
        [hw, -hh],
        [hw, hh],
        [-hw, hh],
      ];
      if (corners.some(([cx, cy]) => Math.hypot(lx - cx, ly - cy) <= 34)) {
        try {
          (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        } catch {
          // noop
        }
        pushUndoSnapshot();
        interactionRef.current = {
          mode: 'resize',
          layerId: selectedLayer.id,
          startDist: Math.max(20, Math.hypot(pt.x - selectedLayer.x, pt.y - selectedLayer.y)),
          startFontSize: selectedLayer.kind === 'text' ? selectedLayer.fontSize : undefined,
          startW: selectedLayer.kind !== 'text' ? selectedLayer.width : undefined,
          startH: selectedLayer.kind !== 'text' ? selectedLayer.height : undefined,
        };
        return;
      }
    }

    for (let i = layers.length - 1; i >= 0; i--) {
      const l = layers[i];
      if (l.visible === false) continue;
      const box = ctx ? getLayerBoundingBox(ctx, l) : { w: 280, h: 120 };
      const { lx, ly } = toLayerLocal(pt, l);
      const insideOuter = Math.abs(lx) <= box.w / 2 + 24 && Math.abs(ly) <= box.h / 2 + 24;
      let isHit = insideOuter;
      if (isHit && l.kind === 'shape' && l.shape === 'frame') {
        const inset = Math.min(l.width, l.height) * 0.14;
        const inInnerHollow =
          Math.abs(lx) < l.width / 2 - inset && Math.abs(ly) < l.height / 2 - inset;
        if (inInnerHollow) isHit = false;
      }

      if (isHit) {
        const groupMembers = l.groupId
          ? layers.filter((m) => m.groupId === l.groupId).map((m) => m.id)
          : [l.id];

        let nextSelIds = selectedLayerIds;
        if (e.shiftKey || isMultiSelectMode) {
          const allIn = groupMembers.every((gid) => selectedLayerIds.includes(gid));
          nextSelIds = allIn
            ? selectedLayerIds.filter((id) => !groupMembers.includes(id))
            : Array.from(new Set([...selectedLayerIds, ...groupMembers]));
          setSelectedLayerIds(nextSelIds);
        } else {
          const now = Date.now();
          if (
            l.kind === 'text' &&
            !l.locked &&
            lastCanvasTapRef.current &&
            lastCanvasTapRef.current.layerId === l.id &&
            now - lastCanvasTapRef.current.ts < 360
          ) {
            lastCanvasTapRef.current = null;
            openInlineTextEditor(l);
            return;
          }
          lastCanvasTapRef.current = { layerId: l.id, ts: now };
          if (!selectedLayerIds.includes(l.id)) {
            nextSelIds = groupMembers;
            setSelectedLayerIds(nextSelIds);
          }
        }

        if (l.locked) return;
        try {
          (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        } catch {
          // noop
        }
        pushUndoSnapshot();

        const moveIds = nextSelIds.filter((id) => {
          const item = layers.find((x) => x.id === id);
          return item && !item.locked;
        });
        const initialPos: Record<string, { x: number; y: number }> = {};
        moveIds.forEach((id) => {
          const item = layers.find((x) => x.id === id);
          if (item) initialPos[id] = { x: item.x, y: item.y };
        });

        interactionRef.current = {
          mode: 'drag',
          layerIds: moveIds,
          startX: pt.x,
          startY: pt.y,
          initialPos,
        };
        return;
      }
    }
    setSelectedLayerIds([]);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (pinchStateRef.current) return;
    const inter = interactionRef.current;
    if (inter?.mode === 'pan') {
      setPanOffset({
        x: inter.origPanX + (e.clientX - inter.startClientX),
        y: inter.origPanY + (e.clientY - inter.startClientY),
      });
      return;
    }

    const pt = getCanvasPoint(e);
    if (isDrawMode && activeStrokeRef.current) {
      activeStrokeRef.current.points.push(pt);
      renderCanvas(true);
      return;
    }

    if (!inter) return;

    if (inter.mode === 'drag') {
      const dx = pt.x - inter.startX;
      const dy = pt.y - inter.startY;
      let snapDx = 0;
      let snapDy = 0;
      let nextGuides: SnapGuideLine[] = [];

      const ctx = canvasRef.current?.getContext('2d');
      if (snapEnabled && inter.layerIds.length >= 1 && ctx) {
        const primaryId = inter.layerIds[0];
        const primaryLayer = layers.find((l) => l.id === primaryId);
        const primaryInit = inter.initialPos[primaryId];
        if (primaryLayer && primaryInit) {
          const box = getLayerBoundingBox(ctx, primaryLayer);
          const otherBounds = layers
            .filter((o) => !inter.layerIds.includes(o.id) && o.visible !== false)
            .map((o) => {
              const ob = getLayerBoundingBox(ctx, o);
              return { id: o.id, cx: o.x, cy: o.y, w: ob.w, h: ob.h, rotationDeg: o.rotation };
            });
          const res = computeSmartSnap(
            {
              id: primaryLayer.id,
              cx: primaryInit.x + dx,
              cy: primaryInit.y + dy,
              w: box.w,
              h: box.h,
              rotationDeg: primaryLayer.rotation,
            },
            otherBounds,
            dims.w,
            dims.h,
            workspaceZoom / 100
          );
          snapDx = res.dx;
          snapDy = res.dy;
          nextGuides = res.guides;
        }
      }

      setLayers((prev) =>
        prev.map((l) => {
          if (!inter.layerIds.includes(l.id)) return l;
          const init = inter.initialPos[l.id];
          if (!init) return l;
          return { ...l, x: init.x + dx + snapDx, y: init.y + dy + snapDy };
        })
      );
      setSnapGuides(nextGuides);
    } else if (inter.mode === 'resize') {
      const target = layers.find((l) => l.id === inter.layerId);
      if (!target) return;
      const curDist = Math.max(20, Math.hypot(pt.x - target.x, pt.y - target.y));
      const scale = curDist / inter.startDist;
      setLayers((prev) =>
        prev.map((l) => {
          if (l.id !== inter.layerId) return l;
          if (l.kind === 'text' && inter.startFontSize) {
            return {
              ...l,
              fontSize: Math.max(14, Math.min(280, Math.round(inter.startFontSize * scale))),
            };
          }
          if (l.kind !== 'text' && inter.startW && inter.startH) {
            return {
              ...l,
              width: Math.max(24, Math.min(1800, Math.round(inter.startW * scale))),
              height: Math.max(14, Math.min(1800, Math.round(inter.startH * scale))),
            };
          }
          return l;
        })
      );
    } else if (inter.mode === 'rotate') {
      const deg = Math.round(((Math.atan2(pt.y - inter.cy, pt.x - inter.cx) * 180) / Math.PI + 90) % 360);
      setLayers((prev) =>
        prev.map((l) => (l.id === inter.layerId ? { ...l, rotation: deg > 180 ? deg - 360 : deg } : l))
      );
    }
  };

  const handlePointerUp = (e?: React.PointerEvent<HTMLCanvasElement>) => {
    if (e) {
      try {
        (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {
        // noop
      }
    }
    if (isDrawMode && activeStrokeRef.current) {
      const finished = activeStrokeRef.current;
      activeStrokeRef.current = null;
      setStrokes((prev) => [...prev, finished]);
    }
    interactionRef.current = null;
    setSnapGuides([]);
  };

  const handleTouchStart = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (e.touches.length !== 2) return;
    interactionRef.current = null;
    activeStrokeRef.current = null;
    const t1 = e.touches[0];
    const t2 = e.touches[1];
    const dist = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
    if (dist <= 0 || !selectedLayer || selectedLayer.locked) return;
    pushUndoSnapshot();
    pinchStateRef.current = {
      startDist: dist,
      layerId: selectedLayer.id,
      startFontSize: selectedLayer.kind === 'text' ? selectedLayer.fontSize : undefined,
      startWidth: selectedLayer.kind !== 'text' ? selectedLayer.width : undefined,
      startHeight: selectedLayer.kind !== 'text' ? selectedLayer.height : undefined,
    };
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (!pinchStateRef.current || e.touches.length < 2) return;
    const t1 = e.touches[0];
    const t2 = e.touches[1];
    const dist = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
    const { startDist, layerId, startFontSize, startWidth, startHeight } = pinchStateRef.current;
    const scale = dist / Math.max(1, startDist);
    setLayers((prev) =>
      prev.map((l) => {
        if (l.id !== layerId) return l;
        if (l.kind === 'text' && startFontSize) {
          return { ...l, fontSize: Math.max(14, Math.min(280, Math.round(startFontSize * scale))) };
        }
        if (l.kind !== 'text' && startWidth && startHeight) {
          return {
            ...l,
            width: Math.max(20, Math.min(1600, Math.round(startWidth * scale))),
            height: Math.max(10, Math.min(1600, Math.round(startHeight * scale))),
          };
        }
        return l;
      })
    );
  };

  const handleTouchEnd = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (e.touches.length < 2) pinchStateRef.current = null;
  };

  // Multi-page / slide operations
  const handleAddPage = () => {
    pushUndoSnapshot();
    const newPg = createBlankPage(pages.length, isPresentation);
    setPages((prev) => [...prev, newPg]);
    setActivePageIndex(pages.length);
    setSelectedLayerIds([]);
  };

  const handleDuplicatePage = (idx: number) => {
    const src = pages[idx];
    if (!src) return;
    pushUndoSnapshot();
    const copy: DesignPage = {
      ...src,
      id: `pg_${Date.now()}`,
      name: `${src.name} (copie)`,
      layers: src.layers.map((l, i) => ({ ...l, id: `${l.id}_cp_${i}` } as StudioLayer)),
      strokes: src.strokes.map((s) => ({ ...s, points: [...s.points] })),
    };
    const next = [...pages];
    next.splice(idx + 1, 0, copy);
    setPages(next);
    setActivePageIndex(idx + 1);
    setSelectedLayerIds([]);
  };

  const handleDeletePage = (idx: number) => {
    if (pages.length <= 1) return;
    pushUndoSnapshot();
    const next = pages.filter((_, i) => i !== idx);
    setPages(next);
    setActivePageIndex(Math.max(0, Math.min(next.length - 1, idx >= next.length ? next.length - 1 : idx)));
    setSelectedLayerIds([]);
  };

  const reorderPages = (fromIdx: number, toIdx: number) => {
    if (fromIdx === toIdx || fromIdx < 0 || toIdx < 0 || fromIdx >= pages.length || toIdx >= pages.length) {
      return;
    }
    pushUndoSnapshot();
    const activeId = activePage.id;
    const copy = [...pages];
    const [moved] = copy.splice(fromIdx, 1);
    copy.splice(toIdx, 0, moved);
    setPages(copy);
    const nextActive = copy.findIndex((p) => p.id === activeId);
    if (nextActive >= 0) setActivePageIndex(nextActive);
  };

  const applyTemplate = async (tpl: DesignTemplate) => {
    pushUndoSnapshot();
    setEditingCreationId(null);
    setDesignTitle(isEn ? tpl.nameEn : tpl.nameFr);
    setFormatRatio(tpl.format || (isPresentation ? 'landscape' : 'square'));

    // Support multi-page saved templates or presentation decks
    if (Array.isArray(tpl.pages) && tpl.pages.length > 0) {
      await applySnapshot({
        version: 3,
        designTitle: isEn ? tpl.nameEn : tpl.nameFr,
        formatRatio: tpl.format || (isPresentation ? 'landscape' : 'square'),
        activePageIndex: 0,
        pages: tpl.pages,
      });
      setNotice(isEn ? `Template "${tpl.nameEn}" loaded.` : `Modèle « ${tpl.nameFr} » appliqué.`);
      return;
    }

    let bgEl: HTMLImageElement | null = null;
    let bgKey: string | undefined = tpl.bgImageAssetKey;
    let resolvedBgType: 'solid' | 'gradient' | 'image' =
      tpl.bgType === 'image' && (tpl.bgImageAssetKey || tpl.bgRemoteImageUrl)
        ? 'image'
        : tpl.bgType || 'gradient';

    if (bgKey) {
      const b = await dbService.getMediaBlob(bgKey);
      if (b) bgEl = await loadImageFromBlob(b).catch(() => null);
    } else if (tpl.bgRemoteImageUrl) {
      try {
        const bgBlob = await fetchOnlineAssetBlobClient({
          id: tpl.id,
          assetType: 'backgrounds',
          title: isEn ? tpl.nameEn : tpl.nameFr,
          previewUrl: tpl.bgRemoteImageUrl,
          fullUrl: tpl.bgRemoteImageUrl,
          source: 'wikimedia',
        });
        const assetKey = `studio_tpl_bg_${Date.now()}`;
        await dbService.saveMediaBlob(assetKey, bgBlob, bgBlob.type || 'image/jpeg');
        bgEl = await loadImageFromBlob(bgBlob);
        bgKey = assetKey;
        resolvedBgType = 'image';
      } catch {
        resolvedBgType = 'gradient';
      }
    }

    const hydrated = await hydrateLayers(
      (tpl.layers || []).map((l, i) => ({ ...l, id: `${l.id}_${Date.now()}_${i}` }))
    );

    updateActivePage((pg) => ({
      ...pg,
      bgType: resolvedBgType,
      bgColor1: tpl.bgColor1,
      bgColor2: tpl.bgColor2,
      bgAngle: tpl.bgAngle ?? 135,
      bgImageEl: bgEl,
      bgImageAssetKey: bgKey,
      layers: hydrated,
      strokes: [],
    }));
    setSelectedLayerIds(hydrated.length > 0 ? [hydrated[hydrated.length - 1].id] : []);
    setNotice(isEn ? `Template "${tpl.nameEn}" loaded.` : `Modèle « ${tpl.nameFr} » appliqué.`);
  };

  // Explicit « ENREGISTRER DANS SHALOM » for online templates (strict verified blob bundle!)
  const handleSaveTemplateToShalom = async (tpl: DesignTemplate) => {
    setSavingShalomId(tpl.id);
    try {
      const saved = await saveTemplateBundleToShalom({
        id: tpl.id,
        studioType: studioMode,
        title: isEn ? tpl.nameEn : tpl.nameFr,
        category: tpl.category,
        templateObj: tpl as unknown as Record<string, unknown>,
        previewColor: tpl.bgColor1,
        previewColor2: tpl.bgColor2,
        source: tpl.source,
        license: 'SHALOM / Wikimedia',
      });
      await reloadData();
      setNotice(
        isEn
          ? `Saved "${saved.title}" verified offline in My SHALOM Resources!`
          : `« ${saved.title} » enregistré et vérifié hors-ligne dans Mes ressources SHALOM !`
      );
    } catch (err) {
      setNotice(
        err instanceof Error
          ? err.message
          : 'Impossible de télécharger toutes les ressources de ce modèle.'
      );
    } finally {
      setSavingShalomId(null);
    }
  };

  // Explicit « Enregistrer dans SHALOM » for online elements/images/backgrounds
  const handleSaveAssetToShalom = async (asset: OnlineAssetItem) => {
    setSavingShalomId(asset.id);
    try {
      const resourceType =
        asset.assetType === 'elements'
          ? 'element'
          : asset.assetType === 'backgrounds'
            ? 'background'
            : 'image';
      const blob = await fetchOnlineAssetBlobClient({
        id: asset.id,
        assetType: asset.assetType,
        title: asset.title,
        previewUrl: asset.previewUrl,
        fullUrl: asset.fullUrl,
        mimeType: asset.mimeType,
        source: asset.source === 'openverse' ? 'openverse' : 'wikimedia',
      });

      await saveAssetResourceToShalom({
        id: asset.id,
        studioType: studioMode,
        resourceType,
        title: asset.title,
        category: asset.assetType,
        remoteUrl: asset.fullUrl,
        blob,
        attribution: asset.author,
        license: asset.license || asset.source,
        source: 'online-live',
      });
      await reloadData();
      setNotice(
        isEn
          ? `Saved "${asset.title}" verified offline in My SHALOM Resources!`
          : `« ${asset.title} » enregistré hors-ligne dans Mes ressources SHALOM !`
      );
    } catch (err) {
      setNotice(err instanceof Error ? err.message : 'Échec de l’enregistrement hors-ligne.');
    } finally {
      setSavingShalomId(null);
    }
  };

  const handleApplySavedShalomItem = async (savedItem: SavedStudioTemplate) => {
    try {
      if (savedItem.resourceType && savedItem.resourceType !== 'template') {
        const parsed = JSON.parse(savedItem.templateJson) as {
          resourceType: 'element' | 'image' | 'background';
          assetKey: string;
        };
        const blob = await dbService.getMediaBlob(parsed.assetKey);
        if (!blob) {
          setNotice('Ressource hors-ligne introuvable.');
          return;
        }
        const img = await loadImageFromBlob(blob);
        pushUndoSnapshot();
        if (parsed.resourceType === 'background') {
          setBgImageEl(img);
          setBgImageAssetKey(parsed.assetKey);
          setBgType('image');
          setNotice(`Arrière-plan « ${savedItem.title} » appliqué.`);
        } else {
          const natW = img.naturalWidth || img.width || 300;
          const natH = img.naturalHeight || img.height || 300;
          const ratio = natW / Math.max(1, natH);
          const w = parsed.resourceType === 'element' ? Math.min(280, Math.round(dims.w * 0.28)) : Math.min(480, Math.round(dims.w * 0.45));
          const h = Math.max(60, Math.round(w / ratio));
          const id = `shres_${Date.now()}`;
          const next: ImageLayer = {
            id,
            kind: 'image',
            imageEl: img,
            assetKey: parsed.assetKey,
            label: savedItem.title,
            width: w,
            height: h,
            circular: false,
            filter: 'none',
            x: dims.w / 2,
            y: dims.h / 2,
            rotation: 0,
            opacity: 1,
            visible: true,
            locked: false,
          };
          setLayers((prev) => [...prev, next]);
          setSelectedLayerIds([id]);
          setNotice(`« ${savedItem.title} » inséré sur le canevas.`);
        }
        return;
      }

      const parsed = JSON.parse(savedItem.templateJson) as DesignTemplate;
      await applyTemplate(parsed);
    } catch {
      setNotice('Impossible de charger cette ressource SHALOM.');
    }
  };

  const handleDeleteSavedShalomItem = async (item: SavedStudioTemplate) => {
    await deleteSavedOnlineTemplate(item.id);
    await reloadData();
    setNotice(isEn ? 'Removed from My SHALOM Resources.' : 'Supprimé de Mes ressources SHALOM.');
  };

  const addTextPreset = (preset: 'heading' | 'sub' | 'verse' | 'badge') => {
    pushUndoSnapshot();
    const id = `txt_${Date.now()}`;
    const isLightBg = bgType === 'solid' && ['#ffffff', '#f8fafc', '#fffbeb', '#fefce8'].includes(bgColor1.toLowerCase());
    const defaults: Record<typeof preset, Partial<TextLayer>> = {
      heading: { text: isEn ? 'MAIN TITLE' : 'GRAND TITRE', fontFamily: STUDIO_FONTS[0].value, fontSize: 72, bold: true, color: isLightBg ? '#0b1f42' : '#ffffff', y: dims.h * 0.34 },
      sub: { text: isEn ? 'Inspiring subtitle here' : 'Sous-titre inspirant ici', fontFamily: STUDIO_FONTS[1].value, fontSize: 40, bold: false, color: isLightBg ? '#334155' : '#e2e8f0', y: dims.h * 0.5 },
      verse: { text: '« Que Sa paix garde vos cœurs. »\nPhilippiens 4 : 7', fontFamily: STUDIO_FONTS[2].value, fontSize: 44, bold: true, italic: true, color: isLightBg ? '#0f172a' : '#fef3c7', y: dims.h * 0.58 },
      badge: { text: 'SHALOM · ÉGLISE', fontFamily: STUDIO_FONTS[0].value, fontSize: 30, bold: true, color: '#0b1f42', bgColor: '#fbbf24', bgEnabled: true, shadow: false, y: dims.h * 0.78 },
    };
    const cfg = defaults[preset];
    const next: TextLayer = {
      id,
      kind: 'text',
      x: dims.w / 2,
      y: cfg.y || dims.h / 2,
      text: cfg.text || 'Texte',
      fontFamily: cfg.fontFamily || STUDIO_FONTS[0].value,
      fontSize: cfg.fontSize || 48,
      color: cfg.color || '#ffffff',
      bold: !!cfg.bold,
      italic: !!cfg.italic,
      underline: false,
      strikethrough: false,
      uppercase: false,
      align: 'center',
      bgColor: cfg.bgColor || '#fbbf24',
      bgEnabled: !!cfg.bgEnabled,
      shadow: cfg.shadow ?? !isLightBg,
      strokeColor: '#000000',
      strokeWidth: 0,
      lineHeight: 1.28,
      letterSpacing: 0,
      rotation: 0,
      opacity: 1,
      visible: true,
      locked: false,
    };
    setLayers((prev) => [...prev, next]);
    setSelectedLayerIds([id]);
    setIsDrawMode(false);
    setIsPanMode(false);
  };

  const addShapeLayer = (shape: StudioVectorElementKind) => {
    pushUndoSnapshot();
    const id = `shp_${Date.now()}`;
    const def = VECTOR_ELEMENT_CATALOG.find((v) => v.id === shape);
    const next: ShapeLayer = {
      id,
      kind: 'shape',
      shape,
      x: dims.w / 2,
      y: dims.h / 2,
      width: shape === 'line' ? 380 : shape === 'frame' ? Math.round(dims.w * 0.85) : 220,
      height: shape === 'line' ? 20 : shape === 'frame' ? Math.round(dims.h * 0.85) : 220,
      fillColor: def?.defaultPrimary || '#fbbf24',
      secondaryColor: def?.defaultSecondary || '#ffffff',
      strokeColor: '#ffffff',
      strokeWidth: 0,
      rotation: 0,
      opacity: shape === 'frame' ? 0.45 : 1,
      visible: true,
      locked: false,
    };
    setLayers((prev) => [...prev, next]);
    setSelectedLayerIds([id]);
    setIsDrawMode(false);
    setIsPanMode(false);
  };

  const handleAddImageFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const buffer = await file.arrayBuffer();
      const blob = new Blob([buffer], { type: file.type || 'image/png' });
      const assetKey = `studio_img_${Date.now()}`;
      await dbService.saveMediaBlob(assetKey, blob, blob.type);
      const img = await loadImageFromBlob(blob);
      pushUndoSnapshot();
      const ratio = img.width / Math.max(1, img.height);
      const w = Math.min(480, Math.round(dims.w * 0.48));
      const h = Math.max(60, Math.round(w / ratio));
      const id = `img_${Date.now()}`;
      const next: ImageLayer = {
        id,
        kind: 'image',
        imageEl: img,
        assetKey,
        label: file.name,
        width: w,
        height: h,
        circular: false,
        filter: 'none',
        x: dims.w / 2,
        y: dims.h / 2,
        rotation: 0,
        opacity: 1,
        visible: true,
        locked: false,
      };
      setLayers((prev) => [...prev, next]);
      setSelectedLayerIds([id]);
      setIsDrawMode(false);
    } catch {
      setNotice('Impossible de charger cette image.');
    }
    e.target.value = '';
  };

  const handleApplyLocalBackdropPhoto = async (photo: { id: string; nameFr: string; nameEn: string; src: string }) => {
    try {
      const resp = await fetch(photo.src);
      const blob = await resp.blob();
      const assetKey = `studio_bg_preset_${photo.id}_${Date.now()}`;
      await dbService.saveMediaBlob(assetKey, blob, blob.type || 'image/jpeg');
      const img = await loadImageFromUrl(photo.src);
      pushUndoSnapshot();
      setBgImageEl(img);
      setBgImageAssetKey(assetKey);
      setBgType('image');
      setNotice(isEn ? `Backdrop "${photo.nameEn}" applied.` : `Fond « ${photo.nameFr} » appliqué.`);
    } catch {
      setNotice('Impossible d’appliquer ce fond.');
    }
  };

  const handleAddBgImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const buffer = await file.arrayBuffer();
      const blob = new Blob([buffer], { type: file.type || 'image/jpeg' });
      const assetKey = `studio_bg_${Date.now()}`;
      await dbService.saveMediaBlob(assetKey, blob, blob.type);
      const img = await loadImageFromBlob(blob);
      pushUndoSnapshot();
      setBgImageEl(img);
      setBgImageAssetKey(assetKey);
      setBgType('image');
    } catch {
      setNotice('Impossible de charger cette image de fond.');
    }
    e.target.value = '';
  };

  const handleReplaceSelectedImageFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedLayer || selectedLayer.kind !== 'image') return;
    try {
      const buffer = await file.arrayBuffer();
      const blob = new Blob([buffer], { type: file.type || 'image/png' });
      const assetKey = `studio_img_repl_${Date.now()}`;
      await dbService.saveMediaBlob(assetKey, blob, blob.type);
      const img = await loadImageFromBlob(blob);
      pushUndoSnapshot();
      const natW = img.naturalWidth || img.width || 300;
      const natH = img.naturalHeight || img.height || 300;
      const ratio = natW / Math.max(1, natH);
      const nextH = Math.max(40, Math.round(selectedLayer.width / ratio));
      setLayers((prev) =>
        prev.map((l) =>
          l.id === selectedLayer.id && l.kind === 'image'
            ? {
                ...l,
                imageEl: img,
                assetKey,
                label: file.name,
                height: nextH,
                cropX: undefined,
                cropY: undefined,
                cropW: undefined,
                cropH: undefined,
              }
            : l
        )
      );
      setNotice(isEn ? 'Image replaced.' : 'Image remplacée avec succès.');
    } catch {
      setNotice('Impossible de remplacer cette image.');
    }
    e.target.value = '';
  };

  const handleApplyCrop = (crop: NormalizedCropRect) => {
    if (!cropTargetLayer) return;
    pushUndoSnapshot();
    const natW = cropTargetLayer.imageEl.naturalWidth || cropTargetLayer.imageEl.width || 300;
    const natH = cropTargetLayer.imageEl.naturalHeight || cropTargetLayer.imageEl.height || 300;
    const croppedPixelW = Math.max(1, crop.cropW * natW);
    const croppedPixelH = Math.max(1, crop.cropH * natH);
    const nextHeight = Math.max(40, Math.round(cropTargetLayer.width / (croppedPixelW / croppedPixelH)));
    setLayers((prev) =>
      prev.map((l) =>
        l.id === cropTargetLayer.id && l.kind === 'image'
          ? {
              ...l,
              cropX: crop.cropX,
              cropY: crop.cropY,
              cropW: crop.cropW,
              cropH: crop.cropH,
              height: nextHeight,
            }
          : l
      )
    );
    setCropTargetLayerId(null);
    setNotice(isEn ? 'Image cropped.' : 'Image recadrée.');
  };

  const updateSelectedLayer = (patch: Partial<StudioLayer>) => {
    if (!primarySelectedId) return;
    setLayers((prev) =>
      prev.map((l) => (l.id === primarySelectedId ? ({ ...l, ...patch } as StudioLayer) : l))
    );
  };

  const alignSelectedLayers = (mode: 'left' | 'centerH' | 'right' | 'centerV') => {
    if (selectedLayerIds.length === 0) return;
    pushUndoSnapshot();
    setLayers((prev) =>
      prev.map((l) => {
        if (!selectedLayerIds.includes(l.id) || l.locked) return l;
        if (mode === 'centerH') return { ...l, x: dims.w / 2 };
        if (mode === 'centerV') return { ...l, y: dims.h / 2 };
        if (mode === 'left') return { ...l, x: Math.round(dims.w * 0.22) };
        if (mode === 'right') return { ...l, x: Math.round(dims.w * 0.78) };
        return l;
      })
    );
  };

  const moveLayerById = (layerId: string, dir: -1 | 1) => {
    const idx = layers.findIndex((l) => l.id === layerId);
    const nextIdx = idx + dir;
    if (idx < 0 || nextIdx < 0 || nextIdx >= layers.length) return;
    pushUndoSnapshot();
    const copy = [...layers];
    const [removed] = copy.splice(idx, 1);
    copy.splice(nextIdx, 0, removed);
    setLayers(copy);
  };

  const reorderLayersByDrop = (fromId: string, toId: string) => {
    if (!fromId || !toId || fromId === toId) return;
    const fromIdx = layers.findIndex((l) => l.id === fromId);
    const toIdx = layers.findIndex((l) => l.id === toId);
    if (fromIdx < 0 || toIdx < 0) return;
    pushUndoSnapshot();
    const copy = [...layers];
    const [moved] = copy.splice(fromIdx, 1);
    copy.splice(toIdx, 0, moved);
    setLayers(copy);
  };

  const handleSearchOnlineTemplates = useCallback(
    async (overrideQuery?: string, overrideCategory?: string, appendPage?: number) => {
      const q = (overrideQuery !== undefined ? overrideQuery : templateQuery).trim();
      const cat = overrideCategory !== undefined ? overrideCategory : templateCategory;
      const targetPage = appendPage && appendPage > 1 ? appendPage : 1;
      const isAppend = targetPage > 1;
      if (isAppend) setIsLoadingMoreTemplates(true);
      else setIsSearchingOnline(true);
      setOnlineStatusMsg(null);

      try {
        const excludeTitles = isAppend ? onlineTemplates.map((t) => (isEn ? t.nameEn : t.nameFr)) : [];
        const res = await searchOnlineTemplatesClient<DesignTemplate>({
          studioType: studioMode,
          query: q,
          category: cat === 'all' ? undefined : cat,
          lang: isEn ? 'en' : 'fr',
          page: targetPage,
          excludeTitles,
        });
        const incoming = res.templates || [];
        setTemplatePage(targetPage);
        setTemplateHasMore(res.hasMore !== false);
        setOnlineTemplates((prev) => {
          if (!isAppend) return incoming;
          const seen = new Set(prev.map((x) => x.id));
          return [...prev, ...incoming.filter((x) => !seen.has(x.id))];
        });
      } catch {
        setOnlineStatusMsg(isEn ? 'Online search unavailable.' : 'Catalogue hors-ligne actif.');
      } finally {
        setIsSearchingOnline(false);
        setIsLoadingMoreTemplates(false);
      }
    },
    [templateQuery, templateCategory, isEn, onlineTemplates, studioMode]
  );

  const searchOnlineAssets = useCallback(
    async (assetType: 'elements' | 'images' | 'backgrounds', overrideQuery?: string, appendPage?: number) => {
      const q = (
        overrideQuery !== undefined
          ? overrideQuery
          : assetType === 'elements'
            ? onlineElementQuery
            : assetType === 'images'
              ? onlineImageQuery
              : onlineBgQuery
      ).trim();
      const targetPage = appendPage && appendPage > 1 ? appendPage : 1;
      const isAppend = targetPage > 1;

      if (assetType === 'elements') setIsSearchingElements(true);
      else if (assetType === 'images') setIsSearchingImages(true);
      else setIsSearchingBgs(true);

      try {
        const res = await searchOnlineAssetsClient({
          assetType,
          query: q,
          page: targetPage,
          lang: isEn ? 'en' : 'fr',
        });
        const incoming: OnlineAssetItem[] = res.assets || [];
        const hasMore = Boolean(res.hasMore);
        if (res.networkError && incoming.length === 0) setNotice(res.networkError);

        if (assetType === 'elements') {
          setOnlineElementPage(targetPage);
          setOnlineElementHasMore(hasMore);
          setOnlineElements((prev) =>
            isAppend ? [...prev, ...incoming.filter((a) => !prev.some((p) => p.id === a.id))] : incoming
          );
        } else if (assetType === 'images') {
          setOnlineImagePage(targetPage);
          setOnlineImageHasMore(hasMore);
          setOnlineImages((prev) =>
            isAppend ? [...prev, ...incoming.filter((a) => !prev.some((p) => p.id === a.id))] : incoming
          );
        } else {
          setOnlineBgPage(targetPage);
          setOnlineBgHasMore(hasMore);
          setOnlineBackgrounds((prev) =>
            isAppend ? [...prev, ...incoming.filter((a) => !prev.some((p) => p.id === a.id))] : incoming
          );
        }
      } catch {
        setNotice(isEn ? 'Online resource search unavailable.' : 'Recherche en ligne indisponible.');
      } finally {
        if (assetType === 'elements') setIsSearchingElements(false);
        else if (assetType === 'images') setIsSearchingImages(false);
        else setIsSearchingBgs(false);
      }
    },
    [onlineElementQuery, onlineImageQuery, onlineBgQuery, isEn]
  );

  const handleInsertOnlineAsset = async (asset: OnlineAssetItem, mode: 'layer' | 'background') => {
    setLoadingAssetId(asset.id);
    try {
      const blob = await fetchOnlineAssetBlobClient({
        id: asset.id,
        assetType: asset.assetType,
        title: asset.title,
        previewUrl: asset.previewUrl,
        fullUrl: asset.fullUrl,
        mimeType: asset.mimeType,
        source: asset.source === 'openverse' ? 'openverse' : 'wikimedia',
      });
      const assetKey = `studio_online_${asset.assetType}_${Date.now()}`;
      await dbService.saveMediaBlob(assetKey, blob, blob.type || 'image/png');
      const img = await loadImageFromBlob(blob);
      pushUndoSnapshot();

      if (mode === 'background') {
        setBgImageEl(img);
        setBgImageAssetKey(assetKey);
        setBgType('image');
        setNotice(`Arrière-plan « ${asset.title} » appliqué.`);
      } else {
        const natW = img.naturalWidth || img.width || 300;
        const natH = img.naturalHeight || img.height || 300;
        const ratio = natW / Math.max(1, natH);
        const w = asset.assetType === 'elements' ? Math.min(280, Math.round(dims.w * 0.28)) : Math.min(480, Math.round(dims.w * 0.46));
        const h = Math.max(60, Math.round(w / ratio));
        const id = `img_${Date.now()}`;
        const next: ImageLayer = {
          id,
          kind: 'image',
          imageEl: img,
          assetKey,
          label: asset.title || 'Illustration en ligne',
          width: w,
          height: h,
          circular: false,
          filter: 'none',
          x: dims.w / 2,
          y: dims.h / 2,
          rotation: 0,
          opacity: 1,
          visible: true,
          locked: false,
        };
        setLayers((prev) => [...prev, next]);
        setSelectedLayerIds([id]);
        setIsDrawMode(false);
        setNotice(`« ${asset.title} » ajouté sur le canevas.`);
      }
    } catch {
      setNotice('Impossible de télécharger cette image ou illustration en ligne.');
    } finally {
      setLoadingAssetId(null);
    }
  };

  useEffect(() => {
    if (activeToolTab === 'templates' && onlineTemplates.length === 0 && !isSearchingOnline) {
      handleSearchOnlineTemplates('', 'all', 1);
    } else if (activeToolTab === 'elements' && onlineElements.length === 0 && !isSearchingElements) {
      searchOnlineAssets('elements', '', 1);
    } else if (activeToolTab === 'images' && onlineImages.length === 0 && !isSearchingImages) {
      searchOnlineAssets('images', '', 1);
    } else if (activeToolTab === 'bg' && onlineBackgrounds.length === 0 && !isSearchingBgs) {
      searchOnlineAssets('backgrounds', '', 1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeToolTab]);

  const deleteSelectedLayers = () => {
    if (selectedLayerIds.length === 0) return;
    pushUndoSnapshot();
    setLayers((prev) => prev.filter((l) => !selectedLayerIds.includes(l.id) || l.locked));
    setSelectedLayerIds([]);
  };

  const exportCleanBlob = (mimeType: 'image/png' | 'image/jpeg'): Promise<Blob | null> => {
    return new Promise((resolve) => {
      renderCanvas(false);
      const canvas = canvasRef.current;
      if (!canvas) {
        resolve(null);
        return;
      }
      canvas.toBlob(
        (blob) => {
          renderCanvas(true);
          resolve(blob);
        },
        mimeType,
        0.95
      );
    });
  };

  const handleOpenPreview = async () => {
    const blob = await exportCleanBlob('image/png');
    if (!blob) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') setPreviewDataUrl(reader.result);
    };
    reader.readAsDataURL(blob);
  };

  const handleDownload = async (ext: 'png' | 'jpg' | 'pdf') => {
    let outBlob: Blob | null = null;
    if (ext === 'pdf') {
      // Multi-page PDF export rendering all pages cleanly
      const pageCanvases: HTMLCanvasElement[] = [];
      for (const pg of pages) {
        const off = document.createElement('canvas');
        renderPageToCanvas(off, pg, false);
        pageCanvases.push(off);
      }
      outBlob = await exportCanvasesToMultiPagePdfBlob(pageCanvases);
    } else {
      outBlob = await exportCleanBlob(ext === 'png' ? 'image/png' : 'image/jpeg');
    }
    if (!outBlob) return;
    const fileName = `${designTitle.trim() || 'creation_shalom'}.${ext}`;
    const res = await downloadBlobToDevice(outBlob, fileName, outBlob.type);
    setNotice(
      res.ok
        ? isEn
          ? `Downloaded "${res.fileName}" to ${res.locationLabel}.`
          : `« ${res.fileName} » enregistré dans ${res.locationLabel}.`
        : res.error || 'Échec du téléchargement.'
    );
  };

  const handleStartSlideshow = () => {
    const renderedUrls: string[] = [];
    const off = document.createElement('canvas');
    for (const pg of pages) {
      renderPageToCanvas(off, pg, false);
      renderedUrls.push(off.toDataURL('image/png'));
    }
    setSlideshowSlideUrls(renderedUrls);
    setSlideshowIndex(activePageIndex);
    setSlideshowPlaying(false);
    setSlideshowOpen(true);
  };

  useEffect(() => {
    if (!slideshowOpen || !slideshowPlaying || slideshowSlideUrls.length <= 1) return;
    const id = window.setInterval(() => {
      setSlideshowIndex((idx) => (idx + 1) % slideshowSlideUrls.length);
    }, 4500);
    return () => clearInterval(id);
  }, [slideshowOpen, slideshowPlaying, slideshowSlideUrls.length]);

  useEffect(() => {
    if (!slideshowOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === ' ') {
        e.preventDefault();
        setSlideshowIndex((idx) => Math.min(slideshowSlideUrls.length - 1, idx + 1));
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        setSlideshowIndex((idx) => Math.max(0, idx - 1));
      } else if (e.key === 'Escape') {
        setSlideshowOpen(false);
        setSlideshowPlaying(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [slideshowOpen, slideshowSlideUrls.length]);

  const handleSaveProject = async () => {
    const blob = await exportCleanBlob('image/png');
    if (!blob) return;
    const snap = createCurrentSnapshot();
    const assetKeys: string[] = [];
    (snap.pages || []).forEach((pg) => {
      if (pg.bgImageAssetKey) assetKeys.push(pg.bgImageAssetKey);
      pg.layers.forEach((l) => {
        if (l.assetKey) assetKeys.push(l.assetKey);
      });
    });

    const id = editingCreationId || `cr_${Date.now()}`;
    const existing = editingCreationId ? creations.find((c) => c.id === editingCreationId) : undefined;
    const blobKey = existing?.mediaBlobKey || `creation_blob_${Date.now()}`;
    await dbService.saveMediaBlob(blobKey, blob, 'image/png');

    const item: CreativeDesignItem = {
      id,
      title: designTitle.trim() || (isPresentation ? 'Présentation SHALOM' : 'Création SHALOM'),
      templateType: 'verset',
      studioType: studioMode,
      mediaBlobKey: blobKey,
      mimeType: 'image/png',
      projectJson: JSON.stringify(snap),
      mediaAssetKeys: Array.from(new Set(assetKeys)),
      createdAt: existing?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await dbService.put(STORES.CREATIONS, item);
    setEditingCreationId(id);
    setNotice(
      isPresentation
        ? isEn
          ? 'Presentation saved cleanly!'
          : 'Présentation multipage enregistrée et modifiable à tout moment.'
        : isEn
          ? 'Editable project saved!'
          : 'Projet multipage enregistré et modifiable à tout moment.'
    );
    await reloadData();
  };

  const handleReopenSavedProject = async (item: CreativeDesignItem) => {
    if (!item.projectJson) {
      setNotice('Ce visuel ancien ne contient pas de calques modifiables.');
      return;
    }
    try {
      const parsed = JSON.parse(item.projectJson) as ProjectSnapshot;
      pushUndoSnapshot();
      await applySnapshot(parsed);
      setEditingCreationId(item.id);
      setNotice(`Projet « ${item.title} » rouvert dans l’éditeur.`);
    } catch {
      setNotice('Impossible de charger les calques de ce projet.');
    }
  };

  const handleShare = async () => {
    const blob = await exportCleanBlob('image/png');
    if (!blob) return;
    const file = new File(
      [blob],
      `${designTitle.trim().replace(/[^a-z0-9àâéèêîôùûç_-]+/gi, '_') || 'creation_shalom'}.png`,
      { type: 'image/png' }
    );
    setSharePayload({
      title: designTitle,
      text: `${designTitle}\n\nCréé dans SHALOM Studio`,
      file,
    });
  };

  const handleShareSavedItem = async (item: CreativeDesignItem) => {
    const blob = await dbService.getMediaBlob(item.mediaBlobKey);
    if (!blob) return;
    const file = new File([blob], `${item.title || item.id}.png`, {
      type: item.mimeType || 'image/png',
    });
    setSharePayload({
      title: item.title,
      text: `${item.title}\n\nPartagé depuis SHALOM Studio`,
      file,
    });
  };

  const handleConfirmDeleteCreations = async () => {
    if (!confirmDeleteCreations || confirmDeleteCreations.length === 0) return;
    const blobs: string[] = [];
    confirmDeleteCreations.forEach((c) => {
      if (c.mediaBlobKey) blobs.push(c.mediaBlobKey);
      if (c.mediaAssetKeys) blobs.push(...c.mediaAssetKeys);
    });
    const ids = confirmDeleteCreations.map((c) => c.id);
    if (blobs.length > 0) await dbService.deleteItems(STORES.MEDIA_BLOBS, blobs);
    await dbService.deleteItems(STORES.CREATIONS, ids);
    setSelectedCreationIds((prev) => prev.filter((id) => !ids.includes(id)));
    if (editingCreationId && ids.includes(editingCreationId)) setEditingCreationId(null);
    setConfirmDeleteCreations(null);
    await reloadData();
  };

  const handleOpenShalomFolder = async () => {
    const outcome = await chooseShalomDownloadDirectory();
    if (outcome.requiresVirtualExplorer) setFolderExplorerOpen(true);
    else if (outcome.folderLabel) setNotice(`Dossier prêt : ${outcome.folderLabel}`);
  };

  const displayedTemplates = useMemo(() => {
    const q = templateQuery.trim().toLowerCase();
    const localBase = isPresentation
      ? DESIGN_TEMPLATES.filter((t) => t.id === 'blank' || t.format === 'landscape').map((t) =>
          t.id === 'blank'
            ? {
                ...t,
                nameFr: 'Présentation Vierge 16:9',
                nameEn: 'Blank 16:9 Presentation',
                format: 'landscape' as FormatRatio,
              }
            : t
        )
      : DESIGN_TEMPLATES;
    const localFiltered = localBase.filter((t) => {
      const catOk = templateCategory === 'all' || t.category.toLowerCase() === templateCategory.toLowerCase();
      const qOk = !q || t.nameFr.toLowerCase().includes(q) || t.nameEn.toLowerCase().includes(q) || t.category.toLowerCase().includes(q);
      return catOk && qOk;
    });
    const seen = new Set(localFiltered.map((t) => t.id));
    return [...localFiltered, ...onlineTemplates.filter((t) => !seen.has(t.id))];
  }, [templateQuery, templateCategory, onlineTemplates, isPresentation]);

  const filteredLocalVectors = useMemo(() => {
    if (vectorCategoryFilter === 'all') return VECTOR_ELEMENT_CATALOG;
    return VECTOR_ELEMENT_CATALOG.filter((v) => v.category === vectorCategoryFilter);
  }, [vectorCategoryFilter]);

  const toolItems: StudioToolRailItem[] = [
    { id: 'templates', label: isEn ? 'Templates' : 'Modèles', icon: LayoutTemplate },
    { id: 'elements', label: isEn ? 'Elements' : 'Éléments', icon: Shapes },
    { id: 'text', label: isEn ? 'Text' : 'Texte', icon: Type },
    { id: 'images', label: isEn ? 'Images' : 'Images', icon: ImageIcon },
    { id: 'bg', label: isEn ? 'Backdrops' : 'Fonds', icon: Palette },
    { id: 'draw', label: isEn ? 'Draw' : 'Dessin', icon: Pencil },
    { id: 'layers', label: isEn ? 'Layers' : 'Calques', icon: Layers, badge: layers.length },
    { id: 'shalom', label: 'SHALOM', icon: FolderHeart },
    { id: 'creations', label: isEn ? 'Saved' : 'Créations', icon: Archive, badge: designCreations.length },
  ];

  // Tool Drawer Content
  const renderToolDrawer = () => {
    if (activeToolTab === 'templates') {
      const categories = isPresentation
        ? ['all', 'Prédication', 'Formation', 'Église', 'Présentation', 'Libre']
        : ['all', 'Verset', 'Affiche', 'Invitation', 'Couverture', 'Présentation', 'Église', 'Fête', 'Réseaux sociaux'];
      return (
        <div className="space-y-3">
          <div className="flex gap-1.5">
            <div className="relative flex-1">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={templateQuery}
                onChange={(e) => setTemplateQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearchOnlineTemplates(templateQuery, templateCategory, 1)}
                placeholder={isEn ? 'Search templates...' : 'Rechercher un modèle...'}
                className="w-full pl-8 pr-2.5 py-2 text-xs rounded-xl bg-slate-50 dark:bg-[#081024] border border-slate-200 dark:border-slate-700"
              />
            </div>
            <button
              type="button"
              onClick={() => handleSearchOnlineTemplates(templateQuery, templateCategory, 1)}
              className="px-3 py-2 rounded-xl bg-blue-700 text-white text-xs font-bold flex items-center gap-1 shrink-0"
            >
              {isSearchingOnline ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Globe className="w-3.5 h-3.5" />}
            </button>
          </div>

          <div className="flex flex-wrap gap-1">
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => {
                  setTemplateCategory(cat);
                  handleSearchOnlineTemplates(templateQuery, cat, 1);
                }}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition ${
                  templateCategory === cat
                    ? 'bg-blue-700 text-white'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                }`}
              >
                {cat === 'all' ? (isEn ? 'All' : 'Tout') : cat}
              </button>
            ))}
          </div>

          {onlineStatusMsg && <div className="text-[11px] text-amber-600 dark:text-amber-400">{onlineStatusMsg}</div>}

          <div className="grid grid-cols-2 gap-2">
            {displayedTemplates.map((tpl) => {
              const isOnline = tpl.source && tpl.source !== 'local';
              const isSaving = savingShalomId === tpl.id;
              const isSaved = customTemplates.some(
                (st) => st.id === `saved_tpl_${studioMode}_${tpl.id}`
              );
              return (
                <TemplatePreviewCard
                  key={tpl.id}
                  id={tpl.id}
                  title={isEn ? tpl.nameEn : tpl.nameFr}
                  category={tpl.category}
                  kind={studioMode}
                  format={tpl.format}
                  bgType={tpl.bgType}
                  bgColor1={tpl.bgColor1}
                  bgColor2={tpl.bgColor2}
                  bgAngle={tpl.bgAngle}
                  bgRemoteImageUrl={tpl.bgRemoteImageUrl}
                  layers={tpl.layers as unknown as Array<Record<string, unknown>>}
                  pages={tpl.pages as unknown as Array<Record<string, unknown>>}
                  slideCount={tpl.pages?.length}
                  isSaved={isSaved}
                  isSavingOffline={isSaving}
                  onSaveOffline={isOnline ? () => handleSaveTemplateToShalom(tpl) : undefined}
                  onSelectPreview={() => setPreviewingTemplate(tpl)}
                  isEn={isEn}
                />
              );
            })}
          </div>

          {templateHasMore && (
            <button
              type="button"
              onClick={() => handleSearchOnlineTemplates(templateQuery, templateCategory, templatePage + 1)}
              disabled={isLoadingMoreTemplates}
              className="w-full py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center justify-center gap-1.5"
            >
              {isLoadingMoreTemplates && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>{isEn ? 'Load more online templates' : 'Charger plus de modèles en ligne'}</span>
            </button>
          )}
        </div>
      );
    }

    if (activeToolTab === 'elements') {
      return (
        <div className="space-y-3">
          {/* Vector Categories */}
          <div className="flex flex-wrap gap-1">
            {[
              ['all', isEn ? 'All' : 'Tout'],
              ['spirituel', isEn ? 'Spiritual' : 'Spirituel'],
              ['nature', 'Nature'],
              ['cadres', isEn ? 'Frames' : 'Cadres'],
              ['formes', isEn ? 'Shapes' : 'Formes'],
            ].map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setVectorCategoryFilter(id)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition ${
                  vectorCategoryFilter === id
                    ? 'bg-blue-700 text-white'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Genuine Recolorable SVG Vector Catalog (ZERO emojis) */}
          <div className="grid grid-cols-3 gap-2">
            {filteredLocalVectors.map((vec) => (
              <button
                key={vec.id}
                type="button"
                onClick={() => addShapeLayer(vec.id)}
                className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-blue-600 flex flex-col items-center justify-center gap-1.5 transition"
              >
                <div className="w-9 h-9 rounded-lg bg-slate-900 dark:bg-slate-950 flex items-center justify-center p-1.5">
                  <VectorPreviewSvg
                    kind={vec.id}
                    primaryColor={vec.defaultPrimary}
                    secondaryColor={vec.defaultSecondary}
                    className="w-full h-full"
                  />
                </div>
                <span className="text-[10px] font-semibold text-slate-700 dark:text-slate-300 text-center line-clamp-1">
                  {isEn ? vec.labelEn : vec.labelFr}
                </span>
              </button>
            ))}
          </div>

          <div className="pt-2 border-t border-slate-200 dark:border-slate-800 space-y-2">
            <div className="text-[11px] font-extrabold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
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
                onKeyDown={(e) => e.key === 'Enter' && searchOnlineAssets('elements', onlineElementQuery, 1)}
                placeholder={isEn ? 'dove, bible, flower, cross...' : 'colombe, livre, fleur, croix...'}
                className="flex-1 px-2.5 py-2 text-xs rounded-xl bg-slate-50 dark:bg-[#081024] border border-slate-200 dark:border-slate-700"
              />
              <button
                type="button"
                onClick={() => searchOnlineAssets('elements', onlineElementQuery, 1)}
                className="px-3 py-2 rounded-xl bg-blue-700 text-white text-xs font-bold"
              >
                {isSearchingElements ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
              </button>
            </div>

            <div className="grid grid-cols-3 gap-2">
              {onlineElements.map((asset) => (
                <div
                  key={asset.id}
                  className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-1.5 flex flex-col items-center gap-1"
                >
                  <button
                    type="button"
                    disabled={loadingAssetId === asset.id}
                    onClick={() => handleInsertOnlineAsset(asset, 'layer')}
                    className="w-full h-14 flex items-center justify-center hover:scale-105 transition bg-slate-50 dark:bg-slate-950 rounded-lg overflow-hidden"
                    title={asset.title}
                  >
                    {loadingAssetId === asset.id ? (
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
                    disabled={savingShalomId === asset.id}
                    onClick={() => handleSaveAssetToShalom(asset)}
                    className="w-full py-1 rounded-md bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 text-[9px] font-bold hover:bg-emerald-100 truncate px-1"
                    title="Enregistrer hors-ligne dans SHALOM"
                  >
                    {savingShalomId === asset.id ? '...' : '+ SHALOM'}
                  </button>
                </div>
              ))}
            </div>
            {onlineElementHasMore && onlineElements.length > 0 && (
              <button
                type="button"
                onClick={() => searchOnlineAssets('elements', onlineElementQuery, onlineElementPage + 1)}
                className="w-full py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-semibold"
              >
                {isEn ? 'Load more elements' : 'Charger plus d’éléments'}
              </button>
            )}
          </div>
        </div>
      );
    }

    if (activeToolTab === 'text') {
      return (
        <div className="space-y-3">
          <div className="grid grid-cols-1 gap-2">
            <button
              type="button"
              onClick={() => addTextPreset('heading')}
              className="p-3 rounded-xl bg-slate-100 dark:bg-slate-900 hover:bg-blue-50 dark:hover:bg-blue-950/40 border border-slate-200 dark:border-slate-800 text-left font-extrabold text-base text-slate-900 dark:text-white"
            >
              + {isEn ? 'Add a Heading' : 'Ajouter un Grand Titre'}
            </button>
            <button
              type="button"
              onClick={() => addTextPreset('sub')}
              className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-900 hover:bg-blue-50 dark:hover:bg-blue-950/40 border border-slate-200 dark:border-slate-800 text-left font-semibold text-sm text-slate-700 dark:text-slate-200"
            >
              + {isEn ? 'Add a Subtitle' : 'Ajouter un Sous-titre'}
            </button>
            <button
              type="button"
              onClick={() => addTextPreset('verse')}
              className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-900 hover:bg-blue-50 dark:hover:bg-blue-950/40 border border-slate-200 dark:border-slate-800 text-left italic font-serif text-xs text-slate-700 dark:text-slate-200"
            >
              + {isEn ? 'Add Bible Verse Citation' : 'Ajouter Citation / Verset'}
            </button>
            <button
              type="button"
              onClick={() => addTextPreset('badge')}
              className="p-2.5 rounded-xl bg-amber-400/20 hover:bg-amber-400/30 border border-amber-400/40 text-left font-bold text-xs text-amber-800 dark:text-amber-300"
            >
              + {isEn ? 'Add Pill Tag / Date Badge' : 'Ajouter Badge Date / Lieu'}
            </button>
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            {isEn
              ? 'Double-click any text on the canvas to edit inline, or select it to open font, bold, italic & spacing controls.'
              : 'Double-cliquez sur un texte sur le canevas pour le modifier directement, ou sélectionnez-le pour ajuster police, gras, italique, ombre et contour.'}
          </p>
        </div>
      );
    }

    if (activeToolTab === 'images') {
      return (
        <div className="space-y-3">
          <label className="w-full min-h-[44px] px-4 py-2.5 rounded-xl bg-blue-700 hover:bg-blue-800 text-white text-xs font-bold flex items-center justify-center gap-2 cursor-pointer">
            <ImageIcon className="w-4 h-4" />
            <span>{isEn ? 'Import Photo from Device' : 'Importer une photo de l’appareil'}</span>
            <input type="file" accept="image/*" onChange={handleAddImageFile} className="hidden" />
          </label>

          <div className="pt-2 border-t border-slate-200 dark:border-slate-800 space-y-2">
            <div className="text-[11px] font-extrabold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
              <Globe className="w-3.5 h-3.5 text-blue-600" />
              <span>{isEn ? 'Online Photos (Wikimedia / Openverse)' : 'Photos en ligne libres'}</span>
            </div>
            <div className="flex gap-1.5">
              <input
                type="text"
                value={onlineImageQuery}
                onChange={(e) => setOnlineImageQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && searchOnlineAssets('images', onlineImageQuery, 1)}
                placeholder={isEn ? 'sky, mountain, church, dove...' : 'ciel, nature, église, lumière...'}
                className="flex-1 px-2.5 py-2 text-xs rounded-xl bg-slate-50 dark:bg-[#081024] border border-slate-200 dark:border-slate-700"
              />
              <button
                type="button"
                onClick={() => searchOnlineAssets('images', onlineImageQuery, 1)}
                className="px-3 py-2 rounded-xl bg-blue-700 text-white text-xs font-bold"
              >
                {isSearchingImages ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {onlineImages.map((img) => (
                <div
                  key={img.id}
                  className="rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900"
                >
                  <button
                    type="button"
                    onClick={() => handleInsertOnlineAsset(img, 'layer')}
                    className="w-full h-24 relative block group"
                  >
                    <img src={img.previewUrl} alt={img.title} className="w-full h-full object-cover" />
                    {loadingAssetId === img.id && (
                      <div className="absolute inset-0 bg-slate-950/60 flex items-center justify-center">
                        <Loader2 className="w-5 h-5 animate-spin text-white" />
                      </div>
                    )}
                  </button>
                  <button
                    type="button"
                    disabled={savingShalomId === img.id}
                    onClick={() => handleSaveAssetToShalom(img)}
                    className="w-full py-1 px-2 bg-emerald-600 text-white text-[10px] font-bold truncate"
                  >
                    {savingShalomId === img.id ? '...' : 'ENREGISTRER DANS SHALOM'}
                  </button>
                </div>
              ))}
            </div>
            {onlineImageHasMore && onlineImages.length > 0 && (
              <button
                type="button"
                onClick={() => searchOnlineAssets('images', onlineImageQuery, onlineImagePage + 1)}
                className="w-full py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-semibold"
              >
                {isEn ? 'Load more images' : 'Charger plus de photos'}
              </button>
            )}
          </div>
        </div>
      );
    }

    if (activeToolTab === 'bg') {
      return (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-1.5 text-xs">
            <button
              type="button"
              onClick={() => setBgType('solid')}
              className={`py-2 rounded-xl font-semibold border ${
                bgType === 'solid'
                  ? 'bg-blue-700 border-blue-700 text-white'
                  : 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800'
              }`}
            >
              {isEn ? 'Solid Color' : 'Couleur Unie'}
            </button>
            <button
              type="button"
              onClick={() => setBgType('gradient')}
              className={`py-2 rounded-xl font-semibold border ${
                bgType === 'gradient'
                  ? 'bg-blue-700 border-blue-700 text-white'
                  : 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800'
              }`}
            >
              {isEn ? 'Gradient' : 'Dégradé'}
            </button>
          </div>

          <div className="flex items-center gap-3">
            <label className="flex-1 text-[11px] font-semibold">
              <span>{bgType === 'gradient' ? 'Couleur 1' : 'Couleur fond'}</span>
              <input
                type="color"
                value={bgColor1}
                onChange={(e) => setBgColor1(e.target.value)}
                className="w-full h-9 rounded-lg mt-1 cursor-pointer"
              />
            </label>
            {bgType === 'gradient' && (
              <label className="flex-1 text-[11px] font-semibold">
                <span>Couleur 2</span>
                <input
                  type="color"
                  value={bgColor2}
                  onChange={(e) => setBgColor2(e.target.value)}
                  className="w-full h-9 rounded-lg mt-1 cursor-pointer"
                />
              </label>
            )}
          </div>

          {bgType === 'gradient' && (
            <label className="block text-[11px] font-semibold">
              <span className="tabular-nums">Angle du dégradé : {bgAngle}°</span>
              <input
                type="range"
                min={0}
                max={360}
                value={bgAngle}
                onChange={(e) => setBgAngle(Number(e.target.value))}
                className="w-full mt-1"
              />
            </label>
          )}

          {bgType === 'image' && (
            <label className="block text-[11px] font-semibold">
              <span className="tabular-nums">Voile sombre : {Math.round(bgImageOverlay * 100)}%</span>
              <input
                type="range"
                min={0}
                max={0.8}
                step={0.05}
                value={bgImageOverlay}
                onChange={(e) => setBgImageOverlay(Number(e.target.value))}
                className="w-full mt-1"
              />
            </label>
          )}

          <div>
            <div className="text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1.5">
              Palettes SHALOM
            </div>
            <div className="space-y-1.5">
              {SHALOM_COLOR_PALETTES.map((pal) => (
                <button
                  key={pal.name}
                  type="button"
                  onClick={() => {
                    pushUndoSnapshot();
                    setBgType('gradient');
                    setBgColor1(pal.colors[0]);
                    setBgColor2(pal.colors[1]);
                  }}
                  className="w-full p-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs hover:border-blue-500"
                >
                  <span className="font-semibold">{pal.name}</span>
                  <div className="flex items-center gap-1">
                    {pal.colors.map((c) => (
                      <span
                        key={c}
                        className="w-4 h-4 rounded-full border border-slate-300"
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1.5">
              {isEn ? 'Built-in Offline Backdrops' : 'Fonds photo intégrés (100% hors-ligne)'}
            </div>
            <div className="grid grid-cols-2 gap-2">
              {STUDIO_BACKDROP_PHOTOS.map((photo) => (
                <button
                  key={photo.id}
                  type="button"
                  onClick={() => handleApplyLocalBackdropPhoto(photo)}
                  className="relative h-20 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 hover:ring-2 hover:ring-blue-600 group"
                >
                  <img src={photo.src} alt={photo.nameFr} className="w-full h-full object-cover" />
                  <span className="absolute inset-x-0 bottom-0 px-1.5 py-1 bg-slate-950/65 text-[10px] font-semibold text-white truncate">
                    {isEn ? photo.nameEn : photo.nameFr}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <label className="w-full min-h-[40px] px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-bold flex items-center justify-center gap-2 cursor-pointer">
            <ImageIcon className="w-4 h-4 text-blue-600" />
            <span>{isEn ? 'Upload Custom Backdrop' : 'Importer une image de fond'}</span>
            <input type="file" accept="image/*" onChange={handleAddBgImage} className="hidden" />
          </label>

          <div className="pt-2 border-t border-slate-200 dark:border-slate-800 space-y-2">
            <div className="flex gap-1.5">
              <input
                type="text"
                value={onlineBgQuery}
                onChange={(e) => setOnlineBgQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && searchOnlineAssets('backgrounds', onlineBgQuery, 1)}
                placeholder={isEn ? 'Search online backdrops...' : 'Rechercher fonds en ligne (or, ciel...)'}
                className="flex-1 px-2.5 py-2 text-xs rounded-xl bg-slate-50 dark:bg-[#081024] border border-slate-200 dark:border-slate-700"
              />
              <button
                type="button"
                onClick={() => searchOnlineAssets('backgrounds', onlineBgQuery, 1)}
                className="px-3 py-2 rounded-xl bg-blue-700 text-white text-xs font-bold"
              >
                {isSearchingBgs ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {onlineBackgrounds.map((bg) => (
                <div key={bg.id} className="rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => handleInsertOnlineAsset(bg, 'background')}
                    className="w-full h-20 relative block"
                  >
                    <img src={bg.previewUrl} alt={bg.title} className="w-full h-full object-cover" />
                  </button>
                  <button
                    type="button"
                    disabled={savingShalomId === bg.id}
                    onClick={() => handleSaveAssetToShalom(bg)}
                    className="w-full py-1 px-2 bg-emerald-600 text-white text-[10px] font-bold truncate"
                  >
                    {savingShalomId === bg.id ? '...' : 'ENREGISTRER DANS SHALOM'}
                  </button>
                </div>
              ))}
            </div>
            {onlineBgHasMore && onlineBackgrounds.length > 0 && (
              <button
                type="button"
                disabled={isSearchingBgs}
                onClick={() => searchOnlineAssets('backgrounds', onlineBgQuery, onlineBgPage + 1)}
                className="w-full min-h-[44px] py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 transition disabled:opacity-50"
              >
                {isEn ? 'Load more backgrounds' : 'Charger plus de fonds'}
              </button>
            )}
          </div>
        </div>
      );
    }

    if (activeToolTab === 'draw') {
      return (
        <div className="space-y-3">
          <button
            type="button"
            onClick={() => {
              setIsDrawMode((d) => !d);
              setIsPanMode(false);
            }}
            className={`w-full min-h-[44px] py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition ${
              isDrawMode
                ? 'bg-amber-500 text-slate-950 shadow-sm'
                : 'bg-blue-700 text-white'
            }`}
          >
            <Pencil className="w-4 h-4" />
            <span>
              {isDrawMode
                ? isEn
                  ? 'Drawing Active (Tap to Stop)'
                  : 'Mode Pinceau ACTIF (Cliquer pour quitter)'
                : isEn
                  ? 'Activate Freehand Brush'
                  : 'Activer le Pinceau sur canevas'}
            </span>
          </button>

          <label className="block text-xs font-semibold">
            <span>{isEn ? 'Brush Color' : 'Couleur du tracé'}</span>
            <input
              type="color"
              value={brushColor}
              onChange={(e) => setBrushColor(e.target.value)}
              className="w-full h-9 rounded-lg mt-1"
            />
          </label>

          <label className="block text-xs font-semibold">
            <span className="tabular-nums">Épaisseur : {brushSize}px</span>
            <input
              type="range"
              min={2}
              max={48}
              value={brushSize}
              onChange={(e) => setBrushSize(Number(e.target.value))}
              className="w-full mt-1"
            />
          </label>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              disabled={strokes.length === 0}
              onClick={() => {
                pushUndoSnapshot();
                setStrokes((prev) => prev.slice(0, -1));
              }}
              className="py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-semibold flex items-center justify-center gap-1 disabled:opacity-40"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Dernier trait</span>
            </button>
            <button
              type="button"
              disabled={strokes.length === 0}
              onClick={() => {
                pushUndoSnapshot();
                setStrokes([]);
              }}
              className="py-2 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 text-xs font-semibold flex items-center justify-center gap-1 disabled:opacity-40"
            >
              <Eraser className="w-3.5 h-3.5" />
              <span>Effacer tout</span>
            </button>
          </div>
        </div>
      );
    }

    if (activeToolTab === 'layers') {
      const reversed = [...layers].reverse();
      return (
        <div className="space-y-2.5">
          {selectedLayerIds.length >= 2 && (
            <button
              type="button"
              onClick={handleGroupSelected}
              className="w-full py-2 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-xs font-bold flex items-center justify-center gap-1.5"
            >
              <Group className="w-3.5 h-3.5" />
              <span>Grouper la sélection ({selectedLayerIds.length})</span>
            </button>
          )}
          {selectedGroupIds.length > 0 && (
            <button
              type="button"
              onClick={handleUngroupSelected}
              className="w-full py-2 rounded-xl bg-slate-200 dark:bg-slate-800 text-xs font-bold flex items-center justify-center gap-1.5"
            >
              <Ungroup className="w-3.5 h-3.5" />
              <span>Dissocier le groupe</span>
            </button>
          )}

          {reversed.length === 0 ? (
            <div className="p-4 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 text-center text-xs text-slate-500">
              {isPresentation
                ? 'Aucun élément sur cette diapositive. Ajoutez un titre, une forme ou une image.'
                : 'Aucun calque sur cette page. Ajoutez un texte, une forme ou une image.'}
            </div>
          ) : (
            <div className="space-y-1.5">
              {reversed.map((l) => {
                const isSel = selectedLayerIds.includes(l.id);
                return (
                  <div
                    key={l.id}
                    draggable
                    onDragStart={() => setDraggingLayerId(l.id)}
                    onDragOver={(e) => {
                      e.preventDefault();
                      setDragOverLayerId(l.id);
                    }}
                    onDrop={() => {
                      if (draggingLayerId) reorderLayersByDrop(draggingLayerId, l.id);
                      setDraggingLayerId(null);
                      setDragOverLayerId(null);
                    }}
                    onDragEnd={() => {
                      setDraggingLayerId(null);
                      setDragOverLayerId(null);
                    }}
                    onClick={() => {
                      if (l.groupId) {
                        setSelectedLayerIds(layers.filter((x) => x.groupId === l.groupId).map((x) => x.id));
                      } else {
                        setSelectedLayerIds([l.id]);
                      }
                    }}
                    className={`p-2 rounded-xl border flex items-center gap-2 cursor-pointer transition ${
                      isSel
                        ? 'bg-blue-50 dark:bg-blue-950/40 border-blue-600'
                        : 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800'
                    } ${dragOverLayerId === l.id ? 'ring-2 ring-amber-400' : ''}`}
                  >
                    <GripVertical className="w-3.5 h-3.5 text-slate-400 shrink-0 cursor-grab" />
                    <div className="w-7 h-7 rounded-lg bg-slate-200 dark:bg-slate-800 flex items-center justify-center shrink-0">
                      {l.kind === 'text' ? (
                        <Type className="w-3.5 h-3.5 text-blue-600" />
                      ) : l.kind === 'shape' ? (
                        <VectorPreviewSvg kind={l.shape} primaryColor={l.fillColor} className="w-4 h-4" />
                      ) : (
                        <ImageIcon className="w-3.5 h-3.5 text-emerald-600" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[11px] font-bold truncate text-slate-800 dark:text-slate-100">
                        {l.kind === 'text' ? l.text.split('\n')[0] || 'Texte' : l.kind === 'shape' ? l.shape : l.label}
                      </div>
                      {l.groupId && (
                        <div className="text-[9px] text-violet-600 dark:text-violet-400 font-semibold">
                          Groupe
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-0.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        onClick={() => moveLayerById(l.id, 1)}
                        title="Monter"
                        className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700"
                      >
                        <ArrowUp className="w-3 h-3" />
                      </button>
                      <button
                        type="button"
                        onClick={() => moveLayerById(l.id, -1)}
                        title="Descendre"
                        className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700"
                      >
                        <ArrowDown className="w-3 h-3" />
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setLayers((prev) =>
                            prev.map((x) => (x.id === l.id ? ({ ...x, visible: x.visible === false } as StudioLayer) : x))
                          )
                        }
                        title={l.visible === false ? 'Afficher' : 'Masquer'}
                        className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700"
                      >
                        {l.visible === false ? <EyeOff className="w-3 h-3 text-slate-400" /> : <Eye className="w-3 h-3" />}
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setLayers((prev) =>
                            prev.map((x) => (x.id === l.id ? ({ ...x, locked: !x.locked } as StudioLayer) : x))
                          )
                        }
                        title={l.locked ? 'Déverrouiller' : 'Verrouiller'}
                        className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700"
                      >
                        {l.locked ? <Lock className="w-3 h-3 text-amber-500" /> : <Unlock className="w-3 h-3 text-slate-400" />}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      );
    }

    if (activeToolTab === 'shalom') {
      return (
        <ShalomResourcesPanel
          studioType={studioMode}
          savedItems={customTemplates}
          isEn={isEn}
          onApplyItem={handleApplySavedShalomItem}
          onDeleteItem={handleDeleteSavedShalomItem}
        />
      );
    }

    if (activeToolTab === 'creations') {
      return (
        <div className="space-y-2.5">
          {selectedCreationIds.length > 0 && (
            <button
              type="button"
              onClick={() =>
                setConfirmDeleteCreations(
                  designCreations.filter((c) => selectedCreationIds.includes(c.id))
                )
              }
              className="w-full py-2 rounded-xl bg-rose-600 text-white text-xs font-bold flex items-center justify-center gap-1.5"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Supprimer sélection ({selectedCreationIds.length})</span>
            </button>
          )}
          {designCreations.length === 0 ? (
            <div className="p-4 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 text-center text-xs text-slate-500">
              Aucune création enregistrée pour le moment.
            </div>
          ) : (
            <div className="space-y-2">
              {designCreations.map((c) => {
                const isSel = selectedCreationIds.includes(c.id);
                return (
                  <div
                    key={c.id}
                    className="p-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2"
                  >
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          setSelectedCreationIds((prev) =>
                            isSel ? prev.filter((x) => x !== c.id) : [...prev, c.id]
                          )
                        }
                      >
                        {isSel ? <CheckSquare className="w-4 h-4 text-blue-600" /> : <Square className="w-4 h-4 text-slate-400" />}
                      </button>
                      {savedPreviews[c.id] && (
                        <img
                          src={savedPreviews[c.id]}
                          alt={c.title}
                          className="w-11 h-11 rounded-lg object-cover border border-slate-200 dark:border-slate-700"
                        />
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-bold truncate">{c.title}</div>
                        <div className="text-[10px] text-slate-500 tabular-nums">
                          {new Date(c.updatedAt || c.createdAt).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-1.5 text-[11px]">
                      {c.projectJson && (
                        <button
                          type="button"
                          onClick={() => handleReopenSavedProject(c)}
                          className="flex-1 py-1.5 rounded-lg bg-blue-700 text-white font-bold"
                        >
                          Modifier
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => handleShareSavedItem(c)}
                        className="px-2.5 py-1.5 rounded-lg bg-emerald-600 text-white font-bold"
                      >
                        <Share2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteCreations([c])}
                        className="px-2 py-1.5 rounded-lg bg-slate-200 dark:bg-slate-800 text-rose-600"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      );
    }

    return null;
  };

  // Contextual Top Selection Bar above canvas
  const selectionToolbar = (
    <>
      <select
        value={formatRatio}
        onChange={(e) => {
          pushUndoSnapshot();
          setFormatRatio(e.target.value as FormatRatio);
        }}
        aria-label="Format"
        className="px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-xs font-semibold text-slate-800 dark:text-slate-100 border border-slate-200 dark:border-slate-700"
      >
        {Object.entries(FORMAT_DIMS).map(([k, v]) => (
          <option key={k} value={k}>
            {v.label}
          </option>
        ))}
      </select>

      <button
        type="button"
        onClick={() => setIsMultiSelectMode((m) => !m)}
        className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 border ${
          isMultiSelectMode
            ? 'bg-blue-700 border-blue-700 text-white'
            : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700'
        }`}
      >
        <CheckSquare className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">Multi</span>
      </button>

      {selectedLayerIds.length >= 2 && (
        <button
          type="button"
          onClick={handleGroupSelected}
          className="px-2.5 py-1.5 rounded-lg bg-violet-600 text-white text-xs font-bold flex items-center gap-1"
        >
          <Group className="w-3.5 h-3.5" />
          <span>Grouper</span>
        </button>
      )}

      {selectedGroupIds.length > 0 && (
        <button
          type="button"
          onClick={handleUngroupSelected}
          className="px-2.5 py-1.5 rounded-lg bg-violet-100 dark:bg-violet-950/60 text-violet-700 dark:text-violet-300 text-xs font-bold flex items-center gap-1"
        >
          <Ungroup className="w-3.5 h-3.5" />
          <span>Dissocier</span>
        </button>
      )}

      {selectedLayer?.kind === 'text' && (
        <div className="flex items-center gap-1 border-l border-slate-200 dark:border-slate-700 pl-2">
          <button
            type="button"
            onClick={() => openInlineTextEditor(selectedLayer)}
            className="px-2 py-1.5 rounded-lg bg-amber-400/20 text-amber-700 dark:text-amber-300 text-xs font-bold flex items-center gap-1"
          >
            <Edit3 className="w-3.5 h-3.5" />
            <span>Éditer</span>
          </button>
          <button
            type="button"
            onClick={() => {
              pushUndoSnapshot();
              updateSelectedLayer({ bold: !selectedLayer.bold });
            }}
            className={`w-8 h-8 rounded-lg font-extrabold text-xs ${
              selectedLayer.bold ? 'bg-blue-700 text-white' : 'bg-slate-100 dark:bg-slate-800'
            }`}
          >
            G
          </button>
          <button
            type="button"
            onClick={() => {
              pushUndoSnapshot();
              updateSelectedLayer({ italic: !selectedLayer.italic });
            }}
            className={`w-8 h-8 rounded-lg italic font-serif font-bold text-xs ${
              selectedLayer.italic ? 'bg-blue-700 text-white' : 'bg-slate-100 dark:bg-slate-800'
            }`}
          >
            I
          </button>
          <button
            type="button"
            onClick={() => {
              pushUndoSnapshot();
              updateSelectedLayer({ underline: !selectedLayer.underline });
            }}
            className={`w-8 h-8 rounded-lg underline font-bold text-xs ${
              selectedLayer.underline ? 'bg-blue-700 text-white' : 'bg-slate-100 dark:bg-slate-800'
            }`}
          >
            S
          </button>
          <input
            type="color"
            value={selectedLayer.color}
            onChange={(e) => updateSelectedLayer({ color: e.target.value })}
            aria-label="Couleur texte"
            className="w-7 h-7 rounded cursor-pointer border border-slate-300"
          />
        </div>
      )}

      {selectedLayer?.kind === 'image' && (
        <div className="flex items-center gap-1.5 border-l border-slate-200 dark:border-slate-700 pl-2">
          <button
            type="button"
            onClick={() => setCropTargetLayerId(selectedLayer.id)}
            className="px-2.5 py-1.5 rounded-lg bg-amber-400/20 text-amber-700 dark:text-amber-300 text-xs font-bold flex items-center gap-1"
          >
            <Crop className="w-3.5 h-3.5" />
            <span>Recadrer</span>
          </button>
          <button
            type="button"
            onClick={() => replaceImageInputRef.current?.click()}
            className="px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-xs font-semibold flex items-center gap-1"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Remplacer</span>
          </button>
        </div>
      )}

      {selectedLayer?.kind === 'shape' && (
        <div className="flex items-center gap-1.5 border-l border-slate-200 dark:border-slate-700 pl-2">
          <input
            type="color"
            value={selectedLayer.fillColor}
            onChange={(e) => updateSelectedLayer({ fillColor: e.target.value })}
            title="Couleur principale"
            className="w-7 h-7 rounded cursor-pointer border border-slate-300"
          />
          <input
            type="color"
            value={selectedLayer.secondaryColor || '#ffffff'}
            onChange={(e) => updateSelectedLayer({ secondaryColor: e.target.value })}
            title="Couleur secondaire"
            className="w-7 h-7 rounded cursor-pointer border border-slate-300"
          />
        </div>
      )}

      {selectedLayer && (
        <div className="flex items-center gap-1 border-l border-slate-200 dark:border-slate-700 pl-2 ml-auto">
          <button
            type="button"
            onClick={handleCopySelectedLayers}
            title="Copier (Ctrl+C)"
            className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <Copy className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={duplicateSelectedLayers}
            title="Dupliquer (Ctrl+D)"
            className="px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-xs font-semibold"
          >
            +1
          </button>
          <button
            type="button"
            onClick={deleteSelectedLayers}
            title="Supprimer"
            className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {copiedLayers.length > 0 && !selectedLayer && (
        <button
          type="button"
          onClick={handlePasteCopiedLayers}
          className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-xs font-semibold flex items-center gap-1"
        >
          <ClipboardPaste className="w-3.5 h-3.5" />
          <span>Coller</span>
        </button>
      )}
    </>
  );

  // Right Inspector Content
  const inspectorContent = selectedLayer ? (
    <div className="space-y-3 text-xs">
      <div className="grid grid-cols-4 gap-1">
        <button
          type="button"
          onClick={() => alignSelectedLayers('left')}
          className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center"
          title="Aligner à gauche"
        >
          <AlignHorizontalJustifyStart className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => alignSelectedLayers('centerH')}
          className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center"
          title="Centrer horizontalement"
        >
          <AlignHorizontalJustifyCenter className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => alignSelectedLayers('right')}
          className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center"
          title="Aligner à droite"
        >
          <AlignHorizontalJustifyEnd className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => alignSelectedLayers('centerV')}
          className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center"
          title="Centrer verticalement"
        >
          <AlignVerticalJustifyCenter className="w-4 h-4" />
        </button>
      </div>

      {selectedLayer.kind === 'text' && (
        <div className="space-y-2.5 pt-2 border-t border-slate-200 dark:border-slate-800">
          <textarea
            value={selectedLayer.text}
            onChange={(e) => updateSelectedLayer({ text: e.target.value })}
            rows={3}
            className="w-full p-2 text-xs rounded-xl bg-slate-50 dark:bg-[#081024] border border-slate-200 dark:border-slate-700"
          />

          <select
            value={selectedLayer.fontFamily}
            onChange={(e) => updateSelectedLayer({ fontFamily: e.target.value })}
            className="w-full p-2 text-xs rounded-xl bg-slate-50 dark:bg-[#081024] border border-slate-200 dark:border-slate-700"
          >
            {STUDIO_FONTS.map((f) => (
              <option key={f.value} value={f.value}>
                {f.label}
              </option>
            ))}
          </select>

          <label className="block">
            <span className="font-semibold tabular-nums">Taille : {selectedLayer.fontSize}px</span>
            <input
              type="range"
              min={16}
              max={180}
              value={selectedLayer.fontSize}
              onChange={(e) => updateSelectedLayer({ fontSize: Number(e.target.value) })}
              className="w-full"
            />
          </label>

          <div className="flex flex-wrap gap-1">
            <button
              type="button"
              onClick={() => updateSelectedLayer({ bold: !selectedLayer.bold })}
              className={`px-2.5 py-1.5 rounded-lg font-bold ${selectedLayer.bold ? 'bg-blue-700 text-white' : 'bg-slate-100 dark:bg-slate-800'}`}
            >
              Gras
            </button>
            <button
              type="button"
              onClick={() => updateSelectedLayer({ italic: !selectedLayer.italic })}
              className={`px-2.5 py-1.5 rounded-lg italic font-serif ${selectedLayer.italic ? 'bg-blue-700 text-white' : 'bg-slate-100 dark:bg-slate-800'}`}
            >
              Italique
            </button>
            <button
              type="button"
              onClick={() => updateSelectedLayer({ underline: !selectedLayer.underline })}
              className={`px-2.5 py-1.5 rounded-lg underline ${selectedLayer.underline ? 'bg-blue-700 text-white' : 'bg-slate-100 dark:bg-slate-800'}`}
            >
              Souligné
            </button>
            <button
              type="button"
              onClick={() => updateSelectedLayer({ uppercase: !selectedLayer.uppercase })}
              className={`px-2.5 py-1.5 rounded-lg ${selectedLayer.uppercase ? 'bg-blue-700 text-white' : 'bg-slate-100 dark:bg-slate-800'}`}
            >
              AA
            </button>
          </div>

          <div className="grid grid-cols-3 gap-1">
            {(['left', 'center', 'right'] as const).map((al) => (
              <button
                key={al}
                type="button"
                onClick={() => updateSelectedLayer({ align: al })}
                className={`p-2 rounded-lg flex items-center justify-center ${
                  selectedLayer.align === al ? 'bg-blue-700 text-white' : 'bg-slate-100 dark:bg-slate-800'
                }`}
              >
                {al === 'left' ? <AlignLeft className="w-3.5 h-3.5" /> : al === 'center' ? <AlignCenter className="w-3.5 h-3.5" /> : <AlignRight className="w-3.5 h-3.5" />}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <label className="flex items-center gap-1.5">
              <input
                type="checkbox"
                checked={!!selectedLayer.shadow}
                onChange={(e) => updateSelectedLayer({ shadow: e.target.checked })}
              />
              <span>Ombre</span>
            </label>
            <label className="flex items-center gap-1.5">
              <input
                type="checkbox"
                checked={!!selectedLayer.bgEnabled}
                onChange={(e) => updateSelectedLayer({ bgEnabled: e.target.checked })}
              />
              <span>Fond texte</span>
            </label>
            {selectedLayer.bgEnabled && (
              <input
                type="color"
                value={selectedLayer.bgColor}
                onChange={(e) => updateSelectedLayer({ bgColor: e.target.value })}
                className="w-7 h-7 rounded"
              />
            )}
          </div>
        </div>
      )}

      {selectedLayer.kind === 'image' && (
        <div className="space-y-2.5 pt-2 border-t border-slate-200 dark:border-slate-800">
          <div className="grid grid-cols-2 gap-1.5">
            <button
              type="button"
              onClick={() => setCropTargetLayerId(selectedLayer.id)}
              className="min-h-[38px] px-2.5 py-1.5 rounded-xl bg-amber-400/20 hover:bg-amber-400/30 text-amber-800 dark:text-amber-300 font-bold flex items-center justify-center gap-1.5"
            >
              <Crop className="w-3.5 h-3.5" />
              <span>{isEn ? 'Crop' : 'Recadrer'}</span>
            </button>
            <button
              type="button"
              onClick={() => replaceImageInputRef.current?.click()}
              className="min-h-[38px] px-2.5 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 font-semibold flex items-center justify-center gap-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>{isEn ? 'Replace' : 'Remplacer'}</span>
            </button>
          </div>
          {selectedLayer.cropW !== undefined && selectedLayer.cropW < 0.99 && (
            <button
              type="button"
              onClick={() => {
                pushUndoSnapshot();
                const natW = selectedLayer.imageEl.naturalWidth || selectedLayer.imageEl.width || 300;
                const natH = selectedLayer.imageEl.naturalHeight || selectedLayer.imageEl.height || 300;
                const nextH = Math.max(40, Math.round(selectedLayer.width / (natW / Math.max(1, natH))));
                updateSelectedLayer({
                  cropX: undefined,
                  cropY: undefined,
                  cropW: undefined,
                  cropH: undefined,
                  height: nextH,
                });
              }}
              className="w-full py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-[11px] font-semibold"
            >
              {isEn ? 'Reset crop' : 'Réinitialiser le recadrage'}
            </button>
          )}
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={selectedLayer.circular}
              onChange={(e) => updateSelectedLayer({ circular: e.target.checked })}
            />
            <span>Cadre circulaire</span>
          </label>
          <select
            value={selectedLayer.filter || 'none'}
            onChange={(e) => updateSelectedLayer({ filter: e.target.value as ImageLayer['filter'] })}
            className="w-full p-2 rounded-xl bg-slate-50 dark:bg-[#081024] border border-slate-200 dark:border-slate-700"
          >
            <option value="none">Filtre : Original</option>
            <option value="warm">Chaleureux</option>
            <option value="bright">Lumineux</option>
            <option value="sepia">Sépia doux</option>
            <option value="grayscale">Noir & Blanc</option>
          </select>
        </div>
      )}

      {/* Common Opacity & Rotation */}
      <div className="space-y-2 pt-2 border-t border-slate-200 dark:border-slate-800">
        <label className="block">
          <span className="font-semibold tabular-nums">
            Opacité : {Math.round(selectedLayer.opacity * 100)}%
          </span>
          <input
            type="range"
            min={0.1}
            max={1}
            step={0.05}
            value={selectedLayer.opacity}
            onChange={(e) => updateSelectedLayer({ opacity: Number(e.target.value) })}
            className="w-full"
          />
        </label>
        <label className="block">
          <span className="font-semibold tabular-nums">Rotation : {selectedLayer.rotation}°</span>
          <input
            type="range"
            min={-180}
            max={180}
            value={selectedLayer.rotation}
            onChange={(e) => updateSelectedLayer({ rotation: Number(e.target.value) })}
            className="w-full"
          />
        </label>
      </div>
    </div>
  ) : (
    <div className="text-xs text-slate-500 p-2 text-center">
      Sélectionnez un élément sur le canevas pour ajuster ses propriétés.
    </div>
  );

  // Center Stage
  const centerStage = (
    <div className="relative w-full h-full flex items-center justify-center overflow-hidden">
      <div
        className="relative transition-transform duration-75 origin-center"
        style={{
          transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${workspaceZoom / 100})`,
        }}
      >
        <div className="relative rounded-xl shadow-2xl border border-slate-300 dark:border-slate-700 overflow-hidden bg-white">
          <canvas
            ref={canvasRef}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            style={{
              maxHeight: '58dvh',
              maxWidth: '100%',
              aspectRatio: `${dims.w} / ${dims.h}`,
            }}
            className={`block w-auto h-auto touch-none ${
              isPanMode ? 'cursor-grab active:cursor-grabbing' : isDrawMode ? 'cursor-crosshair' : 'cursor-default'
            }`}
          />

          {/* Floating Inline Text Editor Overlay */}
          {inlineEditLayerId && (
            <div className="absolute inset-0 bg-slate-950/65 flex items-center justify-center p-4 z-30">
              <div className="w-full max-w-sm bg-white dark:bg-[#0c1631] rounded-2xl p-4 shadow-2xl space-y-3 border border-slate-200 dark:border-slate-700">
                <div className="text-xs font-extrabold text-slate-900 dark:text-white">
                  Modifier le texte
                </div>
                <textarea
                  autoFocus
                  value={inlineEditText}
                  onChange={(e) => setInlineEditText(e.target.value)}
                  rows={4}
                  className="w-full p-2.5 text-sm rounded-xl bg-slate-50 dark:bg-[#081024] border border-slate-200 dark:border-slate-700"
                />
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setInlineEditLayerId(null)}
                    className="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-xs font-semibold"
                  >
                    Annuler
                  </button>
                  <button
                    type="button"
                    onClick={commitInlineTextEditor}
                    className="px-4 py-1.5 rounded-lg bg-blue-700 text-white text-xs font-bold"
                  >
                    Valider
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {notice && (
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 px-3.5 py-2 rounded-xl bg-slate-950/90 text-white text-xs font-semibold shadow-lg flex items-center gap-2 z-30 max-w-[90%]">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span className="truncate">{notice}</span>
          <button type="button" onClick={() => setNotice(null)} className="text-slate-400 hover:text-white ml-1">
            ×
          </button>
        </div>
      )}
    </div>
  );

  // Bottom Multi-Page / Slide Strip & Zoom Strip
  const bottomBar = (
    <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
      {/* Multi-Page / Slide Tabs with drag reorder + transition selector in Presentation mode */}
      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5 flex-1 min-w-0">
        {pages.map((pg, idx) => (
          <div
            key={pg.id}
            draggable
            onDragStart={() => setDraggingPageIdx(idx)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => {
              if (draggingPageIdx !== null) reorderPages(draggingPageIdx, idx);
              setDraggingPageIdx(null);
            }}
            onDragEnd={() => setDraggingPageIdx(null)}
            className={`flex items-center rounded-lg border transition shrink-0 ${
              idx === activePageIndex
                ? 'bg-blue-700 border-blue-700 text-white'
                : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200'
            }`}
          >
            <button
              type="button"
              onClick={() => {
                setActivePageIndex(idx);
                setSelectedLayerIds([]);
              }}
              className="px-2.5 py-1.5 font-bold whitespace-nowrap flex items-center gap-1"
            >
              <GripVertical className="w-3 h-3 opacity-60 hidden sm:inline" />
              <span>{isPresentation ? `Diapo ${idx + 1}` : `Page ${idx + 1}`}</span>
            </button>
            {idx === activePageIndex && (
              <div className="flex items-center pr-1 gap-0.5">
                {idx > 0 && (
                  <button
                    type="button"
                    onClick={() => reorderPages(idx, idx - 1)}
                    title={isPresentation ? 'Déplacer à gauche' : 'Page précédente'}
                    className="p-1 rounded hover:bg-white/20"
                  >
                    <ChevronLeft className="w-3 h-3" />
                  </button>
                )}
                {idx < pages.length - 1 && (
                  <button
                    type="button"
                    onClick={() => reorderPages(idx, idx + 1)}
                    title={isPresentation ? 'Déplacer à droite' : 'Page suivante'}
                    className="p-1 rounded hover:bg-white/20"
                  >
                    <ChevronRight className="w-3 h-3" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => handleDuplicatePage(idx)}
                  title={isPresentation ? 'Dupliquer la diapo' : 'Dupliquer la page'}
                  className="p-1 rounded hover:bg-white/20"
                >
                  <Copy className="w-3 h-3" />
                </button>
                {pages.length > 1 && (
                  <button
                    type="button"
                    onClick={() => handleDeletePage(idx)}
                    title={isPresentation ? 'Supprimer la diapo' : 'Supprimer la page'}
                    className="p-1 rounded hover:bg-rose-500/80"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                )}
              </div>
            )}
          </div>
        ))}
        <button
          type="button"
          onClick={handleAddPage}
          className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-xs font-bold flex items-center gap-1 whitespace-nowrap shrink-0"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>{isPresentation ? 'Diapo' : 'Page'}</span>
        </button>

        {isPresentation && (
          <select
            value={activePage.transition || 'fade'}
            onChange={(e) =>
              updateActivePage((pg) => ({
                ...pg,
                transition: e.target.value as SlideTransition,
              }))
            }
            aria-label="Transition"
            className="px-2 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[11px] font-semibold shrink-0"
          >
            <option value="fade">Transition : Fondu</option>
            <option value="slide">Glissement</option>
            <option value="zoom">Zoom doux</option>
            <option value="none">Aucune</option>
          </select>
        )}
      </div>

      {/* Snap + Pan + Zoom Controls */}
      <div className="flex items-center gap-1.5 shrink-0">
        {isPresentation && (
          <button
            type="button"
            onClick={handleStartSlideshow}
            className="px-2.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-slate-950 font-extrabold flex items-center gap-1 whitespace-nowrap"
          >
            <MonitorPlay className="w-3.5 h-3.5" />
            <span>Diaporama</span>
          </button>
        )}
        <button
          type="button"
          onClick={() => {
            setIsPanMode((p) => !p);
            setIsDrawMode(false);
          }}
          title="Déplacer la vue (Main)"
          className={`px-2 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 ${
            isPanMode ? 'bg-amber-500 text-slate-950' : 'bg-slate-100 dark:bg-slate-800'
          }`}
        >
          <Hand className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={() => setSnapEnabled((s) => !s)}
          title="Aimant d’alignement"
          className={`px-2 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 ${
            snapEnabled ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300' : 'bg-slate-100 dark:bg-slate-800'
          }`}
        >
          <Magnet className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={() => setWorkspaceZoom((z) => Math.max(50, z - 15))}
          className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800"
        >
          <ZoomOut className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={() => {
            setWorkspaceZoom(100);
            setPanOffset({ x: 0, y: 0 });
          }}
          className="px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-[11px] font-bold tabular-nums"
        >
          {workspaceZoom}%
        </button>
        <button
          type="button"
          onClick={() => setWorkspaceZoom((z) => Math.min(200, z + 15))}
          className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800"
        >
          <ZoomIn className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );

  // Export Multi-format Bar
  const exportMenu = (
    <div className="flex items-center gap-1">
      <button
        type="button"
        onClick={() => handleDownload('png')}
        className="min-h-[38px] px-2.5 py-1.5 rounded-lg bg-blue-700 hover:bg-blue-800 text-white text-xs font-bold flex items-center gap-1 whitespace-nowrap"
      >
        <Download className="w-3.5 h-3.5" />
        <span>PNG</span>
      </button>
      <button
        type="button"
        onClick={() => handleDownload('jpg')}
        className="min-h-[38px] px-2.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold hidden sm:flex items-center gap-1 whitespace-nowrap"
      >
        <span>JPG</span>
      </button>
      <button
        type="button"
        onClick={() => handleDownload('pdf')}
        className="min-h-[38px] px-2.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-extrabold flex items-center gap-1 whitespace-nowrap"
        title={pages.length > 1 ? `Exporter les ${pages.length} pages en PDF` : 'Exporter en PDF'}
      >
        <FileText className="w-3.5 h-3.5" />
        <span>PDF{pages.length > 1 ? ` (${pages.length})` : ''}</span>
      </button>
    </div>
  );

  const previewModalTemplate: PreviewModalTemplateData | null = previewingTemplate
    ? {
        id: previewingTemplate.id,
        title: isEn ? previewingTemplate.nameEn : previewingTemplate.nameFr,
        category: previewingTemplate.category,
        kind: studioMode,
        format: previewingTemplate.format,
        bgType: previewingTemplate.bgType,
        bgColor1: previewingTemplate.bgColor1,
        bgColor2: previewingTemplate.bgColor2,
        bgAngle: previewingTemplate.bgAngle,
        bgRemoteImageUrl: previewingTemplate.bgRemoteImageUrl,
        layers: previewingTemplate.layers as unknown as Array<Record<string, unknown>>,
        pages: previewingTemplate.pages as unknown as Array<Record<string, unknown>>,
        sourceLabel:
          previewingTemplate.source && previewingTemplate.source !== 'local'
            ? 'Bibliothèque en ligne'
            : 'SHALOM',
        isSavedOffline: customTemplates.some(
          (st) => st.id === `saved_tpl_${studioMode}_${previewingTemplate.id}`
        ),
        isSavingOffline: savingShalomId === previewingTemplate.id,
        rawTemplate: previewingTemplate,
      }
    : null;

  const activeSlideTransition = pages[slideshowIndex]?.transition || 'fade';

  return (
    <>
      <input
        ref={replaceImageInputRef}
        type="file"
        accept="image/*"
        onChange={handleReplaceSelectedImageFile}
        className="hidden"
      />

      <StudioWorkspaceShell
        projectTitle={designTitle}
        onProjectTitleChange={setDesignTitle}
        titlePlaceholder={isPresentation ? 'Ma présentation SHALOM' : 'Ma création SHALOM'}
        statusLine={`${isPresentation ? 'Diapo' : 'Page'} ${activePageIndex + 1}/${pages.length} · ${dims.w}×${dims.h} · Brouillon auto`}
        canUndo={historyPast.length > 0}
        canRedo={historyFuture.length > 0}
        onUndo={handleUndo}
        onRedo={handleRedo}
        onPreview={isPresentation ? handleStartSlideshow : handleOpenPreview}
        onSaveProject={handleSaveProject}
        onOpenShalomFolder={handleOpenShalomFolder}
        onShare={handleShare}
        exportMenu={exportMenu}
        toolItems={toolItems}
        activeToolId={activeToolTab}
        onSelectTool={(id) => setActiveToolTab(id as StudioToolTab | null)}
        toolDrawerContent={renderToolDrawer()}
        selectionToolbar={selectionToolbar}
        centerStage={centerStage}
        bottomBar={bottomBar}
        inspectorTitle="Propriétés"
        inspectorContent={inspectorContent}
        isInspectorOpen={isInspectorOpen}
        onToggleInspector={() => setIsInspectorOpen((v) => !v)}
      />

      {/* Template Visual Preview Modal BEFORE Applying */}
      <TemplatePreviewModal
        template={previewModalTemplate}
        isEn={isEn}
        onClose={() => setPreviewingTemplate(null)}
        onSaveToShalom={
          previewingTemplate?.source && previewingTemplate.source !== 'local'
            ? () => handleSaveTemplateToShalom(previewingTemplate)
            : undefined
        }
        onUseTemplate={async (tplData) => {
          const raw = tplData.rawTemplate as DesignTemplate;
          setPreviewingTemplate(null);
          await applyTemplate(raw);
        }}
      />

      {/* Non-destructive Image Crop Modal */}
      <ImageCropModal
        isOpen={Boolean(cropTargetLayer)}
        imageEl={cropTargetLayer?.imageEl || null}
        initialCrop={cropTargetLayer || undefined}
        isEn={isEn}
        onClose={() => setCropTargetLayerId(null)}
        onApply={handleApplyCrop}
      />

      {/* Interactive Presentation Slideshow Modal */}
      <Modal
        isOpen={slideshowOpen}
        onClose={() => {
          setSlideshowOpen(false);
          setSlideshowPlaying(false);
        }}
        title={`${designTitle} — Diaporama (${slideshowIndex + 1}/${Math.max(1, slideshowSlideUrls.length)})`}
        maxWidth="2xl"
      >
        <div className="space-y-4">
          <div className="bg-slate-950 rounded-2xl border border-slate-800 p-3 flex items-center justify-center overflow-hidden min-h-[260px]">
            {slideshowSlideUrls[slideshowIndex] && (
              <img
                key={`${slideshowIndex}_${activeSlideTransition}`}
                src={slideshowSlideUrls[slideshowIndex]}
                alt={`Diapo ${slideshowIndex + 1}`}
                className={`max-h-[58vh] w-auto object-contain rounded-xl shadow-2xl ${
                  activeSlideTransition === 'zoom'
                    ? 'animate-in zoom-in-95 duration-300'
                    : activeSlideTransition === 'slide'
                      ? 'animate-in slide-in-from-right-6 duration-300'
                      : activeSlideTransition === 'fade'
                        ? 'animate-in fade-in duration-300'
                        : ''
                }`}
              />
            )}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => setSlideshowIndex((i) => Math.max(0, i - 1))}
              disabled={slideshowIndex <= 0}
              className="min-h-[44px] px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-bold flex items-center gap-1.5 disabled:opacity-40"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Précédent</span>
            </button>

            <button
              type="button"
              onClick={() => setSlideshowPlaying((p) => !p)}
              className="min-h-[44px] px-4 py-2 rounded-xl bg-amber-500 text-slate-950 text-xs font-extrabold flex items-center gap-1.5"
            >
              {slideshowPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
              <span>{slideshowPlaying ? 'Pause auto' : 'Lecture auto'}</span>
            </button>

            <button
              type="button"
              onClick={() => setSlideshowIndex((i) => Math.min(slideshowSlideUrls.length - 1, i + 1))}
              disabled={slideshowIndex >= slideshowSlideUrls.length - 1}
              className="min-h-[44px] px-4 py-2 rounded-xl bg-blue-700 text-white text-xs font-bold flex items-center gap-1.5 disabled:opacity-40"
            >
              <span>Suivant</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </Modal>

      {/* Preview Modal */}
      <Modal
        isOpen={!!previewDataUrl}
        onClose={() => setPreviewDataUrl(null)}
        title={designTitle}
        maxWidth="lg"
      >
        {previewDataUrl && (
          <div className="space-y-3 text-center">
            <img
              src={previewDataUrl}
              alt={designTitle}
              className="max-h-[68vh] mx-auto rounded-xl border border-slate-200 dark:border-slate-700"
            />
            <div className="flex justify-center gap-2">
              <button
                type="button"
                onClick={() => handleDownload('png')}
                className="px-4 py-2 rounded-xl bg-blue-700 text-white text-xs font-bold"
              >
                Télécharger PNG
              </button>
              <button
                type="button"
                onClick={handleShare}
                className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold"
              >
                Partager
              </button>
            </div>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        isOpen={!!confirmDeleteCreations && confirmDeleteCreations.length > 0}
        title="Supprimer cette création ?"
        message={`Supprimer ${confirmDeleteCreations?.length || 0} création(s) enregistrée(s) ?`}
        confirmLabel="Supprimer"
        cancelLabel="Annuler"
        isDestructive
        onConfirm={handleConfirmDeleteCreations}
        onCancel={() => setConfirmDeleteCreations(null)}
      />

      <SocialShareModal
        isOpen={!!sharePayload}
        onClose={() => setSharePayload(null)}
        payload={sharePayload}
      />

      <ShalomFolderExplorerModal
        isOpen={folderExplorerOpen}
        onClose={() => setFolderExplorerOpen(false)}
      />
    </>
  );
};
