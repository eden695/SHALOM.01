// Client-first CORS-enabled Online Search Engine for SHALOM Studios (Design, Audio, Video)
// Works seamlessly on Android APK (WebView/Website2APK), GitHub Pages static hosting, and Express server.

export type StudioKind = 'design' | 'presentation' | 'video' | 'audio';
export type CreativeAssetType = 'elements' | 'images' | 'backgrounds';

export interface OnlineCreativeAsset {
  id: string;
  assetType: CreativeAssetType;
  title: string;
  previewUrl: string;
  fullUrl: string;
  mimeType?: string;
  isBitmap?: boolean;
  width?: number;
  height?: number;
  source: 'wikimedia' | 'openverse';
  author?: string;
  license?: string;
}

export interface OnlineMediaTrackResult {
  id: string;
  kind: 'audio' | 'video' | 'image';
  title: string;
  streamUrl: string;
  previewUrl?: string;
  mimeType: string;
  durationSec?: number;
  author?: string;
  license?: string;
  source: 'wikimedia' | 'internet-archive';
}

const FR_EN_SEARCH_MAP: Record<string, string> = {
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
  adoration: 'worship',
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
  mains: 'hands',
  paix: 'peace',
  espoir: 'hope',
  ange: 'angel',
  noeud: 'ribbon',
  cadre: 'frame',
  banniere: 'banner',
  noel: 'christmas',
  paques: 'easter',
  jeunesse: 'youth',
  jeune: 'fasting',
  psaume: 'psalm',
  grace: 'grace',
  piano: 'piano',
  violon: 'violin',
  harpe: 'harp',
  cloche: 'bell',
  cantique: 'hymn',
  hymne: 'hymn',
  pluie: 'rain',
  oiseau: 'bird',
  nature: 'nature',
  aurore: 'sunrise',
  coucher: 'sunset',
  nuit: 'night stars',
};

export function translateQueryForGlobalSearch(rawQuery: string, fallback = 'faith light'): string {
  const clean = (rawQuery || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
  if (!clean) return fallback;
  const words = clean.split(/\s+/).filter(Boolean);
  return words.map((w) => FR_EN_SEARCH_MAP[w] || w).join(' ');
}

function canAttemptExpressApi(): boolean {
  if (typeof window === 'undefined') return false;
  const { protocol, hostname } = window.location;
  if (protocol === 'file:' || protocol === 'content:') return false;
  if (hostname.endsWith('.github.io')) return false;
  return protocol === 'http:' || protocol === 'https:';
}

async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeoutMs = 10000
): Promise<Response> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
    });
  } finally {
    window.clearTimeout(timer);
  }
}

async function postJsonIfExpressAvailable<T>(
  endpoint: string,
  payload: unknown,
  timeoutMs = 5000
): Promise<T | null> {
  if (!canAttemptExpressApi()) return null;
  try {
    const resp = await fetchWithTimeout(
      endpoint,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      },
      timeoutMs
    );
    const contentType = (resp.headers.get('content-type') || '').toLowerCase();
    if (!resp.ok || !contentType.includes('application/json')) return null;
    return (await resp.json()) as T;
  } catch {
    return null;
  }
}

function isStrictBitmapUrlAndMime(url: string, mime?: string): boolean {
  const lowerUrl = (url || '').toLowerCase();
  if (!lowerUrl || lowerUrl.includes('.svg') || lowerUrl.startsWith('data:image/svg')) return false;
  if (!mime) return true;
  const lowerMime = mime.toLowerCase();
  if (lowerMime.includes('svg')) return false;
  return (
    lowerMime.includes('png') ||
    lowerMime.includes('jpeg') ||
    lowerMime.includes('jpg') ||
    lowerMime.includes('webp')
  );
}

async function fetchWikimediaImagesDirect(
  query: string,
  page: number,
  assetType: CreativeAssetType
): Promise<OnlineCreativeAsset[]> {
  const baseQuery = translateQueryForGlobalSearch(
    query,
    assetType === 'elements'
      ? 'dove light cross'
      : assetType === 'backgrounds'
        ? 'sky light clouds'
        : 'nature church bible'
  );
  const effectiveQuery =
    assetType === 'elements'
      ? `${baseQuery} png filetype:bitmap`
      : assetType === 'backgrounds' && !baseQuery.includes('background') && !baseQuery.includes('texture')
        ? `${baseQuery} sky light filetype:bitmap`
        : `${baseQuery} filetype:bitmap`;
  const offset = Math.max(0, (page - 1) * 14);
  const url = `https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrnamespace=6&gsrsearch=${encodeURIComponent(
    effectiveQuery
  )}&gsrlimit=14&gsroffset=${offset}&prop=imageinfo&iiprop=url|mime|size|extmetadata&iiurlwidth=1080&format=json&origin=*`;

  const resp = await fetchWithTimeout(url, { mode: 'cors' }, 10000);
  if (!resp.ok) {
    throw new Error(`Wikimedia HTTP ${resp.status}`);
  }
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
            extmetadata?: {
              Artist?: { value?: string };
              LicenseShortName?: { value?: string };
            };
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
    const chosenUrl = info.thumburl || info.url;
    if (!chosenUrl || !chosenUrl.startsWith('https://')) continue;
    if (!isStrictBitmapUrlAndMime(chosenUrl, mime)) continue;

    const cleanTitle = p.title.replace(/^File:/i, '').replace(/\.[^.]+$/, '').replace(/_/g, ' ');
    const rawArtist = info.extmetadata?.Artist?.value?.replace(/<[^>]+>/g, '').trim();
    const rawLicense = info.extmetadata?.LicenseShortName?.value?.replace(/<[^>]+>/g, '').trim();

    items.push({
      id: `wm_${assetType}_${page}_${p.pageid}`,
      assetType,
      title: cleanTitle.slice(0, 64),
      previewUrl: chosenUrl,
      fullUrl:
        info.url && info.url.startsWith('https://') && isStrictBitmapUrlAndMime(info.url, mime)
          ? info.url
          : chosenUrl,
      mimeType: mime || 'image/png',
      isBitmap: true,
      width: info.width,
      height: info.height,
      source: 'wikimedia',
      author: rawArtist ? rawArtist.slice(0, 48) : undefined,
      license: rawLicense || 'Wikimedia Commons',
    });
  }
  return items;
}

async function fetchOpenverseImagesDirect(
  query: string,
  page: number,
  assetType: CreativeAssetType
): Promise<OnlineCreativeAsset[]> {
  const baseQuery = translateQueryForGlobalSearch(
    query,
    assetType === 'elements' ? 'dove cross illustration' : 'sunrise nature peace'
  );
  const extra = assetType === 'elements' ? '&extension=png' : '';
  const url = `https://api.openverse.org/v1/images/?q=${encodeURIComponent(
    baseQuery
  )}&page=${page}&page_size=14${extra}`;
  const resp = await fetchWithTimeout(
    url,
    { mode: 'cors', headers: { Accept: 'application/json' } },
    9000
  );
  if (!resp.ok) {
    throw new Error(`Openverse HTTP ${resp.status}`);
  }
  const data = (await resp.json()) as {
    results?: Array<{
      id: string;
      title?: string;
      url?: string;
      thumbnail?: string;
      creator?: string;
      license?: string;
      filetype?: string;
      width?: number;
      height?: number;
    }>;
  };
  const results = Array.isArray(data.results) ? data.results : [];
  return results
    .filter((r) => {
      if (!r.url || !r.url.startsWith('https://')) return false;
      const ft = (r.filetype || '').toLowerCase();
      if (ft.includes('svg')) return false;
      return isStrictBitmapUrlAndMime(r.url);
    })
    .map((r) => {
      const lower = (r.url || '').toLowerCase();
      const ft = (r.filetype || '').toLowerCase();
      const mime =
        ft === 'png' || lower.includes('.png')
          ? 'image/png'
          : ft === 'webp' || lower.includes('.webp')
            ? 'image/webp'
            : 'image/jpeg';
      return {
        id: `ov_${assetType}_${page}_${r.id}`,
        assetType,
        title: (r.title || baseQuery).slice(0, 64),
        previewUrl:
          r.thumbnail &&
          r.thumbnail.startsWith('https://') &&
          !r.thumbnail.toLowerCase().includes('.svg')
            ? r.thumbnail
            : r.url!,
        fullUrl: r.url!,
        mimeType: mime,
        isBitmap: true,
        width: r.width,
        height: r.height,
        source: 'openverse' as const,
        author: r.creator,
        license: r.license,
      };
    });
}

export async function searchOnlineAssetsClient(params: {
  assetType: CreativeAssetType;
  query: string;
  page?: number;
  lang?: 'fr' | 'en';
}): Promise<{
  assets: OnlineCreativeAsset[];
  page: number;
  hasMore: boolean;
  networkError?: string;
}> {
  const assetType = params.assetType;
  const query = (params.query || '').trim();
  const page = Math.max(1, Number(params.page) || 1);
  const lang = params.lang === 'en' ? 'en' : 'fr';

  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return {
      assets: [],
      page,
      hasMore: false,
      networkError:
        lang === 'en'
          ? 'No Internet connection detected. Connect to Wi-Fi or mobile data to search online.'
          : 'Aucune connexion Internet détectée. Activez le Wi-Fi ou les données mobiles pour rechercher en ligne.',
    };
  }

  // Optional local Express server API first (if running full-stack server.ts)
  const serverRes = await postJsonIfExpressAvailable<{
    ok?: boolean;
    assets?: OnlineCreativeAsset[];
    hasMore?: boolean;
  }>('/api/studios/assets/search', { assetType, query, page, lang }, 4500);

  if (serverRes?.ok && Array.isArray(serverRes.assets) && serverRes.assets.length > 0) {
    const cleanServerAssets = serverRes.assets.filter((item) =>
      isStrictBitmapUrlAndMime(item.fullUrl, item.mimeType)
    );
    if (cleanServerAssets.length > 0) {
      return {
        assets: cleanServerAssets,
        page,
        hasMore: Boolean(serverRes.hasMore),
      };
    }
  }

  const settled = await Promise.allSettled([
    fetchWikimediaImagesDirect(query, page, assetType),
    fetchOpenverseImagesDirect(query, page, assetType),
  ]);

  const seen = new Set<string>();
  const combined: OnlineCreativeAsset[] = [];
  let anySucceeded = false;
  let lastError = '';

  for (const res of settled) {
    if (res.status === 'fulfilled') {
      anySucceeded = true;
      for (const item of res.value) {
        if (!isStrictBitmapUrlAndMime(item.fullUrl, item.mimeType)) continue;
        if (!seen.has(item.fullUrl)) {
          seen.add(item.fullUrl);
          combined.push(item);
        }
      }
    } else {
      lastError = res.reason instanceof Error ? res.reason.message : 'Erreur réseau';
    }
  }

  if (assetType === 'elements') {
    combined.sort((a, b) => {
      const aPng = (a.mimeType || '').includes('png') ? 0 : 1;
      const bPng = (b.mimeType || '').includes('png') ? 0 : 1;
      return aPng - bPng;
    });
  }

  if (!anySucceeded && combined.length === 0) {
    return {
      assets: [],
      page,
      hasMore: false,
      networkError:
        lang === 'en'
          ? `Unable to reach online libraries (${lastError || 'network error'}).`
          : `Impossible de joindre les bibliothèques en ligne (${lastError || 'erreur réseau'}). Vérifiez votre accès Internet.`,
    };
  }

  return {
    assets: combined,
    page,
    hasMore: combined.length >= 6 || page < 15,
  };
}

export async function fetchOnlineAssetBlobClient(asset: OnlineCreativeAsset): Promise<Blob> {
  if (!isStrictBitmapUrlAndMime(asset.fullUrl, asset.mimeType)) {
    throw new Error('Seules les images et illustrations matricielles (PNG/JPG/WebP) sont acceptées.');
  }
  if (asset.fullUrl.startsWith('data:')) {
    const resp = await fetch(asset.fullUrl);
    if (!resp.ok) throw new Error('Data asset fetch error');
    return await resp.blob();
  }

  // 1. Direct CORS fetch (Wikimedia Commons / Openverse)
  try {
    const resp = await fetchWithTimeout(asset.fullUrl, { mode: 'cors' }, 11000);
    if (resp.ok) {
      const contentType = (resp.headers.get('content-type') || '').toLowerCase();
      if (contentType.includes('svg')) {
        throw new Error('Les fichiers SVG sont désactivés pour les éléments.');
      }
      const blob = await resp.blob();
      if (blob.size > 0) return blob;
    }
  } catch {
    // Fall through to Express proxy if present
  }

  // 2. Fallback proxy if running with Express server
  if (canAttemptExpressApi()) {
    const resp = await fetchWithTimeout(
      `/api/studios/assets/image-proxy?url=${encodeURIComponent(asset.fullUrl)}`,
      {},
      10000
    );
    if (resp.ok) {
      const blob = await resp.blob();
      if (blob.size > 0) return blob;
    }
  }

  throw new Error(
    'Ce serveur d’images bloque le téléchargement direct (CORS). Essayez une autre image Wikimedia ou Iconify.'
  );
}

export async function fetchOnlineMediaBlobClient(
  url: string,
  kind: 'audio' | 'video' | 'image'
): Promise<Blob> {
  const cleanUrl = (url || '').trim();
  if (!cleanUrl) throw new Error('URL média invalide.');

  try {
    const resp = await fetchWithTimeout(cleanUrl, { mode: 'cors' }, 14000);
    if (resp.ok) {
      const blob = await resp.blob();
      if (blob && blob.size > 0) return blob;
    }
  } catch {
    // Fall through to Express proxy if available
  }

  if (canAttemptExpressApi()) {
    const endpoint =
      kind === 'image'
        ? `/api/studios/assets/image-proxy?url=${encodeURIComponent(cleanUrl)}`
        : `/api/studios/assets/media-proxy?url=${encodeURIComponent(cleanUrl)}&kind=${kind}`;
    const resp = await fetchWithTimeout(endpoint, {}, 18000);
    if (resp.ok) {
      const blob = await resp.blob();
      if (blob && blob.size > 0) return blob;
    }
  }

  throw new Error(
    'Impossible de télécharger ce média en ligne (CORS ou réseau indisponible). Essayez un autre résultat.'
  );
}

// =========================================================================
// ONLINE TEMPLATES SEARCH (CLIENT-FIRST FOR DESIGN, VIDEO & AUDIO)
// =========================================================================

const CURATED_DESIGN_TEMPLATES: Array<Record<string, unknown>> = [
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
      { kind: 'shape', id: 'p91_rays', shape: 'rays', x: 540, y: 230, width: 240, height: 240, fillColor: '#fbbf24', strokeColor: '#ffffff', strokeWidth: 0, rotation: 0, opacity: 0.25 },
      { kind: 'shape', id: 'p91_cross', shape: 'cross', x: 540, y: 230, width: 110, height: 140, fillColor: '#fbbf24', strokeColor: '#ffffff', strokeWidth: 0, rotation: 0, opacity: 0.95 },
      { kind: 'text', id: 'p91_txt', x: 540, y: 540, text: '« Celui qui demeure sous l’abri\ndu Très-Haut repose à l’ombre\ndu Tout-Puissant. »', fontFamily: 'Georgia, "Times New Roman", serif', fontSize: 54, color: '#ffffff', bold: true, italic: true, underline: false, align: 'center', bgColor: '#071128', bgEnabled: false, shadow: true, rotation: 0, opacity: 1 },
      { kind: 'text', id: 'p91_ref', x: 540, y: 840, text: 'PSAUME 91 : 1', fontFamily: '"Outfit", sans-serif', fontSize: 38, color: '#fde68a', bold: true, italic: false, underline: true, align: 'center', bgColor: '#0f766e', bgEnabled: false, shadow: false, rotation: 0, opacity: 1 },
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
      { kind: 'shape', id: 'bp_dove', shape: 'dove', x: 540, y: 280, width: 210, height: 170, fillColor: '#ffffff', strokeColor: '#fde68a', strokeWidth: 0, rotation: 0, opacity: 0.95 },
      { kind: 'text', id: 'bp_title', x: 540, y: 580, text: 'JOURNÉE DE\nBAPTÊME', fontFamily: '"Outfit", sans-serif', fontSize: 82, color: '#ffffff', bold: true, italic: false, align: 'center', bgColor: '#0c4a6e', bgEnabled: false, shadow: true, rotation: 0, opacity: 1 },
      { kind: 'text', id: 'bp_verse', x: 540, y: 920, text: '« Si quelqu’un est en Christ, il est une nouvelle créature. »\n2 Corinthiens 5 : 17', fontFamily: 'Georgia, "Times New Roman", serif', fontSize: 36, color: '#e0f2fe', bold: false, italic: true, align: 'center', bgColor: '#0c4a6e', bgEnabled: false, shadow: false, rotation: 0, opacity: 1 },
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
      { kind: 'shape', id: 'jn_star', shape: 'rays', x: 540, y: 380, width: 300, height: 300, fillColor: '#fbbf24', strokeColor: '#ffffff', strokeWidth: 0, rotation: 0, opacity: 0.3 },
      { kind: 'text', id: 'jn_h1', x: 540, y: 740, text: 'GÉNÉRATION\nDE FEU', fontFamily: '"Arial Black", Impact, sans-serif', fontSize: 88, color: '#ffffff', bold: true, italic: false, align: 'center', bgColor: '#000000', bgEnabled: false, shadow: true, rotation: -3, opacity: 1 },
      { kind: 'text', id: 'jn_info', x: 540, y: 1120, text: 'SAMEDI · 18H30 · LOUANGE LIVE', fontFamily: '"Outfit", sans-serif', fontSize: 38, color: '#0f172a', bold: true, italic: false, align: 'center', bgColor: '#fbbf24', bgEnabled: true, shadow: false, rotation: 0, opacity: 1 },
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
      { kind: 'shape', id: 'mr_frame', shape: 'frame', x: 540, y: 540, width: 960, height: 960, fillColor: '#b45309', strokeColor: '#b45309', strokeWidth: 0, rotation: 0, opacity: 0.25 },
      { kind: 'shape', id: 'mr_heart', shape: 'heart', x: 540, y: 230, width: 120, height: 110, fillColor: '#be123c', strokeColor: '#ffffff', strokeWidth: 0, rotation: 0, opacity: 0.9 },
      { kind: 'text', id: 'mr_title', x: 540, y: 480, text: '« Ce que Dieu a uni,\nque l’homme ne le sépare pas. »', fontFamily: 'Georgia, "Times New Roman", serif', fontSize: 54, color: '#451a03', bold: true, italic: true, align: 'center', bgColor: '#ffffff', bgEnabled: false, shadow: false, rotation: 0, opacity: 1 },
      { kind: 'text', id: 'mr_ref', x: 540, y: 780, text: 'Marc 10 : 9 · Joyeuse Union Bénie', fontFamily: '"Outfit", sans-serif', fontSize: 34, color: '#b45309', bold: true, italic: false, align: 'center', bgColor: '#ffffff', bgEnabled: false, shadow: false, rotation: 0, opacity: 1 },
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
      { kind: 'shape', id: 'yt_bible', shape: 'bible', x: 240, y: 360, width: 280, height: 220, fillColor: '#fbbf24', strokeColor: '#ffffff', strokeWidth: 0, rotation: -6, opacity: 0.95 },
      { kind: 'text', id: 'yt_head', x: 760, y: 310, text: 'LA FOI QUI\nDÉPLACE LES\nMONTAGNES', fontFamily: '"Arial Black", Impact, sans-serif', fontSize: 68, color: '#ffffff', bold: true, italic: false, align: 'center', bgColor: '#000000', bgEnabled: false, shadow: true, rotation: 0, opacity: 1 },
      { kind: 'text', id: 'yt_tag', x: 760, y: 560, text: 'MESSAGE DU DIMANCHE · MATTHIEU 17:20', fontFamily: '"Outfit", sans-serif', fontSize: 28, color: '#0b1f42', bold: true, italic: false, align: 'center', bgColor: '#fbbf24', bgEnabled: true, shadow: false, rotation: 0, opacity: 1 },
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
      { kind: 'shape', id: 'nl_star', shape: 'star', x: 540, y: 230, width: 150, height: 150, fillColor: '#fbbf24', strokeColor: '#ffffff', strokeWidth: 0, rotation: 0, opacity: 1 },
      { kind: 'text', id: 'nl_title', x: 540, y: 510, text: 'JOYEUX NOËL\nEMMANUEL !', fontFamily: 'Georgia, "Times New Roman", serif', fontSize: 72, color: '#ffffff', bold: true, italic: false, align: 'center', bgColor: '#000000', bgEnabled: false, shadow: true, rotation: 0, opacity: 1 },
      { kind: 'text', id: 'nl_sub', x: 540, y: 780, text: '« Un Sauveur nous est né, qui est le Christ, le Seigneur. »', fontFamily: 'Georgia, "Times New Roman", serif', fontSize: 34, color: '#fde68a', bold: false, italic: true, align: 'center', bgColor: '#000000', bgEnabled: false, shadow: false, rotation: 0, opacity: 1 },
    ],
  },
  {
    id: 'onl_des_matin',
    nameFr: 'Prière du Matin Lumineuse',
    nameEn: 'Morning Prayer Inspiration',
    category: 'Réseaux sociaux',
    tags: ['matin', 'priere', 'reveil', 'lumiere', 'verset', 'jour', 'reseaux'],
    format: 'story',
    bgType: 'gradient',
    bgColor1: '#0f172a',
    bgColor2: '#b45309',
    bgAngle: 175,
    source: 'online-catalog',
    layers: [
      { kind: 'shape', id: 'mt_frame', shape: 'frame', x: 540, y: 960, width: 980, height: 1780, fillColor: '#fde68a', strokeColor: '#fde68a', strokeWidth: 0, rotation: 0, opacity: 0.25 },
      { kind: 'shape', id: 'mt_rays', shape: 'rays', x: 540, y: 440, width: 340, height: 340, fillColor: '#fbbf24', strokeColor: '#ffffff', strokeWidth: 0, rotation: 0, opacity: 0.28 },
      { kind: 'shape', id: 'mt_dove', shape: 'dove', x: 540, y: 440, width: 220, height: 180, fillColor: '#fef3c7', strokeColor: '#ffffff', strokeWidth: 0, rotation: 0, opacity: 0.96 },
      { kind: 'shape', id: 'mt_line', shape: 'line', x: 540, y: 690, width: 320, height: 16, fillColor: '#fbbf24', strokeColor: '#fbbf24', strokeWidth: 0, rotation: 0, opacity: 0.85 },
      { kind: 'text', id: 'mt_txt', x: 540, y: 890, text: 'BONJOUR\nSOUS LA GRÂCE', fontFamily: '"Outfit", sans-serif', fontSize: 76, color: '#ffffff', bold: true, italic: false, align: 'center', bgColor: '#000000', bgEnabled: false, shadow: true, rotation: 0, opacity: 1 },
      { kind: 'text', id: 'mt_ref', x: 540, y: 1260, text: '« Ses bontés se renouvellent chaque matin. »\nLamentations 3 : 23', fontFamily: 'Georgia, "Times New Roman", serif', fontSize: 42, color: '#fffbeb', bold: false, italic: true, align: 'center', bgColor: '#000000', bgEnabled: false, shadow: true, rotation: 0, opacity: 1 },
    ],
  },
  {
    id: 'onl_des_affiche_conference',
    nameFr: 'Affiche Conférence & Réveil',
    nameEn: 'Revival Conference Poster',
    category: 'Affiche',
    tags: ['affiche', 'conference', 'eglise', 'reveil', 'flyer', 'culte'],
    format: 'a4',
    bgType: 'gradient',
    bgColor1: '#071128',
    bgColor2: '#1e3a8a',
    bgAngle: 150,
    source: 'online-catalog',
    layers: [
      { kind: 'shape', id: 'ac_arch', shape: 'chapelArch', x: 620, y: 880, width: 1080, height: 1520, fillColor: '#1d4ed8', strokeColor: '#fbbf24', strokeWidth: 0, rotation: 0, opacity: 0.2 },
      { kind: 'shape', id: 'ac_badge', shape: 'scrollBanner', x: 620, y: 240, width: 520, height: 120, fillColor: '#fbbf24', strokeColor: '#b45309', strokeWidth: 0, rotation: 0, opacity: 0.96 },
      { kind: 'text', id: 'ac_kicker', x: 620, y: 235, text: 'GRANDE CONFÉRENCE ANNUELLE', fontFamily: '"Outfit", sans-serif', fontSize: 30, color: '#0b1f42', bold: true, italic: false, align: 'center', bgColor: '#fbbf24', bgEnabled: false, shadow: false, rotation: 0, opacity: 1 },
      { kind: 'text', id: 'ac_title', x: 620, y: 690, text: 'BÂTIR SUR\nLE ROC', fontFamily: '"Arial Black", Impact, sans-serif', fontSize: 112, color: '#ffffff', bold: true, italic: false, align: 'center', bgColor: '#000000', bgEnabled: false, shadow: true, rotation: 0, opacity: 1 },
      { kind: 'shape', id: 'ac_div', shape: 'line', x: 620, y: 970, width: 420, height: 18, fillColor: '#fbbf24', strokeColor: '#fbbf24', strokeWidth: 0, rotation: 0, opacity: 0.9 },
      { kind: 'text', id: 'ac_sub', x: 620, y: 1120, text: '3 Jours de Parole, Guérison & Adoration\nMatthieu 7 : 24', fontFamily: 'Georgia, "Times New Roman", serif', fontSize: 42, color: '#e2e8f0', bold: false, italic: true, align: 'center', bgColor: '#000000', bgEnabled: false, shadow: false, rotation: 0, opacity: 1 },
      { kind: 'text', id: 'ac_footer', x: 620, y: 1470, text: 'VENDREDI AU DIMANCHE · ENTRÉE LIBRE', fontFamily: '"Outfit", sans-serif', fontSize: 34, color: '#0b1f42', bold: true, italic: false, align: 'center', bgColor: '#fbbf24', bgEnabled: true, shadow: false, rotation: 0, opacity: 1 },
    ],
  },
  {
    id: 'onl_des_couverture_livre',
    nameFr: 'Couverture Livre · Sur les Pas de la Grâce',
    nameEn: 'Book Cover · Steps of Grace',
    category: 'Couverture',
    tags: ['livre', 'couverture', 'book', 'auteur', 'edition', 'devotionnel'],
    format: 'portrait',
    bgType: 'gradient',
    bgColor1: '#14532d',
    bgColor2: '#052e16',
    bgAngle: 165,
    source: 'online-catalog',
    layers: [
      { kind: 'shape', id: 'cl_frame', shape: 'frame', x: 540, y: 675, width: 960, height: 1220, fillColor: '#fde68a', strokeColor: '#fde68a', strokeWidth: 0, rotation: 0, opacity: 0.42 },
      { kind: 'shape', id: 'cl_olive', shape: 'oliveBranch', x: 540, y: 310, width: 220, height: 220, fillColor: '#a7f3d0', strokeColor: '#fde68a', strokeWidth: 0, rotation: 0, opacity: 0.95 },
      { kind: 'text', id: 'cl_title', x: 540, y: 620, text: 'MARCHER\nDANS LA\nPAIX', fontFamily: 'Georgia, "Times New Roman", serif', fontSize: 88, color: '#fffbeb', bold: true, italic: false, align: 'center', bgColor: '#000000', bgEnabled: false, shadow: true, rotation: 0, opacity: 1 },
      { kind: 'shape', id: 'cl_sep', shape: 'line', x: 540, y: 890, width: 260, height: 16, fillColor: '#fbbf24', strokeColor: '#fbbf24', strokeWidth: 0, rotation: 0, opacity: 0.9 },
      { kind: 'text', id: 'cl_sub', x: 540, y: 980, text: '30 JOURS DE MÉDITATION BIBLIQUE', fontFamily: '"Outfit", sans-serif', fontSize: 30, color: '#fde68a', bold: true, italic: false, align: 'center', bgColor: '#000000', bgEnabled: false, shadow: false, rotation: 0, opacity: 1 },
      { kind: 'text', id: 'cl_auth', x: 540, y: 1180, text: 'ÉDITIONS SHALOM', fontFamily: '"Outfit", sans-serif', fontSize: 28, color: '#a7f3d0', bold: true, italic: false, align: 'center', bgColor: '#000000', bgEnabled: false, shadow: false, rotation: 0, opacity: 0.9 },
    ],
  },
  {
    id: 'onl_des_presentation_culte',
    nameFr: 'Présentation Église · Slide 16:9',
    nameEn: 'Church Sermon Slide 16:9',
    category: 'Présentation',
    tags: ['presentation', 'slide', 'diapo', 'culte', 'predication', 'ecran'],
    format: 'landscape',
    bgType: 'gradient',
    bgColor1: '#fffbeb',
    bgColor2: '#fef3c7',
    bgAngle: 125,
    source: 'online-catalog',
    layers: [
      { kind: 'shape', id: 'pr_panel', shape: 'roundRect', x: 350, y: 360, width: 560, height: 600, fillColor: '#0b1f42', strokeColor: '#fbbf24', strokeWidth: 0, rotation: 0, opacity: 0.96 },
      { kind: 'shape', id: 'pr_bible', shape: 'bible', x: 350, y: 270, width: 200, height: 180, fillColor: '#fef3c7', strokeColor: '#fbbf24', strokeWidth: 0, rotation: 0, opacity: 1 },
      { kind: 'text', id: 'pr_left', x: 350, y: 480, text: 'MESSAGE\nDU JOUR', fontFamily: '"Outfit", sans-serif', fontSize: 52, color: '#ffffff', bold: true, italic: false, align: 'center', bgColor: '#0b1f42', bgEnabled: false, shadow: false, rotation: 0, opacity: 1 },
      { kind: 'text', id: 'pr_h1', x: 940, y: 260, text: 'La Force de la\nPersévérance', fontFamily: 'Georgia, "Times New Roman", serif', fontSize: 60, color: '#0b1f42', bold: true, italic: false, align: 'center', bgColor: '#ffffff', bgEnabled: false, shadow: false, rotation: 0, opacity: 1 },
      { kind: 'text', id: 'pr_body', x: 940, y: 470, text: '« Soyez fermes, inébranlables, travaillant\nde mieux en mieux à l’œuvre du Seigneur. »\n— 1 Corinthiens 15 : 58', fontFamily: '"Plus Jakarta Sans", sans-serif', fontSize: 28, color: '#334155', bold: false, italic: true, align: 'center', bgColor: '#ffffff', bgEnabled: false, shadow: false, rotation: 0, opacity: 1 },
    ],
  },
  {
    id: 'onl_des_invitation_carte',
    nameFr: 'Invitation Fraternelle · Couronne',
    nameEn: 'Fellowship Invitation · Wreath',
    category: 'Invitation',
    tags: ['invitation', 'carte', 'repas', 'eglise', 'fete', 'fraternite'],
    format: 'square',
    bgType: 'gradient',
    bgColor1: '#fefce8',
    bgColor2: '#fde68a',
    bgAngle: 140,
    source: 'online-catalog',
    layers: [
      { kind: 'shape', id: 'ic_c1', shape: 'floralCorner', x: 130, y: 130, width: 160, height: 160, fillColor: '#b45309', strokeColor: '#92400e', strokeWidth: 0, rotation: 0, opacity: 0.75 },
      { kind: 'shape', id: 'ic_c2', shape: 'floralCorner', x: 950, y: 950, width: 160, height: 160, fillColor: '#b45309', strokeColor: '#92400e', strokeWidth: 0, rotation: 180, opacity: 0.75 },
      { kind: 'shape', id: 'ic_wreath', shape: 'wreath', x: 540, y: 250, width: 200, height: 200, fillColor: '#047857', strokeColor: '#b45309', strokeWidth: 0, rotation: 0, opacity: 0.95 },
      { kind: 'text', id: 'ic_kicker', x: 540, y: 430, text: 'VOUS ÊTES INVITÉS', fontFamily: '"Outfit", sans-serif', fontSize: 32, color: '#92400e', bold: true, italic: false, align: 'center', bgColor: '#ffffff', bgEnabled: false, shadow: false, rotation: 0, opacity: 1 },
      { kind: 'text', id: 'ic_title', x: 540, y: 580, text: 'Culte d’Action\nde Grâces', fontFamily: 'Georgia, "Times New Roman", serif', fontSize: 72, color: '#0f172a', bold: true, italic: false, align: 'center', bgColor: '#ffffff', bgEnabled: false, shadow: false, rotation: 0, opacity: 1 },
      { kind: 'text', id: 'ic_details', x: 540, y: 810, text: 'Dimanche à 10h00 · Suivi d’un partage fraternel', fontFamily: '"Plus Jakarta Sans", sans-serif', fontSize: 30, color: '#065f46', bold: true, italic: false, align: 'center', bgColor: '#ffffff', bgEnabled: false, shadow: false, rotation: 0, opacity: 1 },
    ],
  },
];

const CURATED_PRESENTATION_TEMPLATES: Array<Record<string, unknown>> = [
  {
    id: 'onl_pres_sermon_deck',
    nameFr: 'Prédication du Dimanche (4 diapositives)',
    nameEn: 'Sunday Sermon Deck (4 slides)',
    category: 'Prédication',
    tags: ['predication', 'culte', 'sermon', 'eglise', 'presentation', 'diapo'],
    format: 'landscape',
    bgType: 'gradient',
    bgColor1: '#071128',
    bgColor2: '#1d4ed8',
    bgAngle: 135,
    source: 'online-catalog',
    pages: [
      {
        id: 'prs_1',
        name: 'Ouverture',
        transition: 'fade',
        bgType: 'gradient',
        bgColor1: '#071128',
        bgColor2: '#1d4ed8',
        bgAngle: 135,
        layers: [
          { kind: 'shape', id: 'pr1_rays', shape: 'rays', x: 240, y: 360, width: 280, height: 280, fillColor: '#fbbf24', strokeColor: '#ffffff', strokeWidth: 0, rotation: 0, opacity: 0.25 },
          { kind: 'shape', id: 'pr1_cross', shape: 'cross', x: 240, y: 360, width: 110, height: 150, fillColor: '#fbbf24', strokeColor: '#ffffff', strokeWidth: 0, rotation: 0, opacity: 0.95 },
          { kind: 'text', id: 'pr1_h', x: 780, y: 310, text: 'LA PAIX QUI\nSURPASSE TOUT', fontFamily: '"Outfit", sans-serif', fontSize: 66, color: '#ffffff', bold: true, italic: false, align: 'center', bgColor: '#071128', bgEnabled: false, shadow: true, rotation: 0, opacity: 1 },
          { kind: 'text', id: 'pr1_s', x: 780, y: 500, text: 'Philippiens 4 : 7 · Culte du Dimanche', fontFamily: 'Georgia, "Times New Roman", serif', fontSize: 32, color: '#fde68a', bold: false, italic: true, align: 'center', bgColor: '#071128', bgEnabled: false, shadow: false, rotation: 0, opacity: 1 },
        ],
        strokes: [],
      },
      {
        id: 'prs_2',
        name: 'Verset Clé',
        transition: 'slide',
        bgType: 'gradient',
        bgColor1: '#fffbeb',
        bgColor2: '#fef3c7',
        bgAngle: 135,
        layers: [
          { kind: 'shape', id: 'pr2_bar', shape: 'roundRect', x: 640, y: 120, width: 420, height: 64, fillColor: '#0b1f42', strokeColor: '#fbbf24', strokeWidth: 0, rotation: 0, opacity: 1 },
          { kind: 'text', id: 'pr2_tag', x: 640, y: 120, text: 'LECTURE BIBLIQUE', fontFamily: '"Outfit", sans-serif', fontSize: 28, color: '#fbbf24', bold: true, italic: false, align: 'center', bgColor: '#0b1f42', bgEnabled: false, shadow: false, rotation: 0, opacity: 1 },
          { kind: 'text', id: 'pr2_q', x: 640, y: 380, text: '« Ne vous inquiétez de rien ;\nmais en toute chose faites connaître\nvos besoins à Dieu par des prières. »', fontFamily: 'Georgia, "Times New Roman", serif', fontSize: 48, color: '#0f172a', bold: true, italic: true, align: 'center', bgColor: '#ffffff', bgEnabled: false, shadow: false, rotation: 0, opacity: 1 },
          { kind: 'text', id: 'pr2_ref', x: 640, y: 590, text: 'Philippiens 4 : 6', fontFamily: '"Outfit", sans-serif', fontSize: 30, color: '#b45309', bold: true, italic: false, align: 'center', bgColor: '#ffffff', bgEnabled: false, shadow: false, rotation: 0, opacity: 1 },
        ],
        strokes: [],
      },
      {
        id: 'prs_3',
        name: 'Points Clés',
        transition: 'slide',
        bgType: 'gradient',
        bgColor1: '#0b1f42',
        bgColor2: '#0f766e',
        bgAngle: 145,
        layers: [
          { kind: 'text', id: 'pr3_t', x: 640, y: 140, text: '3 PILIERS DE LA PAIX', fontFamily: '"Outfit", sans-serif', fontSize: 52, color: '#fbbf24', bold: true, italic: false, align: 'center', bgColor: '#000000', bgEnabled: false, shadow: false, rotation: 0, opacity: 1 },
          { kind: 'text', id: 'pr3_b', x: 640, y: 400, text: '1. Déposer ses fardeaux dans la prière\n2. Nourrir son cœur de gratitude\n3. Demeurer confiant dans Ses promesses', fontFamily: '"Plus Jakarta Sans", sans-serif', fontSize: 38, color: '#ffffff', bold: true, italic: false, align: 'left', bgColor: '#000000', bgEnabled: false, shadow: false, rotation: 0, opacity: 1 },
        ],
        strokes: [],
      },
      {
        id: 'prs_4',
        name: 'Prière Finale',
        transition: 'zoom',
        bgType: 'gradient',
        bgColor1: '#1e1b4b',
        bgColor2: '#071128',
        bgAngle: 150,
        layers: [
          { kind: 'shape', id: 'pr4_dove', shape: 'dove', x: 640, y: 210, width: 170, height: 140, fillColor: '#fde68a', strokeColor: '#ffffff', strokeWidth: 0, rotation: 0, opacity: 0.95 },
          { kind: 'text', id: 'pr4_t', x: 640, y: 440, text: 'QUE LA PAIX DE CHRIST\nRÈGNE DANS VOS CŒURS', fontFamily: '"Outfit", sans-serif', fontSize: 54, color: '#ffffff', bold: true, italic: false, align: 'center', bgColor: '#000000', bgEnabled: false, shadow: true, rotation: 0, opacity: 1 },
          { kind: 'text', id: 'pr4_f', x: 640, y: 600, text: 'Shalom · Amen', fontFamily: 'Georgia, "Times New Roman", serif', fontSize: 34, color: '#fbbf24', bold: false, italic: true, align: 'center', bgColor: '#000000', bgEnabled: false, shadow: false, rotation: 0, opacity: 1 },
        ],
        strokes: [],
      },
    ],
  },
  {
    id: 'onl_pres_bible_study',
    nameFr: 'Étude Biblique & Formation (3 diapositives)',
    nameEn: 'Bible Study & Workshop (3 slides)',
    category: 'Formation',
    tags: ['etude', 'bible', 'formation', 'enseignement', 'groupe'],
    format: 'landscape',
    bgType: 'gradient',
    bgColor1: '#064e3b',
    bgColor2: '#059669',
    bgAngle: 135,
    source: 'online-catalog',
    pages: [
      {
        id: 'bs_1',
        name: 'Titre Étude',
        transition: 'fade',
        bgType: 'gradient',
        bgColor1: '#064e3b',
        bgColor2: '#059669',
        bgAngle: 135,
        layers: [
          { kind: 'shape', id: 'bs1_b', shape: 'bible', x: 260, y: 360, width: 250, height: 210, fillColor: '#fef3c7', strokeColor: '#fbbf24', strokeWidth: 0, rotation: 0, opacity: 0.95 },
          { kind: 'text', id: 'bs1_t', x: 780, y: 310, text: 'ÉTUDE BIBLIQUE\nAPPROFONDIE', fontFamily: '"Outfit", sans-serif', fontSize: 64, color: '#ffffff', bold: true, italic: false, align: 'center', bgColor: '#000000', bgEnabled: false, shadow: true, rotation: 0, opacity: 1 },
          { kind: 'text', id: 'bs1_s', x: 780, y: 495, text: 'Contexte · Sens Spirituel · Application', fontFamily: '"Plus Jakarta Sans", sans-serif', fontSize: 30, color: '#d1fae5', bold: true, italic: false, align: 'center', bgColor: '#000000', bgEnabled: false, shadow: false, rotation: 0, opacity: 1 },
        ],
        strokes: [],
      },
      {
        id: 'bs_2',
        name: 'Observation',
        transition: 'slide',
        bgType: 'solid',
        bgColor1: '#f8fafc',
        bgColor2: '#e2e8f0',
        bgAngle: 135,
        layers: [
          { kind: 'shape', id: 'bs2_side', shape: 'rect', x: 180, y: 360, width: 360, height: 720, fillColor: '#064e3b', strokeColor: '#064e3b', strokeWidth: 0, rotation: 0, opacity: 1 },
          { kind: 'text', id: 'bs2_l', x: 180, y: 360, text: '01\nCONTEXTE', fontFamily: '"Outfit", sans-serif', fontSize: 48, color: '#fbbf24', bold: true, italic: false, align: 'center', bgColor: '#000000', bgEnabled: false, shadow: false, rotation: 0, opacity: 1 },
          { kind: 'text', id: 'bs2_r', x: 800, y: 350, text: '• Qui parle et à qui ?\n• Quelle promesse est révélée ?\n• Comment la vivre cette semaine ?', fontFamily: '"Plus Jakarta Sans", sans-serif', fontSize: 38, color: '#0f172a', bold: true, italic: false, align: 'left', bgColor: '#ffffff', bgEnabled: false, shadow: false, rotation: 0, opacity: 1 },
        ],
        strokes: [],
      },
      {
        id: 'bs_3',
        name: 'Application',
        transition: 'fade',
        bgType: 'gradient',
        bgColor1: '#0f172a',
        bgColor2: '#064e3b',
        bgAngle: 160,
        layers: [
          { kind: 'text', id: 'bs3_t', x: 640, y: 260, text: 'DÉFI DE LA SEMAINE', fontFamily: '"Outfit", sans-serif', fontSize: 54, color: '#fbbf24', bold: true, italic: false, align: 'center', bgColor: '#000000', bgEnabled: false, shadow: false, rotation: 0, opacity: 1 },
          { kind: 'text', id: 'bs3_b', x: 640, y: 440, text: 'Partager ce passage avec une personne\net prier ensemble pour sa maison.', fontFamily: 'Georgia, "Times New Roman", serif', fontSize: 38, color: '#ffffff', bold: false, italic: true, align: 'center', bgColor: '#000000', bgEnabled: false, shadow: false, rotation: 0, opacity: 1 },
        ],
        strokes: [],
      },
    ],
  },
  {
    id: 'onl_pres_annonces_eglise',
    nameFr: 'Annonces & Programme de la Semaine (3 diapos)',
    nameEn: 'Weekly Church Announcements (3 slides)',
    category: 'Église',
    tags: ['annonces', 'programme', 'eglise', 'culte', 'evenement'],
    format: 'landscape',
    bgType: 'gradient',
    bgColor1: '#451a03',
    bgColor2: '#b45309',
    bgAngle: 135,
    source: 'online-catalog',
    pages: [
      {
        id: 'an_1',
        name: 'Annonces',
        transition: 'fade',
        bgType: 'gradient',
        bgColor1: '#451a03',
        bgColor2: '#b45309',
        bgAngle: 135,
        layers: [
          { kind: 'shape', id: 'an1_cr', shape: 'crown', x: 640, y: 170, width: 150, height: 120, fillColor: '#fde68a', strokeColor: '#ffffff', strokeWidth: 0, rotation: 0, opacity: 0.95 },
          { kind: 'text', id: 'an1_h', x: 640, y: 380, text: 'BIENVENUE À TOUS\nANNONCES DE LA SEMAINE', fontFamily: '"Outfit", sans-serif', fontSize: 58, color: '#ffffff', bold: true, italic: false, align: 'center', bgColor: '#000000', bgEnabled: false, shadow: true, rotation: 0, opacity: 1 },
          { kind: 'text', id: 'an1_s', x: 640, y: 550, text: 'Communauté · Prière · Entraide Fraternelle', fontFamily: '"Plus Jakarta Sans", sans-serif', fontSize: 30, color: '#fef3c7', bold: false, italic: false, align: 'center', bgColor: '#000000', bgEnabled: false, shadow: false, rotation: 0, opacity: 1 },
        ],
        strokes: [],
      },
      {
        id: 'an_2',
        name: 'Agenda Hebdo',
        transition: 'slide',
        bgType: 'gradient',
        bgColor1: '#0b1f42',
        bgColor2: '#1e3a8a',
        bgAngle: 145,
        layers: [
          { kind: 'text', id: 'an2_h', x: 640, y: 140, text: 'RENDEZ-VOUS DE LA SEMAINE', fontFamily: '"Outfit", sans-serif', fontSize: 48, color: '#fbbf24', bold: true, italic: false, align: 'center', bgColor: '#000000', bgEnabled: false, shadow: false, rotation: 0, opacity: 1 },
          { kind: 'text', id: 'an2_b', x: 640, y: 400, text: 'Mercredi · 18h30 : Intercession & Louange\nVendredi · 19h00 : Étude Biblique\nDimanche · 09h30 : Culte d’Adoration', fontFamily: '"Plus Jakarta Sans", sans-serif', fontSize: 36, color: '#ffffff', bold: true, italic: false, align: 'left', bgColor: '#000000', bgEnabled: false, shadow: false, rotation: 0, opacity: 1 },
        ],
        strokes: [],
      },
      {
        id: 'an_3',
        name: 'Bénédiction',
        transition: 'zoom',
        bgType: 'gradient',
        bgColor1: '#064e3b',
        bgColor2: '#0f172a',
        bgAngle: 140,
        layers: [
          { kind: 'text', id: 'an3_h', x: 640, y: 340, text: 'EXCELLENTE SEMAINE\nSOUS LA GRÂCE DE DIEU', fontFamily: '"Outfit", sans-serif', fontSize: 56, color: '#ffffff', bold: true, italic: false, align: 'center', bgColor: '#000000', bgEnabled: false, shadow: true, rotation: 0, opacity: 1 },
        ],
        strokes: [],
      },
    ],
  },
];

const CURATED_VIDEO_TEMPLATES: Array<Record<string, unknown>> = [
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
      { kind: 'custom', name: 'Introduction Paix', durationSec: 3.5, trimStartSec: 0, trimEndSec: 3.5, fitMode: 'cover', kenBurns: false, volume: 1, playbackRate: 1, transition: 'fade', filter: 'none', bgType: 'gradient', bgColor: '#064e3b', bgColor2: '#0f172a', shape: 'dove', shapeColor: '#fde68a', text: 'MÉDITATION DU JOUR', textColor: '#ffffff', fontSize: 48, fontFamily: '"Outfit", sans-serif', bold: true, italic: false, underline: false, textAlign: 'center' },
      { kind: 'custom', name: 'Psaume 23:1', durationSec: 6, trimStartSec: 0, trimEndSec: 6, fitMode: 'cover', kenBurns: false, volume: 1, playbackRate: 1, transition: 'zoom', filter: 'none', bgType: 'gradient', bgColor: '#0f172a', bgColor2: '#065f46', shape: 'cross', shapeColor: '#fbbf24', text: '« L’Éternel est mon berger :\nje ne manquerai de rien. »\nPsaume 23 : 1', textColor: '#ffffff', fontSize: 40, fontFamily: 'Georgia, "Times New Roman", serif', bold: true, italic: true, underline: false, textAlign: 'center' },
    ],
    overlays: [
      { kind: 'text', label: 'Signature Paix', startSec: 0.4, endSec: 9.2, xPct: 50, yPct: 88, size: 26, rotationDeg: 0, color: '#fde68a', bgBadge: true, opacity: 0.95, animation: 'slide-up', text: 'SHALOM · Paix du Cœur', fontFamily: '"Outfit", sans-serif', bold: true, italic: false },
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
      { kind: 'custom', name: 'Accroche Jeunesse', durationSec: 3, trimStartSec: 0, trimEndSec: 3, fitMode: 'cover', kenBurns: false, volume: 1, playbackRate: 1, transition: 'zoom', filter: 'vivid', bgType: 'gradient', bgColor: '#3b0764', bgColor2: '#be185d', shape: 'rays', shapeColor: '#fbbf24', text: 'SOIRÉE JEUNESSE\nLOUANGE LIVE', textColor: '#ffffff', fontSize: 52, fontFamily: '"Arial Black", Impact, sans-serif', bold: true, italic: false, underline: false, textAlign: 'center' },
      { kind: 'custom', name: 'Lieu & Date', durationSec: 4.5, trimStartSec: 0, trimEndSec: 4.5, fitMode: 'cover', kenBurns: false, volume: 1, playbackRate: 1, transition: 'slide', filter: 'none', bgType: 'gradient', bgColor: '#0b1f42', bgColor2: '#1d4ed8', shape: 'crown', shapeColor: '#fbbf24', text: 'Samedi · 18h30\nViens avec tes amis !', textColor: '#ffffff', fontSize: 44, fontFamily: '"Outfit", sans-serif', bold: true, italic: false, underline: false, textAlign: 'center' },
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
      { kind: 'custom', name: 'Appel Intercession', durationSec: 5, trimStartSec: 0, trimEndSec: 5, fitMode: 'cover', kenBurns: false, volume: 1, playbackRate: 1, transition: 'fade', filter: 'none', bgType: 'gradient', bgColor: '#1e1b4b', bgColor2: '#0f766e', shape: 'bible', shapeColor: '#fbbf24', text: 'TEMPS DE JEÛNE\n& D’INTERCESSION', textColor: '#ffffff', fontSize: 48, fontFamily: '"Outfit", sans-serif', bold: true, italic: false, underline: false, textAlign: 'center' },
    ],
    overlays: [
      { kind: 'text', label: 'Verset Prière', startSec: 0.5, endSec: 5, xPct: 50, yPct: 86, size: 28, rotationDeg: 0, color: '#fef3c7', bgBadge: true, opacity: 1, animation: 'fade-in', text: '1 Thessaloniciens 5:17 · Priez sans cesse', fontFamily: 'Georgia, "Times New Roman", serif', bold: false, italic: true },
    ],
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
      { kind: 'custom', name: 'Ouverture Culte', durationSec: 4, trimStartSec: 0, trimEndSec: 4, fitMode: 'cover', kenBurns: false, volume: 1, playbackRate: 1, transition: 'zoom', filter: 'none', bgType: 'gradient', bgColor: '#071128', bgColor2: '#1d4ed8', shape: 'cross', shapeColor: '#fbbf24', text: 'MESSAGE BIBLIQUE\n& ENSEIGNEMENT', textColor: '#ffffff', fontSize: 58, fontFamily: '"Outfit", sans-serif', bold: true, italic: false, underline: false, textAlign: 'center' },
    ],
    overlays: [
      { kind: 'text', label: 'Bandeau Orateur', startSec: 0.6, endSec: 4, xPct: 50, yPct: 86, size: 30, rotationDeg: 0, color: '#ffffff', bgBadge: true, opacity: 0.95, animation: 'slide-up', text: 'Bienvenue à l’écoute de la Parole', fontFamily: '"Plus Jakarta Sans", sans-serif', bold: true, italic: false },
    ],
  },
];

const CURATED_AUDIO_TEMPLATES: Array<Record<string, unknown>> = [
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
    scriptFr: 'Seigneur, merci pour ce souffle de vie et ce matin nouveau.\nConduis chacun de mes pas dans Ta paix et Ta sagesse aujourd’hui. Amen.',
    scriptEn: 'Lord, thank You for the breath of life and this brand new morning.\nGuide every step I take today in Your peace and wisdom. Amen.',
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
    scriptFr: 'Verset du jour — Philippiens 4:13 :\n« Je puis tout par celui qui me fortifie. »\n\nRappel : Dieu dépose Sa force au cœur même de votre journée.',
    scriptEn: 'Verse of the Day — Philippians 4:13:\n"I can do all things through Christ who strengthens me."',
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
    scriptFr: 'Je veux rendre gloire à Dieu pour Sa fidélité dans ma vie.\nLà où je ne voyais aucune issue, Il a ouvert un chemin de paix.',
    scriptEn: 'I want to give glory to God for His faithfulness in my life.\nWhere there seemed to be no way, He opened a path of peace.',
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
    scriptFr: 'Seigneur, nous élevons nos familles, notre ville et notre église devant Ton trône de grâce.\nRépands Ton Esprit de guérison et d’unité.',
    scriptEn: 'Lord, we lift our families, our city, and our church before Your throne of grace.',
  },
];

function normalizeSearchStr(s: string): string {
  return (s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

const PROC_PALETTES = [
  ['#0b1f42', '#1d4ed8', '#fbbf24'],
  ['#134e4a', '#059669', '#fde68a'],
  ['#4c1d95', '#7c3aed', '#f9a8d4'],
  ['#7c2d12', '#d97706', '#fef3c7'],
  ['#0f172a', '#334155', '#38bdf8'],
  ['#831843', '#db2777', '#fde047'],
];
const PROC_SHAPES = ['cross', 'dove', 'bible', 'crown', 'rays', 'heart', 'star', 'frame'];

function generateClientTemplatesBatch(
  studioType: StudioKind,
  query: string,
  category: string,
  lang: 'fr' | 'en',
  page: number,
  excludeSet: Set<string>
): Array<Record<string, unknown>> {
  const topic = query || (category && category !== 'all' ? category : lang === 'en' ? 'Grace & Peace' : 'Grâce & Lumière');
  const catLabel = category && category !== 'all' ? category : 'En ligne';
  const batch: Array<Record<string, unknown>> = [];
  const designFormats = ['square', 'portrait', 'story', 'landscape', 'a4'] as const;
  const videoAspects = ['9:16', '16:9', '1:1', '4:5'] as const;

  for (let i = 0; i < 4; i++) {
    const seed = (page - 1) * 4 + i + 1;
    const pal = PROC_PALETTES[seed % PROC_PALETTES.length];
    const shape = PROC_SHAPES[seed % PROC_SHAPES.length];

    if (studioType === 'design' || studioType === 'presentation') {
      const format = studioType === 'presentation' ? 'landscape' : designFormats[seed % designFormats.length];
      const w = format === 'landscape' ? 1280 : format === 'a4' ? 1240 : 1080;
      const h =
        format === 'landscape' ? 720 : format === 'story' ? 1920 : format === 'portrait' ? 1350 : format === 'a4' ? 1754 : 1080;
      const nameFr =
        studioType === 'presentation'
          ? `${topic} · Présentation #${seed}`
          : `${topic} · Édition ${seed}`;
      if (excludeSet.has(normalizeSearchStr(nameFr))) continue;
      if (studioType === 'presentation') {
        batch.push({
          id: `onl_cli_prs_${page}_${i}_${Date.now()}`,
          nameFr,
          nameEn: `${topic} · Deck #${seed}`,
          category: catLabel,
          tags: [topic, catLabel, 'presentation'],
          format: 'landscape',
          bgType: 'gradient',
          bgColor1: pal[0],
          bgColor2: pal[1],
          bgAngle: (seed * 35) % 360,
          source: 'online-live',
          pages: [
            {
              id: `cp1_${seed}`,
              name: 'Diapositive 1',
              transition: 'fade',
              bgType: 'gradient',
              bgColor1: pal[0],
              bgColor2: pal[1],
              bgAngle: (seed * 35) % 360,
              layers: [
                { kind: 'shape', id: `cp_s_${seed}`, shape, x: 250, y: 360, width: 200, height: 200, fillColor: pal[2], strokeColor: '#ffffff', strokeWidth: 0, rotation: 0, opacity: 0.94 },
                { kind: 'text', id: `cp_h_${seed}`, x: 780, y: 310, text: topic.toUpperCase(), fontFamily: '"Outfit", sans-serif', fontSize: 64, color: '#ffffff', bold: true, italic: false, align: 'center', bgColor: pal[0], bgEnabled: false, shadow: true, rotation: 0, opacity: 1 },
                { kind: 'text', id: `cp_sub_${seed}`, x: 780, y: 490, text: 'SHALOM · Présentation Édifiable', fontFamily: 'Georgia, "Times New Roman", serif', fontSize: 32, color: pal[2], bold: false, italic: true, align: 'center', bgColor: pal[0], bgEnabled: false, shadow: false, rotation: 0, opacity: 1 },
              ],
              strokes: [],
            },
            {
              id: `cp2_${seed}`,
              name: 'Diapositive 2',
              transition: 'slide',
              bgType: 'gradient',
              bgColor1: pal[1],
              bgColor2: pal[0],
              bgAngle: 150,
              layers: [
                { kind: 'text', id: `cp2_h_${seed}`, x: 640, y: 180, text: 'POINTS PRINCIPAUX', fontFamily: '"Outfit", sans-serif', fontSize: 48, color: pal[2], bold: true, italic: false, align: 'center', bgColor: pal[0], bgEnabled: false, shadow: false, rotation: 0, opacity: 1 },
                { kind: 'text', id: `cp2_b_${seed}`, x: 640, y: 410, text: '1. Introduction & Lecture\n2. Enseignement central\n3. Temps de prière', fontFamily: '"Plus Jakarta Sans", sans-serif', fontSize: 38, color: '#ffffff', bold: true, italic: false, align: 'left', bgColor: pal[0], bgEnabled: false, shadow: false, rotation: 0, opacity: 1 },
              ],
              strokes: [],
            },
          ],
        });
        continue;
      }
      batch.push({
        id: `onl_cli_des_${page}_${i}_${Date.now()}`,
        nameFr,
        nameEn: `${topic} · Edition ${seed}`,
        category: catLabel,
        tags: [topic, catLabel],
        format,
        bgType: 'gradient',
        bgColor1: pal[0],
        bgColor2: pal[1],
        bgAngle: (seed * 35) % 360,
        source: 'online-live',
        layers: [
          { kind: 'shape', id: `cd_s_${seed}`, shape, x: Math.round(w / 2), y: Math.round(h * 0.24), width: Math.round(Math.min(w, h) * 0.16), height: Math.round(Math.min(w, h) * 0.16), fillColor: pal[2], strokeColor: '#ffffff', strokeWidth: 0, rotation: 0, opacity: 0.94 },
          { kind: 'text', id: `cd_h_${seed}`, x: Math.round(w / 2), y: Math.round(h * 0.52), text: topic.toUpperCase(), fontFamily: seed % 2 === 0 ? '"Outfit", sans-serif' : 'Georgia, "Times New Roman", serif', fontSize: Math.round(Math.min(w, h) * 0.056), color: '#ffffff', bold: true, italic: false, underline: false, align: 'center', bgColor: pal[0], bgEnabled: false, shadow: true, rotation: 0, opacity: 1 },
          { kind: 'text', id: `cd_sub_${seed}`, x: Math.round(w / 2), y: Math.round(h * 0.78), text: 'SHALOM · Méditation & Partage', fontFamily: 'Georgia, "Times New Roman", serif', fontSize: Math.round(Math.min(w, h) * 0.032), color: pal[2], bold: false, italic: true, underline: false, align: 'center', bgColor: pal[0], bgEnabled: false, shadow: false, rotation: 0, opacity: 1 },
        ],
      });
    } else if (studioType === 'video') {
      const aspect = videoAspects[seed % videoAspects.length];
      const titleFr = `${topic} · Séquence ${seed}`;
      if (excludeSet.has(normalizeSearchStr(titleFr))) continue;
      batch.push({
        id: `onl_cli_vid_${page}_${i}_${Date.now()}`,
        titleFr,
        titleEn: `${topic} · Reel ${seed}`,
        descFr: `Séquence animée (${aspect}) pour « ${topic} ».`,
        descEn: `Animated sequence (${aspect}) for "${topic}".`,
        category: catLabel,
        tags: [topic, catLabel],
        aspect,
        bgColor: pal[0],
        source: 'online-live',
        scenes: [
          { kind: 'custom', name: 'Scène 1 · Ouverture', durationSec: 4, trimStartSec: 0, trimEndSec: 4, fitMode: 'cover', kenBurns: false, volume: 1, playbackRate: 1, transition: 'fade', filter: 'none', bgType: 'gradient', bgColor: pal[0], bgColor2: pal[1], shape, shapeColor: pal[2], text: topic.toUpperCase(), textColor: '#ffffff', fontSize: 48, fontFamily: '"Outfit", sans-serif', bold: true, italic: false, underline: false, textAlign: 'center' },
          { kind: 'custom', name: 'Scène 2 · Message', durationSec: 5, trimStartSec: 0, trimEndSec: 5, fitMode: 'cover', kenBurns: false, volume: 1, playbackRate: 1, transition: 'slide', filter: 'none', bgType: 'gradient', bgColor: pal[1], bgColor2: pal[0], shape: 'cross', shapeColor: pal[2], text: 'Que Sa paix repose sur votre maison.', textColor: '#ffffff', fontSize: 40, fontFamily: 'Georgia, "Times New Roman", serif', bold: false, italic: true, underline: false, textAlign: 'center' },
        ],
        overlays: [
          { kind: 'text', label: 'Bandeau', startSec: 0.4, endSec: 8.5, xPct: 50, yPct: 86, size: 24, rotationDeg: 0, color: pal[2], bgBadge: true, opacity: 0.95, animation: 'slide-up', text: 'SHALOM · La foi au quotidien', fontFamily: '"Outfit", sans-serif', bold: true, italic: false },
        ],
      });
    } else {
      const titleFr = `${topic} · Session Audio ${seed}`;
      if (excludeSet.has(normalizeSearchStr(titleFr))) continue;
      const synths = ['c_major', 'g_warm', 'a_minor', 'soft_bell', 'chime', 'swell'];
      batch.push({
        id: `onl_cli_aud_${page}_${i}_${Date.now()}`,
        titleFr,
        titleEn: `${topic} · Audio Session ${seed}`,
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
          { id: `mkc_1_${seed}`, timeSec: 0.8, label: 'Ouverture', color: '#3b82f6' },
          { id: `mkc_2_${seed}`, timeSec: 9, label: 'Exhortation', color: '#fbbf24' },
        ],
        scriptFr: `Méditation SHALOM : ${topic}\n1. Temps de calme et de reconnaissance.\n2. Lecture biblique & prière.`,
        scriptEn: `SHALOM Meditation: ${topic}\n1. Quiet gratitude.\n2. Scripture reading & prayer.`,
      });
    }
  }
  return batch;
}

export async function searchOnlineTemplatesClient<T = Record<string, unknown>>(params: {
  studioType: StudioKind;
  query?: string;
  category?: string;
  lang?: 'fr' | 'en';
  page?: number;
  excludeTitles?: string[];
}): Promise<{
  templates: T[];
  hasMore: boolean;
  sourceMode: 'server' | 'online-catalog' | 'offline-catalog';
}> {
  const studioType = params.studioType;
  const query = (params.query || '').trim();
  const category = (params.category || '').trim();
  const lang = params.lang === 'en' ? 'en' : 'fr';
  const page = Math.max(1, Number(params.page) || 1);
  const excludeTitles = params.excludeTitles || [];

  // Optional Express server search first
  const serverRes = await postJsonIfExpressAvailable<{
    ok?: boolean;
    templates?: T[];
    hasMore?: boolean;
  }>(
    '/api/studios/templates/search',
    {
      studioType,
      query,
      category: category === 'all' ? undefined : category,
      lang,
      page,
      excludeTitles,
    },
    4500
  );

  if (serverRes?.ok && Array.isArray(serverRes.templates) && serverRes.templates.length > 0) {
    return {
      templates: serverRes.templates,
      hasMore: serverRes.hasMore !== false,
      sourceMode: 'server',
    };
  }

  // Client-first curated + paginated dynamic catalog (100% compatible Android APK & GitHub Pages!)
  const qNorm = normalizeSearchStr(query);
  const catNorm = category && category !== 'all' ? normalizeSearchStr(category) : '';
  const excludeSet = new Set(excludeTitles.map((t) => normalizeSearchStr(t)));

  const baseList =
    studioType === 'presentation'
      ? CURATED_PRESENTATION_TEMPLATES
      : studioType === 'design'
        ? CURATED_DESIGN_TEMPLATES
        : studioType === 'video'
          ? CURATED_VIDEO_TEMPLATES
          : CURATED_AUDIO_TEMPLATES;

  let catalogMatches: Array<Record<string, unknown>> = [];
  if (page === 1) {
    catalogMatches = baseList.filter((item) => {
      const itemCat = normalizeSearchStr(String(item.category || ''));
      if (catNorm && itemCat !== catNorm) return false;
      const titleKey = normalizeSearchStr(String(item.nameFr || item.titleFr || ''));
      if (excludeSet.has(titleKey)) return false;
      if (!qNorm) return true;
      const hay = normalizeSearchStr(
        [
          item.nameFr,
          item.nameEn,
          item.titleFr,
          item.titleEn,
          item.descFr,
          item.descEn,
          item.category,
          ...(Array.isArray(item.tags) ? item.tags : []),
        ]
          .filter(Boolean)
          .join(' ')
      );
      return qNorm.split(/\s+/).every((w) => hay.includes(w));
    });
  }

  let onlineEnriched: Array<Record<string, unknown>> = [];
  if (studioType === 'design' && query.length >= 2 && navigator.onLine !== false) {
    try {
      // Enrich search with real online Wikimedia photos styled as Canva verse cards!
      const wm = await fetchWikimediaImagesDirect(query, page, 'backgrounds');
      onlineEnriched = wm.slice(0, 3).map((asset, idx) => ({
        id: `onl_wm_tpl_${page}_${idx}_${Date.now()}`,
        nameFr: `${query} · Photo en ligne #${(page - 1) * 3 + idx + 1}`,
        nameEn: `${query} · Online Photo #${(page - 1) * 3 + idx + 1}`,
        category: catLabelFrom(category),
        tags: [query],
        format: 'square',
        bgType: 'image',
        bgColor1: '#0b1f42',
        bgColor2: '#1d4ed8',
        bgAngle: 135,
        bgRemoteImageUrl: asset.fullUrl,
        source: 'online-live',
        layers: [
          {
            kind: 'shape',
            id: `wm_sh_${page}_${idx}`,
            shape: 'rect',
            x: 540,
            y: 540,
            width: 1080,
            height: 1080,
            fillColor: '#071128',
            strokeColor: '#ffffff',
            strokeWidth: 0,
            rotation: 0,
            opacity: 0.42,
          },
          {
            kind: 'text',
            id: `wm_txt_${page}_${idx}`,
            x: 540,
            y: 510,
            text: query.toUpperCase(),
            fontFamily: '"Outfit", sans-serif',
            fontSize: 64,
            color: '#ffffff',
            bold: true,
            italic: false,
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
            id: `wm_sub_${page}_${idx}`,
            x: 540,
            y: 720,
            text: 'SHALOM · La foi au quotidien',
            fontFamily: 'Georgia, "Times New Roman", serif',
            fontSize: 34,
            color: '#fde68a',
            bold: false,
            italic: true,
            underline: false,
            align: 'center',
            bgColor: '#071128',
            bgEnabled: false,
            shadow: false,
            rotation: 0,
            opacity: 1,
          },
        ],
      }));
    } catch {
      // ignore optional enrichment failure
    }
  }

  let merged = [...onlineEnriched, ...catalogMatches];
  if (merged.length < 4) {
    merged = [
      ...merged,
      ...generateClientTemplatesBatch(studioType, query, category, lang, page, excludeSet),
    ];
  }

  return {
    templates: merged as unknown as T[],
    hasMore: true,
    sourceMode: navigator.onLine === false ? 'offline-catalog' : 'online-catalog',
  };
}

function catLabelFrom(category: string): string {
  return category && category !== 'all' ? category : 'En ligne';
}

// =========================================================================
// ONLINE AUDIO & VIDEO CLIP SEARCH (WIKIMEDIA COMMONS + INTERNET ARCHIVE)
// =========================================================================

export async function searchOnlineMediaLibrary(params: {
  mediaKind: 'audio' | 'video';
  query: string;
  page?: number;
  lang?: 'fr' | 'en';
}): Promise<{
  items: OnlineMediaTrackResult[];
  hasMore: boolean;
  networkError?: string;
}> {
  const { mediaKind, query, page = 1, lang = 'fr' } = params;
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return {
      items: [],
      hasMore: false,
      networkError:
        lang === 'en'
          ? 'No Internet connection detected.'
          : 'Aucune connexion Internet détectée. Connectez-vous pour rechercher en ligne.',
    };
  }

  const terms = translateQueryForGlobalSearch(
    query,
    mediaKind === 'audio' ? 'hymn piano bell worship' : 'sunrise clouds nature light'
  );
  const offset = Math.max(0, (page - 1) * 12);

  if (mediaKind === 'audio') {
    const wmUrl = `https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrnamespace=6&gsrsearch=${encodeURIComponent(
      `${terms} filetype:audio`
    )}&gsrlimit=12&gsroffset=${offset}&prop=imageinfo&iiprop=url|mime|size&format=json&origin=*`;

    try {
      const resp = await fetchWithTimeout(wmUrl, { mode: 'cors' }, 10000);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = (await resp.json()) as {
        query?: {
          pages?: Record<
            string,
            {
              pageid: number;
              title: string;
              imageinfo?: Array<{ url?: string; mime?: string; duration?: number }>;
            }
          >;
        };
      };
      const items: OnlineMediaTrackResult[] = [];
      for (const p of Object.values(data.query?.pages || {})) {
        const info = p.imageinfo?.[0];
        if (!info?.url) continue;
        const mime = (info.mime || '').toLowerCase();
        if (!mime.startsWith('audio/') && !/\.(ogg|oga|mp3|wav|flac)$/i.test(info.url)) continue;
        items.push({
          id: `wm_aud_${page}_${p.pageid}`,
          kind: 'audio',
          title: p.title.replace(/^File:/i, '').replace(/\.[^.]+$/, '').replace(/_/g, ' ').slice(0, 64),
          streamUrl: info.url,
          mimeType: mime || 'audio/ogg',
          durationSec: info.duration,
          source: 'wikimedia',
          license: 'Wikimedia Commons',
        });
      }
      return {
        items,
        hasMore: items.length >= 6,
      };
    } catch (err) {
      return {
        items: [],
        hasMore: false,
        networkError:
          err instanceof Error
            ? `Impossible de rechercher les sons en ligne (${err.message}).`
            : 'Erreur réseau lors de la recherche audio en ligne.',
      };
    }
  } else {
    // Video Studio: search Wikimedia Commons video clips + animated photo backdrops
    const wmVidUrl = `https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrnamespace=6&gsrsearch=${encodeURIComponent(
      `${terms} filetype:video`
    )}&gsrlimit=8&gsroffset=${offset}&prop=imageinfo&iiprop=url|mime|size&format=json&origin=*`;

    try {
      const [vidRes, imgRes] = await Promise.allSettled([
        fetchWithTimeout(wmVidUrl, { mode: 'cors' }, 10000).then((r) => r.json()),
        fetchWikimediaImagesDirect(query, page, 'images'),
      ]);

      const items: OnlineMediaTrackResult[] = [];
      if (vidRes.status === 'fulfilled') {
        const pages = Object.values(
          (vidRes.value as {
            query?: {
              pages?: Record<
                string,
                { pageid: number; title: string; imageinfo?: Array<{ url?: string; mime?: string }> }
              >;
            };
          })?.query?.pages || {}
        );
        for (const p of pages) {
          const info = p.imageinfo?.[0];
          if (!info?.url) continue;
          const mime = (info.mime || '').toLowerCase();
          if (mime.includes('webm') || mime.includes('mp4') || mime.includes('ogg')) {
            items.push({
              id: `wm_vid_${page}_${p.pageid}`,
              kind: 'video',
              title: p.title.replace(/^File:/i, '').replace(/\.[^.]+$/, '').replace(/_/g, ' ').slice(0, 64),
              streamUrl: info.url,
              mimeType: mime,
              source: 'wikimedia',
              license: 'Wikimedia Commons',
            });
          }
        }
      }

      if (imgRes.status === 'fulfilled') {
        for (const img of imgRes.value.slice(0, 8)) {
          items.push({
            id: `wm_vimg_${img.id}`,
            kind: 'image',
            title: img.title,
            streamUrl: img.fullUrl,
            previewUrl: img.previewUrl,
            mimeType: 'image/jpeg',
            source: 'wikimedia',
            license: img.license,
          });
        }
      }

      return {
        items,
        hasMore: items.length >= 6,
      };
    } catch (err) {
      return {
        items: [],
        hasMore: false,
        networkError:
          err instanceof Error
            ? `Impossible de rechercher les médias vidéo en ligne (${err.message}).`
            : 'Erreur réseau lors de la recherche vidéo en ligne.',
      };
    }
  }
}
