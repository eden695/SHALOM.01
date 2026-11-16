import React, { useState, useEffect, useRef, useCallback } from 'react';
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
  Save,
  RotateCcw,
  Eraser,
  CheckCircle2,
  Sparkles,
  CheckSquare,
  Square,
  ZoomIn,
  ZoomOut,
  Undo2,
  Redo2,
  Layers,
  LayoutTemplate,
  Palette,
  Eye,
  Lock,
  Unlock,
  EyeOff,
  Magnet,
  AlignHorizontalJustifyCenter,
  AlignVerticalJustifyCenter,
  AlignHorizontalJustifyStart,
  AlignHorizontalJustifyEnd,
  FileText,
  FolderOpen,
  Search,
  Globe,
  GripVertical,
  ArrowLeft,
  ArrowRight,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Loader2,
  Plus,
} from 'lucide-react';
import { useShalomDB } from '../../hooks/useShalomDB';
import { dbService, STORES } from '../../services/db';
import { useLanguage } from '../../contexts/LanguageContext';
import { CreativeDesignItem, SavedStudioTemplate } from '../../types';
import { ConfirmDialog } from '../common/ConfirmDialog';
import { Modal } from '../common/Modal';
import { SocialShareModal } from '../common/SocialShareModal';
import { SharePayload } from '../../services/socialShare';
import { downloadBlobToDevice } from '../../services/fileTransfer';
import {
  drawStudioVectorElement,
  exportCanvasToPdfBlob,
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

type FormatRatio = 'square' | 'portrait' | 'story' | 'landscape' | 'a4';
type StudioToolTab = 'templates' | 'elements' | 'text' | 'images' | 'draw' | 'bg' | 'layers';

interface BaseLayer {
  id: string;
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
  strokeColor: string;
  strokeWidth: number;
}

interface ImageLayer extends BaseLayer {
  kind: 'image';
  imageEl: HTMLImageElement;
  assetKey?: string;
  label: string;
  width: number;
  height: number;
  circular: boolean;
  filter?: 'none' | 'grayscale' | 'sepia' | 'warm' | 'bright';
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
  x: number;
  y: number;
  rotation: number;
  opacity: number;
  visible?: boolean;
  locked?: boolean;
  // text
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
  lineHeight?: number;
  letterSpacing?: number;
  // shape
  shape?: StudioVectorElementKind;
  width?: number;
  height?: number;
  fillColor?: string;
  strokeColor?: string;
  strokeWidth?: number;
  // image
  assetKey?: string;
  label?: string;
  circular?: boolean;
  filter?: 'none' | 'grayscale' | 'sepia' | 'warm' | 'bright';
}

interface ProjectSnapshot {
  designTitle: string;
  formatRatio: FormatRatio;
  bgType: 'solid' | 'gradient' | 'image';
  bgColor1: string;
  bgColor2: string;
  bgAngle: number;
  bgImageAssetKey?: string;
  bgImageOverlay: number;
  layers: SerializedLayer[];
  strokes: DrawStroke[];
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
  bgType: 'solid' | 'gradient';
  bgColor1: string;
  bgColor2: string;
  bgAngle: number;
  source?: 'local' | 'online-catalog' | 'online-live';
  layers: SerializedLayer[];
}

interface OnlineAssetItem {
  id: string;
  assetType: 'elements' | 'images' | 'backgrounds';
  title: string;
  previewUrl: string;
  fullUrl: string;
  svgMarkup?: string;
  width?: number;
  height?: number;
  source: string;
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
        opacity: 0.25,
      },
      {
        kind: 'shape',
        id: 'tpl_cross',
        shape: 'cross',
        x: 540,
        y: 220,
        width: 120,
        height: 150,
        fillColor: '#fbbf24',
        strokeColor: '#ffffff',
        strokeWidth: 0,
        rotation: 0,
        opacity: 0.95,
      },
      {
        kind: 'text',
        id: 'tpl_txt1',
        x: 540,
        y: 520,
        text: '« L’Éternel est mon berger :\nje ne manquerai de rien. »',
        fontFamily: 'Georgia, "Times New Roman", serif',
        fontSize: 60,
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
        kind: 'text',
        id: 'tpl_txt2',
        x: 540,
        y: 780,
        text: 'PSAUME 23 : 1',
        fontFamily: '"Outfit", sans-serif',
        fontSize: 36,
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
    id: 'culte_invite',
    nameFr: 'Invitation Culte',
    nameEn: 'Worship Invitation',
    category: 'Église',
    format: 'portrait',
    bgType: 'gradient',
    bgColor1: '#1e1b4b',
    bgColor2: '#7c3aed',
    bgAngle: 155,
    layers: [
      {
        kind: 'shape',
        id: 'ci_rays',
        shape: 'rays',
        x: 540,
        y: 250,
        width: 280,
        height: 280,
        fillColor: '#fde68a',
        strokeColor: '#ffffff',
        strokeWidth: 0,
        rotation: 0,
        opacity: 0.25,
      },
      {
        kind: 'shape',
        id: 'ci_dove',
        shape: 'dove',
        x: 540,
        y: 250,
        width: 170,
        height: 150,
        fillColor: '#ffffff',
        strokeColor: '#fbbf24',
        strokeWidth: 0,
        rotation: 0,
        opacity: 0.95,
      },
      {
        kind: 'text',
        id: 'ci_h1',
        x: 540,
        y: 520,
        text: 'CULTE DE LOUANGE\n& D’ADORATION',
        fontFamily: '"Outfit", sans-serif',
        fontSize: 66,
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
        id: 'ci_badge',
        x: 540,
        y: 820,
        text: 'DIMANCHE · 09H30 · ENTRÉE LIBRE',
        fontFamily: '"Plus Jakarta Sans", sans-serif',
        fontSize: 34,
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
      {
        kind: 'text',
        id: 'ci_foot',
        x: 540,
        y: 1050,
        text: '« Venez avec joie en Sa présence ! »',
        fontFamily: 'Georgia, "Times New Roman", serif',
        fontSize: 38,
        color: '#e2e8f0',
        bold: false,
        italic: true,
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
    id: 'jeune_priere',
    nameFr: 'Temps de Jeûne & Prière',
    nameEn: 'Fasting & Prayer',
    category: 'Prière',
    format: 'story',
    bgType: 'gradient',
    bgColor1: '#064e3b',
    bgColor2: '#0f172a',
    bgAngle: 180,
    layers: [
      {
        kind: 'shape',
        id: 'jp_bible',
        shape: 'bible',
        x: 540,
        y: 440,
        width: 240,
        height: 180,
        fillColor: '#fde68a',
        strokeColor: '#ffffff',
        strokeWidth: 0,
        rotation: 0,
        opacity: 0.9,
      },
      {
        kind: 'text',
        id: 'jp_title',
        x: 540,
        y: 780,
        text: '3 JOURS DE JEÛNE\n& INTERCESSION',
        fontFamily: '"Outfit", sans-serif',
        fontSize: 72,
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
      {
        kind: 'text',
        id: 'jp_sub',
        x: 540,
        y: 1180,
        text: '« Priez sans cesse. »\n1 Thessaloniciens 5 : 17',
        fontFamily: 'Georgia, "Times New Roman", serif',
        fontSize: 44,
        color: '#a7f3d0',
        bold: false,
        italic: true,
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
    id: 'temoignage',
    nameFr: 'Carte Témoignage',
    nameEn: 'Testimony Card',
    category: 'Témoignage',
    format: 'square',
    bgType: 'gradient',
    bgColor1: '#fffbeb',
    bgColor2: '#fef3c7',
    bgAngle: 145,
    layers: [
      {
        kind: 'shape',
        id: 'tm_ribbon',
        shape: 'roundRect',
        x: 540,
        y: 540,
        width: 920,
        height: 920,
        fillColor: '#ffffff',
        strokeColor: '#d97706',
        strokeWidth: 8,
        rotation: 0,
        opacity: 0.95,
      },
      {
        kind: 'shape',
        id: 'tm_heart',
        shape: 'heart',
        x: 540,
        y: 230,
        width: 110,
        height: 100,
        fillColor: '#d97706',
        strokeColor: '#ffffff',
        strokeWidth: 0,
        rotation: 0,
        opacity: 1,
      },
      {
        kind: 'text',
        id: 'tm_title',
        x: 540,
        y: 380,
        text: 'TÉMOIGNAGE DE GRÂCE',
        fontFamily: '"Outfit", sans-serif',
        fontSize: 44,
        color: '#b45309',
        bold: true,
        italic: false,
        align: 'center',
        bgColor: '#ffffff',
        bgEnabled: false,
        shadow: false,
        rotation: 0,
        opacity: 1,
      },
      {
        kind: 'text',
        id: 'tm_body',
        x: 540,
        y: 610,
        text: '« Mon cœur exulte en l’Éternel ;\nIl a exaucé ma prière avec fidélité. »',
        fontFamily: 'Georgia, "Times New Roman", serif',
        fontSize: 48,
        color: '#1e293b',
        bold: false,
        italic: true,
        align: 'center',
        bgColor: '#ffffff',
        bgEnabled: false,
        shadow: false,
        rotation: 0,
        opacity: 1,
      },
    ],
  },
  {
    id: 'voeux_benis',
    nameFr: 'Vœux & Bénédiction',
    nameEn: 'Blessed Wishes',
    category: 'Vœux',
    format: 'square',
    bgType: 'gradient',
    bgColor1: '#4c1d95',
    bgColor2: '#db2777',
    bgAngle: 120,
    layers: [
      {
        kind: 'shape',
        id: 'vb_crown',
        shape: 'crown',
        x: 540,
        y: 260,
        width: 170,
        height: 130,
        fillColor: '#fbbf24',
        strokeColor: '#ffffff',
        strokeWidth: 0,
        rotation: 0,
        opacity: 1,
      },
      {
        kind: 'text',
        id: 'vb_title',
        x: 540,
        y: 530,
        text: 'QUE LA PAIX DE DIEU\nSOIT SUR VOUS',
        fontFamily: '"Outfit", sans-serif',
        fontSize: 64,
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
        x: l.x,
        y: l.y,
        rotation: l.rotation,
        opacity: l.opacity,
        visible: l.visible,
        locked: l.locked,
        assetKey: l.assetKey,
        label: l.label,
        width: l.width,
        height: l.height,
        circular: l.circular,
        filter: l.filter,
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

async function hydrateLayers(serialized: SerializedLayer[]): Promise<StudioLayer[]> {
  const out: StudioLayer[] = [];
  for (const s of serialized) {
    if (s.kind === 'text') {
      out.push({
        id: s.id,
        kind: 'text',
        x: s.x,
        y: s.y,
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
        id: s.id,
        kind: 'shape',
        shape: s.shape || 'rect',
        x: s.x,
        y: s.y,
        width: s.width || 220,
        height: s.height || 220,
        fillColor: s.fillColor || '#1d4ed8',
        strokeColor: s.strokeColor || '#fbbf24',
        strokeWidth: s.strokeWidth ?? 0,
        rotation: s.rotation || 0,
        opacity: s.opacity ?? 1,
        visible: s.visible ?? true,
        locked: s.locked ?? false,
      });
    } else if (s.kind === 'image' && s.assetKey) {
      const blob = await dbService.getMediaBlob(s.assetKey);
      if (blob) {
        try {
          const img = await loadImageFromBlob(blob);
          out.push({
            id: s.id,
            kind: 'image',
            imageEl: img,
            assetKey: s.assetKey,
            label: s.label || 'Image',
            width: s.width || 320,
            height: s.height || 320,
            circular: !!s.circular,
            filter: s.filter || 'none',
            x: s.x,
            y: s.y,
            rotation: s.rotation || 0,
            opacity: s.opacity ?? 1,
            visible: s.visible ?? true,
            locked: s.locked ?? false,
          });
        } catch {
          // skip unreadable image asset
        }
      }
    }
  }
  return out;
}

export const CreativeStudioModule: React.FC = () => {
  const { lang } = useLanguage();
  const { creations, customTemplates, reloadData } = useShalomDB();
  const isEn = lang === 'en';

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const draftRestoredRef = useRef(false);

  const [activeToolTab, setActiveToolTab] = useState<StudioToolTab>('templates');
  const [editingCreationId, setEditingCreationId] = useState<string | null>(null);
  const [designTitle, setDesignTitle] = useState(isEn ? 'My Creation' : 'Ma création');
  const [formatRatio, setFormatRatio] = useState<FormatRatio>('square');
  const [bgType, setBgType] = useState<'solid' | 'gradient' | 'image'>('solid');
  const [bgColor1, setBgColor1] = useState('#ffffff');
  const [bgColor2, setBgColor2] = useState('#173c7a');
  const [bgAngle, setBgAngle] = useState(135);
  const [bgImageEl, setBgImageEl] = useState<HTMLImageElement | null>(null);
  const [bgImageAssetKey, setBgImageAssetKey] = useState<string | undefined>(undefined);
  const [bgImageOverlay, setBgImageOverlay] = useState(0.2);

  const [layers, setLayers] = useState<StudioLayer[]>([]);
  const [selectedLayerIds, setSelectedLayerIds] = useState<string[]>([]);
  const [workspaceZoom, setWorkspaceZoom] = useState<number>(100);
  const [snapEnabled, setSnapEnabled] = useState(true);
  const [snapGuides, setSnapGuides] = useState<{ x: boolean; y: boolean }>({ x: false, y: false });

  // Undo / Redo history stacks
  const [historyPast, setHistoryPast] = useState<ProjectSnapshot[]>([]);
  const [historyFuture, setHistoryFuture] = useState<ProjectSnapshot[]>([]);
  const skipHistoryRef = useRef(false);

  // Freehand drawing
  const [isDrawMode, setIsDrawMode] = useState(false);
  const [brushColor, setBrushColor] = useState('#0b1f42');
  const [brushSize, setBrushSize] = useState(10);
  const [strokes, setStrokes] = useState<DrawStroke[]>([]);
  const activeStrokeRef = useRef<DrawStroke | null>(null);

  // Pointer interaction state (drag / handle resize / handle rotate)
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

  // Template search & online discovery state
  const [templateQuery, setTemplateQuery] = useState('');
  const [templateCategory, setTemplateCategory] = useState('all');
  const [onlineTemplates, setOnlineTemplates] = useState<DesignTemplate[]>([]);
  const [templatePage, setTemplatePage] = useState(1);
  const [templateHasMore, setTemplateHasMore] = useState(true);
  const [isSearchingOnline, setIsSearchingOnline] = useState(false);
  const [isLoadingMoreTemplates, setIsLoadingMoreTemplates] = useState(false);
  const [onlineStatusMsg, setOnlineStatusMsg] = useState<string | null>(null);

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

  // Layer panel drag-and-drop state
  const [draggingLayerId, setDraggingLayerId] = useState<string | null>(null);
  const [dragOverLayerId, setDragOverLayerId] = useState<string | null>(null);

  const dims = FORMAT_DIMS[formatRatio];
  const primarySelectedId = selectedLayerIds[selectedLayerIds.length - 1] || null;
  const selectedLayer = layers.find((l) => l.id === primarySelectedId) || null;

  const designCreations = creations.filter((c) => !c.studioType || c.studioType === 'design');
  const savedDesignTemplates = React.useMemo(
    () => customTemplates.filter((t) => t.studioType === 'design'),
    [customTemplates]
  );

  const createCurrentSnapshot = useCallback((): ProjectSnapshot => {
    return {
      designTitle,
      formatRatio,
      bgType,
      bgColor1,
      bgColor2,
      bgAngle,
      bgImageAssetKey,
      bgImageOverlay,
      layers: serializeLayers(layers),
      strokes: strokes.map((s) => ({ ...s, points: [...s.points] })),
    };
  }, [
    designTitle,
    formatRatio,
    bgType,
    bgColor1,
    bgColor2,
    bgAngle,
    bgImageAssetKey,
    bgImageOverlay,
    layers,
    strokes,
  ]);

  const pushUndoSnapshot = useCallback(() => {
    if (skipHistoryRef.current) return;
    const snap = createCurrentSnapshot();
    setHistoryPast((prev) => [...prev.slice(-24), snap]);
    setHistoryFuture([]);
  }, [createCurrentSnapshot]);

  const applySnapshot = useCallback(async (snap: ProjectSnapshot) => {
    skipHistoryRef.current = true;
    setDesignTitle(snap.designTitle);
    setFormatRatio(snap.formatRatio);
    setBgType(snap.bgType);
    setBgColor1(snap.bgColor1);
    setBgColor2(snap.bgColor2);
    setBgAngle(snap.bgAngle);
    setBgImageAssetKey(snap.bgImageAssetKey);
    setBgImageOverlay(snap.bgImageOverlay);
    setStrokes(snap.strokes || []);
    if (snap.bgImageAssetKey) {
      const b = await dbService.getMediaBlob(snap.bgImageAssetKey);
      if (b) {
        const img = await loadImageFromBlob(b).catch(() => null);
        setBgImageEl(img);
      }
    } else {
      setBgImageEl(null);
    }
    const hydrated = await hydrateLayers(snap.layers || []);
    setLayers(hydrated);
    setSelectedLayerIds([]);
    window.setTimeout(() => {
      skipHistoryRef.current = false;
    }, 50);
  }, []);

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

  // Restore last active studio draft on mount (survives tab switches, WhatsApp returns, WebView resumes)
  useEffect(() => {
    let active = true;
    (async () => {
      const draft = await loadStudioDraft('design');
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
  }, [applySnapshot]);

  // Auto-save active draft to IndexedDB debounced + on visibilitychange
  useEffect(() => {
    if (!draftRestoredRef.current) return;
    const snap = createCurrentSnapshot();
    const assetKeys = new Set<string>();
    if (snap.bgImageAssetKey) assetKeys.add(snap.bgImageAssetKey);
    snap.layers.forEach((l) => {
      if (l.assetKey) assetKeys.add(l.assetKey);
    });
    const timer = window.setTimeout(() => {
      saveStudioDraft('design', snap.designTitle, JSON.stringify(snap), Array.from(assetKeys)).catch(
        () => {}
      );
    }, 400);
    return () => clearTimeout(timer);
  }, [createCurrentSnapshot]);

  // Keyboard shortcuts (Ctrl+Z Undo, Ctrl+Y Redo, Delete)
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
      } else if (e.key === 'Delete' && selectedLayerIds.length > 0) {
        e.preventDefault();
        pushUndoSnapshot();
        setLayers((prev) => prev.filter((l) => !selectedLayerIds.includes(l.id) || l.locked));
        setSelectedLayerIds([]);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [handleUndo, handleRedo, selectedLayerIds, pushUndoSnapshot]);

  useEffect(() => {
    let cancelled = false;
    const urls: string[] = [];
    (async () => {
      const next: Record<string, string> = {};
      for (const item of designCreations) {
        const blob = await dbService.getMediaBlob(item.mediaBlobKey);
        if (blob && !cancelled) {
          const url = URL.createObjectURL(blob);
          urls.push(url);
          next[item.id] = url;
        }
      }
      if (!cancelled) setSavedPreviews(next);
    })();
    return () => {
      cancelled = true;
      urls.forEach((u) => URL.revokeObjectURL(u));
    };
  }, [creations]);

  const getLayerBoundingBox = useCallback(
    (ctx: CanvasRenderingContext2D, layer: StudioLayer): { w: number; h: number } => {
      if (layer.kind === 'text') {
        ctx.save();
        ctx.font = `${layer.italic ? 'italic ' : ''}${layer.bold ? '700 ' : '400 '}${layer.fontSize}px ${layer.fontFamily}`;
        if ('letterSpacing' in ctx && layer.letterSpacing) {
          (ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = `${layer.letterSpacing}px`;
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

  const renderCanvas = useCallback(
    (showSelectionBox = true) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      canvas.width = dims.w;
      canvas.height = dims.h;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // 1. Background
      if (bgType === 'solid') {
        ctx.fillStyle = bgColor1;
        ctx.fillRect(0, 0, dims.w, dims.h);
      } else if (bgType === 'gradient') {
        const rad = (bgAngle * Math.PI) / 180;
        const cx = dims.w / 2;
        const cy = dims.h / 2;
        const r = Math.max(dims.w, dims.h) / 2;
        const grad = ctx.createLinearGradient(
          cx - Math.cos(rad) * r,
          cy - Math.sin(rad) * r,
          cx + Math.cos(rad) * r,
          cy + Math.sin(rad) * r
        );
        grad.addColorStop(0, bgColor1);
        grad.addColorStop(1, bgColor2);
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, dims.w, dims.h);
      } else if (bgType === 'image' && bgImageEl) {
        ctx.fillStyle = bgColor1;
        ctx.fillRect(0, 0, dims.w, dims.h);
        const iRatio = bgImageEl.width / Math.max(1, bgImageEl.height);
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
        ctx.drawImage(bgImageEl, dx, dy, dw, dh);
        if (bgImageOverlay > 0) {
          ctx.fillStyle = `rgba(0,0,0,${bgImageOverlay})`;
          ctx.fillRect(0, 0, dims.w, dims.h);
        }
      } else {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, dims.w, dims.h);
      }

      // 2. Layers
      for (const layer of layers) {
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
            layer.strokeWidth
          );
        } else if (layer.kind === 'image') {
          const hw = layer.width / 2;
          const hh = layer.height / 2;
          if (layer.filter === 'grayscale') ctx.filter = 'grayscale(100%)';
          else if (layer.filter === 'sepia') ctx.filter = 'sepia(85%)';
          else if (layer.filter === 'warm') ctx.filter = 'saturate(135%) contrast(105%)';
          else if (layer.filter === 'bright') ctx.filter = 'brightness(118%) contrast(105%)';
          if (layer.circular) {
            ctx.beginPath();
            ctx.ellipse(0, 0, hw, hh, 0, 0, Math.PI * 2);
            ctx.closePath();
            ctx.clip();
          }
          ctx.drawImage(layer.imageEl, -hw, -hh, layer.width, layer.height);
          ctx.filter = 'none';
        } else if (layer.kind === 'text') {
          ctx.font = `${layer.italic ? 'italic ' : ''}${layer.bold ? '700 ' : '400 '}${layer.fontSize}px ${layer.fontFamily}`;
          if ('letterSpacing' in ctx) {
            (ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = `${layer.letterSpacing || 0}px`;
          }
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
            ctx.roundRect(-maxLineW / 2 - 26, -totalH / 2 - 14, maxLineW + 52, totalH + 28, 18);
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

        // Selection box + touch-friendly corner resize & top rotate handles
        if (showSelectionBox && selectedLayerIds.includes(layer.id)) {
          const box = getLayerBoundingBox(ctx, layer);
          const hw = box.w / 2 + 12;
          const hh = box.h / 2 + 12;

          ctx.shadowColor = 'transparent';
          ctx.strokeStyle = layer.locked ? '#f59e0b' : '#2563eb';
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
            // Top rotate handle
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
      const allStrokes = activeStrokeRef.current ? [...strokes, activeStrokeRef.current] : strokes;
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

      // 4. Smart center snap alignment guides
      if (showSelectionBox && snapEnabled) {
        if (snapGuides.x) {
          ctx.save();
          ctx.strokeStyle = '#38bdf8';
          ctx.lineWidth = 2;
          ctx.setLineDash([8, 6]);
          ctx.beginPath();
          ctx.moveTo(dims.w / 2, 0);
          ctx.lineTo(dims.w / 2, dims.h);
          ctx.stroke();
          ctx.restore();
        }
        if (snapGuides.y) {
          ctx.save();
          ctx.strokeStyle = '#38bdf8';
          ctx.lineWidth = 2;
          ctx.setLineDash([8, 6]);
          ctx.beginPath();
          ctx.moveTo(0, dims.h / 2);
          ctx.lineTo(dims.w, dims.h / 2);
          ctx.stroke();
          ctx.restore();
        }
      }
    },
    [
      dims,
      bgType,
      bgColor1,
      bgColor2,
      bgAngle,
      bgImageEl,
      bgImageOverlay,
      layers,
      selectedLayerIds,
      primarySelectedId,
      strokes,
      snapEnabled,
      snapGuides,
      getLayerBoundingBox,
    ]
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

    // Check corner resize / top rotate handles of primary selected layer first
    if (selectedLayer && !selectedLayer.locked && ctx) {
      const box = getLayerBoundingBox(ctx, selectedLayer);
      const hw = box.w / 2 + 12;
      const hh = box.h / 2 + 12;
      const { lx, ly } = toLayerLocal(pt, selectedLayer);

      // Rotate handle hit test
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

      // Corner resize handle hit test
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

    // Hit-test layers from top to bottom (frames only hit on border rim so inner layers stay clickable)
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
        let nextSelIds = selectedLayerIds;
        if (e.shiftKey) {
          nextSelIds = selectedLayerIds.includes(l.id)
            ? selectedLayerIds.filter((id) => id !== l.id)
            : [...selectedLayerIds, l.id];
          setSelectedLayerIds(nextSelIds);
        } else if (!selectedLayerIds.includes(l.id)) {
          nextSelIds = [l.id];
          setSelectedLayerIds(nextSelIds);
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
    const pt = getCanvasPoint(e);

    if (isDrawMode && activeStrokeRef.current) {
      activeStrokeRef.current.points.push(pt);
      renderCanvas(true);
      return;
    }

    const inter = interactionRef.current;
    if (!inter) return;

    if (inter.mode === 'drag') {
      const dx = pt.x - inter.startX;
      const dy = pt.y - inter.startY;
      let snapX = false;
      let snapY = false;

      setLayers((prev) =>
        prev.map((l) => {
          if (!inter.layerIds.includes(l.id)) return l;
          const init = inter.initialPos[l.id];
          if (!init) return l;
          let nx = init.x + dx;
          let ny = init.y + dy;
          if (snapEnabled && inter.layerIds.length === 1) {
            if (Math.abs(nx - dims.w / 2) < 18) {
              nx = dims.w / 2;
              snapX = true;
            }
            if (Math.abs(ny - dims.h / 2) < 18) {
              ny = dims.h / 2;
              snapY = true;
            }
          }
          return { ...l, x: nx, y: ny };
        })
      );
      setSnapGuides({ x: snapX, y: snapY });
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
    setSnapGuides({ x: false, y: false });
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

  const applyTemplate = async (tpl: DesignTemplate, options?: { skipPersist?: boolean }) => {
    pushUndoSnapshot();
    setEditingCreationId(null);
    setDesignTitle(isEn ? tpl.nameEn : tpl.nameFr);
    setFormatRatio(tpl.format);
    setBgType(tpl.bgType);
    setBgColor1(tpl.bgColor1);
    setBgColor2(tpl.bgColor2);
    setBgAngle(tpl.bgAngle);
    setBgImageEl(null);
    setBgImageAssetKey(undefined);
    setStrokes([]);
    const hydrated = await hydrateLayers(
      tpl.layers.map((l, i) => ({ ...l, id: `${l.id}_${Date.now()}_${i}` }))
    );
    setLayers(hydrated);
    setSelectedLayerIds(hydrated.length > 0 ? [hydrated[hydrated.length - 1].id] : []);
    const isOnlineTpl =
      Boolean(tpl.source && tpl.source !== 'local') ||
      tpl.id.startsWith('live_') ||
      tpl.id.startsWith('proc_') ||
      tpl.id.startsWith('online_');
    if (isOnlineTpl && !options?.skipPersist) {
      try {
        await saveOnlineTemplateLocally({
          id: tpl.id,
          studioType: 'design',
          title: isEn ? tpl.nameEn : tpl.nameFr,
          category: tpl.category,
          templateObj: tpl,
          previewColor: tpl.bgColor1,
          previewColor2: tpl.bgColor2,
          source: tpl.source,
        });
        reloadData();
      } catch {
        // non-fatal
      }
    }
    setNotice(
      isEn
        ? `Template "${tpl.nameEn}" loaded${isOnlineTpl && !options?.skipPersist ? ' and kept in My Templates' : ''}.`
        : `Modèle « ${tpl.nameFr} » appliqué${isOnlineTpl && !options?.skipPersist ? ' et conservé dans Vos modèles' : ''}.`
    );
  };

  const handleApplySavedOnlineTemplate = async (savedItem: SavedStudioTemplate) => {
    try {
      const parsed = JSON.parse(savedItem.templateJson) as DesignTemplate;
      await applyTemplate(parsed, { skipPersist: true });
    } catch {
      setNotice(isEn ? 'Could not load saved template.' : 'Impossible d’ouvrir ce modèle enregistré.');
    }
  };

  const handleDeleteSavedOnlineTemplate = async (id: string) => {
    await deleteSavedOnlineTemplate(id);
    reloadData();
  };

  const addTextPreset = (preset: 'heading' | 'sub' | 'verse' | 'badge') => {
    pushUndoSnapshot();
    const id = `txt_${Date.now()}`;
    const isLightBg = bgType === 'solid' && bgColor1.toLowerCase() === '#ffffff';
    const next: TextLayer = {
      id,
      kind: 'text',
      text:
        preset === 'heading'
          ? 'GRAND TITRE'
          : preset === 'verse'
            ? '« Car Dieu a tant aimé le monde... »\nJean 3 : 16'
            : preset === 'badge'
              ? 'NOUVEAU MESSAGE'
              : 'Sous-titre ou détails ici',
      fontFamily: preset === 'verse' ? STUDIO_FONTS[2].value : STUDIO_FONTS[0].value,
      fontSize: preset === 'heading' ? 76 : preset === 'verse' ? 46 : 42,
      color: preset === 'badge' ? '#0b1f42' : isLightBg ? '#0f172a' : '#ffffff',
      bold: preset !== 'verse',
      italic: preset === 'verse',
      align: 'center',
      bgColor: '#fbbf24',
      bgEnabled: preset === 'badge',
      shadow: preset === 'heading',
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
  };

  const addShapeLayer = (shape: StudioVectorElementKind) => {
    pushUndoSnapshot();
    const id = `shp_${Date.now()}`;
    const next: ShapeLayer = {
      id,
      kind: 'shape',
      shape,
      width: shape === 'line' ? 420 : shape === 'frame' ? Math.round(dims.w * 0.85) : 230,
      height: shape === 'line' ? 14 : shape === 'frame' ? Math.round(dims.h * 0.85) : 230,
      fillColor: shape === 'cross' || shape === 'crown' || shape === 'star' ? '#fbbf24' : '#1d4ed8',
      strokeColor: '#ffffff',
      strokeWidth: shape === 'line' ? 10 : 0,
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
  };

  const handleAddImageFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const assetKey = `studio_asset_img_${Date.now()}`;
      await dbService.saveMediaBlob(assetKey, file, file.type || 'image/png');
      const img = await loadImageFromBlob(file);
      pushUndoSnapshot();
      const ratio = img.width / Math.max(1, img.height);
      const w = Math.min(460, Math.round(dims.w * 0.45));
      const h = Math.round(w / ratio);
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

  const handleAddBgImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const assetKey = `studio_asset_bg_${Date.now()}`;
      await dbService.saveMediaBlob(assetKey, file, file.type || 'image/png');
      const img = await loadImageFromBlob(file);
      pushUndoSnapshot();
      setBgImageEl(img);
      setBgImageAssetKey(assetKey);
      setBgType('image');
    } catch {
      setNotice('Impossible de charger l’image de fond.');
    }
    e.target.value = '';
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

  const moveSelectedLayer = (dir: -1 | 1) => {
    if (!primarySelectedId) return;
    moveLayerById(primarySelectedId, dir);
  };

  const moveLayerById = (layerId: string, dir: -1 | 1) => {
    const idx = layers.findIndex((l) => l.id === layerId);
    const target = idx + dir;
    if (idx < 0 || target < 0 || target >= layers.length) return;
    pushUndoSnapshot();
    setLayers((prev) => {
      const next = [...prev];
      const tmp = next[idx];
      next[idx] = next[target];
      next[target] = tmp;
      return next;
    });
  };

  const reorderLayersByDrop = (fromId: string, toId: string) => {
    if (fromId === toId) return;
    const fromIdx = layers.findIndex((l) => l.id === fromId);
    const toIdx = layers.findIndex((l) => l.id === toId);
    if (fromIdx < 0 || toIdx < 0) return;
    pushUndoSnapshot();
    setLayers((prev) => {
      const next = [...prev];
      const [moved] = next.splice(fromIdx, 1);
      next.splice(toIdx, 0, moved);
      return next;
    });
  };

  const nudgeSelectedLayers = (dx: number, dy: number) => {
    if (selectedLayerIds.length === 0) return;
    pushUndoSnapshot();
    setLayers((prev) =>
      prev.map((l) =>
        selectedLayerIds.includes(l.id) && !l.locked
          ? { ...l, x: Math.round(l.x + dx), y: Math.round(l.y + dy) }
          : l
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
          ? onlineTemplates.map((t) => (isEn ? t.nameEn : t.nameFr))
          : [];
        const resp = await fetch('/api/studios/templates/search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            studioType: 'design',
            query: q,
            category: cat === 'all' ? undefined : cat,
            lang: isEn ? 'en' : 'fr',
            page: targetPage,
            excludeTitles,
          }),
        });
        const data = await resp.json();
        if (resp.ok && data.ok && Array.isArray(data.templates)) {
          const incoming = data.templates as DesignTemplate[];
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
              ? `${nextTotal} online template(s) loaded${q ? ` for "${q}"` : ''}.`
              : `${nextTotal} modèle(s) en ligne affiché(s)${q ? ` pour « ${q} »` : ''}.`
          );
        } else {
          setOnlineStatusMsg(
            isEn ? 'Online search unavailable right now.' : 'Recherche en ligne momentanément indisponible.'
          );
        }
      } catch {
        setOnlineStatusMsg(
          isEn
            ? 'Offline mode: showing local & saved templates.'
            : 'Mode hors ligne : affichage des modèles locaux et conservés.'
        );
      } finally {
        setIsSearchingOnline(false);
        setIsLoadingMoreTemplates(false);
      }
    },
    [templateQuery, templateCategory, isEn, onlineTemplates]
  );

  const searchOnlineAssets = useCallback(
    async (
      assetType: 'elements' | 'images' | 'backgrounds',
      overrideQuery?: string,
      appendPage?: number
    ) => {
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
        const resp = await fetch('/api/studios/assets/search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            assetType,
            query: q,
            page: targetPage,
            lang: isEn ? 'en' : 'fr',
          }),
        });
        const data = await resp.json();
        const incoming: OnlineAssetItem[] =
          resp.ok && data?.ok && Array.isArray(data.assets) ? data.assets : [];
        const hasMore = Boolean(data?.hasMore);

        if (assetType === 'elements') {
          setOnlineElementPage(targetPage);
          setOnlineElementHasMore(hasMore);
          setOnlineElements((prev) => {
            if (!isAppend) return incoming;
            const seen = new Set(prev.map((a) => a.id));
            return [...prev, ...incoming.filter((a) => !seen.has(a.id))];
          });
        } else if (assetType === 'images') {
          setOnlineImagePage(targetPage);
          setOnlineImageHasMore(hasMore);
          setOnlineImages((prev) => {
            if (!isAppend) return incoming;
            const seen = new Set(prev.map((a) => a.id));
            return [...prev, ...incoming.filter((a) => !seen.has(a.id))];
          });
        } else {
          setOnlineBgPage(targetPage);
          setOnlineBgHasMore(hasMore);
          setOnlineBackgrounds((prev) => {
            if (!isAppend) return incoming;
            const seen = new Set(prev.map((a) => a.id));
            return [...prev, ...incoming.filter((a) => !seen.has(a.id))];
          });
        }
      } catch {
        setNotice(
          isEn
            ? 'Online resource search unavailable right now.'
            : 'Recherche de ressources en ligne momentanément indisponible.'
        );
      } finally {
        if (assetType === 'elements') setIsSearchingElements(false);
        else if (assetType === 'images') setIsSearchingImages(false);
        else setIsSearchingBgs(false);
      }
    },
    [onlineElementQuery, onlineImageQuery, onlineBgQuery, isEn]
  );

  const fetchOnlineAssetAsBlob = async (asset: OnlineAssetItem): Promise<Blob> => {
    if (asset.svgMarkup) {
      return new Blob([asset.svgMarkup], { type: 'image/svg+xml;charset=utf-8' });
    }
    if (asset.fullUrl.startsWith('data:')) {
      const resp = await fetch(asset.fullUrl);
      if (!resp.ok) throw new Error('Data asset fetch error');
      return await resp.blob();
    }
    const resp = await fetch(`/api/studios/assets/image-proxy?url=${encodeURIComponent(asset.fullUrl)}`);
    if (!resp.ok) throw new Error('Proxy image fetch failed');
    return await resp.blob();
  };

  const handleInsertOnlineAsset = async (
    asset: OnlineAssetItem,
    mode: 'layer' | 'background'
  ) => {
    setLoadingAssetId(asset.id);
    try {
      const blob = await fetchOnlineAssetAsBlob(asset);
      const assetKey = `studio_online_${asset.assetType}_${Date.now()}`;
      await dbService.saveMediaBlob(assetKey, blob, blob.type || 'image/png');
      const img = await loadImageFromBlob(blob);
      pushUndoSnapshot();

      if (mode === 'background') {
        setBgImageEl(img);
        setBgImageAssetKey(assetKey);
        setBgType('image');
        setNotice(
          isEn
            ? `Background "${asset.title}" applied.`
            : `Arrière-plan « ${asset.title} » appliqué.`
        );
      } else {
        const natW = img.naturalWidth || img.width || 300;
        const natH = img.naturalHeight || img.height || 300;
        const ratio = natW / Math.max(1, natH);
        const w =
          asset.assetType === 'elements'
            ? Math.min(280, Math.round(dims.w * 0.28))
            : Math.min(480, Math.round(dims.w * 0.46));
        const h = Math.max(60, Math.round(w / ratio));
        const id = `img_${Date.now()}`;
        const next: ImageLayer = {
          id,
          kind: 'image',
          imageEl: img,
          assetKey,
          label: asset.title || 'Ressource en ligne',
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
        setNotice(
          isEn ? `Added "${asset.title}" to canvas.` : `« ${asset.title} » ajouté sur le canevas.`
        );
      }
    } catch {
      setNotice(
        isEn
          ? 'Could not download this online resource safely.'
          : 'Impossible de télécharger cette ressource en ligne.'
      );
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

  const duplicateSelectedLayers = () => {
    if (selectedLayerIds.length === 0) return;
    pushUndoSnapshot();
    const newIds: string[] = [];
    const copies: StudioLayer[] = [];
    layers.forEach((l, idx) => {
      if (selectedLayerIds.includes(l.id)) {
        const nid = `${l.kind}_${Date.now()}_${idx}`;
        newIds.push(nid);
        copies.push({ ...l, id: nid, x: l.x + 40, y: l.y + 40, locked: false } as StudioLayer);
      }
    });
    setLayers((prev) => [...prev, ...copies]);
    setSelectedLayerIds(newIds);
  };

  const deleteSelectedLayers = () => {
    if (selectedLayerIds.length === 0) return;
    pushUndoSnapshot();
    setLayers((prev) => prev.filter((l) => !selectedLayerIds.includes(l.id)));
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
      renderCanvas(false);
      const canvas = canvasRef.current;
      if (canvas) outBlob = await exportCanvasToPdfBlob(canvas);
      renderCanvas(true);
    } else {
      outBlob = await exportCleanBlob(ext === 'png' ? 'image/png' : 'image/jpeg');
    }
    if (!outBlob) return;
    const fileName = `${designTitle.trim() || 'creation_shalom'}.${ext}`;
    const res = await downloadBlobToDevice(outBlob, fileName, outBlob.type);
    if (res.ok) {
      setNotice(
        isEn
          ? `Downloaded « ${res.fileName} » to ${res.locationLabel}.`
          : `« ${res.fileName} » enregistré dans ${res.locationLabel}.`
      );
    } else {
      setNotice(res.error || 'Échec du téléchargement.');
    }
  };

  const handleSaveProject = async () => {
    const blob = await exportCleanBlob('image/png');
    if (!blob) return;
    const snap = createCurrentSnapshot();
    const assetKeys: string[] = [];
    if (snap.bgImageAssetKey) assetKeys.push(snap.bgImageAssetKey);
    snap.layers.forEach((l) => {
      if (l.assetKey) assetKeys.push(l.assetKey);
    });

    const id = editingCreationId || `cr_${Date.now()}`;
    const existing = editingCreationId
      ? creations.find((c) => c.id === editingCreationId)
      : undefined;
    const blobKey = existing?.mediaBlobKey || `creation_blob_${Date.now()}`;
    await dbService.saveMediaBlob(blobKey, blob, 'image/png');

    const item: CreativeDesignItem = {
      id,
      title: designTitle.trim() || 'Création SHALOM',
      templateType: 'verset',
      studioType: 'design',
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
      isEn
        ? 'Editable project saved! You can reopen and edit it anytime.'
        : 'Projet modifiable enregistré ! Vous pourrez le rouvrir et le modifier à tout moment.'
    );
    await reloadData();
  };

  const handleReopenSavedProject = async (item: CreativeDesignItem) => {
    if (!item.projectJson) {
      setNotice('Ce visuel ancien est une image simple sans calques modifiables.');
      return;
    }
    try {
      const parsed = JSON.parse(item.projectJson) as ProjectSnapshot;
      pushUndoSnapshot();
      await applySnapshot(parsed);
      setEditingCreationId(item.id);
      setNotice(`Projet « ${item.title} » rouvert dans l’éditeur.`);
      window.scrollTo({ top: 0, behavior: 'smooth' });
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
    if (blobs.length > 0) {
      await dbService.deleteItems(STORES.MEDIA_BLOBS, blobs);
    }
    await dbService.deleteItems(STORES.CREATIONS, ids);
    setSelectedCreationIds((prev) => prev.filter((id) => !ids.includes(id)));
    if (editingCreationId && ids.includes(editingCreationId)) setEditingCreationId(null);
    setConfirmDeleteCreations(null);
    await reloadData();
  };

  const applyPaletteToWorkspace = (colors: string[]) => {
    pushUndoSnapshot();
    setBgType('gradient');
    setBgColor1(colors[0]);
    setBgColor2(colors[1]);
    if (selectedLayer) {
      if (selectedLayer.kind === 'text') updateSelectedLayer({ color: colors[2] });
      else if (selectedLayer.kind === 'shape') updateSelectedLayer({ fillColor: colors[2] });
    }
  };

  const toolTabs: Array<{ id: StudioToolTab; label: string; icon: React.ComponentType<{ className?: string }> }> = [
    { id: 'templates', label: isEn ? 'Templates' : 'Modèles', icon: LayoutTemplate },
    { id: 'elements', label: isEn ? 'Elements' : 'Éléments', icon: Shapes },
    { id: 'text', label: isEn ? 'Text' : 'Texte', icon: Type },
    { id: 'images', label: isEn ? 'Images' : 'Images', icon: ImageIcon },
    { id: 'draw', label: isEn ? 'Draw' : 'Dessin', icon: Pencil },
    { id: 'bg', label: isEn ? 'Background' : 'Fond', icon: Palette },
    { id: 'layers', label: `${isEn ? 'Layers' : 'Calques'} (${layers.length})`, icon: Layers },
  ];

  return (
    <div className="space-y-5">
      {/* Canva-Style Top Command Bar */}
      <div className="p-3.5 rounded-2xl bg-[#0b1f42] text-white border border-blue-900/70 shadow-md flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex flex-wrap items-center gap-2 flex-1 min-w-[220px]">
          <input
            type="text"
            value={designTitle}
            onChange={(e) => setDesignTitle(e.target.value)}
            aria-label="Nom du projet"
            className="px-3 py-1.5 rounded-xl bg-white/10 border border-white/20 text-white font-bold text-sm max-w-[220px] focus:outline-none focus:border-amber-400"
          />

          <div className="flex items-center gap-1 bg-white/10 rounded-xl p-1">
            <button
              type="button"
              onClick={handleUndo}
              disabled={historyPast.length === 0}
              className="p-1.5 rounded-lg hover:bg-white/15 disabled:opacity-35 transition"
              title="Annuler (Ctrl+Z)"
            >
              <Undo2 className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={handleRedo}
              disabled={historyFuture.length === 0}
              className="p-1.5 rounded-lg hover:bg-white/15 disabled:opacity-35 transition"
              title="Rétablir (Ctrl+Y)"
            >
              <Redo2 className="w-4 h-4" />
            </button>
          </div>

          <button
            type="button"
            onClick={() => setSnapEnabled((s) => !s)}
            className={`px-2.5 py-1.5 rounded-xl font-semibold flex items-center gap-1 transition ${
              snapEnabled ? 'bg-amber-500 text-slate-950' : 'bg-white/10 text-blue-100'
            }`}
            title="Magnétisme & guides d’alignement"
          >
            <Magnet className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Guides</span>
          </button>

          <div className="flex items-center gap-1 bg-white/10 rounded-xl p-1 tabular-nums">
            <button
              type="button"
              onClick={() => setWorkspaceZoom((z) => Math.max(50, z - 25))}
              className="p-1 rounded-lg hover:bg-white/15"
              title="Zoom arrière"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="px-1.5 font-bold">{workspaceZoom}%</span>
            <button
              type="button"
              onClick={() => setWorkspaceZoom((z) => Math.min(200, z + 25))}
              className="p-1 rounded-lg hover:bg-white/15"
              title="Zoom avant"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={handleOpenPreview}
            className="px-3 py-2 rounded-xl bg-white/15 hover:bg-white/25 font-bold flex items-center gap-1.5"
          >
            <Eye className="w-3.5 h-3.5" />
            <span>{isEn ? 'Preview' : 'Aperçu'}</span>
          </button>
          <button
            type="button"
            onClick={handleSaveProject}
            className="px-3 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold flex items-center gap-1.5"
          >
            <Save className="w-3.5 h-3.5" />
            <span>{isEn ? 'Save Project' : 'Enregistrer'}</span>
          </button>
          <button
            type="button"
            onClick={() => handleDownload('png')}
            className="px-2.5 py-2 rounded-xl bg-white/15 hover:bg-white/25 font-bold flex items-center gap-1"
            title="Exporter PNG"
          >
            <Download className="w-3.5 h-3.5" />
            <span>PNG</span>
          </button>
          <button
            type="button"
            onClick={() => handleDownload('jpg')}
            className="px-2.5 py-2 rounded-xl bg-white/15 hover:bg-white/25 font-bold"
            title="Exporter JPG"
          >
            JPG
          </button>
          <button
            type="button"
            onClick={() => handleDownload('pdf')}
            className="px-2.5 py-2 rounded-xl bg-white/15 hover:bg-white/25 font-bold flex items-center gap-1"
            title="Exporter PDF"
          >
            <FileText className="w-3.5 h-3.5" />
            <span>PDF</span>
          </button>
          <button
            type="button"
            onClick={handleShare}
            className="px-3 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold flex items-center gap-1.5"
          >
            <Share2 className="w-3.5 h-3.5" />
            <span>{isEn ? 'Share' : 'Partager'}</span>
          </button>
        </div>
      </div>

      {notice && (
        <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/50 text-xs font-semibold text-emerald-700 dark:text-emerald-300 flex items-center justify-between">
          <span className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{notice}</span>
          </span>
          <button type="button" onClick={() => setNotice(null)} className="underline ml-2">
            OK
          </button>
        </div>
      )}

      {/* Canva Workspace: Tool Rail + Tool Drawer + Interactive Canvas */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Left Side: Tool Tabs + Active Drawer */}
        <div className="lg:col-span-5 space-y-3 text-xs">
          {/* Canva-style Horizontal Scrollable Rail on mobile, Grid on desktop */}
          <div className="flex lg:grid lg:grid-cols-4 gap-1.5 overflow-x-auto pb-1 p-1.5 rounded-2xl bg-white dark:bg-[#0c1631] border border-slate-200/80 dark:border-slate-800/80">
            {toolTabs.map((tab) => {
              const Icon = tab.icon;
              const active = activeToolTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => {
                    setActiveToolTab(tab.id);
                    setIsDrawMode(tab.id === 'draw');
                  }}
                  className={`px-3 py-2 rounded-xl font-bold flex items-center justify-center gap-1.5 shrink-0 transition whitespace-nowrap ${
                    active
                      ? 'bg-[#0b1f42] text-white dark:bg-blue-700 shadow-xs'
                      : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5 shrink-0" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* Drawer Content */}
          <div className="p-4 rounded-2xl bg-white dark:bg-[#0c1631] border border-slate-200/80 dark:border-slate-800/80 space-y-4">
            {activeToolTab === 'templates' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="font-bold uppercase tracking-wider text-slate-500">
                    {isEn ? 'Search Templates Online' : 'Modèles locaux & en ligne'}
                  </h3>
                  <button
                    type="button"
                    onClick={() => applyTemplate(DESIGN_TEMPLATES[0])}
                    className="text-[11px] font-bold text-blue-700 dark:text-blue-400 flex items-center gap-1"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>Vierge</span>
                  </button>
                </div>

                {/* Live Online + Local Search Form */}
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleSearchOnlineTemplates();
                  }}
                  className="flex gap-1.5"
                >
                  <div className="relative flex-1">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={templateQuery}
                      onChange={(e) => setTemplateQuery(e.target.value)}
                      placeholder={
                        isEn
                          ? 'Search online (Baptism, Psalm 91, Youth...)'
                          : 'Rechercher en ligne (Mariage, Psaume 91...)'
                      }
                      className="w-full pl-8 pr-2.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-medium"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={isSearchingOnline}
                    className="px-3 py-2 rounded-xl bg-blue-700 hover:bg-blue-800 disabled:opacity-60 text-white font-bold flex items-center gap-1 shrink-0"
                  >
                    {isSearchingOnline ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Globe className="w-3.5 h-3.5" />
                    )}
                    <span>{isEn ? 'Search' : 'En ligne'}</span>
                  </button>
                </form>

                {/* Category Filter Bar */}
                <div className="flex items-center gap-1 overflow-x-auto pb-1">
                  {['all', 'Verset', 'Église', 'Prière', 'Témoignage', 'Vœux', 'Événement', 'Affiche', 'Fête'].map(
                    (cat) => (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => {
                          setTemplateCategory(cat);
                          handleSearchOnlineTemplates(templateQuery, cat);
                        }}
                        className={`px-2.5 py-1 rounded-lg font-semibold whitespace-nowrap text-[11px] transition ${
                          templateCategory === cat
                            ? 'bg-blue-700 text-white'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                        }`}
                      >
                        {cat === 'all' ? (isEn ? 'All' : 'Tous') : cat}
                      </button>
                    )
                  )}
                </div>

                {onlineStatusMsg && (
                  <p className="text-[11px] font-medium text-blue-700 dark:text-amber-400">
                    {onlineStatusMsg}
                  </p>
                )}

                {savedDesignTemplates.length > 0 && (
                  <div className="space-y-2 pb-2 border-b border-slate-100 dark:border-slate-800">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                        {isEn ? 'My Kept Online Templates' : 'Mes modèles conservés'} ({savedDesignTemplates.length})
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {savedDesignTemplates.map((st) => (
                        <div
                          key={st.id}
                          className="relative rounded-xl border border-emerald-200 dark:border-emerald-900/50 bg-emerald-50/40 dark:bg-emerald-950/20 p-2 space-y-1"
                        >
                          <button
                            type="button"
                            onClick={() => handleApplySavedOnlineTemplate(st)}
                            className="w-full text-left space-y-1"
                          >
                            <div
                              className="h-10 rounded-lg flex items-center justify-center text-[10px] font-bold text-white px-2"
                              style={{
                                background: st.previewColor2
                                  ? `linear-gradient(135deg, ${st.previewColor || '#0b1f42'}, ${st.previewColor2})`
                                  : st.previewColor || '#0b1f42',
                              }}
                            >
                              <span className="truncate">{st.category}</span>
                            </div>
                            <div className="font-bold text-slate-900 dark:text-white truncate text-[11px] pr-5">
                              {st.title}
                            </div>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteSavedOnlineTemplate(st.id)}
                            aria-label="Supprimer modèle conservé"
                            className="absolute bottom-1.5 right-1.5 p-1 rounded-md text-slate-400 hover:text-red-600"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {(() => {
                  const qNorm = templateQuery
                    .trim()
                    .toLowerCase()
                    .normalize('NFD')
                    .replace(/[\u0300-\u036f]/g, '');
                  const localFiltered = DESIGN_TEMPLATES.filter((t) => {
                    if (
                      templateCategory !== 'all' &&
                      t.category.toLowerCase() !== templateCategory.toLowerCase()
                    ) {
                      return false;
                    }
                    if (!qNorm) return true;
                    const hay = `${t.nameFr} ${t.nameEn} ${t.category}`
                      .toLowerCase()
                      .normalize('NFD')
                      .replace(/[\u0300-\u036f]/g, '');
                    return hay.includes(qNorm);
                  });

                  const combined: Array<DesignTemplate & { isOnline?: boolean }> = [
                    ...onlineTemplates.map((t) => ({ ...t, isOnline: true })),
                    ...localFiltered.map((t) => ({ ...t, isOnline: false })),
                  ];

                  return combined.length === 0 ? (
                    <p className="text-center text-slate-500 py-4 text-xs">
                      {isEn
                        ? 'No local match. Tap Search Online to generate matching templates.'
                        : 'Aucun modèle local correspondant. Cliquez sur « En ligne » pour rechercher sur le serveur.'}
                    </p>
                  ) : (
                    <div className="space-y-2.5">
                      <div className="grid grid-cols-2 gap-2.5 max-h-[360px] overflow-y-auto pr-1">
                        {combined.map((tpl) => (
                          <button
                            key={tpl.id}
                            type="button"
                            onClick={() => applyTemplate(tpl)}
                            className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-blue-600 text-left space-y-1.5 transition group"
                          >
                            <div
                              className="h-14 rounded-lg flex items-center justify-center font-bold text-[11px] shadow-inner border border-black/10 px-2 text-center"
                              style={{
                                background:
                                  tpl.bgType === 'gradient'
                                    ? `linear-gradient(${tpl.bgAngle}deg, ${tpl.bgColor1}, ${tpl.bgColor2})`
                                    : tpl.bgColor1,
                                color:
                                  tpl.bgColor1 === '#ffffff' ||
                                  tpl.bgColor1 === '#fffbeb' ||
                                  tpl.bgColor1 === '#fff7ed'
                                    ? '#0f172a'
                                    : '#ffffff',
                              }}
                            >
                              <span className="truncate">{tpl.category}</span>
                            </div>
                            <div className="font-bold text-slate-900 dark:text-white truncate text-xs">
                              {isEn ? tpl.nameEn : tpl.nameFr}
                            </div>
                            <div className="text-[10px] text-slate-500 flex items-center gap-1">
                              <span>{tpl.isOnline ? 'En ligne' : 'Local'}</span>
                              <span aria-hidden="true">·</span>
                              <span>{tpl.format}</span>
                            </div>
                          </button>
                        ))}
                      </div>

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
                  );
                })()}
              </div>
            )}

            {activeToolTab === 'elements' && (
              <div className="space-y-4">
                <div>
                  <h3 className="font-bold uppercase tracking-wider text-slate-500 mb-2">
                    {isEn ? 'Online Elements & Stickers' : 'Éléments & Icônes en ligne'}
                  </h3>
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      searchOnlineAssets('elements', onlineElementQuery, 1);
                    }}
                    className="flex gap-1.5 mb-2"
                  >
                    <div className="relative flex-1">
                      <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={onlineElementQuery}
                        onChange={(e) => setOnlineElementQuery(e.target.value)}
                        placeholder={isEn ? 'Search icons (dove, cross, fire...)' : 'Rechercher (colombe, croix, couronne...)'}
                        className="w-full pl-8 pr-2.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs"
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={isSearchingElements}
                      className="px-3 py-2 rounded-xl bg-blue-700 hover:bg-blue-800 text-white font-bold flex items-center gap-1"
                    >
                      {isSearchingElements ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Globe className="w-3.5 h-3.5" />}
                    </button>
                  </form>

                  {onlineElements.length > 0 && (
                    <div className="space-y-2 mb-3">
                      <div className="grid grid-cols-4 gap-2 max-h-48 overflow-y-auto pr-1">
                        {onlineElements.map((asset) => (
                          <button
                            key={asset.id}
                            type="button"
                            disabled={loadingAssetId === asset.id}
                            onClick={() => handleInsertOnlineAsset(asset, 'layer')}
                            title={asset.title}
                            className="p-2 rounded-xl bg-slate-50 hover:bg-blue-50 dark:bg-slate-900 dark:hover:bg-blue-950/40 border border-slate-200 dark:border-slate-800 flex flex-col items-center gap-1 transition"
                          >
                            {loadingAssetId === asset.id ? (
                              <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
                            ) : (
                              <img
                                src={asset.previewUrl}
                                alt={asset.title}
                                referrerPolicy="no-referrer"
                                className="w-7 h-7 object-contain"
                              />
                            )}
                            <span className="text-[9px] text-slate-600 dark:text-slate-300 truncate w-full text-center">
                              {asset.title}
                            </span>
                          </button>
                        ))}
                      </div>
                      {onlineElementHasMore && (
                        <button
                          type="button"
                          disabled={isSearchingElements}
                          onClick={() => searchOnlineAssets('elements', onlineElementQuery, onlineElementPage + 1)}
                          className="w-full py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-blue-700 dark:text-amber-400 font-bold text-[11px] flex items-center justify-center gap-1"
                        >
                          <Plus className="w-3 h-3" />
                          <span>{isEn ? 'Load more elements' : 'Charger plus d’éléments'}</span>
                        </button>
                      )}
                    </div>
                  )}
                </div>

                <div>
                  <h3 className="font-bold uppercase tracking-wider text-slate-500 mb-2">
                    {isEn ? 'Vector Icons & Shapes' : 'Icônes chrétiennes & Formes'}
                  </h3>
                  <div className="grid grid-cols-4 gap-2">
                    {VECTOR_ELEMENT_CATALOG.map((el) => (
                      <button
                        key={el.id}
                        type="button"
                        onClick={() => addShapeLayer(el.id)}
                        className="p-2.5 rounded-xl bg-slate-50 hover:bg-blue-50 dark:bg-slate-900 dark:hover:bg-blue-950/40 border border-slate-200 dark:border-slate-800 flex flex-col items-center gap-1 transition"
                      >
                        <span className="text-lg leading-none">{el.symbol}</span>
                        <span className="text-[10px] font-semibold text-slate-600 dark:text-slate-300 truncate w-full text-center">
                          {isEn ? el.labelEn : el.labelFr}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-2">
                  <h4 className="font-bold uppercase tracking-wider text-slate-500">
                    Palettes d’harmonie SHALOM
                  </h4>
                  <div className="space-y-1.5">
                    {SHALOM_COLOR_PALETTES.map((pal) => (
                      <button
                        key={pal.name}
                        type="button"
                        onClick={() => applyPaletteToWorkspace(pal.colors)}
                        className="w-full p-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-blue-500 flex items-center justify-between"
                      >
                        <span className="font-semibold text-slate-700 dark:text-slate-200">
                          {pal.name}
                        </span>
                        <div className="flex items-center gap-1">
                          {pal.colors.map((c) => (
                            <span
                              key={c}
                              style={{ backgroundColor: c }}
                              className="w-4 h-4 rounded-full border border-black/15"
                            />
                          ))}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {activeToolTab === 'text' && (
              <div className="space-y-3">
                <h3 className="font-bold uppercase tracking-wider text-slate-500">
                  Ajouter un style de texte
                </h3>
                <div className="grid grid-cols-1 gap-2">
                  <button
                    type="button"
                    onClick={() => addTextPreset('heading')}
                    className="p-3 rounded-xl bg-blue-700 hover:bg-blue-800 text-white font-extrabold text-base text-left"
                  >
                    + Ajouter un Grand Titre
                  </button>
                  <button
                    type="button"
                    onClick={() => addTextPreset('sub')}
                    className="p-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 font-bold text-sm text-left"
                  >
                    + Ajouter un Sous-titre
                  </button>
                  <button
                    type="button"
                    onClick={() => addTextPreset('verse')}
                    className="p-2.5 rounded-xl bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 italic font-serif text-sm text-left text-amber-900 dark:text-amber-200"
                  >
                    + Ajouter un Verset Biblique
                  </button>
                  <button
                    type="button"
                    onClick={() => addTextPreset('badge')}
                    className="p-2.5 rounded-xl bg-slate-900 text-amber-300 font-bold text-xs text-left"
                  >
                    + Ajouter un Bandeau / Étiquette
                  </button>
                </div>
              </div>
            )}

            {activeToolTab === 'images' && (
              <div className="space-y-3">
                <h3 className="font-bold uppercase tracking-wider text-slate-500">
                  {isEn ? 'Search Online Images & Import' : 'Photos en ligne & Import local'}
                </h3>

                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    searchOnlineAssets('images', onlineImageQuery, 1);
                  }}
                  className="flex gap-1.5"
                >
                  <div className="relative flex-1">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={onlineImageQuery}
                      onChange={(e) => setOnlineImageQuery(e.target.value)}
                      placeholder={isEn ? 'Search photos (church, sky, bible...)' : 'Rechercher photos (bible, ciel, fleur...)'}
                      className="w-full pl-8 pr-2.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={isSearchingImages}
                    className="px-3 py-2 rounded-xl bg-blue-700 hover:bg-blue-800 text-white font-bold flex items-center gap-1"
                  >
                    {isSearchingImages ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Globe className="w-3.5 h-3.5" />}
                  </button>
                </form>

                {onlineImages.length > 0 && (
                  <div className="space-y-2">
                    <div className="grid grid-cols-3 gap-2 max-h-52 overflow-y-auto pr-1">
                      {onlineImages.map((asset) => (
                        <button
                          key={asset.id}
                          type="button"
                          disabled={loadingAssetId === asset.id}
                          onClick={() => handleInsertOnlineAsset(asset, 'layer')}
                          title={asset.title}
                          className="relative rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 hover:border-blue-600 h-20 bg-slate-100 dark:bg-slate-900"
                        >
                          <img
                            src={asset.previewUrl}
                            alt={asset.title}
                            referrerPolicy="no-referrer"
                            className="w-full h-full object-cover"
                          />
                          {loadingAssetId === asset.id && (
                            <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                              <Loader2 className="w-4 h-4 animate-spin text-white" />
                            </div>
                          )}
                        </button>
                      ))}
                    </div>
                    {onlineImageHasMore && (
                      <button
                        type="button"
                        disabled={isSearchingImages}
                        onClick={() => searchOnlineAssets('images', onlineImageQuery, onlineImagePage + 1)}
                        className="w-full py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-blue-700 dark:text-amber-400 font-bold text-[11px] flex items-center justify-center gap-1"
                      >
                        <Plus className="w-3 h-3" />
                        <span>{isEn ? 'Load more images' : 'Charger plus d’images'}</span>
                      </button>
                    )}
                  </div>
                )}

                <label className="w-full py-3 px-4 rounded-xl bg-blue-700 hover:bg-blue-800 text-white font-bold flex items-center justify-center gap-2 cursor-pointer">
                  <ImageIcon className="w-4 h-4" />
                  <span>+ Ajouter une photo / logo depuis l’appareil</span>
                  <input type="file" accept="image/*" onChange={handleAddImageFile} className="hidden" />
                </label>

                <label className="w-full py-2.5 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 font-bold flex items-center justify-center gap-2 cursor-pointer">
                  <Palette className="w-4 h-4" />
                  <span>Utiliser comme photo d’arrière-plan</span>
                  <input type="file" accept="image/*" onChange={handleAddBgImage} className="hidden" />
                </label>
              </div>
            )}

            {activeToolTab === 'draw' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold uppercase tracking-wider text-slate-500">
                    Pinceau à main levée
                  </h3>
                  <button
                    type="button"
                    onClick={() => setIsDrawMode((d) => !d)}
                    className={`px-3 py-1 rounded-lg font-bold ${
                      isDrawMode ? 'bg-amber-500 text-slate-950' : 'bg-slate-100 dark:bg-slate-800'
                    }`}
                  >
                    {isDrawMode ? 'ACTIF' : 'Activer'}
                  </button>
                </div>
                <div className="flex flex-wrap items-center gap-4">
                  <label className="flex items-center gap-2 font-semibold">
                    <span>Couleur</span>
                    <input
                      type="color"
                      value={brushColor}
                      onChange={(e) => setBrushColor(e.target.value)}
                      className="w-8 h-7 rounded"
                    />
                  </label>
                  <label className="flex items-center gap-2 font-semibold flex-1">
                    <span>Taille ({brushSize}px)</span>
                    <input
                      type="range"
                      min={2}
                      max={48}
                      value={brushSize}
                      onChange={(e) => setBrushSize(parseInt(e.target.value, 10))}
                      className="flex-1"
                    />
                  </label>
                </div>
                {strokes.length > 0 && (
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        pushUndoSnapshot();
                        setStrokes((prev) => prev.slice(0, -1));
                      }}
                      className="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 font-semibold flex items-center gap-1"
                    >
                      <Eraser className="w-3.5 h-3.5" />
                      <span>Annuler dernier trait</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        pushUndoSnapshot();
                        setStrokes([]);
                      }}
                      className="px-3 py-1.5 rounded-lg bg-red-50 text-red-600 font-semibold"
                    >
                      Effacer traits
                    </button>
                  </div>
                )}
              </div>
            )}

            {activeToolTab === 'bg' && (
              <div className="space-y-3">
                <h3 className="font-bold uppercase tracking-wider text-slate-500">
                  Format & Arrière-plan
                </h3>
                <div>
                  <label className="block font-semibold mb-1">Dimensions du projet</label>
                  <select
                    value={formatRatio}
                    onChange={(e) => {
                      pushUndoSnapshot();
                      setFormatRatio(e.target.value as FormatRatio);
                    }}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 font-semibold"
                  >
                    {Object.entries(FORMAT_DIMS).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {[
                    { id: 'solid', label: 'Couleur unie' },
                    { id: 'gradient', label: 'Dégradé' },
                    { id: 'image', label: 'Photo' },
                  ].map((b) => (
                    <button
                      key={b.id}
                      type="button"
                      onClick={() => setBgType(b.id as typeof bgType)}
                      className={`px-3 py-1.5 rounded-lg font-semibold ${
                        bgType === b.id ? 'bg-blue-700 text-white' : 'bg-slate-100 dark:bg-slate-800'
                      }`}
                    >
                      {b.label}
                    </button>
                  ))}
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <label className="flex items-center gap-1.5 font-semibold">
                    <span>Couleur 1</span>
                    <input
                      type="color"
                      value={bgColor1}
                      onChange={(e) => setBgColor1(e.target.value)}
                      className="w-8 h-7 rounded cursor-pointer"
                    />
                  </label>
                  {bgType === 'gradient' && (
                    <>
                      <label className="flex items-center gap-1.5 font-semibold">
                        <span>Couleur 2</span>
                        <input
                          type="color"
                          value={bgColor2}
                          onChange={(e) => setBgColor2(e.target.value)}
                          className="w-8 h-7 rounded cursor-pointer"
                        />
                      </label>
                      <label className="flex items-center gap-1.5 font-semibold">
                        <span>Angle {bgAngle}°</span>
                        <input
                          type="range"
                          min={0}
                          max={360}
                          value={bgAngle}
                          onChange={(e) => setBgAngle(parseInt(e.target.value, 10))}
                          className="w-20"
                        />
                      </label>
                    </>
                  )}
                  {bgType === 'image' && (
                    <div className="flex flex-wrap items-center gap-2 w-full">
                      <label className="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 cursor-pointer font-semibold">
                        <span>Choisir photo</span>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleAddBgImage}
                          className="hidden"
                        />
                      </label>
                      <span className="text-[11px]">Assombrir</span>
                      <input
                        type="range"
                        min={0}
                        max={0.85}
                        step={0.05}
                        value={bgImageOverlay}
                        onChange={(e) => setBgImageOverlay(parseFloat(e.target.value))}
                        className="w-24"
                      />
                    </div>
                  )}
                </div>

                <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-2">
                  <h4 className="font-bold uppercase tracking-wider text-slate-500 text-[11px]">
                    {isEn ? 'Online Backgrounds' : 'Fonds en ligne (illimité)'}
                  </h4>
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      searchOnlineAssets('backgrounds', onlineBgQuery, 1);
                    }}
                    className="flex gap-1.5"
                  >
                    <div className="relative flex-1">
                      <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={onlineBgQuery}
                        onChange={(e) => setOnlineBgQuery(e.target.value)}
                        placeholder={isEn ? 'Search backgrounds (marble, sky, gold...)' : 'Rechercher un fond (marbre, ciel, or...)'}
                        className="w-full pl-8 pr-2.5 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs"
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={isSearchingBgs}
                      className="px-3 py-1.5 rounded-xl bg-blue-700 hover:bg-blue-800 text-white font-bold flex items-center gap-1"
                    >
                      {isSearchingBgs ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Globe className="w-3.5 h-3.5" />}
                    </button>
                  </form>

                  {onlineBackgrounds.length > 0 && (
                    <div className="space-y-2">
                      <div className="grid grid-cols-3 gap-2 max-h-44 overflow-y-auto pr-1">
                        {onlineBackgrounds.map((asset) => (
                          <button
                            key={asset.id}
                            type="button"
                            disabled={loadingAssetId === asset.id}
                            onClick={() => handleInsertOnlineAsset(asset, 'background')}
                            title={asset.title}
                            className="relative rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 hover:border-blue-600 h-16 bg-slate-100 dark:bg-slate-900"
                          >
                            <img
                              src={asset.previewUrl}
                              alt={asset.title}
                              referrerPolicy="no-referrer"
                              className="w-full h-full object-cover"
                            />
                            {loadingAssetId === asset.id && (
                              <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                                <Loader2 className="w-4 h-4 animate-spin text-white" />
                              </div>
                            )}
                          </button>
                        ))}
                      </div>
                      {onlineBgHasMore && (
                        <button
                          type="button"
                          disabled={isSearchingBgs}
                          onClick={() => searchOnlineAssets('backgrounds', onlineBgQuery, onlineBgPage + 1)}
                          className="w-full py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-blue-700 dark:text-amber-400 font-bold text-[11px] flex items-center justify-center gap-1"
                        >
                          <Plus className="w-3 h-3" />
                          <span>{isEn ? 'Load more backgrounds' : 'Charger plus de fonds'}</span>
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeToolTab === 'layers' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-bold uppercase tracking-wider text-slate-500">
                      {isEn ? 'Layer Order & Selection' : 'Déplacer & Gérer les Calques'}
                    </h3>
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      {isEn
                        ? 'Drag a row or tap ↑ ↓ to move layers above or below.'
                        : 'Glissez une ligne ou cliquez sur ↑ ↓ pour déplacer l’ordre des calques.'}
                    </p>
                  </div>
                  {selectedLayerIds.length > 0 && (
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={duplicateSelectedLayers}
                        className="px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 font-semibold"
                        title="Dupliquer sélection"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={deleteSelectedLayers}
                        className="px-2 py-1 rounded-lg bg-red-600 text-white font-semibold"
                        title="Supprimer sélection"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>

                {layers.length === 0 ? (
                  <p className="text-slate-400 text-center py-4">
                    Aucun calque. Ajoutez un modèle, texte, élément ou photo.
                  </p>
                ) : (
                  <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
                    {[...layers].reverse().map((l, revIdx) => {
                      const realIdx = layers.length - 1 - revIdx;
                      const isSel = selectedLayerIds.includes(l.id);
                      const label =
                        l.kind === 'text'
                          ? l.text.split('\n')[0] || 'Texte'
                          : l.kind === 'shape'
                            ? `Forme · ${l.shape}`
                            : l.label;
                      return (
                        <div
                          key={l.id}
                          draggable
                          onDragStart={() => setDraggingLayerId(l.id)}
                          onDragOver={(e) => {
                            e.preventDefault();
                            if (draggingLayerId && draggingLayerId !== l.id) {
                              setDragOverLayerId(l.id);
                            }
                          }}
                          onDragLeave={() => {
                            if (dragOverLayerId === l.id) setDragOverLayerId(null);
                          }}
                          onDrop={(e) => {
                            e.preventDefault();
                            if (draggingLayerId) {
                              reorderLayersByDrop(draggingLayerId, l.id);
                            }
                            setDraggingLayerId(null);
                            setDragOverLayerId(null);
                          }}
                          onDragEnd={() => {
                            setDraggingLayerId(null);
                            setDragOverLayerId(null);
                          }}
                          className={`p-2 rounded-xl border flex items-center justify-between gap-1.5 transition ${
                            dragOverLayerId === l.id
                              ? 'border-amber-500 ring-2 ring-amber-400/30'
                              : isSel
                                ? 'border-blue-600 bg-blue-50/70 dark:bg-blue-950/30'
                                : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900'
                          }`}
                        >
                          <span
                            className="p-1 text-slate-400 cursor-grab active:cursor-grabbing shrink-0"
                            title="Glisser pour déplacer l’ordre"
                          >
                            <GripVertical className="w-3.5 h-3.5" />
                          </span>

                          <button
                            type="button"
                            onClick={() =>
                              setSelectedLayerIds((prev) =>
                                prev.includes(l.id)
                                  ? prev.filter((id) => id !== l.id)
                                  : [...prev, l.id]
                              )
                            }
                            className="flex items-center gap-1.5 min-w-0 flex-1 text-left"
                          >
                            {isSel ? (
                              <CheckSquare className="w-4 h-4 text-blue-600 shrink-0" />
                            ) : (
                              <Square className="w-4 h-4 text-slate-400 shrink-0" />
                            )}
                            <span className="font-semibold truncate">{label}</span>
                          </button>

                          <div className="flex items-center gap-0.5 shrink-0">
                            <button
                              type="button"
                              onClick={() => moveLayerById(l.id, 1)}
                              disabled={realIdx === layers.length - 1}
                              className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-800 disabled:opacity-30"
                              title="Monter au premier plan"
                            >
                              <ArrowUp className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => moveLayerById(l.id, -1)}
                              disabled={realIdx === 0}
                              className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-800 disabled:opacity-30"
                              title="Descendre à l’arrière-plan"
                            >
                              <ArrowDown className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                setLayers((prev) =>
                                  prev.map((x) =>
                                    x.id === l.id ? { ...x, visible: x.visible === false } : x
                                  )
                                )
                              }
                              className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-800"
                              title="Afficher / Masquer"
                            >
                              {l.visible === false ? (
                                <EyeOff className="w-3.5 h-3.5 text-slate-400" />
                              ) : (
                                <Eye className="w-3.5 h-3.5 text-slate-600 dark:text-slate-300" />
                              )}
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                setLayers((prev) =>
                                  prev.map((x) => (x.id === l.id ? { ...x, locked: !x.locked } : x))
                                )
                              }
                              className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-800"
                              title="Verrouiller / Déverrouiller"
                            >
                              {l.locked ? (
                                <Lock className="w-3.5 h-3.5 text-amber-500" />
                              ) : (
                                <Unlock className="w-3.5 h-3.5 text-slate-400" />
                              )}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Selected Element Detailed Inspector */}
          {selectedLayer && (
            <div className="p-4 rounded-2xl bg-white dark:bg-[#0c1631] border-2 border-blue-500/70 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-bold uppercase tracking-wider text-blue-700 dark:text-blue-400">
                  {selectedLayer.kind === 'text'
                    ? 'Propriétés du Texte'
                    : selectedLayer.kind === 'shape'
                      ? 'Propriétés de l’Élément'
                      : 'Propriétés de l’Image'}
                </span>

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => alignSelectedLayers('left')}
                    className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800"
                    title="Aligner à gauche"
                  >
                    <AlignHorizontalJustifyStart className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => alignSelectedLayers('centerH')}
                    className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800"
                    title="Centrer horizontalement"
                  >
                    <AlignHorizontalJustifyCenter className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => alignSelectedLayers('centerV')}
                    className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800"
                    title="Centrer verticalement"
                  >
                    <AlignVerticalJustifyCenter className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => alignSelectedLayers('right')}
                    className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800"
                    title="Aligner à droite"
                  >
                    <AlignHorizontalJustifyEnd className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => moveSelectedLayer(-1)}
                    className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800"
                    title="Reculer calque"
                  >
                    <ArrowDown className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => moveSelectedLayer(1)}
                    className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800"
                    title="Avancer calque"
                  >
                    <ArrowUp className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={duplicateSelectedLayers}
                    className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800"
                    title="Dupliquer"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={deleteSelectedLayers}
                    className="p-1.5 rounded-lg text-red-600 hover:bg-red-50"
                    title="Supprimer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {selectedLayer.kind === 'text' && (
                <div className="space-y-3">
                  <textarea
                    rows={3}
                    value={selectedLayer.text}
                    onChange={(e) => updateSelectedLayer({ text: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 font-semibold"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <select
                      value={selectedLayer.fontFamily}
                      onChange={(e) => updateSelectedLayer({ fontFamily: e.target.value })}
                      className="px-2.5 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 font-semibold"
                    >
                      {STUDIO_FONTS.map((f) => (
                        <option key={f.label} value={f.value}>
                          {f.label}
                        </option>
                      ))}
                    </select>
                    <div className="flex items-center gap-2">
                      <span>Taille</span>
                      <input
                        type="number"
                        min={14}
                        max={280}
                        value={selectedLayer.fontSize}
                        onChange={(e) =>
                          updateSelectedLayer({ fontSize: parseInt(e.target.value, 10) || 40 })
                        }
                        className="w-full px-2 py-1 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 tabular-nums"
                      />
                    </div>
                  </div>

                  {/* Rich Text Style Controls: Bold, Italic, Underline, Strikethrough, Uppercase, Alignment */}
                  <div className="flex flex-wrap items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => updateSelectedLayer({ bold: !selectedLayer.bold })}
                      aria-pressed={selectedLayer.bold}
                      title="Gras"
                      className={`px-2.5 py-1.5 rounded-lg font-extrabold border transition ${
                        selectedLayer.bold
                          ? 'bg-blue-700 text-white border-blue-700'
                          : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700'
                      }`}
                    >
                      G · Gras
                    </button>
                    <button
                      type="button"
                      onClick={() => updateSelectedLayer({ italic: !selectedLayer.italic })}
                      aria-pressed={selectedLayer.italic}
                      title="Italique"
                      className={`px-2.5 py-1.5 rounded-lg italic font-serif border transition ${
                        selectedLayer.italic
                          ? 'bg-blue-700 text-white border-blue-700'
                          : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700'
                      }`}
                    >
                      I · Italique
                    </button>
                    <button
                      type="button"
                      onClick={() => updateSelectedLayer({ underline: !selectedLayer.underline })}
                      aria-pressed={!!selectedLayer.underline}
                      title="Souligné"
                      className={`px-2.5 py-1.5 rounded-lg underline border transition ${
                        selectedLayer.underline
                          ? 'bg-blue-700 text-white border-blue-700'
                          : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700'
                      }`}
                    >
                      S · Souligné
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        updateSelectedLayer({ strikethrough: !selectedLayer.strikethrough })
                      }
                      aria-pressed={!!selectedLayer.strikethrough}
                      title="Barré"
                      className={`px-2.5 py-1.5 rounded-lg line-through border transition ${
                        selectedLayer.strikethrough
                          ? 'bg-blue-700 text-white border-blue-700'
                          : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700'
                      }`}
                    >
                      Barré
                    </button>
                    <button
                      type="button"
                      onClick={() => updateSelectedLayer({ uppercase: !selectedLayer.uppercase })}
                      aria-pressed={!!selectedLayer.uppercase}
                      title="Majuscules"
                      className={`px-2 py-1.5 rounded-lg font-bold border transition ${
                        selectedLayer.uppercase
                          ? 'bg-blue-700 text-white border-blue-700'
                          : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700'
                      }`}
                    >
                      AA
                    </button>

                    <div className="flex items-center gap-0.5 ml-auto bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg">
                      <button
                        type="button"
                        onClick={() => updateSelectedLayer({ align: 'left' })}
                        className={`p-1.5 rounded ${
                          selectedLayer.align === 'left' ? 'bg-blue-700 text-white' : ''
                        }`}
                        title="Aligner texte à gauche"
                      >
                        <AlignLeft className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => updateSelectedLayer({ align: 'center' })}
                        className={`p-1.5 rounded ${
                          selectedLayer.align === 'center' ? 'bg-blue-700 text-white' : ''
                        }`}
                        title="Centrer texte"
                      >
                        <AlignCenter className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => updateSelectedLayer({ align: 'right' })}
                        className={`p-1.5 rounded ${
                          selectedLayer.align === 'right' ? 'bg-blue-700 text-white' : ''
                        }`}
                        title="Aligner texte à droite"
                      >
                        <AlignRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2.5">
                    <label className="flex items-center gap-1 font-semibold">
                      <span>Couleur</span>
                      <input
                        type="color"
                        value={selectedLayer.color}
                        onChange={(e) => updateSelectedLayer({ color: e.target.value })}
                        className="w-8 h-7 rounded cursor-pointer"
                        title="Couleur texte"
                      />
                    </label>
                    <label className="flex items-center gap-1 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedLayer.shadow}
                        onChange={(e) => updateSelectedLayer({ shadow: e.target.checked })}
                      />
                      <span>Ombre</span>
                    </label>
                    <label className="flex items-center gap-1 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedLayer.bgEnabled}
                        onChange={(e) => updateSelectedLayer({ bgEnabled: e.target.checked })}
                      />
                      <span>Cartouche</span>
                    </label>
                    {selectedLayer.bgEnabled && (
                      <input
                        type="color"
                        value={selectedLayer.bgColor}
                        onChange={(e) => updateSelectedLayer({ bgColor: e.target.value })}
                        className="w-7 h-7 rounded"
                      />
                    )}
                    <label className="flex items-center gap-1 font-semibold">
                      <span>Contour</span>
                      <input
                        type="color"
                        value={selectedLayer.strokeColor || '#000000'}
                        onChange={(e) => updateSelectedLayer({ strokeColor: e.target.value })}
                        className="w-7 h-7 rounded cursor-pointer"
                      />
                      <input
                        type="number"
                        min={0}
                        max={14}
                        value={selectedLayer.strokeWidth || 0}
                        onChange={(e) =>
                          updateSelectedLayer({
                            strokeWidth: Math.max(0, Math.min(14, parseInt(e.target.value, 10) || 0)),
                          })
                        }
                        className="w-12 px-1.5 py-0.5 rounded bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 tabular-nums"
                        title="Épaisseur du contour"
                      />
                    </label>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <span className="block mb-1">
                        Interligne ({(selectedLayer.lineHeight || 1.28).toFixed(2)})
                      </span>
                      <input
                        type="range"
                        min={0.9}
                        max={2}
                        step={0.05}
                        value={selectedLayer.lineHeight || 1.28}
                        onChange={(e) =>
                          updateSelectedLayer({ lineHeight: parseFloat(e.target.value) })
                        }
                        className="w-full"
                      />
                    </div>
                    <div>
                      <span className="block mb-1">
                        Espacement lettres ({selectedLayer.letterSpacing || 0}px)
                      </span>
                      <input
                        type="range"
                        min={-2}
                        max={16}
                        step={1}
                        value={selectedLayer.letterSpacing || 0}
                        onChange={(e) =>
                          updateSelectedLayer({ letterSpacing: parseInt(e.target.value, 10) })
                        }
                        className="w-full"
                      />
                    </div>
                  </div>
                </div>
              )}

              {selectedLayer.kind === 'shape' && (
                <div className="grid grid-cols-2 gap-3">
                  <label className="flex items-center justify-between font-semibold">
                    <span>Remplissage</span>
                    <input
                      type="color"
                      value={
                        selectedLayer.fillColor === 'transparent'
                          ? '#ffffff'
                          : selectedLayer.fillColor
                      }
                      onChange={(e) => updateSelectedLayer({ fillColor: e.target.value })}
                      className="w-9 h-7 rounded cursor-pointer"
                    />
                  </label>
                  <label className="flex items-center justify-between font-semibold">
                    <span>Bordure</span>
                    <input
                      type="color"
                      value={selectedLayer.strokeColor}
                      onChange={(e) => updateSelectedLayer({ strokeColor: e.target.value })}
                      className="w-9 h-7 rounded cursor-pointer"
                    />
                  </label>
                  <div>
                    <span className="block mb-1">Largeur ({selectedLayer.width})</span>
                    <input
                      type="range"
                      min={20}
                      max={1100}
                      value={selectedLayer.width}
                      onChange={(e) =>
                        updateSelectedLayer({ width: parseInt(e.target.value, 10) })
                      }
                      className="w-full"
                    />
                  </div>
                  <div>
                    <span className="block mb-1">Hauteur ({selectedLayer.height})</span>
                    <input
                      type="range"
                      min={10}
                      max={1600}
                      value={selectedLayer.height}
                      onChange={(e) =>
                        updateSelectedLayer({ height: parseInt(e.target.value, 10) })
                      }
                      className="w-full"
                    />
                  </div>
                  <div className="col-span-2">
                    <span className="block mb-1">
                      Épaisseur bordure ({selectedLayer.strokeWidth}px)
                    </span>
                    <input
                      type="range"
                      min={0}
                      max={40}
                      value={selectedLayer.strokeWidth}
                      onChange={(e) =>
                        updateSelectedLayer({ strokeWidth: parseInt(e.target.value, 10) })
                      }
                      className="w-full"
                    />
                  </div>
                </div>
              )}

              {selectedLayer.kind === 'image' && (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <span className="block mb-1">Largeur</span>
                      <input
                        type="range"
                        min={40}
                        max={1200}
                        value={selectedLayer.width}
                        onChange={(e) =>
                          updateSelectedLayer({ width: parseInt(e.target.value, 10) })
                        }
                        className="w-full"
                      />
                    </div>
                    <div>
                      <span className="block mb-1">Hauteur</span>
                      <input
                        type="range"
                        min={40}
                        max={1200}
                        value={selectedLayer.height}
                        onChange={(e) =>
                          updateSelectedLayer({ height: parseInt(e.target.value, 10) })
                        }
                        className="w-full"
                      />
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <label className="flex items-center gap-2 cursor-pointer font-semibold">
                      <input
                        type="checkbox"
                        checked={selectedLayer.circular}
                        onChange={(e) => updateSelectedLayer({ circular: e.target.checked })}
                      />
                      <span>Découpe cercle</span>
                    </label>
                    <select
                      value={selectedLayer.filter || 'none'}
                      onChange={(e) =>
                        updateSelectedLayer({
                          filter: e.target.value as ImageLayer['filter'],
                        })
                      }
                      className="px-2.5 py-1 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 font-semibold"
                    >
                      <option value="none">Filtre : Original</option>
                      <option value="warm">Chaleureux</option>
                      <option value="bright">Lumineux</option>
                      <option value="sepia">Sépia doux</option>
                      <option value="grayscale">Noir & Blanc</option>
                    </select>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
                <div>
                  <span className="block mb-1">Rotation ({selectedLayer.rotation}°)</span>
                  <input
                    type="range"
                    min={-180}
                    max={180}
                    value={selectedLayer.rotation}
                    onChange={(e) =>
                      updateSelectedLayer({ rotation: parseInt(e.target.value, 10) })
                    }
                    className="w-full"
                  />
                </div>
                <div>
                  <span className="block mb-1">
                    Opacité ({Math.round(selectedLayer.opacity * 100)}%)
                  </span>
                  <input
                    type="range"
                    min={0.1}
                    max={1}
                    step={0.05}
                    value={selectedLayer.opacity}
                    onChange={(e) =>
                      updateSelectedLayer({ opacity: parseFloat(e.target.value) })
                    }
                    className="w-full"
                  />
                </div>
              </div>

              {/* Precision Layer Move / Nudge Controls */}
              <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2">
                <span className="font-semibold text-slate-600 dark:text-slate-300">
                  Déplacer position
                </span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => nudgeSelectedLayers(-20, 0)}
                    className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-blue-100"
                    title="Déplacer à gauche (-20px)"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => nudgeSelectedLayers(0, -20)}
                    className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-blue-100"
                    title="Déplacer vers le haut (-20px)"
                  >
                    <ArrowUp className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => nudgeSelectedLayers(0, 20)}
                    className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-blue-100"
                    title="Déplacer vers le bas (+20px)"
                  >
                    <ArrowDown className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => nudgeSelectedLayers(20, 0)}
                    className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-blue-100"
                    title="Déplacer à droite (+20px)"
                  >
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="flex items-center gap-1.5 tabular-nums">
                  <label className="flex items-center gap-1">
                    <span>X</span>
                    <input
                      type="number"
                      value={Math.round(selectedLayer.x)}
                      onChange={(e) =>
                        updateSelectedLayer({ x: parseInt(e.target.value, 10) || 0 })
                      }
                      className="w-16 px-1.5 py-0.5 rounded bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800"
                    />
                  </label>
                  <label className="flex items-center gap-1">
                    <span>Y</span>
                    <input
                      type="number"
                      value={Math.round(selectedLayer.y)}
                      onChange={(e) =>
                        updateSelectedLayer({ y: parseInt(e.target.value, 10) || 0 })
                      }
                      className="w-16 px-1.5 py-0.5 rounded bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800"
                    />
                  </label>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right Side: Interactive Zoomable Workspace Canvas */}
        <div className="lg:col-span-7 space-y-3 lg:sticky lg:top-4">
          <div className="p-4 sm:p-6 rounded-2xl bg-slate-200/80 dark:bg-slate-900/90 border border-slate-300/70 dark:border-slate-800 overflow-auto max-h-[640px] flex items-center justify-center">
            <div
              style={{
                transform: `scale(${workspaceZoom / 100})`,
                transformOrigin: 'center center',
              }}
              className="transition-transform duration-150"
            >
              <canvas
                ref={canvasRef}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerCancel={handlePointerUp}
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
                className="max-w-full max-h-[540px] w-auto h-auto rounded-lg shadow-2xl touch-none cursor-grab active:cursor-grabbing bg-white"
              />
            </div>
          </div>

          <p className="text-[11px] text-slate-500 text-center">
            Astuce : Touchez et glissez un élément pour le déplacer, utilisez les poignées blanches pour redimensionner ou le point doré pour pivoter.
          </p>
        </div>
      </div>

      {/* Saved Editable Projects Gallery */}
      {designCreations.length > 0 && (
        <div className="space-y-3 pt-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              {isEn ? 'My Saved Visual Projects' : 'Mes projets visuels enregistrés'}
            </h3>

            <div className="flex items-center gap-2 text-xs">
              <button
                type="button"
                onClick={() => {
                  const allIds = designCreations.map((c) => c.id);
                  const allSel =
                    allIds.length > 0 && allIds.every((id) => selectedCreationIds.includes(id));
                  setSelectedCreationIds(allSel ? [] : allIds);
                }}
                className="font-semibold text-slate-600 dark:text-slate-300 flex items-center gap-1.5 hover:text-blue-700"
              >
                {designCreations.every((c) => selectedCreationIds.includes(c.id)) ? (
                  <CheckSquare className="w-4 h-4 text-blue-600" />
                ) : (
                  <Square className="w-4 h-4 text-slate-400" />
                )}
                <span>Tout sélectionner ({selectedCreationIds.length})</span>
              </button>

              {selectedCreationIds.length > 0 && (
                <button
                  type="button"
                  onClick={() =>
                    setConfirmDeleteCreations(
                      designCreations.filter((c) => selectedCreationIds.includes(c.id))
                    )
                  }
                  className="px-3 py-1 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold flex items-center gap-1"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Supprimer ({selectedCreationIds.length})</span>
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3.5">
            {designCreations.map((item) => {
              const isSel = selectedCreationIds.includes(item.id);
              return (
                <div
                  key={item.id}
                  className={`p-2.5 rounded-2xl bg-white dark:bg-[#0c1631] border space-y-2 transition ${
                    isSel
                      ? 'border-blue-600 ring-2 ring-blue-600/20'
                      : 'border-slate-200/80 dark:border-slate-800/80'
                  }`}
                >
                  <div className="relative">
                    {savedPreviews[item.id] && (
                      <img
                        src={savedPreviews[item.id]}
                        alt={item.title}
                        className="w-full h-36 object-cover rounded-xl bg-slate-100 dark:bg-slate-900"
                      />
                    )}
                    <button
                      type="button"
                      onClick={() =>
                        setSelectedCreationIds((prev) =>
                          prev.includes(item.id)
                            ? prev.filter((x) => x !== item.id)
                            : [...prev, item.id]
                        )
                      }
                      aria-label="Sélectionner cette création"
                      className="absolute top-2 left-2 p-1 rounded-lg bg-white/90 dark:bg-slate-900/90 shadow-xs"
                    >
                      {isSel ? (
                        <CheckSquare className="w-4 h-4 text-blue-600" />
                      ) : (
                        <Square className="w-4 h-4 text-slate-500" />
                      )}
                    </button>
                  </div>
                  <div className="text-xs font-bold truncate text-slate-900 dark:text-white">
                    {item.title}
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-1">
                    {item.projectJson && (
                      <button
                        type="button"
                        onClick={() => handleReopenSavedProject(item)}
                        className="px-2 py-1 rounded-lg bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300 text-[11px] font-bold flex items-center gap-1"
                      >
                        <FolderOpen className="w-3 h-3" />
                        <span>Modifier</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleShareSavedItem(item)}
                      className="px-2 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 text-[11px] font-bold flex items-center gap-1"
                    >
                      <Share2 className="w-3 h-3" />
                      <span>Partager</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteCreations([item])}
                      className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* High-Res Preview Modal */}
      <Modal
        isOpen={!!previewDataUrl}
        onClose={() => setPreviewDataUrl(null)}
        title={`Aperçu · ${designTitle}`}
        subtitle={`${dims.w} × ${dims.h} px`}
        maxWidth="xl"
      >
        {previewDataUrl && (
          <div className="space-y-4 text-xs">
            <div className="p-4 rounded-2xl bg-slate-950 flex items-center justify-center">
              <img
                src={previewDataUrl}
                alt={designTitle}
                className="max-h-[65vh] rounded-xl object-contain"
              />
            </div>
            <div className="flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={() => handleDownload('png')}
                className="px-4 py-2 rounded-xl bg-blue-700 text-white font-bold flex items-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Télécharger PNG</span>
              </button>
              <button
                type="button"
                onClick={() => handleDownload('pdf')}
                className="px-4 py-2 rounded-xl bg-slate-800 text-white font-bold flex items-center gap-1.5"
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Télécharger PDF</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setPreviewDataUrl(null);
                  handleShare();
                }}
                className="px-4 py-2 rounded-xl bg-emerald-600 text-white font-bold flex items-center gap-1.5"
              >
                <Share2 className="w-3.5 h-3.5" />
                <span>Partager</span>
              </button>
            </div>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        isOpen={!!confirmDeleteCreations && confirmDeleteCreations.length > 0}
        title={isEn ? 'Delete creation(s)?' : 'Supprimer la sélection ?'}
        message={
          confirmDeleteCreations && confirmDeleteCreations.length === 1
            ? `${isEn ? 'Delete' : 'Supprimer'} « ${confirmDeleteCreations[0].title} » ?`
            : `${isEn ? 'Delete' : 'Supprimer'} ${confirmDeleteCreations?.length || 0} création(s) ?`
        }
        confirmLabel={isEn ? 'Delete' : 'Supprimer'}
        cancelLabel={isEn ? 'Cancel' : 'Annuler'}
        isDestructive
        onConfirm={handleConfirmDeleteCreations}
        onCancel={() => setConfirmDeleteCreations(null)}
      />

      <SocialShareModal
        isOpen={!!sharePayload}
        onClose={() => setSharePayload(null)}
        payload={sharePayload}
      />
    </div>
  );
};
