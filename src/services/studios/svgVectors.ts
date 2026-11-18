// Genuine Multi-Layer Recolorable SVG Vector Catalog & Canvas Renderer for SHALOM Studios
// Zero Unicode emojis or character symbols — pure vector paths scaled cleanly to any canvas/screen DPI.

export type StudioVectorElementKind =
  | 'cross'
  | 'dove'
  | 'bible'
  | 'crown'
  | 'rays'
  | 'heart'
  | 'star'
  | 'rect'
  | 'roundRect'
  | 'circle'
  | 'triangle'
  | 'diamond'
  | 'line'
  | 'arrow'
  | 'ribbon'
  | 'frame'
  | 'oliveBranch'
  | 'chalice'
  | 'candle'
  | 'chapelArch'
  | 'shieldFaith'
  | 'wreath'
  | 'floralCorner'
  | 'musicNote'
  | 'scrollBanner';

export type VectorCategory = 'spirituel' | 'nature' | 'cadres' | 'formes';

export interface SvgVectorPathPart {
  d: string;
  role: 'primary' | 'secondary' | 'stroke';
  fillRule?: 'nonzero' | 'evenodd';
  opacity?: number;
  strokeWidth?: number;
  lineCap?: 'round' | 'butt' | 'square';
  lineJoin?: 'round' | 'miter' | 'bevel';
}

export interface SvgVectorDefinition {
  id: StudioVectorElementKind;
  labelFr: string;
  labelEn: string;
  category: VectorCategory;
  tags: string[];
  defaultPrimary: string;
  defaultSecondary: string;
  paths: SvgVectorPathPart[];
}

export const SVG_VECTOR_CATALOG: SvgVectorDefinition[] = [
  // ================= SPIRITUEL =================
  {
    id: 'cross',
    labelFr: 'Croix Lumineuse',
    labelEn: 'Radiant Cross',
    category: 'spirituel',
    tags: ['croix', 'cross', 'foi', 'jesus', 'eglise', 'paques'],
    defaultPrimary: '#fbbf24',
    defaultSecondary: '#fef3c7',
    paths: [
      {
        // Outer graceful cross with gently flared terminals
        d: 'M41 8 L59 8 L57 31 L84 29 L84 47 L57 45 L59 92 L41 92 L43 45 L16 47 L16 29 L43 31 Z',
        role: 'primary',
      },
      {
        // Inner luminous core accent
        d: 'M46 14 L54 14 L53 35 L78 34 L78 42 L53 41 L54 86 L46 86 L47 41 L22 42 L22 34 L47 35 Z',
        role: 'secondary',
        opacity: 0.45,
      },
    ],
  },
  {
    id: 'dove',
    labelFr: 'Colombe de Paix',
    labelEn: 'Peace Dove',
    category: 'spirituel',
    tags: ['colombe', 'dove', 'paix', 'esprit', 'bapteme', 'oiseau'],
    defaultPrimary: '#ffffff',
    defaultSecondary: '#fbbf24',
    paths: [
      {
        // Graceful soaring dove silhouette with spread upper wing & tail feathers
        d: 'M12 52 C22 44 31 35 37 22 C43 10 55 9 60 22 C54 31 53 39 59 42 C67 43 74 36 81 36 C86 36 90 39 92 42 C88 45 85 45 81 47 C77 56 67 64 54 67 C48 69 40 73 34 83 C26 78 21 71 19 63 C15 62 12 58 12 52 Z',
        role: 'primary',
      },
      {
        // Secondary feathered inner wing contour
        d: 'M24 49 C33 42 40 31 45 20 C48 27 47 37 51 44 C41 49 32 51 24 49 Z',
        role: 'secondary',
        opacity: 0.55,
      },
      {
        // Olive twig held in beak
        d: 'M83 44 C88 47 92 50 96 52 M88 46 C91 44 93 43 95 44 M91 49 C90 52 91 54 93 55',
        role: 'stroke',
        strokeWidth: 2.8,
        lineCap: 'round',
      },
    ],
  },
  {
    id: 'bible',
    labelFr: 'Bible Ouverte',
    labelEn: 'Open Bible',
    category: 'spirituel',
    tags: ['bible', 'livre', 'parole', 'evangile', 'etude', 'book'],
    defaultPrimary: '#fef3c7',
    defaultSecondary: '#d97706',
    paths: [
      {
        // Hardcover backing
        d: 'M8 26 L48 31 L52 31 L92 26 L92 78 L52 83 L48 83 L8 78 Z',
        role: 'secondary',
      },
      {
        // Open arched pages (left + right)
        d: 'M12 22 C26 19 39 22 49 29 L49 76 C38 70 25 69 12 72 Z M88 22 C74 19 61 22 51 29 L51 76 C62 70 75 69 88 72 Z',
        role: 'primary',
      },
      {
        // Text lines + bookmark ribbon + spine lines
        d: 'M19 36 L41 39 M19 45 L41 48 M19 54 L37 56 M59 39 L81 36 M59 48 L81 45 M59 56 L77 54',
        role: 'stroke',
        strokeWidth: 2.5,
        lineCap: 'round',
      },
      {
        // Golden bookmark ribbon descending from spine
        d: 'M48 73 L53 73 L53 91 L50.5 87 L48 91 Z',
        role: 'secondary',
      },
    ],
  },
  {
    id: 'crown',
    labelFr: 'Couronne Royale',
    labelEn: 'Royal Crown',
    category: 'spirituel',
    tags: ['couronne', 'crown', 'roi', 'gloire', 'majeste'],
    defaultPrimary: '#fbbf24',
    defaultSecondary: '#fef3c7',
    paths: [
      {
        d: 'M12 72 L8 32 L30 50 L50 22 L70 50 L92 32 L88 72 Z',
        role: 'primary',
      },
      {
        d: 'M12 76 L88 76 L86 84 L14 84 Z M50 14 A5 5 0 1 0 50 24 A5 5 0 1 0 50 14 Z M8 24 A4 4 0 1 0 8 32 A4 4 0 1 0 8 24 Z M92 24 A4 4 0 1 0 92 32 A4 4 0 1 0 92 24 Z',
        role: 'secondary',
      },
    ],
  },
  {
    id: 'rays',
    labelFr: 'Rayons de Lumière',
    labelEn: 'Light Rays',
    category: 'spirituel',
    tags: ['lumiere', 'soleil', 'gloire', 'grace', 'rays', 'light'],
    defaultPrimary: '#fde68a',
    defaultSecondary: '#ffffff',
    paths: [
      {
        d: 'M50 4 L55 34 L73 10 L62 37 L90 27 L67 45 L96 50 L67 55 L90 73 L62 63 L73 90 L55 66 L50 96 L45 66 L27 90 L38 63 L10 73 L33 55 L4 50 L33 45 L10 27 L38 37 L27 10 L45 34 Z',
        role: 'primary',
      },
      {
        d: 'M50 36 A14 14 0 1 0 50 64 A14 14 0 1 0 50 36 Z',
        role: 'secondary',
        opacity: 0.75,
      },
    ],
  },
  {
    id: 'chalice',
    labelFr: 'Calice & Pain',
    labelEn: 'Chalice & Bread',
    category: 'spirituel',
    tags: ['calice', 'sainte cene', 'communion', 'eglise', 'chalice'],
    defaultPrimary: '#fbbf24',
    defaultSecondary: '#fef3c7',
    paths: [
      {
        // Cup & stem & foot
        d: 'M24 24 L76 24 C74 49 63 58 54 60 L54 78 L72 86 L72 91 L28 91 L28 86 L46 78 L46 60 C37 58 26 49 24 24 Z',
        role: 'primary',
      },
      {
        // Host circle above chalice
        d: 'M50 7 A9 9 0 1 0 50 25 A9 9 0 1 0 50 7 Z',
        role: 'secondary',
      },
      {
        d: 'M50 11 L50 21 M46 15 L54 15',
        role: 'stroke',
        strokeWidth: 2,
        lineCap: 'round',
      },
    ],
  },
  {
    id: 'candle',
    labelFr: 'Bougie de Prière',
    labelEn: 'Prayer Candle',
    category: 'spirituel',
    tags: ['bougie', 'priere', 'veille', 'lumiere', 'candle'],
    defaultPrimary: '#fef3c7',
    defaultSecondary: '#f59e0b',
    paths: [
      {
        // Glowing outer flame
        d: 'M50 8 C60 20 63 30 50 37 C37 30 40 20 50 8 Z',
        role: 'secondary',
      },
      {
        // Wax body & candle holder base
        d: 'M36 42 L64 42 L64 84 L36 84 Z M26 84 L74 84 L70 92 L30 92 Z',
        role: 'primary',
      },
      {
        // Wick & wax drip accent
        d: 'M50 37 L50 42',
        role: 'stroke',
        strokeWidth: 2.5,
        lineCap: 'round',
      },
    ],
  },
  {
    id: 'chapelArch',
    labelFr: 'Arche Sanctuaire',
    labelEn: 'Sanctuary Arch',
    category: 'spirituel',
    tags: ['eglise', 'chapelle', 'arche', 'sanctuaire', 'church'],
    defaultPrimary: '#1e3a8a',
    defaultSecondary: '#fbbf24',
    paths: [
      {
        d: 'M18 90 L18 46 C18 22 33 10 50 10 C67 10 82 22 82 46 L82 90 L70 90 L70 46 C70 29 61 21 50 21 C39 21 30 29 30 46 L30 90 Z',
        role: 'primary',
      },
      {
        d: 'M46 32 L54 32 L54 44 L65 44 L65 52 L54 52 L54 78 L46 78 L46 52 L35 52 L35 44 L46 44 Z',
        role: 'secondary',
      },
    ],
  },
  {
    id: 'shieldFaith',
    labelFr: 'Bouclier de la Foi',
    labelEn: 'Shield of Faith',
    category: 'spirituel',
    tags: ['bouclier', 'foi', 'protection', 'psaume', 'shield'],
    defaultPrimary: '#1d4ed8',
    defaultSecondary: '#fbbf24',
    paths: [
      {
        d: 'M50 9 L85 20 L85 48 C85 70 69 85 50 92 C31 85 15 70 15 48 L15 20 Z',
        role: 'primary',
      },
      {
        d: 'M46 24 L54 24 L54 41 L70 41 L70 49 L54 49 L54 75 L46 75 L46 49 L30 49 L30 41 L46 41 Z',
        role: 'secondary',
      },
    ],
  },
  {
    id: 'musicNote',
    labelFr: 'Note de Louange',
    labelEn: 'Worship Note',
    category: 'spirituel',
    tags: ['musique', 'louange', 'chant', 'chorale', 'worship', 'music'],
    defaultPrimary: '#fbbf24',
    defaultSecondary: '#ffffff',
    paths: [
      {
        d: 'M37 22 L80 12 L80 65 C80 73 73 79 65 79 C57 79 52 74 52 67 C52 60 58 55 66 55 C69 55 71 56 73 57 L73 28 L44 35 L44 73 C44 81 37 87 29 87 C21 87 16 82 16 75 C16 68 22 63 30 63 C33 63 35 64 37 65 Z',
        role: 'primary',
      },
      {
        d: 'M44 26 L73 19 L73 25 L44 32 Z',
        role: 'secondary',
        opacity: 0.65,
      },
    ],
  },

  // ================= NATURE =================
  {
    id: 'oliveBranch',
    labelFr: 'Rameau d’Olivier',
    labelEn: 'Olive Branch',
    category: 'nature',
    tags: ['olivier', 'rameau', 'paix', 'fleur', 'feuille', 'nature', 'branch'],
    defaultPrimary: '#10b981',
    defaultSecondary: '#fde68a',
    paths: [
      {
        d: 'M18 82 C36 64 56 44 82 18',
        role: 'stroke',
        strokeWidth: 4,
        lineCap: 'round',
      },
      {
        d: 'M32 66 C20 60 18 46 28 42 C36 48 36 58 32 66 Z M48 50 C36 44 34 30 44 26 C52 32 52 42 48 50 Z M66 34 C56 26 56 14 66 12 C73 19 72 28 66 34 Z M42 62 C52 68 64 66 64 56 C56 50 48 54 42 62 Z M58 46 C68 52 80 50 80 40 C72 34 64 38 58 46 Z',
        role: 'primary',
      },
      {
        d: 'M44 58 A4 4 0 1 0 44 66 A4 4 0 1 0 44 58 Z M62 40 A4 4 0 1 0 62 48 A4 4 0 1 0 62 40 Z',
        role: 'secondary',
      },
    ],
  },
  {
    id: 'wreath',
    labelFr: 'Couronne de Feuillage',
    labelEn: 'Botanical Wreath',
    category: 'nature',
    tags: ['couronne', 'fleur', 'feuille', 'mariage', 'nature', 'wreath'],
    defaultPrimary: '#10b981',
    defaultSecondary: '#fbbf24',
    paths: [
      {
        d: 'M24 72 C14 55 18 32 34 20 M76 72 C86 55 82 32 66 20 M28 76 C38 86 62 86 72 76',
        role: 'stroke',
        strokeWidth: 3.2,
        lineCap: 'round',
      },
      {
        d: 'M18 52 C10 46 11 36 20 35 C25 41 23 48 18 52 Z M23 33 C18 24 23 15 31 19 C33 26 29 32 23 33 Z M82 52 C90 46 89 36 80 35 C75 41 77 48 82 52 Z M77 33 C82 24 77 15 69 19 C67 26 71 32 77 33 Z M24 68 C16 68 15 58 22 55 C27 59 27 65 24 68 Z M76 68 C84 68 85 58 78 55 C73 59 73 65 76 68 Z',
        role: 'primary',
      },
      {
        d: 'M50 76 L53 81 L58 82 L54 85 L55 90 L50 87 L45 90 L46 85 L42 82 L47 81 Z',
        role: 'secondary',
      },
    ],
  },
  {
    id: 'heart',
    labelFr: 'Cœur d’Amour',
    labelEn: 'Grace Heart',
    category: 'nature',
    tags: ['coeur', 'amour', 'mariage', 'grace', 'heart'],
    defaultPrimary: '#e11d48',
    defaultSecondary: '#fecdd3',
    paths: [
      {
        d: 'M50 86 C26 71 10 54 10 34 C10 20 21 10 34 10 C42 10 47 14 50 20 C53 14 58 10 66 10 C79 10 90 20 90 34 C90 54 74 71 50 86 Z',
        role: 'primary',
      },
      {
        d: 'M24 27 C24 20 30 16 36 16',
        role: 'stroke',
        strokeWidth: 4,
        lineCap: 'round',
      },
    ],
  },
  {
    id: 'star',
    labelFr: 'Étoile de Bethléem',
    labelEn: 'Star of Bethlehem',
    category: 'nature',
    tags: ['etoile', 'noel', 'nuit', 'lumiere', 'star'],
    defaultPrimary: '#fbbf24',
    defaultSecondary: '#fef3c7',
    paths: [
      {
        d: 'M50 6 L61 36 L93 38 L68 58 L77 90 L50 72 L23 90 L32 58 L7 38 L39 36 Z',
        role: 'primary',
      },
      {
        d: 'M50 24 L56 41 L74 42 L60 54 L65 72 L50 62 L35 72 L40 54 L26 42 L44 41 Z',
        role: 'secondary',
        opacity: 0.45,
      },
    ],
  },

  // ================= CADRES & ORNEMENTS =================
  {
    id: 'frame',
    labelFr: 'Cadre Double Royal',
    labelEn: 'Royal Double Frame',
    category: 'cadres',
    tags: ['cadre', 'bordure', 'invitation', 'frame', 'border'],
    defaultPrimary: '#fbbf24',
    defaultSecondary: '#ffffff',
    paths: [
      {
        d: 'M6 6 L94 6 L94 94 L6 94 Z M13 13 L13 87 L87 87 L87 13 Z',
        role: 'primary',
        fillRule: 'evenodd',
      },
      {
        d: 'M18 18 L82 18 L82 82 L18 82 Z',
        role: 'stroke',
        strokeWidth: 1.6,
      },
    ],
  },
  {
    id: 'floralCorner',
    labelFr: 'Ornement d’Angle',
    labelEn: 'Corner Flourish',
    category: 'cadres',
    tags: ['angle', 'ornement', 'fleur', 'cadre', 'corner', 'mariage'],
    defaultPrimary: '#fbbf24',
    defaultSecondary: '#fde68a',
    paths: [
      {
        d: 'M12 88 L12 20 C12 15 15 12 20 12 L88 12',
        role: 'stroke',
        strokeWidth: 4.5,
        lineCap: 'round',
      },
      {
        d: 'M24 24 C36 24 44 16 44 12 L24 12 L12 24 L12 44 C16 44 24 36 24 24 Z',
        role: 'primary',
      },
      {
        d: 'M32 32 A6 6 0 1 0 32 44 A6 6 0 1 0 32 32 Z',
        role: 'secondary',
      },
    ],
  },
  {
    id: 'ribbon',
    labelFr: 'Ruban Bannière',
    labelEn: 'Banner Ribbon',
    category: 'cadres',
    tags: ['ruban', 'banniere', 'badge', 'etiquette', 'ribbon'],
    defaultPrimary: '#fbbf24',
    defaultSecondary: '#d97706',
    paths: [
      {
        d: 'M6 26 L94 26 L84 50 L94 74 L6 74 L16 50 Z',
        role: 'primary',
      },
      {
        d: 'M14 33 L86 33 M14 67 L86 67',
        role: 'stroke',
        strokeWidth: 1.8,
        lineCap: 'round',
      },
    ],
  },
  {
    id: 'scrollBanner',
    labelFr: 'Bannière Parchemin',
    labelEn: 'Scroll Banner',
    category: 'cadres',
    tags: ['parchemin', 'ruban', 'titre', 'banniere', 'scroll'],
    defaultPrimary: '#fef3c7',
    defaultSecondary: '#b45309',
    paths: [
      {
        d: 'M20 22 L80 22 L80 68 L20 68 Z',
        role: 'primary',
      },
      {
        d: 'M6 34 L20 34 L20 76 L6 76 L13 55 Z M80 34 L94 34 L87 55 L94 76 L80 76 Z',
        role: 'secondary',
      },
    ],
  },

  // ================= FORMES =================
  {
    id: 'rect',
    labelFr: 'Rectangle',
    labelEn: 'Rectangle',
    category: 'formes',
    tags: ['rectangle', 'bloc', 'fond', 'forme'],
    defaultPrimary: '#1d4ed8',
    defaultSecondary: '#ffffff',
    paths: [{ d: 'M8 14 L92 14 L92 86 L8 86 Z', role: 'primary' }],
  },
  {
    id: 'roundRect',
    labelFr: 'Carte Arrondie',
    labelEn: 'Rounded Card',
    category: 'formes',
    tags: ['carte', 'arrondi', 'badge', 'forme'],
    defaultPrimary: '#0f766e',
    defaultSecondary: '#ffffff',
    paths: [
      {
        d: 'M22 14 L78 14 Q88 14 88 24 L88 76 Q88 86 78 86 L22 86 Q12 86 12 76 L12 24 Q12 14 22 14 Z',
        role: 'primary',
      },
    ],
  },
  {
    id: 'circle',
    labelFr: 'Cercle',
    labelEn: 'Circle',
    category: 'formes',
    tags: ['cercle', 'rond', 'badge', 'halo'],
    defaultPrimary: '#fbbf24',
    defaultSecondary: '#ffffff',
    paths: [{ d: 'M50 8 A42 42 0 1 0 50 92 A42 42 0 1 0 50 8 Z', role: 'primary' }],
  },
  {
    id: 'triangle',
    labelFr: 'Triangle',
    labelEn: 'Triangle',
    category: 'formes',
    tags: ['triangle', 'trinite', 'forme'],
    defaultPrimary: '#7c3aed',
    defaultSecondary: '#ffffff',
    paths: [{ d: 'M50 10 L92 86 L8 86 Z', role: 'primary' }],
  },
  {
    id: 'diamond',
    labelFr: 'Losange',
    labelEn: 'Diamond',
    category: 'formes',
    tags: ['losange', 'diamond', 'forme'],
    defaultPrimary: '#0ea5e9',
    defaultSecondary: '#ffffff',
    paths: [{ d: 'M50 6 L94 50 L50 94 L6 50 Z', role: 'primary' }],
  },
  {
    id: 'arrow',
    labelFr: 'Flèche',
    labelEn: 'Arrow',
    category: 'formes',
    tags: ['fleche', 'direction', 'arrow'],
    defaultPrimary: '#f59e0b',
    defaultSecondary: '#ffffff',
    paths: [{ d: 'M8 36 L58 36 L58 18 L94 50 L58 82 L58 64 L8 64 Z', role: 'primary' }],
  },
  {
    id: 'line',
    labelFr: 'Ligne Séparateur',
    labelEn: 'Divider Line',
    category: 'formes',
    tags: ['ligne', 'trait', 'separateur', 'line'],
    defaultPrimary: '#fbbf24',
    defaultSecondary: '#fbbf24',
    paths: [
      {
        d: 'M6 50 L94 50',
        role: 'stroke',
        strokeWidth: 7,
        lineCap: 'round',
      },
    ],
  },
];

export function getSvgVectorDef(kind: string): SvgVectorDefinition {
  const found = SVG_VECTOR_CATALOG.find((item) => item.id === kind);
  return found || SVG_VECTOR_CATALOG[0];
}

export function buildSvgVectorMarkup(
  kind: StudioVectorElementKind,
  primaryColor: string,
  secondaryColor?: string,
  strokeColor?: string,
  strokeWidth = 0
): string {
  const def = getSvgVectorDef(kind);
  const sec = secondaryColor || def.defaultSecondary;
  const strk = strokeColor || sec || primaryColor;

  const elements = def.paths
    .map((p) => {
      const opacityAttr = p.opacity !== undefined ? ` opacity="${p.opacity}"` : '';
      const fillRuleAttr = p.fillRule ? ` fill-rule="${p.fillRule}"` : '';
      if (p.role === 'stroke') {
        const sw = p.strokeWidth ?? 3;
        return `<path d="${p.d}" fill="none" stroke="${
          kind === 'line' ? primaryColor : strk
        }" stroke-width="${sw}" stroke-linecap="${p.lineCap || 'round'}" stroke-linejoin="${
          p.lineJoin || 'round'
        }"${opacityAttr}/>`;
      }
      const fill = p.role === 'primary' ? primaryColor : sec;
      const outlineAttr =
        strokeWidth > 0 && p.role === 'primary'
          ? ` stroke="${strk}" stroke-width="${Math.max(1, strokeWidth * 0.6)}" stroke-linejoin="round"`
          : '';
      return `<path d="${p.d}" fill="${fill}"${fillRuleAttr}${outlineAttr}${opacityAttr}/>`;
    })
    .join('');

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" preserveAspectRatio="none">${elements}</svg>`;
}

export function recolorArbitrarySvgMarkup(
  svgMarkup: string,
  fillColor: string,
  strokeColor?: string
): string {
  if (!svgMarkup || typeof svgMarkup !== 'string') return '';
  let out = svgMarkup
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/\son[a-z]+\s*=\s*(".*?"|'.*?'|[^\s>]+)/gi, '');

  // Replace currentColor and explicit monochrome hex/named fills inside vector icon markup
  out = out.replace(/fill\s*=\s*["']currentColor["']/gi, `fill="${fillColor}"`);
  if (strokeColor) {
    out = out.replace(/stroke\s*=\s*["']currentColor["']/gi, `stroke="${strokeColor}"`);
  } else {
    out = out.replace(/stroke\s*=\s*["']currentColor["']/gi, `stroke="${fillColor}"`);
  }

  // If the SVG uses fill="#000" / fill="#000000" / fill="black" or omits fill altogether, inject root fill
  out = out.replace(/fill\s*=\s*["'](?:#000000|#000|black|rgb\(0,\s*0,\s*0\))["']/gi, `fill="${fillColor}"`);
  if (!/fill\s*=/i.test(out)) {
    out = out.replace(/<svg\b/i, `<svg fill="${fillColor}"`);
  }
  return out;
}

export function renderSvgVectorToCanvas(
  ctx: CanvasRenderingContext2D,
  kind: StudioVectorElementKind,
  width: number,
  height: number,
  primaryColor: string,
  secondaryColor?: string,
  strokeColor?: string,
  strokeWidth = 0
): void {
  const def = getSvgVectorDef(kind);
  const sec = secondaryColor || def.defaultSecondary;
  const strk = strokeColor || sec || primaryColor;

  if (typeof Path2D === 'undefined') return;

  ctx.save();
  ctx.translate(-width / 2, -height / 2);
  ctx.scale(width / 100, height / 100);

  for (const part of def.paths) {
    const path = new Path2D(part.d);
    const prevAlpha = ctx.globalAlpha;
    if (part.opacity !== undefined) {
      ctx.globalAlpha = prevAlpha * part.opacity;
    }

    if (part.role === 'stroke') {
      ctx.strokeStyle = kind === 'line' ? primaryColor : strk;
      ctx.lineWidth = part.strokeWidth ?? 3;
      ctx.lineCap = part.lineCap || 'round';
      ctx.lineJoin = part.lineJoin || 'round';
      ctx.stroke(path);
    } else {
      const fill = part.role === 'primary' ? primaryColor : sec;
      if (fill !== 'transparent') {
        ctx.fillStyle = fill;
        ctx.fill(path, part.fillRule || 'nonzero');
      }
      if (strokeWidth > 0 && part.role === 'primary') {
        ctx.strokeStyle = strk;
        ctx.lineWidth = Math.max(1, (strokeWidth / Math.max(1, Math.min(width, height))) * 100);
        ctx.lineJoin = 'round';
        ctx.stroke(path);
      }
    }

    ctx.globalAlpha = prevAlpha;
  }

  ctx.restore();
}
