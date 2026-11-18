import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';

export type StudioKind = 'design' | 'presentation' | 'video' | 'audio';

const ALLOWED_FONTS = new Set([
  '"Outfit", sans-serif',
  '"Plus Jakarta Sans", sans-serif',
  'Georgia, "Times New Roman", serif',
  '"Palatino Linotype", "Book Antiqua", Palatino, serif',
  '"Arial Black", Impact, sans-serif',
  'cursive',
  '"Courier New", monospace',
]);

const ALLOWED_SHAPES = new Set([
  'rect',
  'roundRect',
  'circle',
  'triangle',
  'star',
  'cross',
  'dove',
  'crown',
  'bible',
  'rays',
  'heart',
  'diamond',
  'arrow',
  'ribbon',
  'frame',
  'line',
]);

const ALLOWED_SYNTH_PRESETS = new Set([
  'c_major',
  'g_warm',
  'a_minor',
  'soft_bell',
  'chime',
  'swell',
  'metronome',
  'silence',
]);

export interface OnlineDesignTemplate {
  id: string;
  nameFr: string;
  nameEn: string;
  category: string;
  tags: string[];
  format: 'square' | 'portrait' | 'story' | 'landscape' | 'a4';
  bgType: 'solid' | 'gradient';
  bgColor1: string;
  bgColor2: string;
  bgAngle: number;
  source: 'online-catalog' | 'online-live';
  layers: Array<Record<string, unknown>>;
}

export interface OnlineVideoTemplate {
  id: string;
  titleFr: string;
  titleEn: string;
  descFr: string;
  descEn: string;
  category: string;
  tags: string[];
  aspect: '9:16' | '16:9' | '1:1' | '4:5';
  bgColor: string;
  source: 'online-catalog' | 'online-live';
  scenes: Array<Record<string, unknown>>;
  overlays: Array<Record<string, unknown>>;
}

export interface OnlineAudioTemplate {
  id: string;
  titleFr: string;
  titleEn: string;
  descFr: string;
  descEn: string;
  category: string;
  tags: string[];
  badgeColor: string;
  source: 'online-catalog' | 'online-live';
  tracks: Array<{
    id: string;
    name: string;
    color: string;
    volume: number;
    muted: boolean;
    solo: boolean;
  }>;
  synthAdditions: Array<{
    preset: string;
    duration: number;
    trackId: string;
    name: string;
    startTimeSec: number;
    gain: number;
  }>;
  markers: Array<{
    id: string;
    timeSec: number;
    label: string;
    color: string;
  }>;
  scriptFr: string;
  scriptEn: string;
}

const ONLINE_DESIGN_CATALOG: OnlineDesignTemplate[] = [
  {
    id: 'onl_des_psaume91',
    nameFr: 'Psaume 91 · Bouclier & Paix',
    nameEn: 'Psalm 91 · Shield & Peace',
    category: 'Verset',
    tags: ['psaume', 'protection', 'paix', 'verset', 'bouclier'],
    format: 'square',
    bgType: 'gradient',
    bgColor1: '#071128',
    bgColor2: '#0f766e',
    bgAngle: 140,
    source: 'online-catalog',
    layers: [
      {
        kind: 'shape',
        id: 'p91_rays',
        shape: 'rays',
        x: 540,
        y: 230,
        width: 240,
        height: 240,
        fillColor: '#fbbf24',
        strokeColor: '#ffffff',
        strokeWidth: 0,
        rotation: 0,
        opacity: 0.25,
      },
      {
        kind: 'shape',
        id: 'p91_cross',
        shape: 'cross',
        x: 540,
        y: 230,
        width: 110,
        height: 140,
        fillColor: '#fbbf24',
        strokeColor: '#ffffff',
        strokeWidth: 0,
        rotation: 0,
        opacity: 0.95,
      },
      {
        kind: 'text',
        id: 'p91_txt',
        x: 540,
        y: 540,
        text: '« Celui qui demeure sous l’abri\ndu Très-Haut repose à l’ombre\ndu Tout-Puissant. »',
        fontFamily: 'Georgia, "Times New Roman", serif',
        fontSize: 54,
        color: '#ffffff',
        bold: true,
        italic: true,
        underline: false,
        align: 'center',
        bgColor: '#071128',
        bgEnabled: false,
        shadow: true,
        rotation: 0,
        opacity: 1,
      },
      {
        kind: 'text',
        id: 'p91_ref',
        x: 540,
        y: 840,
        text: 'PSAUME 91 : 1',
        fontFamily: '"Outfit", sans-serif',
        fontSize: 38,
        color: '#fde68a',
        bold: true,
        italic: false,
        underline: true,
        align: 'center',
        bgColor: '#0f766e',
        bgEnabled: false,
        shadow: false,
        rotation: 0,
        opacity: 1,
      },
    ],
  },
  {
    id: 'onl_des_bapteme',
    nameFr: 'Célébration Baptême',
    nameEn: 'Baptism Celebration',
    category: 'Église',
    tags: ['bapteme', 'eglise', 'eau', 'nouvelle naissance', 'fete'],
    format: 'portrait',
    bgType: 'gradient',
    bgColor1: '#0c4a6e',
    bgColor2: '#0284c7',
    bgAngle: 160,
    source: 'online-catalog',
    layers: [
      {
        kind: 'shape',
        id: 'bp_dove',
        shape: 'dove',
        x: 540,
        y: 280,
        width: 210,
        height: 170,
        fillColor: '#ffffff',
        strokeColor: '#fde68a',
        strokeWidth: 0,
        rotation: 0,
        opacity: 0.95,
      },
      {
        kind: 'text',
        id: 'bp_title',
        x: 540,
        y: 580,
        text: 'JOURNÉE DE\nBAPTÊME',
        fontFamily: '"Outfit", sans-serif',
        fontSize: 82,
        color: '#ffffff',
        bold: true,
        italic: false,
        align: 'center',
        bgColor: '#0c4a6e',
        bgEnabled: false,
        shadow: true,
        rotation: 0,
        opacity: 1,
      },
      {
        kind: 'text',
        id: 'bp_verse',
        x: 540,
        y: 920,
        text: '« Si quelqu’un est en Christ, il est une nouvelle créature. »\n2 Corinthiens 5 : 17',
        fontFamily: 'Georgia, "Times New Roman", serif',
        fontSize: 36,
        color: '#e0f2fe',
        bold: false,
        italic: true,
        align: 'center',
        bgColor: '#0c4a6e',
        bgEnabled: false,
        shadow: false,
        rotation: 0,
        opacity: 1,
      },
    ],
  },
  {
    id: 'onl_des_jeunesse',
    nameFr: 'Soirée Jeunesse & Louange',
    nameEn: 'Youth Worship Night',
    category: 'Événement',
    tags: ['jeunesse', 'louange', 'concert', 'gospel', 'affiche', 'soiree'],
    format: 'story',
    bgType: 'gradient',
    bgColor1: '#311042',
    bgColor2: '#e11d48',
    bgAngle: 145,
    source: 'online-catalog',
    layers: [
      {
        kind: 'shape',
        id: 'jn_star',
        shape: 'rays',
        x: 540,
        y: 380,
        width: 300,
        height: 300,
        fillColor: '#fbbf24',
        strokeColor: '#ffffff',
        strokeWidth: 0,
        rotation: 0,
        opacity: 0.3,
      },
      {
        kind: 'text',
        id: 'jn_h1',
        x: 540,
        y: 740,
        text: 'GÉNÉRATION\nDE FEU',
        fontFamily: '"Arial Black", Impact, sans-serif',
        fontSize: 88,
        color: '#ffffff',
        bold: true,
        italic: false,
        align: 'center',
        bgColor: '#000000',
        bgEnabled: false,
        shadow: true,
        rotation: -3,
        opacity: 1,
      },
      {
        kind: 'text',
        id: 'jn_info',
        x: 540,
        y: 1120,
        text: 'SAMEDI · 18H30 · LOUANGE LIVE',
        fontFamily: '"Outfit", sans-serif',
        fontSize: 38,
        color: '#0f172a',
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
    id: 'onl_des_mariage',
    nameFr: 'Bénédiction Mariage Chrétien',
    nameEn: 'Christian Wedding Blessing',
    category: 'Vœux',
    tags: ['mariage', 'amour', 'couple', 'benediction', 'alliance', 'voeux'],
    format: 'square',
    bgType: 'gradient',
    bgColor1: '#fff7ed',
    bgColor2: '#fde68a',
    bgAngle: 135,
    source: 'online-catalog',
    layers: [
      {
        kind: 'shape',
        id: 'mr_frame',
        shape: 'frame',
        x: 540,
        y: 540,
        width: 960,
        height: 960,
        fillColor: '#b45309',
        strokeColor: '#b45309',
        strokeWidth: 0,
        rotation: 0,
        opacity: 0.25,
      },
      {
        kind: 'shape',
        id: 'mr_heart',
        shape: 'heart',
        x: 540,
        y: 230,
        width: 120,
        height: 110,
        fillColor: '#be123c',
        strokeColor: '#ffffff',
        strokeWidth: 0,
        rotation: 0,
        opacity: 0.9,
      },
      {
        kind: 'text',
        id: 'mr_title',
        x: 540,
        y: 480,
        text: '« Ce que Dieu a uni,\nque l’homme ne le sépare pas. »',
        fontFamily: 'Georgia, "Times New Roman", serif',
        fontSize: 54,
        color: '#451a03',
        bold: true,
        italic: true,
        align: 'center',
        bgColor: '#ffffff',
        bgEnabled: false,
        shadow: false,
        rotation: 0,
        opacity: 1,
      },
      {
        kind: 'text',
        id: 'mr_ref',
        x: 540,
        y: 780,
        text: 'Marc 10 : 9 · Joyeuse Union Bénie',
        fontFamily: '"Outfit", sans-serif',
        fontSize: 34,
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
    ],
  },
  {
    id: 'onl_des_youtube',
    nameFr: 'Miniature Prédication 16:9',
    nameEn: 'Sermon Thumbnail 16:9',
    category: 'Miniature',
    tags: ['youtube', 'miniature', 'predication', 'sermon', 'video', 'bible'],
    format: 'landscape',
    bgType: 'gradient',
    bgColor1: '#0b1f42',
    bgColor2: '#1e3a8a',
    bgAngle: 120,
    source: 'online-catalog',
    layers: [
      {
        kind: 'shape',
        id: 'yt_bible',
        shape: 'bible',
        x: 240,
        y: 360,
        width: 280,
        height: 220,
        fillColor: '#fbbf24',
        strokeColor: '#ffffff',
        strokeWidth: 0,
        rotation: -6,
        opacity: 0.95,
      },
      {
        kind: 'text',
        id: 'yt_head',
        x: 760,
        y: 310,
        text: 'LA FOI QUI\nDÉPLACE LES\nMONTAGNES',
        fontFamily: '"Arial Black", Impact, sans-serif',
        fontSize: 68,
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
        id: 'yt_tag',
        x: 760,
        y: 560,
        text: 'MESSAGE DU DIMANCHE · MATTHIEU 17:20',
        fontFamily: '"Outfit", sans-serif',
        fontSize: 28,
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
    id: 'onl_des_noel',
    nameFr: 'Paix de Noël · Nativité',
    nameEn: 'Christmas Peace · Nativity',
    category: 'Fête',
    tags: ['noel', 'nativite', 'etoile', 'jesus', 'fete', 'voeux'],
    format: 'square',
    bgType: 'gradient',
    bgColor1: '#7f1d1d',
    bgColor2: '#064e3b',
    bgAngle: 145,
    source: 'online-catalog',
    layers: [
      {
        kind: 'shape',
        id: 'nl_star',
        shape: 'star',
        x: 540,
        y: 230,
        width: 150,
        height: 150,
        fillColor: '#fbbf24',
        strokeColor: '#ffffff',
        strokeWidth: 0,
        rotation: 0,
        opacity: 1,
      },
      {
        kind: 'text',
        id: 'nl_title',
        x: 540,
        y: 510,
        text: 'JOYEUX NOËL\nEMMANUEL !',
        fontFamily: 'Georgia, "Times New Roman", serif',
        fontSize: 72,
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
        id: 'nl_sub',
        x: 540,
        y: 780,
        text: '« Un Sauveur nous est né, qui est le Christ, le Seigneur. »',
        fontFamily: 'Georgia, "Times New Roman", serif',
        fontSize: 34,
        color: '#fde68a',
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
    id: 'onl_des_paques',
    nameFr: 'Pâques · Il est Ressuscité',
    nameEn: 'Easter · He Is Risen',
    category: 'Fête',
    tags: ['paques', 'resurrection', 'croix', 'victoire', 'fete'],
    format: 'portrait',
    bgType: 'gradient',
    bgColor1: '#fbbf24',
    bgColor2: '#9a3412',
    bgAngle: 165,
    source: 'online-catalog',
    layers: [
      {
        kind: 'shape',
        id: 'pq_rays',
        shape: 'rays',
        x: 540,
        y: 360,
        width: 340,
        height: 340,
        fillColor: '#ffffff',
        strokeColor: '#ffffff',
        strokeWidth: 0,
        rotation: 0,
        opacity: 0.35,
      },
      {
        kind: 'shape',
        id: 'pq_cross',
        shape: 'cross',
        x: 540,
        y: 360,
        width: 140,
        height: 190,
        fillColor: '#ffffff',
        strokeColor: '#451a03',
        strokeWidth: 0,
        rotation: 0,
        opacity: 1,
      },
      {
        kind: 'text',
        id: 'pq_title',
        x: 540,
        y: 760,
        text: 'IL EST\nRESSUSCITÉ !',
        fontFamily: '"Outfit", sans-serif',
        fontSize: 84,
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
        id: 'pq_sub',
        x: 540,
        y: 1050,
        text: 'Luc 24 : 6 · Joyeuses Pâques en Christ',
        fontFamily: 'Georgia, "Times New Roman", serif',
        fontSize: 38,
        color: '#fef3c7',
        bold: true,
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
    id: 'onl_des_matin',
    nameFr: 'Prière du Matin Lumineuse',
    nameEn: 'Morning Prayer Inspiration',
    category: 'Prière',
    tags: ['matin', 'priere', 'reveil', 'lumiere', 'verset', 'jour'],
    format: 'story',
    bgType: 'gradient',
    bgColor1: '#0f172a',
    bgColor2: '#f59e0b',
    bgAngle: 175,
    source: 'online-catalog',
    layers: [
      {
        kind: 'shape',
        id: 'mt_dove',
        shape: 'dove',
        x: 540,
        y: 440,
        width: 210,
        height: 170,
        fillColor: '#fef3c7',
        strokeColor: '#ffffff',
        strokeWidth: 0,
        rotation: 0,
        opacity: 0.95,
      },
      {
        kind: 'text',
        id: 'mt_txt',
        x: 540,
        y: 860,
        text: 'BONJOUR\nSOUS LA GRÂCE',
        fontFamily: '"Outfit", sans-serif',
        fontSize: 74,
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
        id: 'mt_ref',
        x: 540,
        y: 1220,
        text: '« Ses bontés se renouvellent chaque matin. »\nLamentations 3 : 23',
        fontFamily: 'Georgia, "Times New Roman", serif',
        fontSize: 42,
        color: '#fffbeb',
        bold: false,
        italic: true,
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

const ONLINE_VIDEO_CATALOG: OnlineVideoTemplate[] = [
  {
    id: 'onl_vid_psaume23',
    titleFr: 'Psaume 23 · Paix & Berger (9:16)',
    titleEn: 'Psalm 23 · Shepherd Reel (9:16)',
    descFr: 'Vidéo courte apaisante avec transition en fondu, verset doré et bannière.',
    descEn: 'Peaceful vertical reel with cross icon, golden scripture and lower badge.',
    category: 'Verset',
    tags: ['psaume', 'verset', 'paix', 'reel', 'story', 'meditation'],
    aspect: '9:16',
    bgColor: '#064e3b',
    source: 'online-catalog',
    scenes: [
      {
        kind: 'custom',
        name: 'Introduction Paix',
        durationSec: 3.5,
        trimStartSec: 0,
        trimEndSec: 3.5,
        fitMode: 'cover',
        kenBurns: false,
        volume: 1,
        playbackRate: 1,
        transition: 'fade',
        filter: 'none',
        bgType: 'gradient',
        bgColor: '#064e3b',
        bgColor2: '#0f172a',
        shape: 'dove',
        shapeColor: '#fde68a',
        text: 'MÉDITATION DU JOUR',
        textColor: '#ffffff',
        fontSize: 48,
        fontFamily: '"Outfit", sans-serif',
        bold: true,
        italic: false,
        underline: false,
        textAlign: 'center',
      },
      {
        kind: 'custom',
        name: 'Psaume 23:1',
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
        bgColor2: '#065f46',
        shape: 'cross',
        shapeColor: '#fbbf24',
        text: '« L’Éternel est mon berger :\nje ne manquerai de rien. »\nPsaume 23 : 1',
        textColor: '#ffffff',
        fontSize: 40,
        fontFamily: 'Georgia, "Times New Roman", serif',
        bold: true,
        italic: true,
        underline: false,
        textAlign: 'center',
      },
    ],
    overlays: [
      {
        kind: 'text',
        label: 'Signature Paix',
        startSec: 0.4,
        endSec: 9.2,
        xPct: 50,
        yPct: 88,
        size: 26,
        rotationDeg: 0,
        color: '#fde68a',
        bgBadge: true,
        opacity: 0.95,
        animation: 'slide-up',
        text: 'SHALOM · Paix du Cœur',
        fontFamily: '"Outfit", sans-serif',
        bold: true,
        italic: false,
      },
    ],
  },
  {
    id: 'onl_vid_jeunesse',
    titleFr: 'Teaser Soirée Jeunesse (9:16)',
    titleEn: 'Youth Night Promo (9:16)',
    descFr: 'Annonce dynamique multi-scènes pour inviter les jeunes au culte.',
    descEn: 'Dynamic multi-scene invite reel for church youth worship nights.',
    category: 'Événement',
    tags: ['jeunesse', 'soiree', 'invitation', 'concert', 'louange', 'evenement'],
    aspect: '9:16',
    bgColor: '#3b0764',
    source: 'online-catalog',
    scenes: [
      {
        kind: 'custom',
        name: 'Accroche Jeunesse',
        durationSec: 3,
        trimStartSec: 0,
        trimEndSec: 3,
        fitMode: 'cover',
        kenBurns: false,
        volume: 1,
        playbackRate: 1,
        transition: 'zoom',
        filter: 'vivid',
        bgType: 'gradient',
        bgColor: '#3b0764',
        bgColor2: '#be185d',
        shape: 'rays',
        shapeColor: '#fbbf24',
        text: 'SOIRÉE JEUNESSE\nLOUANGE LIVE',
        textColor: '#ffffff',
        fontSize: 52,
        fontFamily: '"Arial Black", Impact, sans-serif',
        bold: true,
        italic: false,
        underline: false,
        textAlign: 'center',
      },
      {
        kind: 'custom',
        name: 'Lieu & Date',
        durationSec: 4.5,
        trimStartSec: 0,
        trimEndSec: 4.5,
        fitMode: 'cover',
        kenBurns: false,
        volume: 1,
        playbackRate: 1,
        transition: 'slide',
        filter: 'none',
        bgType: 'gradient',
        bgColor: '#0b1f42',
        bgColor2: '#1d4ed8',
        shape: 'crown',
        shapeColor: '#fbbf24',
        text: 'Samedi · 18h30\nViens avec tes amis !',
        textColor: '#ffffff',
        fontSize: 44,
        fontFamily: '"Outfit", sans-serif',
        bold: true,
        italic: false,
        underline: false,
        textAlign: 'center',
      },
    ],
    overlays: [],
  },
  {
    id: 'onl_vid_jeune_priere',
    titleFr: 'Appel Jeûne & Prière (4:5)',
    titleEn: 'Fasting & Prayer Call (4:5)',
    descFr: 'Format Instagram/WhatsApp avec Bible ouverte et verset d’encouragement.',
    descEn: 'Portrait invitation for fasting & intercession gatherings.',
    category: 'Prière',
    tags: ['jeune', 'priere', 'intercession', 'eglise', 'appel'],
    aspect: '4:5',
    bgColor: '#1e1b4b',
    source: 'online-catalog',
    scenes: [
      {
        kind: 'custom',
        name: 'Appel Intercession',
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
        bgColor2: '#0f766e',
        shape: 'bible',
        shapeColor: '#fbbf24',
        text: 'TEMPS DE JEÛNE\n& D’INTERCESSION',
        textColor: '#ffffff',
        fontSize: 48,
        fontFamily: '"Outfit", sans-serif',
        bold: true,
        italic: false,
        underline: false,
        textAlign: 'center',
      },
    ],
    overlays: [
      {
        kind: 'text',
        label: 'Verset Prière',
        startSec: 0.5,
        endSec: 5,
        xPct: 50,
        yPct: 86,
        size: 28,
        rotationDeg: 0,
        color: '#fef3c7',
        bgBadge: true,
        opacity: 1,
        animation: 'fade-in',
        text: '1 Thessaloniciens 5:17 · Priez sans cesse',
        fontFamily: 'Georgia, "Times New Roman", serif',
        bold: false,
        italic: true,
      },
    ],
  },
  {
    id: 'onl_vid_mariage',
    titleFr: 'Vœux & Bénédiction Union (1:1)',
    titleEn: 'Wedding Blessing Card (1:1)',
    descFr: 'Carte vidéo élégante dorée pour féliciter un couple ou célébrer un anniversaire.',
    descEn: 'Warm golden square video card to bless couples & anniversaries.',
    category: 'Vœux',
    tags: ['mariage', 'amour', 'couple', 'voeux', 'anniversaire', 'benediction'],
    aspect: '1:1',
    bgColor: '#451a03',
    source: 'online-catalog',
    scenes: [
      {
        kind: 'custom',
        name: 'Bénédiction Union',
        durationSec: 5,
        trimStartSec: 0,
        trimEndSec: 5,
        fitMode: 'cover',
        kenBurns: false,
        volume: 1,
        playbackRate: 1,
        transition: 'fade',
        filter: 'warm',
        bgType: 'gradient',
        bgColor: '#7c2d12',
        bgColor2: '#b45309',
        shape: 'heart',
        shapeColor: '#fef3c7',
        text: 'QUE DIEU BÉNISSE\nVOTRE UNION',
        textColor: '#fffbeb',
        fontSize: 48,
        fontFamily: 'Georgia, "Times New Roman", serif',
        bold: true,
        italic: true,
        underline: false,
        textAlign: 'center',
      },
    ],
    overlays: [],
  },
  {
    id: 'onl_vid_predication_169',
    titleFr: 'Intro Prédication YouTube (16:9)',
    titleEn: 'YouTube Sermon Intro (16:9)',
    descFr: 'Générique grand écran 16:9 élégant pour cultes, rediffusions et enseignements.',
    descEn: 'Widescreen 16:9 intro bumper for church livestreams and sermons.',
    category: 'Église',
    tags: ['youtube', 'predication', 'culte', 'eglise', 'intro', 'enseignement'],
    aspect: '16:9',
    bgColor: '#0b1f42',
    source: 'online-catalog',
    scenes: [
      {
        kind: 'custom',
        name: 'Ouverture Culte',
        durationSec: 4,
        trimStartSec: 0,
        trimEndSec: 4,
        fitMode: 'cover',
        kenBurns: false,
        volume: 1,
        playbackRate: 1,
        transition: 'zoom',
        filter: 'none',
        bgType: 'gradient',
        bgColor: '#071128',
        bgColor2: '#1d4ed8',
        shape: 'cross',
        shapeColor: '#fbbf24',
        text: 'MESSAGE BIBLIQUE\n& ENSEIGNEMENT',
        textColor: '#ffffff',
        fontSize: 58,
        fontFamily: '"Outfit", sans-serif',
        bold: true,
        italic: false,
        underline: false,
        textAlign: 'center',
      },
    ],
    overlays: [
      {
        kind: 'text',
        label: 'Bandeau Orateur',
        startSec: 0.6,
        endSec: 4,
        xPct: 50,
        yPct: 86,
        size: 30,
        rotationDeg: 0,
        color: '#ffffff',
        bgBadge: true,
        opacity: 0.95,
        animation: 'slide-up',
        text: 'Bienvenue à l’écoute de la Parole',
        fontFamily: '"Plus Jakarta Sans", sans-serif',
        bold: true,
        italic: false,
      },
    ],
  },
];

const ONLINE_AUDIO_CATALOG: OnlineAudioTemplate[] = [
  {
    id: 'onl_aud_matin',
    titleFr: 'Prière Matinale Paisible',
    titleEn: 'Peaceful Morning Prayer',
    descFr: 'Cloche douce d’ouverture + Accord Sol chaleureux + Script de prière guidée.',
    descEn: 'Gentle bell + warm G major pad + morning gratitude script.',
    category: 'Prière',
    tags: ['matin', 'priere', 'paix', 'meditation', 'gratitude'],
    badgeColor: '#f59e0b',
    source: 'online-catalog',
    tracks: [
      { id: 'track_1', name: 'Voix Prière Matinale', color: '#2563eb', volume: 1.0, muted: false, solo: false },
      { id: 'track_2', name: 'Nappe Sol Paix', color: '#059669', volume: 0.42, muted: false, solo: false },
    ],
    synthAdditions: [
      { preset: 'soft_bell', duration: 3, trackId: 'track_2', name: 'Cloche Aurore', startTimeSec: 0, gain: 0.8 },
      { preset: 'g_warm', duration: 20, trackId: 'track_2', name: 'Harmonie Sol Douce', startTimeSec: 0.8, gain: 0.85 },
    ],
    markers: [
      { id: 'mk_am1', timeSec: 0.5, label: 'Action de grâces', color: '#fbbf24' },
      { id: 'mk_am2', timeSec: 10, label: 'Bénédiction du jour', color: '#10b981' },
    ],
    scriptFr:
      'Seigneur, merci pour ce souffle de vie et ce matin nouveau.\nConduis chacun de mes pas dans Ta paix et Ta sagesse aujourd’hui. Amen.',
    scriptEn:
      'Lord, thank You for the breath of life and this brand new morning.\nGuide every step I take today in Your peace and wisdom. Amen.',
  },
  {
    id: 'onl_aud_capsule_verset',
    titleFr: 'Capsule Verset Quotidien (1 min)',
    titleEn: 'Daily Scripture Capsule',
    descFr: 'Carillon lumineux + Tapis Do majeur court + repères lecture & application.',
    descEn: 'Crisp intro chime + C major bed + verse reading markers.',
    category: 'Verset',
    tags: ['verset', 'bible', 'capsule', 'podcast', 'exhortation'],
    badgeColor: '#2563eb',
    source: 'online-catalog',
    tracks: [
      { id: 'track_1', name: 'Lecture & Commentaire', color: '#2563eb', volume: 1.05, muted: false, solo: false },
      { id: 'track_2', name: 'Fond Musical Lumière', color: '#d97706', volume: 0.36, muted: false, solo: false },
    ],
    synthAdditions: [
      { preset: 'chime', duration: 3, trackId: 'track_2', name: 'Carillon Ouverture', startTimeSec: 0, gain: 0.85 },
      { preset: 'c_major', duration: 16, trackId: 'track_2', name: 'Soutien Do Majeur', startTimeSec: 1, gain: 0.78 },
    ],
    markers: [
      { id: 'mk_cv1', timeSec: 1, label: 'Lecture du Verset', color: '#3b82f6' },
      { id: 'mk_cv2', timeSec: 8, label: 'Message Court', color: '#fbbf24' },
    ],
    scriptFr:
      'Verset du jour — Philippiens 4:13 :\n« Je puis tout par celui qui me fortifie. »\n\nRappel : Dieu dépose Sa force au cœur même de votre journée.',
    scriptEn:
      'Verse of the Day — Philippians 4:13:\n"I can do all things through Christ who strengthens me."',
  },
  {
    id: 'onl_aud_temoignage',
    titleFr: 'Témoignage & Reconnaissance',
    titleEn: 'Testimony & Thanksgiving',
    descFr: 'Montée douce d’introduction + Nappe chaleureuse idéale pour partager un miracle.',
    descEn: 'Warm intro swell + supportive harmonic pad for personal testimonies.',
    category: 'Témoignage',
    tags: ['temoignage', 'grace', 'miracle', 'reconnaissance', 'histoire'],
    badgeColor: '#db2777',
    source: 'online-catalog',
    tracks: [
      { id: 'track_1', name: 'Récit Témoignage', color: '#db2777', volume: 1.05, muted: false, solo: false },
      { id: 'track_2', name: 'Soutien Chaleureux', color: '#d97706', volume: 0.38, muted: false, solo: false },
    ],
    synthAdditions: [
      { preset: 'swell', duration: 4, trackId: 'track_2', name: 'Montée Émotion', startTimeSec: 0, gain: 0.85 },
      { preset: 'g_warm', duration: 18, trackId: 'track_2', name: 'Accord Sol Doux', startTimeSec: 3, gain: 0.8 },
    ],
    markers: [
      { id: 'mk_tm1', timeSec: 0.5, label: 'Contexte', color: '#ec4899' },
      { id: 'mk_tm2', timeSec: 10, label: 'Action de Dieu', color: '#fbbf24' },
    ],
    scriptFr:
      'Je veux rendre gloire à Dieu pour Sa fidélité dans ma vie.\nLà où je ne voyais aucune issue, Il a ouvert un chemin de paix.',
    scriptEn:
      'I want to give glory to God for His faithfulness in my life.\nWhere there seemed to be no way, He opened a path of peace.',
  },
  {
    id: 'onl_aud_veillee',
    titleFr: 'Atmosphère Veillée & Intercession',
    titleEn: 'Night Vigil & Intercession',
    descFr: 'Accord La mineur profond + Cloche méditative pour temps de prière prolongé.',
    descEn: 'Deep A minor ambient texture + meditation bells for prayer vigils.',
    category: 'Prière',
    tags: ['veillee', 'intercession', 'nuit', 'priere', 'adoration'],
    badgeColor: '#7c3aed',
    source: 'online-catalog',
    tracks: [
      { id: 'track_1', name: 'Voix Intercesseur', color: '#2563eb', volume: 1.0, muted: false, solo: false },
      { id: 'track_2', name: 'Nappe Adoration La m', color: '#7c3aed', volume: 0.48, muted: false, solo: false },
    ],
    synthAdditions: [
      { preset: 'a_minor', duration: 24, trackId: 'track_2', name: 'Nappe La Mineur', startTimeSec: 0, gain: 0.85 },
      { preset: 'soft_bell', duration: 3.5, trackId: 'track_2', name: 'Cloche Veillée', startTimeSec: 12, gain: 0.7 },
    ],
    markers: [
      { id: 'mk_vl1', timeSec: 0, label: 'Adoration', color: '#8b5cf6' },
      { id: 'mk_vl2', timeSec: 12, label: 'Intercession', color: '#fbbf24' },
    ],
    scriptFr:
      'Seigneur, nous élevons nos familles, notre ville et notre église devant Ton trône de grâce.\nRépands Ton Esprit de guérison et d’unité.',
    scriptEn:
      'Lord, we lift our families, our city, and our church before Your throne of grace.',
  },
  {
    id: 'onl_aud_lecture_biblique',
    titleFr: 'Lecture Biblique Solennelle',
    titleEn: 'Solemn Scripture Reading',
    descFr: 'Mix ultra-clair centré sur la voix avec discret accord d’ouverture et fermeture.',
    descEn: 'Voice-forward scripture reading with subtle intro and outro chimes.',
    category: 'Bible',
    tags: ['lecture', 'bible', 'chapitre', 'evangile', 'psaume'],
    badgeColor: '#059669',
    source: 'online-catalog',
    tracks: [
      { id: 'track_1', name: 'Lecteur Biblique', color: '#059669', volume: 1.1, muted: false, solo: false },
      { id: 'track_2', name: 'Carillons Repères', color: '#d97706', volume: 0.35, muted: false, solo: false },
    ],
    synthAdditions: [
      { preset: 'chime', duration: 2.5, trackId: 'track_2', name: 'Carillon Début', startTimeSec: 0, gain: 0.75 },
      { preset: 'soft_bell', duration: 3, trackId: 'track_2', name: 'Cloche Fin', startTimeSec: 16, gain: 0.75 },
    ],
    markers: [{ id: 'mk_lb1', timeSec: 2, label: 'Lecture du passage', color: '#10b981' }],
    scriptFr:
      'Lecture du Psaume 121 :\n« Je lève mes yeux vers les montagnes... D’où me viendra le secours ? Le secours me vient de l’Éternel. »',
    scriptEn:
      'Reading from Psalm 121:\n"I lift up my eyes to the mountains—where does my help come from? My help comes from the Lord."',
  },
];

function normalizeText(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function matchesQuery<T extends { category: string; tags: string[] }>(
  item: T,
  textFields: string[],
  qNorm: string,
  category?: string
): boolean {
  if (category && category !== 'all' && normalizeText(item.category) !== normalizeText(category)) {
    return false;
  }
  if (!qNorm) return true;
  const hay = normalizeText([...textFields, item.category, ...item.tags].join(' '));
  return qNorm
    .split(/\s+/)
    .filter(Boolean)
    .every((word) => hay.includes(word));
}

function safeHex(val: unknown, fallback: string): string {
  if (typeof val === 'string' && /^#[0-9a-fA-F]{6}$/.test(val.trim())) {
    return val.trim();
  }
  return fallback;
}

function safeFont(val: unknown): string {
  if (typeof val === 'string' && ALLOWED_FONTS.has(val)) return val;
  return '"Outfit", sans-serif';
}

function safeShape(val: unknown): string {
  if (typeof val === 'string' && ALLOWED_SHAPES.has(val)) return val;
  return 'cross';
}

function getFormatDims(format: OnlineDesignTemplate['format']): { w: number; h: number } {
  switch (format) {
    case 'portrait':
      return { w: 1080, h: 1350 };
    case 'story':
      return { w: 1080, h: 1920 };
    case 'landscape':
      return { w: 1280, h: 720 };
    case 'a4':
      return { w: 1240, h: 1754 };
    case 'square':
    default:
      return { w: 1080, h: 1080 };
  }
}

async function generateLiveDesignTemplates(
  ai: GoogleGenAI,
  query: string,
  lang: 'fr' | 'en',
  page: number,
  excludeTitles: string[]
): Promise<OnlineDesignTemplate[]> {
  const topic = query || (lang === 'en' ? 'Christian Worship, Faith & Community' : 'Foi, Louange, Verset & Église');
  const excludeNote =
    excludeTitles.length > 0
      ? ` N'utilise PAS ces titres déjà affichés : ${excludeTitles.slice(-24).join(', ')}.`
      : '';
  const response = await ai.models.generateContent({
    model: 'gemini-4-hydrogen',
    contents: `Génère 4 nouveaux modèles de création graphique chrétiens SHALOM (page ${page}) correspondant à : "${topic}". Langue principale : ${lang === 'en' ? 'English' : 'Français'}.${excludeNote}`,
    config: {
      thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
      systemInstruction:
        'Tu es un directeur artistique chrétien pour SHALOM Studio. Retourne des modèles variés, harmonieux, lisibles, bien contrastés et inspirants. Formats autorisés: square, portrait, story, landscape, a4. Formes autorisées: cross, dove, bible, crown, rays, heart, star, rect, roundRect, circle, frame. Polices autorisées: "Outfit", sans-serif | "Plus Jakarta Sans", sans-serif | Georgia, "Times New Roman", serif | "Arial Black", Impact, sans-serif.',
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            nameFr: { type: Type.STRING },
            nameEn: { type: Type.STRING },
            category: { type: Type.STRING },
            format: { type: Type.STRING },
            bgColor1: { type: Type.STRING },
            bgColor2: { type: Type.STRING },
            shape: { type: Type.STRING },
            shapeColor: { type: Type.STRING },
            headline: { type: Type.STRING },
            headlineColor: { type: Type.STRING },
            headlineItalic: { type: Type.BOOLEAN },
            subtext: { type: Type.STRING },
            subtextColor: { type: Type.STRING },
            fontFamily: { type: Type.STRING },
          },
        },
      },
    },
  });

  const raw = JSON.parse((response.text ?? '[]').trim()) as Array<Record<string, unknown>>;
  if (!Array.isArray(raw)) return [];

  return raw.slice(0, 4).map((item, idx) => {
    const fmtRaw = String(item.format || 'square');
    const format: OnlineDesignTemplate['format'] = ['square', 'portrait', 'story', 'landscape', 'a4'].includes(
      fmtRaw
    )
      ? (fmtRaw as OnlineDesignTemplate['format'])
      : 'square';
    const { w, h } = getFormatDims(format);
    const bgColor1 = safeHex(item.bgColor1, '#0b1f42');
    const bgColor2 = safeHex(item.bgColor2, '#1d4ed8');
    const shapeColor = safeHex(item.shapeColor, '#fbbf24');
    const headlineColor = safeHex(item.headlineColor, '#ffffff');
    const subtextColor = safeHex(item.subtextColor, '#fde68a');
    const fontFamily = safeFont(item.fontFamily);
    const shape = safeShape(item.shape);

    return {
      id: `live_des_${Date.now()}_${page}_${idx}`,
      nameFr: String(item.nameFr || `Modèle ${topic} #${page}.${idx + 1}`),
      nameEn: String(item.nameEn || `${topic} Template #${page}.${idx + 1}`),
      category: String(item.category || 'En ligne'),
      tags: [topic],
      format,
      bgType: 'gradient',
      bgColor1,
      bgColor2,
      bgAngle: 145,
      source: 'online-live',
      layers: [
        {
          kind: 'shape',
          id: `ld_shp_${page}_${idx}`,
          shape,
          x: Math.round(w / 2),
          y: Math.round(h * 0.24),
          width: Math.round(Math.min(w, h) * 0.16),
          height: Math.round(Math.min(w, h) * 0.16),
          fillColor: shapeColor,
          strokeColor: '#ffffff',
          strokeWidth: 0,
          rotation: 0,
          opacity: 0.95,
        },
        {
          kind: 'text',
          id: `ld_head_${page}_${idx}`,
          x: Math.round(w / 2),
          y: Math.round(h * 0.52),
          text: String(item.headline || topic.toUpperCase()),
          fontFamily,
          fontSize: Math.round(Math.min(w, h) * 0.056),
          color: headlineColor,
          bold: true,
          italic: Boolean(item.headlineItalic),
          underline: false,
          align: 'center',
          bgColor: bgColor1,
          bgEnabled: false,
          shadow: true,
          rotation: 0,
          opacity: 1,
        },
        {
          kind: 'text',
          id: `ld_sub_${page}_${idx}`,
          x: Math.round(w / 2),
          y: Math.round(h * 0.78),
          text: String(item.subtext || 'SHALOM · La foi au quotidien'),
          fontFamily: 'Georgia, "Times New Roman", serif',
          fontSize: Math.round(Math.min(w, h) * 0.034),
          color: subtextColor,
          bold: false,
          italic: true,
          underline: false,
          align: 'center',
          bgColor: bgColor1,
          bgEnabled: false,
          shadow: false,
          rotation: 0,
          opacity: 1,
        },
      ],
    };
  });
}

async function generateLiveVideoTemplates(
  ai: GoogleGenAI,
  query: string,
  lang: 'fr' | 'en',
  page: number,
  excludeTitles: string[]
): Promise<OnlineVideoTemplate[]> {
  const topic = query || (lang === 'en' ? 'Christian Worship, Faith & Community' : 'Foi, Louange, Verset & Église');
  const excludeNote =
    excludeTitles.length > 0
      ? ` N'utilise PAS ces titres déjà affichés : ${excludeTitles.slice(-24).join(', ')}.`
      : '';
  const response = await ai.models.generateContent({
    model: 'gemini-4-hydrogen',
    contents: `Génère 4 nouveaux modèles vidéo chrétiens SHALOM (page ${page}) correspondant à : "${topic}". Langue principale : ${lang === 'en' ? 'English' : 'Français'}.${excludeNote}`,
    config: {
      thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
      systemInstruction:
        'Tu conçois des modèles vidéo courts chrétiens pour SHALOM Studio Vidéo. Formats autorisés: 9:16, 16:9, 1:1, 4:5. Formes autorisées: cross, dove, bible, crown, rays, heart, star. Transitions autorisées: fade, slide, zoom, none.',
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            titleFr: { type: Type.STRING },
            titleEn: { type: Type.STRING },
            descFr: { type: Type.STRING },
            descEn: { type: Type.STRING },
            category: { type: Type.STRING },
            aspect: { type: Type.STRING },
            bgColor: { type: Type.STRING },
            bgColor2: { type: Type.STRING },
            shape: { type: Type.STRING },
            shapeColor: { type: Type.STRING },
            scene1Text: { type: Type.STRING },
            scene2Text: { type: Type.STRING },
            badgeText: { type: Type.STRING },
            transition: { type: Type.STRING },
          },
        },
      },
    },
  });

  const raw = JSON.parse((response.text ?? '[]').trim()) as Array<Record<string, unknown>>;
  if (!Array.isArray(raw)) return [];

  return raw.slice(0, 4).map((item, idx) => {
    const aspectRaw = String(item.aspect || '9:16');
    const aspect: OnlineVideoTemplate['aspect'] = ['9:16', '16:9', '1:1', '4:5'].includes(aspectRaw)
      ? (aspectRaw as OnlineVideoTemplate['aspect'])
      : '9:16';
    const bg1 = safeHex(item.bgColor, '#0b1f42');
    const bg2 = safeHex(item.bgColor2, '#1d4ed8');
    const shapeColor = safeHex(item.shapeColor, '#fbbf24');
    const shape = safeShape(item.shape);
    const transRaw = String(item.transition || 'fade');
    const transition = ['none', 'fade', 'slide', 'zoom'].includes(transRaw) ? transRaw : 'fade';

    return {
      id: `live_vid_${Date.now()}_${page}_${idx}`,
      titleFr: String(item.titleFr || `Vidéo ${topic} #${page}.${idx + 1}`),
      titleEn: String(item.titleEn || `${topic} Video #${page}.${idx + 1}`),
      descFr: String(item.descFr || `Modèle vidéo en ligne pour « ${topic} ».`),
      descEn: String(item.descEn || `Online video template for "${topic}".`),
      category: String(item.category || 'En ligne'),
      tags: [topic],
      aspect,
      bgColor: bg1,
      source: 'online-live',
      scenes: [
        {
          kind: 'custom',
          name: 'Scène 1 · Ouverture',
          durationSec: 4,
          trimStartSec: 0,
          trimEndSec: 4,
          fitMode: 'cover',
          kenBurns: false,
          volume: 1,
          playbackRate: 1,
          transition,
          filter: 'none',
          bgType: 'gradient',
          bgColor: bg1,
          bgColor2: bg2,
          shape,
          shapeColor,
          text: String(item.scene1Text || topic.toUpperCase()),
          textColor: '#ffffff',
          fontSize: 48,
          fontFamily: '"Outfit", sans-serif',
          bold: true,
          italic: false,
          underline: false,
          textAlign: 'center',
        },
        {
          kind: 'custom',
          name: 'Scène 2 · Message',
          durationSec: 5.5,
          trimStartSec: 0,
          trimEndSec: 5.5,
          fitMode: 'cover',
          kenBurns: false,
          volume: 1,
          playbackRate: 1,
          transition: 'fade',
          filter: 'none',
          bgType: 'gradient',
          bgColor: bg2,
          bgColor2: bg1,
          shape: 'cross',
          shapeColor,
          text: String(item.scene2Text || 'Que la paix de Dieu vous accompagne.'),
          textColor: '#ffffff',
          fontSize: 40,
          fontFamily: 'Georgia, "Times New Roman", serif',
          bold: false,
          italic: true,
          underline: false,
          textAlign: 'center',
        },
      ],
      overlays: item.badgeText
        ? [
            {
              kind: 'text',
              label: 'Bandeau',
              startSec: 0.4,
              endSec: 9,
              xPct: 50,
              yPct: 86,
              size: 26,
              rotationDeg: 0,
              color: shapeColor,
              bgBadge: true,
              opacity: 0.95,
              animation: 'slide-up',
              text: String(item.badgeText),
              fontFamily: '"Outfit", sans-serif',
              bold: true,
              italic: false,
            },
          ]
        : [],
    };
  });
}

async function generateLiveAudioTemplates(
  ai: GoogleGenAI,
  query: string,
  lang: 'fr' | 'en',
  page: number,
  excludeTitles: string[]
): Promise<OnlineAudioTemplate[]> {
  const topic = query || (lang === 'en' ? 'Prayer, Worship, Verse & Podcast' : 'Prière, Méditation, Louange & Podcast');
  const excludeNote =
    excludeTitles.length > 0
      ? ` N'utilise PAS ces titres déjà affichés : ${excludeTitles.slice(-24).join(', ')}.`
      : '';
  const response = await ai.models.generateContent({
    model: 'gemini-4-hydrogen',
    contents: `Génère 4 nouveaux modèles audio multipistes chrétiens SHALOM (page ${page}) correspondant à : "${topic}". Langue principale : ${lang === 'en' ? 'English' : 'Français'}.${excludeNote}`,
    config: {
      thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
      systemInstruction:
        'Tu conçois des projets audio multipistes chrétiens pour SHALOM Studio Audio (podcast, méditation, annonce, prière, chœur). Synthés autorisés: c_major, g_warm, a_minor, soft_bell, chime, swell, metronome.',
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            titleFr: { type: Type.STRING },
            titleEn: { type: Type.STRING },
            descFr: { type: Type.STRING },
            descEn: { type: Type.STRING },
            category: { type: Type.STRING },
            badgeColor: { type: Type.STRING },
            introSynth: { type: Type.STRING },
            padSynth: { type: Type.STRING },
            scriptFr: { type: Type.STRING },
            scriptEn: { type: Type.STRING },
            marker1: { type: Type.STRING },
            marker2: { type: Type.STRING },
          },
        },
      },
    },
  });

  const raw = JSON.parse((response.text ?? '[]').trim()) as Array<Record<string, unknown>>;
  if (!Array.isArray(raw)) return [];

  return raw.slice(0, 4).map((item, idx) => {
    const intro = ALLOWED_SYNTH_PRESETS.has(String(item.introSynth))
      ? String(item.introSynth)
      : 'chime';
    const pad = ALLOWED_SYNTH_PRESETS.has(String(item.padSynth))
      ? String(item.padSynth)
      : 'c_major';

    return {
      id: `live_aud_${Date.now()}_${page}_${idx}`,
      titleFr: String(item.titleFr || `Audio ${topic} #${page}.${idx + 1}`),
      titleEn: String(item.titleEn || `${topic} Audio #${page}.${idx + 1}`),
      descFr: String(item.descFr || `Structure multipiste en ligne pour « ${topic} ».`),
      descEn: String(item.descEn || `Online multitrack template for "${topic}".`),
      category: String(item.category || 'En ligne'),
      tags: [topic],
      badgeColor: safeHex(item.badgeColor, '#2563eb'),
      source: 'online-live',
      tracks: [
        { id: 'track_1', name: 'Piste 1 · Voix principale', color: '#2563eb', volume: 1.05, muted: false, solo: false },
        { id: 'track_2', name: 'Piste 2 · Harmonie / Ambiance', color: '#059669', volume: 0.4, muted: false, solo: false },
        { id: 'track_3', name: 'Piste 3 · Carillon / Repères', color: '#d97706', volume: 0.75, muted: false, solo: false },
      ],
      synthAdditions: [
        { preset: intro, duration: 3, trackId: 'track_3', name: 'Intro Sonore', startTimeSec: 0, gain: 0.85 },
        { preset: pad, duration: 18, trackId: 'track_2', name: 'Tapis Musical', startTimeSec: 0.8, gain: 0.8 },
      ],
      markers: [
        { id: `lmk_1_${page}_${idx}`, timeSec: 0.8, label: String(item.marker1 || 'Ouverture'), color: '#3b82f6' },
        { id: `lmk_2_${page}_${idx}`, timeSec: 9, label: String(item.marker2 || 'Conclusion'), color: '#fbbf24' },
      ],
      scriptFr: String(item.scriptFr || `Script SHALOM pour « ${topic} »...`),
      scriptEn: String(item.scriptEn || `SHALOM script for "${topic}"...`),
    };
  });
}

const PROCEDURAL_PALETTES = [
  ['#0b1f42', '#1d4ed8', '#fbbf24'],
  ['#134e4a', '#059669', '#fde68a'],
  ['#4c1d95', '#7c3aed', '#f9a8d4'],
  ['#7c2d12', '#d97706', '#fef3c7'],
  ['#0f172a', '#334155', '#38bdf8'],
  ['#831843', '#db2777', '#fde047'],
];

const PROCEDURAL_SHAPES = ['cross', 'dove', 'bible', 'crown', 'rays', 'heart', 'star', 'frame'];
const PROCEDURAL_DESIGN_FORMATS: OnlineDesignTemplate['format'][] = ['square', 'portrait', 'story', 'landscape', 'a4'];
const PROCEDURAL_VIDEO_ASPECTS: OnlineVideoTemplate['aspect'][] = ['9:16', '16:9', '1:1', '4:5'];

function generateProceduralTemplateBatch(
  studioType: StudioKind,
  query: string,
  category: string,
  lang: 'fr' | 'en',
  page: number,
  excludeSet: Set<string>
): Array<OnlineDesignTemplate | OnlineVideoTemplate | OnlineAudioTemplate> {
  const topic = query || (category && category !== 'all' ? category : lang === 'en' ? 'Grace & Faith' : 'Grâce & Lumière');
  const catLabel = category && category !== 'all' ? category : 'En ligne';
  const batch: Array<OnlineDesignTemplate | OnlineVideoTemplate | OnlineAudioTemplate> = [];

  for (let i = 0; i < 4; i++) {
    const seed = (page - 1) * 4 + i + 1;
    const pal = PROCEDURAL_PALETTES[seed % PROCEDURAL_PALETTES.length];
    const shape = PROCEDURAL_SHAPES[seed % PROCEDURAL_SHAPES.length];

    if (studioType === 'design') {
      const format = PROCEDURAL_DESIGN_FORMATS[seed % PROCEDURAL_DESIGN_FORMATS.length];
      const { w, h } = getFormatDims(format);
      const nameFr = `${topic} · Édition ${seed}`;
      const nameEn = `${topic} · Edition ${seed}`;
      if (excludeSet.has(normalizeText(nameFr))) continue;
      batch.push({
        id: `proc_des_${page}_${i}_${Date.now()}`,
        nameFr,
        nameEn,
        category: catLabel,
        tags: [topic, catLabel],
        format,
        bgType: 'gradient',
        bgColor1: pal[0],
        bgColor2: pal[1],
        bgAngle: (seed * 35) % 360,
        source: 'online-live',
        layers: [
          {
            kind: 'shape',
            id: `pd_shp_${seed}`,
            shape,
            x: Math.round(w / 2),
            y: Math.round(h * 0.24),
            width: Math.round(Math.min(w, h) * 0.16),
            height: Math.round(Math.min(w, h) * 0.16),
            fillColor: pal[2],
            strokeColor: '#ffffff',
            strokeWidth: 0,
            rotation: 0,
            opacity: 0.94,
          },
          {
            kind: 'text',
            id: `pd_hd_${seed}`,
            x: Math.round(w / 2),
            y: Math.round(h * 0.52),
            text: topic.toUpperCase(),
            fontFamily: seed % 2 === 0 ? '"Outfit", sans-serif' : 'Georgia, "Times New Roman", serif',
            fontSize: Math.round(Math.min(w, h) * 0.056),
            color: '#ffffff',
            bold: true,
            italic: false,
            underline: false,
            align: 'center',
            bgColor: pal[0],
            bgEnabled: false,
            shadow: true,
            rotation: 0,
            opacity: 1,
          },
          {
            kind: 'text',
            id: `pd_sub_${seed}`,
            x: Math.round(w / 2),
            y: Math.round(h * 0.78),
            text: 'SHALOM · Méditation & Partage',
            fontFamily: 'Georgia, "Times New Roman", serif',
            fontSize: Math.round(Math.min(w, h) * 0.032),
            color: pal[2],
            bold: false,
            italic: true,
            underline: false,
            align: 'center',
            bgColor: pal[0],
            bgEnabled: false,
            shadow: false,
            rotation: 0,
            opacity: 1,
          },
        ],
      });
    } else if (studioType === 'video') {
      const aspect = PROCEDURAL_VIDEO_ASPECTS[seed % PROCEDURAL_VIDEO_ASPECTS.length];
      const titleFr = `${topic} · Séquence ${seed}`;
      const titleEn = `${topic} · Reel ${seed}`;
      if (excludeSet.has(normalizeText(titleFr))) continue;
      batch.push({
        id: `proc_vid_${page}_${i}_${Date.now()}`,
        titleFr,
        titleEn,
        descFr: `Séquence animée (${aspect}) pour « ${topic} ».`,
        descEn: `Animated sequence (${aspect}) for "${topic}".`,
        category: catLabel,
        tags: [topic, catLabel],
        aspect,
        bgColor: pal[0],
        source: 'online-live',
        scenes: [
          {
            kind: 'custom',
            name: 'Scène 1 · Ouverture',
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
            bgColor: pal[0],
            bgColor2: pal[1],
            shape,
            shapeColor: pal[2],
            text: topic.toUpperCase(),
            textColor: '#ffffff',
            fontSize: 48,
            fontFamily: '"Outfit", sans-serif',
            bold: true,
            italic: false,
            underline: false,
            textAlign: 'center',
          },
          {
            kind: 'custom',
            name: 'Scène 2 · Message',
            durationSec: 5,
            trimStartSec: 0,
            trimEndSec: 5,
            fitMode: 'cover',
            kenBurns: false,
            volume: 1,
            playbackRate: 1,
            transition: 'slide',
            filter: 'none',
            bgType: 'gradient',
            bgColor: pal[1],
            bgColor2: pal[0],
            shape: 'cross',
            shapeColor: pal[2],
            text: 'Que Sa paix repose sur votre maison.',
            textColor: '#ffffff',
            fontSize: 40,
            fontFamily: 'Georgia, "Times New Roman", serif',
            bold: false,
            italic: true,
            underline: false,
            textAlign: 'center',
          },
        ],
        overlays: [
          {
            kind: 'text',
            label: 'Bandeau',
            startSec: 0.4,
            endSec: 8.5,
            xPct: 50,
            yPct: 86,
            size: 24,
            rotationDeg: 0,
            color: pal[2],
            bgBadge: true,
            opacity: 0.95,
            animation: 'slide-up',
            text: 'SHALOM · La foi au quotidien',
            fontFamily: '"Outfit", sans-serif',
            bold: true,
            italic: false,
          },
        ],
      });
    } else {
      const titleFr = `${topic} · Session Audio ${seed}`;
      const titleEn = `${topic} · Audio Session ${seed}`;
      if (excludeSet.has(normalizeText(titleFr))) continue;
      const synths = ['c_major', 'g_warm', 'a_minor', 'soft_bell', 'chime', 'swell'];
      batch.push({
        id: `proc_aud_${page}_${i}_${Date.now()}`,
        titleFr,
        titleEn,
        descFr: `Structure multipiste (${catLabel}) autour de « ${topic} ».`,
        descEn: `Multitrack layout (${catLabel}) for "${topic}".`,
        category: catLabel,
        tags: [topic, catLabel],
        badgeColor: pal[1],
        source: 'online-live',
        tracks: [
          { id: 'track_1', name: 'Piste 1 · Voix principale', color: '#2563eb', volume: 1.05, muted: false, solo: false },
          { id: 'track_2', name: 'Piste 2 · Harmonie / Ambiance', color: '#059669', volume: 0.4, muted: false, solo: false },
          { id: 'track_3', name: 'Piste 3 · Carillon / Repères', color: '#d97706', volume: 0.75, muted: false, solo: false },
        ],
        synthAdditions: [
          { preset: 'chime', duration: 3, trackId: 'track_3', name: 'Intro Sonore', startTimeSec: 0, gain: 0.85 },
          { preset: synths[seed % synths.length], duration: 18, trackId: 'track_2', name: 'Tapis Musical', startTimeSec: 0.8, gain: 0.8 },
        ],
        markers: [
          { id: `pmk_1_${seed}`, timeSec: 0.8, label: 'Ouverture', color: '#3b82f6' },
          { id: `pmk_2_${seed}`, timeSec: 9, label: 'Exhortation', color: '#fbbf24' },
        ],
        scriptFr: `Méditation SHALOM : ${topic}\n1. Temps de calme et de reconnaissance.\n2. Lecture biblique & prière.`,
        scriptEn: `SHALOM Meditation: ${topic}\n1. Quiet gratitude.\n2. Scripture reading & prayer.`,
      });
    }
  }

  return batch;
}

export async function searchOnlineStudioTemplates(params: {
  studioType: StudioKind;
  query?: string;
  category?: string;
  lang?: 'fr' | 'en';
  page?: number;
  excludeTitles?: string[];
}): Promise<{
  templates: Array<OnlineDesignTemplate | OnlineVideoTemplate | OnlineAudioTemplate | Record<string, unknown>>;
  aiEnhanced: boolean;
  page: number;
  hasMore: boolean;
}> {
  const studioType: StudioKind =
    params.studioType === 'video' ||
    params.studioType === 'audio' ||
    params.studioType === 'presentation'
      ? params.studioType
      : 'design';
  const query = (params.query || '').trim();
  const qNorm = normalizeText(query);
  const category = (params.category || '').trim();
  const lang: 'fr' | 'en' = params.lang === 'en' ? 'en' : 'fr';
  const page = Math.max(1, Number(params.page) || 1);
  const excludeTitles = Array.isArray(params.excludeTitles)
    ? params.excludeTitles.filter((t): t is string => typeof t === 'string')
    : [];
  const excludeSet = new Set(excludeTitles.map((t) => normalizeText(t)));

  let catalogMatches: Array<OnlineDesignTemplate | OnlineVideoTemplate | OnlineAudioTemplate | Record<string, unknown>> = [];

  if (page === 1) {
    if (studioType === 'design') {
      catalogMatches = ONLINE_DESIGN_CATALOG.filter(
        (t) =>
          matchesQuery(t, [t.nameFr, t.nameEn], qNorm, category) &&
          !excludeSet.has(normalizeText(t.nameFr))
      );
    } else if (studioType === 'presentation') {
      const presCatalog = ONLINE_DESIGN_CATALOG.map((t) => ({
        ...t,
        id: t.id.replace('onl_des_', 'onl_prs_'),
        format: 'landscape' as const,
        pages: [
          {
            id: `${t.id}_p1`,
            name: lang === 'en' ? 'Slide 1' : 'Diapositive 1',
            transition: 'fade',
            bgType: t.bgType,
            bgColor1: t.bgColor1,
            bgColor2: t.bgColor2,
            bgAngle: t.bgAngle,
            layers: t.layers,
            strokes: [],
          },
          {
            id: `${t.id}_p2`,
            name: lang === 'en' ? 'Slide 2' : 'Diapositive 2',
            transition: 'slide',
            bgType: 'gradient',
            bgColor1: t.bgColor2,
            bgColor2: t.bgColor1,
            bgAngle: 145,
            layers: [
              {
                kind: 'text',
                id: `${t.id}_p2_h`,
                x: 640,
                y: 220,
                text: (lang === 'en' ? t.nameEn : t.nameFr).toUpperCase(),
                fontFamily: '"Outfit", sans-serif',
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
              {
                kind: 'text',
                id: `${t.id}_p2_b`,
                x: 640,
                y: 440,
                text:
                  lang === 'en'
                    ? '1. Opening & Scripture\n2. Key Teaching\n3. Prayer & Application'
                    : '1. Ouverture & Lecture\n2. Enseignement principal\n3. Temps de prière',
                fontFamily: '"Plus Jakarta Sans", sans-serif',
                fontSize: 36,
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
            strokes: [],
          },
        ],
      }));
      catalogMatches = presCatalog.filter(
        (t) =>
          matchesQuery(t, [t.nameFr, t.nameEn], qNorm, category) &&
          !excludeSet.has(normalizeText(t.nameFr))
      );
    } else if (studioType === 'video') {
      catalogMatches = ONLINE_VIDEO_CATALOG.filter(
        (t) =>
          matchesQuery(t, [t.titleFr, t.titleEn, t.descFr, t.descEn], qNorm, category) &&
          !excludeSet.has(normalizeText(t.titleFr))
      );
    } else {
      catalogMatches = ONLINE_AUDIO_CATALOG.filter(
        (t) =>
          matchesQuery(t, [t.titleFr, t.titleEn, t.descFr, t.descEn, t.scriptFr], qNorm, category) &&
          !excludeSet.has(normalizeText(t.titleFr))
      );
    }
  }

  let liveMatches: Array<OnlineDesignTemplate | OnlineVideoTemplate | OnlineAudioTemplate> = [];
  let aiEnhanced = false;

  if ((query.length >= 2 || page > 1) && process.env.GEMINI_API_KEY) {
    try {
      const ai = new GoogleGenAI({
        apiKey: process.env.GEMINI_API_KEY,
        httpOptions: { headers: { 'User-Agent': 'aistudio-build' } },
      });
      if (studioType === 'design') {
        liveMatches = await generateLiveDesignTemplates(ai, query, lang, page, excludeTitles);
      } else if (studioType === 'presentation') {
        const res = await generateLiveDesignTemplates(ai, `${query} presentation 16:9`, lang, page, excludeTitles);
        liveMatches = res.map((r) => ({ ...r, format: 'landscape' as const }));
      } else if (studioType === 'video') {
        liveMatches = await generateLiveVideoTemplates(ai, query, lang, page, excludeTitles);
      } else {
        liveMatches = await generateLiveAudioTemplates(ai, query, lang, page, excludeTitles);
      }
      aiEnhanced = liveMatches.length > 0;
    } catch (err) {
      console.warn('Online live template generation fallback to procedural batch:', err);
    }
  }

  let merged = [...liveMatches, ...catalogMatches];
  if (merged.length < 4) {
    const proc = generateProceduralTemplateBatch(
      studioType === 'presentation' ? 'design' : studioType,
      query,
      category,
      lang,
      page,
      excludeSet
    );
    merged = [
      ...merged,
      ...(studioType === 'presentation'
        ? proc.map((p) => ({ ...p, format: 'landscape' }))
        : proc),
    ];
  }

  return {
    templates: merged,
    aiEnhanced,
    page,
    hasMore: true,
  };
}
