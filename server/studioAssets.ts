import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';
import net from 'node:net';

export type CreativeAssetType = 'elements' | 'images' | 'backgrounds';

export interface OnlineCreativeAsset {
  id: string;
  assetType: CreativeAssetType;
  title: string;
  previewUrl: string;
  fullUrl: string;
  svgMarkup?: string;
  width?: number;
  height?: number;
  source: 'iconify' | 'wikimedia' | 'openverse' | 'gemini-svg' | 'gradient-pack';
  author?: string;
  license?: string;
}

const ENGLISH_HINTS: Record<string, string> = {
  croix: 'cross',
  colombe: 'dove',
  bible: 'bible',
  priere: 'prayer',
  eglise: 'church',
  coeur: 'heart',
  lumiere: 'light',
  ciel: 'sky',
  nuage: 'clouds',
  soleil: 'sunlight',
  fleur: 'flowers',
  fleurs: 'flowers',
  montagne: 'mountain',
  mer: 'ocean',
  foret: 'forest',
  couronne: 'crown',
  etoile: 'star',
  bougie: 'candle',
  musique: 'music',
  chorale: 'choir',
  louange: 'worship',
  mariage: 'wedding',
  anniversaire: 'birthday',
  or: 'gold',
  dore: 'gold',
  marbre: 'marble',
  bois: 'wood',
  abstrait: 'abstract',
  feu: 'fire',
  eau: 'water',
  chemin: 'path',
  famille: 'family',
  main: 'hands',
  paix: 'peace',
  espoir: 'hope',
  ange: 'angel',
  noeud: 'ribbon',
  cadre: 'frame',
  banniere: 'banner',
};

function translateHintForSearch(rawQuery: string): string {
  const clean = rawQuery
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
  if (!clean) return 'faith light';
  const words = clean.split(/\s+/).filter(Boolean);
  const mapped = words.map((w) => ENGLISH_HINTS[w] || w);
  return mapped.join(' ');
}

function isBlockedPrivateHost(hostname: string): boolean {
  const lower = hostname.toLowerCase();
  if (
    lower === 'localhost' ||
    lower === '0.0.0.0' ||
    lower === '::1' ||
    lower.endsWith('.local') ||
    lower.endsWith('.internal')
  ) {
    return true;
  }
  const ipType = net.isIP(lower);
  if (ipType === 4) {
    const parts = lower.split('.').map(Number);
    if (parts[0] === 127 || parts[0] === 10 || parts[0] === 0) return true;
    if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
    if (parts[0] === 192 && parts[1] === 168) return true;
    if (parts[0] === 169 && parts[1] === 254) return true;
  }
  if (ipType === 6) {
    if (lower === '::1' || lower.startsWith('fe80:') || lower.startsWith('fc') || lower.startsWith('fd')) {
      return true;
    }
  }
  return false;
}

export async function proxySafeAssetImage(rawUrl: string): Promise<{
  buffer: Buffer;
  contentType: string;
}> {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error('URL invalide');
  }
  if (parsed.protocol !== 'https:') {
    throw new Error('Seules les URL HTTPS sont autorisées');
  }
  if (isBlockedPrivateHost(parsed.hostname)) {
    throw new Error('Hôte non autorisé');
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 9000);
  try {
    const resp = await fetch(parsed.toString(), {
      signal: controller.signal,
      headers: {
        'User-Agent': 'SHALOM-Studio/1.0 (https://shalom.app)',
        Accept: 'image/webp,image/png,image/jpeg,image/svg+xml,image/*;q=0.8',
      },
    });
    if (!resp.ok) {
      throw new Error(`HTTP ${resp.status}`);
    }
    const contentType = resp.headers.get('content-type') || 'application/octet-stream';
    if (!contentType.toLowerCase().startsWith('image/')) {
      throw new Error('Le fichier distant n’est pas une image valide');
    }
    const contentLength = Number(resp.headers.get('content-length') || 0);
    if (contentLength > 12 * 1024 * 1024) {
      throw new Error('Image trop volumineuse (max 12 Mo)');
    }
    const ab = await resp.arrayBuffer();
    if (ab.byteLength > 12 * 1024 * 1024) {
      throw new Error('Image trop volumineuse (max 12 Mo)');
    }
    return {
      buffer: Buffer.from(ab),
      contentType: contentType.split(';')[0].trim(),
    };
  } finally {
    clearTimeout(timeout);
  }
}

function sanitizeSvgMarkup(rawSvg: string): string | null {
  const trimmed = rawSvg.trim();
  if (!trimmed.toLowerCase().includes('<svg')) return null;
  // Strip any script tags or inline event handlers for strict safety
  const clean = trimmed
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/\son[a-z]+\s*=\s*(".*?"|'.*?'|[^\s>]+)/gi, '');
  return clean;
}

async function fetchIconifyElements(
  query: string,
  page: number
): Promise<OnlineCreativeAsset[]> {
  const searchTerms = translateHintForSearch(query);
  const start = Math.max(0, (page - 1) * 18);
  const url = `https://api.iconify.design/search?query=${encodeURIComponent(
    searchTerms
  )}&limit=18&start=${start}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    const resp = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: 'application/json', 'User-Agent': 'SHALOM-Studio/1.0' },
    });
    if (!resp.ok) return [];
    const data = (await resp.json()) as { icons?: string[] };
    const icons = Array.isArray(data.icons) ? data.icons : [];
    return icons.map((iconName, idx) => {
      const [prefix, name] = iconName.split(':');
      const svgUrl = `https://api.iconify.design/${encodeURIComponent(prefix)}/${encodeURIComponent(
        name
      )}.svg?height=256`;
      return {
        id: `ico_${page}_${idx}_${iconName.replace(/[^a-z0-9]/gi, '_')}`,
        assetType: 'elements',
        title: name.replace(/-/g, ' '),
        previewUrl: svgUrl,
        fullUrl: svgUrl,
        source: 'iconify',
        license: 'Open Source Iconify',
      };
    });
  } catch {
    return [];
  } finally {
    clearTimeout(timeout);
  }
}

async function generateGeminiSvgElements(
  query: string,
  page: number,
  lang: 'fr' | 'en'
): Promise<OnlineCreativeAsset[]> {
  if (!process.env.GEMINI_API_KEY) return [];
  try {
    const ai = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: { headers: { 'User-Agent': 'aistudio-build' } },
    });
    const seedHint = page > 1 ? ` (variation créative lot #${page}, styles variés)` : '';
    const response = await ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: `Crée 4 éléments graphiques SVG vectoriels nets et propres (viewBox="0 0 256 256") correspondant à la recherche : "${
        query || 'spiritual light, cross, dove, ornament'
      }"${seedHint}. Langue : ${lang === 'en' ? 'English' : 'Français'}.`,
      config: {
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        systemInstruction:
          'Tu génères des icônes, autocollants et ornements SVG valides avec viewBox="0 0 256 256", des formes géométriques propres, des couleurs harmonieuses et sans balise script.',
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              svg: { type: Type.STRING },
            },
          },
        },
      },
    });

    const parsed = JSON.parse((response.text ?? '[]').trim()) as Array<{
      title?: string;
      svg?: string;
    }>;
    if (!Array.isArray(parsed)) return [];
    const results: OnlineCreativeAsset[] = [];
    parsed.slice(0, 4).forEach((item, idx) => {
      const clean = item.svg ? sanitizeSvgMarkup(item.svg) : null;
      if (!clean) return;
      const dataUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(clean)}`;
      results.push({
        id: `gem_svg_${page}_${Date.now()}_${idx}`,
        assetType: 'elements',
        title: String(item.title || `Élément ${idx + 1}`),
        previewUrl: dataUrl,
        fullUrl: dataUrl,
        svgMarkup: clean,
        source: 'gemini-svg',
      });
    });
    return results;
  } catch {
    return [];
  }
}

async function fetchWikimediaImages(
  query: string,
  page: number,
  assetType: 'images' | 'backgrounds'
): Promise<OnlineCreativeAsset[]> {
  const baseQuery = translateHintForSearch(query);
  const effectiveQuery =
    assetType === 'backgrounds' && !baseQuery.includes('background') && !baseQuery.includes('texture')
      ? `${baseQuery} sky light texture`
      : baseQuery;
  const offset = Math.max(0, (page - 1) * 12);
  const url = `https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrnamespace=6&gsrsearch=${encodeURIComponent(
    `${effectiveQuery} filetype:bitmap`
  )}&gsrlimit=12&gsroffset=${offset}&prop=imageinfo&iiprop=url|mime|size|extmetadata&iiurlwidth=1080&format=json&origin=*`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5500);
  try {
    const resp = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'SHALOM-Studio/1.0 (https://shalom.app)' },
    });
    if (!resp.ok) return [];
    const data = (await resp.json()) as {
      query?: {
        pages?: Record<
          string,
          {
            pageid: number;
            title: string;
            imageinfo?: Array<{
              url?: string;
              thumburl?: string;
              mime?: string;
              width?: number;
              height?: number;
            }>;
          }
        >;
      };
    };
    const pages = Object.values(data.query?.pages || {});
    const items: OnlineCreativeAsset[] = [];
    for (const p of pages) {
      const info = p.imageinfo?.[0];
      if (!info) continue;
      const mime = (info.mime || '').toLowerCase();
      if (!mime.includes('jpeg') && !mime.includes('png') && !mime.includes('webp')) continue;
      const chosenUrl = info.thumburl || info.url;
      if (!chosenUrl || !chosenUrl.startsWith('https://')) continue;
      const cleanTitle = p.title.replace(/^File:/i, '').replace(/\.[^.]+$/, '').replace(/_/g, ' ');
      items.push({
        id: `wm_${assetType}_${page}_${p.pageid}`,
        assetType,
        title: cleanTitle.slice(0, 60),
        previewUrl: chosenUrl,
        fullUrl: chosenUrl,
        width: info.width,
        height: info.height,
        source: 'wikimedia',
        license: 'Wikimedia Commons',
      });
    }
    return items;
  } catch {
    return [];
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchOpenverseImages(
  query: string,
  page: number,
  assetType: 'images' | 'backgrounds'
): Promise<OnlineCreativeAsset[]> {
  const baseQuery = translateHintForSearch(query);
  const url = `https://api.openverse.org/v1/images/?q=${encodeURIComponent(
    baseQuery
  )}&page=${page}&page_size=12`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5500);
  try {
    const resp = await fetch(url, {
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        'User-Agent': 'SHALOM-Studio/1.0 (https://shalom.app)',
      },
    });
    if (!resp.ok) return [];
    const data = (await resp.json()) as {
      results?: Array<{
        id: string;
        title?: string;
        url?: string;
        thumbnail?: string;
        creator?: string;
        license?: string;
        width?: number;
        height?: number;
      }>;
    };
    const results = Array.isArray(data.results) ? data.results : [];
    return results
      .filter((r) => r.url && r.url.startsWith('https://'))
      .map((r) => ({
        id: `ov_${assetType}_${page}_${r.id}`,
        assetType,
        title: (r.title || baseQuery).slice(0, 60),
        previewUrl: r.thumbnail && r.thumbnail.startsWith('https://') ? r.thumbnail : r.url!,
        fullUrl: r.url!,
        width: r.width,
        height: r.height,
        source: 'openverse',
        author: r.creator,
        license: r.license,
      }));
  } catch {
    return [];
  } finally {
    clearTimeout(timeout);
  }
}

function buildProceduralSvgBackgrounds(query: string, page: number): OnlineCreativeAsset[] {
  const palettes = [
    ['#0b1f42', '#1d4ed8', '#fbbf24', 'Aurore Royale'],
    ['#1e1b4b', '#6d28d9', '#f472b6', 'Louange Céleste'],
    ['#064e3b', '#059669', '#a7f3d0', 'Paix Émeraude'],
    ['#451a03', '#b45309', '#fde68a', 'Lumière Dorée'],
    ['#0f172a', '#334155', '#38bdf8', 'Nuit Étoilée'],
    ['#7c2d12', '#ea580c', '#fed7aa', 'Feu Sacré'],
  ];
  const offset = (page - 1) * 3;
  return [0, 1, 2].map((i) => {
    const [c1, c2, accent, label] = palettes[(offset + i) % palettes.length];
    const title = query ? `${label} · ${query}` : `${label} #${page}`;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1080 1080" width="1080" height="1080">
  <defs>
    <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${c1}"/>
      <stop offset="100%" stop-color="${c2}"/>
    </linearGradient>
    <radialGradient id="r" cx="50%" cy="32%" r="55%">
      <stop offset="0%" stop-color="${accent}" stop-opacity="0.34"/>
      <stop offset="100%" stop-color="${accent}" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="1080" height="1080" fill="url(#g)"/>
  <rect width="1080" height="1080" fill="url(#r)"/>
  <circle cx="${260 + ((i * 190) % 520)}" cy="${220 + ((page * 90) % 300)}" r="240" fill="${accent}" fill-opacity="0.1"/>
  <circle cx="${780 - ((i * 130) % 400)}" cy="820" r="320" fill="#ffffff" fill-opacity="0.06"/>
</svg>`;
    const dataUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
    return {
      id: `bg_svg_${page}_${i}_${Date.now()}`,
      assetType: 'backgrounds',
      title,
      previewUrl: dataUrl,
      fullUrl: dataUrl,
      svgMarkup: svg,
      width: 1080,
      height: 1080,
      source: 'gradient-pack',
    };
  });
}

export async function searchOnlineCreativeAssets(params: {
  assetType: CreativeAssetType;
  query?: string;
  page?: number;
  lang?: 'fr' | 'en';
}): Promise<{
  assets: OnlineCreativeAsset[];
  page: number;
  hasMore: boolean;
}> {
  const assetType: CreativeAssetType =
    params.assetType === 'elements' || params.assetType === 'backgrounds'
      ? params.assetType
      : 'images';
  const query = (params.query || '').trim() || (assetType === 'elements' ? 'faith' : 'sky light');
  const page = Math.max(1, Number(params.page) || 1);
  const lang: 'fr' | 'en' = params.lang === 'en' ? 'en' : 'fr';

  if (assetType === 'elements') {
    const [iconify, geminiSvgs] = await Promise.all([
      fetchIconifyElements(query, page),
      page <= 4 ? generateGeminiSvgElements(query, page, lang) : Promise.resolve([]),
    ]);
    const merged = [...geminiSvgs, ...iconify];
    return {
      assets: merged,
      page,
      hasMore: iconify.length >= 10 || page < 10,
    };
  }

  const [wikimedia, openverse] = await Promise.all([
    fetchWikimediaImages(query, page, assetType),
    fetchOpenverseImages(query, page, assetType),
  ]);

  const seenUrls = new Set<string>();
  const combined: OnlineCreativeAsset[] = [];

  for (const item of [...openverse, ...wikimedia]) {
    if (!seenUrls.has(item.fullUrl)) {
      seenUrls.add(item.fullUrl);
      combined.push(item);
    }
  }

  if (assetType === 'backgrounds') {
    const bgSvgs = buildProceduralSvgBackgrounds(params.query?.trim() || '', page);
    combined.push(...bgSvgs);
  }

  return {
    assets: combined,
    page,
    hasMore: combined.length >= 6 || page < 15,
  };
}
