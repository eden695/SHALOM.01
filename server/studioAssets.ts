import net from 'node:net';

export type CreativeAssetType = 'elements' | 'images' | 'backgrounds';

export interface OnlineCreativeAsset {
  id: string;
  assetType: CreativeAssetType;
  title: string;
  previewUrl: string;
  fullUrl: string;
  mimeType: string;
  isBitmap: true;
  width?: number;
  height?: number;
  source: 'wikimedia' | 'openverse';
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
  olivier: 'olive branch',
  agneau: 'lamb',
  calice: 'chalice',
  harpe: 'harp',
  trompette: 'trumpet',
};

function translateHintForSearch(rawQuery: string): string {
  const clean = rawQuery
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
  if (!clean) return 'dove light peace';
  const words = clean.split(/\s+/).filter(Boolean);
  const mapped = words.map((w) => ENGLISH_HINTS[w] || w);
  return mapped.join(' ');
}

function isStrictBitmapUrlAndMime(url: string, mime?: string): boolean {
  const lowerUrl = url.toLowerCase();
  if (lowerUrl.includes('.svg') || lowerUrl.startsWith('data:image/svg')) return false;
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
    if (
      lower === '::1' ||
      lower.startsWith('fe80:') ||
      lower.startsWith('fc') ||
      lower.startsWith('fd')
    ) {
      return true;
    }
  }
  return false;
}

export async function proxySafeMediaAsset(
  rawUrl: string,
  allowedPrefix: 'image' | 'any' = 'any'
): Promise<{
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
  const timeout = setTimeout(() => controller.abort(), 14000);
  try {
    const resp = await fetch(parsed.toString(), {
      signal: controller.signal,
      headers: {
        'User-Agent': 'SHALOM-Studio/1.0 (https://shalom.app)',
        Accept:
          allowedPrefix === 'image'
            ? 'image/webp,image/png,image/jpeg,image/*;q=0.8'
            : 'image/*,audio/*,video/*,application/ogg;q=0.8,*/*;q=0.5',
      },
    });
    if (!resp.ok) {
      throw new Error(`HTTP ${resp.status}`);
    }
    const contentType = (resp.headers.get('content-type') || 'application/octet-stream')
      .split(';')[0]
      .trim()
      .toLowerCase();

    if (allowedPrefix === 'image') {
      if (!contentType.startsWith('image/') || contentType.includes('svg')) {
        throw new Error('Le fichier distant n’est pas une image matricielle valide (PNG/JPG/WebP)');
      }
    } else if (
      !contentType.startsWith('image/') &&
      !contentType.startsWith('audio/') &&
      !contentType.startsWith('video/') &&
      contentType !== 'application/ogg' &&
      contentType !== 'application/octet-stream'
    ) {
      throw new Error('Type de média distant non pris en charge');
    }

    const maxBytes = allowedPrefix === 'image' ? 12 * 1024 * 1024 : 28 * 1024 * 1024;
    const contentLength = Number(resp.headers.get('content-length') || 0);
    if (contentLength > maxBytes) {
      throw new Error('Média trop volumineux');
    }
    const ab = await resp.arrayBuffer();
    if (ab.byteLength === 0 || ab.byteLength > maxBytes) {
      throw new Error('Média vide ou trop volumineux');
    }
    return {
      buffer: Buffer.from(ab),
      contentType: contentType || 'application/octet-stream',
    };
  } finally {
    clearTimeout(timeout);
  }
}

export async function proxySafeAssetImage(rawUrl: string): Promise<{
  buffer: Buffer;
  contentType: string;
}> {
  return proxySafeMediaAsset(rawUrl, 'image');
}

async function fetchWikimediaBitmaps(
  query: string,
  page: number,
  assetType: CreativeAssetType
): Promise<OnlineCreativeAsset[]> {
  const baseQuery = translateHintForSearch(query);
  const effectiveQuery =
    assetType === 'elements'
      ? `${baseQuery} png filetype:bitmap`
      : assetType === 'backgrounds' && !baseQuery.includes('background') && !baseQuery.includes('texture')
        ? `${baseQuery} sky light texture filetype:bitmap`
        : `${baseQuery} filetype:bitmap`;
  const offset = Math.max(0, (page - 1) * 14);
  const url = `https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrnamespace=6&gsrsearch=${encodeURIComponent(
    effectiveQuery
  )}&gsrlimit=14&gsroffset=${offset}&prop=imageinfo&iiprop=url|mime|size|extmetadata&iiurlwidth=1080&format=json&origin=*`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 6000);
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
        fullUrl: info.url && info.url.startsWith('https://') && isStrictBitmapUrlAndMime(info.url, mime) ? info.url : chosenUrl,
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
  } catch {
    return [];
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchOpenverseBitmaps(
  query: string,
  page: number,
  assetType: CreativeAssetType
): Promise<OnlineCreativeAsset[]> {
  const baseQuery = translateHintForSearch(query);
  const extraParams =
    assetType === 'elements'
      ? '&extension=png'
      : assetType === 'backgrounds'
        ? '&aspect_ratio=wide,square'
        : '';
  const url = `https://api.openverse.org/v1/images/?q=${encodeURIComponent(
    baseQuery
  )}&page=${page}&page_size=14${extraParams}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 6000);
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
            r.thumbnail && r.thumbnail.startsWith('https://') && !r.thumbnail.toLowerCase().includes('.svg')
              ? r.thumbnail
              : r.url!,
          fullUrl: r.url!,
          mimeType: mime,
          isBitmap: true as const,
          width: r.width,
          height: r.height,
          source: 'openverse' as const,
          author: r.creator,
          license: r.license,
        };
      });
  } catch {
    return [];
  } finally {
    clearTimeout(timeout);
  }
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
  const query = (params.query || '').trim() || (assetType === 'elements' ? 'dove' : 'sky light');
  const page = Math.max(1, Number(params.page) || 1);

  const [wikimedia, openverse] = await Promise.all([
    fetchWikimediaBitmaps(query, page, assetType),
    fetchOpenverseBitmaps(query, page, assetType),
  ]);

  const seenUrls = new Set<string>();
  const combined: OnlineCreativeAsset[] = [];

  for (const item of [...openverse, ...wikimedia]) {
    if (!isStrictBitmapUrlAndMime(item.fullUrl, item.mimeType)) continue;
    if (!seenUrls.has(item.fullUrl)) {
      seenUrls.add(item.fullUrl);
      combined.push(item);
    }
  }

  // For Elements search, sort true PNG bitmaps first
  if (assetType === 'elements') {
    combined.sort((a, b) => {
      const aPng = a.mimeType.includes('png') ? 0 : 1;
      const bPng = b.mimeType.includes('png') ? 0 : 1;
      return aPng - bPng;
    });
  }

  return {
    assets: combined,
    page,
    hasMore: combined.length >= 6 || page < 15,
  };
}
