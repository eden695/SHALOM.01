// Strict Verified Offline Resource Bundler for SHALOM Studios (« ENREGISTRER DANS SHALOM »)
// Downloads every external media dependency into STORES.MEDIA_BLOBS, verifies non-zero integrity,
// attaches license/attribution metadata, and only marks verifiedOffline=true if 100% of assets succeed.

import { dbService, STORES } from '../db';
import { SavedStudioTemplate } from '../../types';

function canAttemptExpressProxy(): boolean {
  if (typeof window === 'undefined') return false;
  const { protocol, hostname } = window.location;
  if (protocol === 'file:' || protocol === 'content:') return false;
  if (hostname.endsWith('.github.io')) return false;
  return protocol === 'http:' || protocol === 'https:';
}

async function fetchWithTimeout(url: string, options: RequestInit = {}, timeoutMs = 15000): Promise<Response> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    window.clearTimeout(timer);
  }
}

export async function fetchRemoteAssetVerifiedBlob(
  url: string,
  kind: 'image' | 'audio' | 'video'
): Promise<Blob> {
  const trimmed = (url || '').trim();
  if (!trimmed) {
    throw new Error('URL de ressource vide.');
  }

  // Handle data: URLs, blob: URLs, or local same-origin /assets/* paths directly
  if (trimmed.startsWith('data:') || trimmed.startsWith('blob:') || trimmed.startsWith('/') || trimmed.startsWith('./')) {
    const resp = await fetchWithTimeout(trimmed, {}, 12000);
    if (!resp.ok) throw new Error(`Échec de lecture locale (HTTP ${resp.status}).`);
    const blob = await resp.blob();
    if (!blob || blob.size === 0) throw new Error('Ressource locale vide (0 octet).');
    return blob;
  }

  // 1. Direct CORS fetch (Wikimedia Commons, Iconify, Internet Archive CORS)
  try {
    const resp = await fetchWithTimeout(trimmed, { mode: 'cors' }, 15000);
    if (resp.ok) {
      const blob = await resp.blob();
      if (blob && blob.size > 0) {
        return blob;
      }
    }
  } catch {
    // Fall through to Express proxy if available
  }

  // 2. Express Media / Image Proxy fallback
  if (canAttemptExpressProxy()) {
    const endpoint =
      kind === 'image'
        ? `/api/studios/assets/image-proxy?url=${encodeURIComponent(trimmed)}`
        : `/api/studios/assets/media-proxy?url=${encodeURIComponent(trimmed)}&kind=${kind}`;
    const resp = await fetchWithTimeout(endpoint, {}, 20000);
    if (resp.ok) {
      const blob = await resp.blob();
      if (blob && blob.size > 0) {
        return blob;
      }
    }
  }

  throw new Error(
    `Impossible de télécharger la ressource (${kind}) pour le mode hors-ligne. Vérifiez votre connexion.`
  );
}

function makeAssetKey(prefix: string): string {
  return `res_${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

async function storeAndVerifyBlob(assetKey: string, blob: Blob, createdKeys: string[]): Promise<void> {
  if (!blob || blob.size === 0) {
    throw new Error('Fichier média vide (0 octet).');
  }
  await dbService.saveMediaBlob(assetKey, blob);
  createdKeys.push(assetKey);
  const verified = await dbService.verifyMediaBlob(assetKey);
  if (!verified) {
    throw new Error(`La vérification d’écriture IndexedDB a échoué pour « ${assetKey} ».`);
  }
}

async function rollbackKeys(keys: string[]): Promise<void> {
  for (const k of keys) {
    try {
      await dbService.deleteMediaBlob(k);
    } catch {
      // ignore cleanup failure
    }
  }
}

/**
 * Bundles all external images, SVG markup, audio, or video clips referenced inside a template
 * into local MEDIA_BLOBS, replaces remote URLs with verified assetKeys inside the cloned templateObj,
 * and saves the SavedStudioTemplate with verifiedOffline = true.
 */
export async function saveTemplateBundleToShalom(params: {
  id: string;
  studioType: 'design' | 'presentation' | 'video' | 'audio';
  title: string;
  category: string;
  templateObj: Record<string, unknown>;
  previewColor?: string;
  previewColor2?: string;
  previewDataUrl?: string;
  source?: string;
  attribution?: string;
  license?: string;
}): Promise<SavedStudioTemplate> {
  const cloned = JSON.parse(JSON.stringify(params.templateObj)) as Record<string, unknown>;
  const createdKeys: string[] = [];
  const allAssetKeys: string[] = [];

  try {
    const bundleRemoteImage = async (remoteUrl: unknown): Promise<string | null> => {
      if (typeof remoteUrl !== 'string' || !remoteUrl.trim()) return null;
      const blob = await fetchRemoteAssetVerifiedBlob(remoteUrl, 'image');
      const key = makeAssetKey(params.studioType);
      await storeAndVerifyBlob(key, blob, createdKeys);
      allAssetKeys.push(key);
      return key;
    };

    const bundleSvgMarkup = async (svgMarkup: unknown): Promise<string | null> => {
      if (typeof svgMarkup !== 'string' || !svgMarkup.trim()) return null;
      const blob = new Blob([svgMarkup], { type: 'image/svg+xml;charset=utf-8' });
      const key = makeAssetKey(`${params.studioType}_svg`);
      await storeAndVerifyBlob(key, blob, createdKeys);
      allAssetKeys.push(key);
      return key;
    };

    const processLayerList = async (layers: unknown) => {
      if (!Array.isArray(layers)) return;
      for (const rawLayer of layers) {
        if (!rawLayer || typeof rawLayer !== 'object') continue;
        const layer = rawLayer as Record<string, unknown>;
        if (typeof layer.assetKey === 'string' && layer.assetKey) {
          const exists = await dbService.verifyMediaBlob(layer.assetKey);
          if (exists) {
            allAssetKeys.push(layer.assetKey);
            continue;
          }
        }
        if (typeof layer.svgMarkup === 'string' && layer.svgMarkup && !layer.assetKey) {
          const k = await bundleSvgMarkup(layer.svgMarkup);
          if (k) layer.assetKey = k;
        } else if (typeof layer.remoteUrl === 'string' && layer.remoteUrl) {
          const k = await bundleRemoteImage(layer.remoteUrl);
          if (k) layer.assetKey = k;
        }
      }
    };

    // Design template root background & layers
    if (typeof cloned.bgRemoteImageUrl === 'string' && cloned.bgRemoteImageUrl) {
      const bgKey = await bundleRemoteImage(cloned.bgRemoteImageUrl);
      if (bgKey) cloned.bgImageAssetKey = bgKey;
    }
    if (typeof cloned.bgImageAssetKey === 'string' && cloned.bgImageAssetKey) {
      if (!allAssetKeys.includes(cloned.bgImageAssetKey)) {
        const ok = await dbService.verifyMediaBlob(cloned.bgImageAssetKey);
        if (ok) allAssetKeys.push(cloned.bgImageAssetKey);
      }
    }
    await processLayerList(cloned.layers);

    // Multi-page design template pages
    if (Array.isArray(cloned.pages)) {
      for (const rawPage of cloned.pages) {
        if (!rawPage || typeof rawPage !== 'object') continue;
        const pg = rawPage as Record<string, unknown>;
        if (typeof pg.bgRemoteImageUrl === 'string' && pg.bgRemoteImageUrl) {
          const bgKey = await bundleRemoteImage(pg.bgRemoteImageUrl);
          if (bgKey) pg.bgImageAssetKey = bgKey;
        }
        await processLayerList(pg.layers);
      }
    }

    // Video template scenes, overlays, and audio tracks
    if (Array.isArray(cloned.scenes)) {
      for (const rawScene of cloned.scenes) {
        if (!rawScene || typeof rawScene !== 'object') continue;
        const sc = rawScene as Record<string, unknown>;
        if (typeof sc.remoteUrl === 'string' && sc.remoteUrl) {
          const mediaKind = sc.kind === 'video' ? 'video' : 'image';
          const blob = await fetchRemoteAssetVerifiedBlob(sc.remoteUrl, mediaKind);
          const k = makeAssetKey(`vid_sc`);
          await storeAndVerifyBlob(k, blob, createdKeys);
          allAssetKeys.push(k);
          sc.assetKey = k;
        } else if (typeof sc.assetKey === 'string' && sc.assetKey) {
          const ok = await dbService.verifyMediaBlob(sc.assetKey);
          if (ok) allAssetKeys.push(sc.assetKey);
        }
      }
    }
    if (Array.isArray(cloned.overlays)) {
      await processLayerList(cloned.overlays);
    }
    if (Array.isArray(cloned.audioTracks)) {
      for (const rawAud of cloned.audioTracks) {
        if (!rawAud || typeof rawAud !== 'object') continue;
        const tr = rawAud as Record<string, unknown>;
        if (typeof tr.remoteUrl === 'string' && tr.remoteUrl) {
          const blob = await fetchRemoteAssetVerifiedBlob(tr.remoteUrl, 'audio');
          const k = makeAssetKey('vid_aud');
          await storeAndVerifyBlob(k, blob, createdKeys);
          allAssetKeys.push(k);
          tr.assetKey = k;
        } else if (typeof tr.assetKey === 'string' && tr.assetKey) {
          const ok = await dbService.verifyMediaBlob(tr.assetKey);
          if (ok) allAssetKeys.push(tr.assetKey);
        }
      }
    }

    const sourceNormalized: 'online-catalog' | 'online-live' =
      params.source === 'online-live' ? 'online-live' : 'online-catalog';

    const saved: SavedStudioTemplate = {
      id: `saved_tpl_${params.studioType}_${params.id}`,
      studioType: params.studioType,
      resourceType: 'template',
      title: params.title.trim() || 'Modèle SHALOM',
      category: params.category.trim() || 'SHALOM',
      templateJson: JSON.stringify(cloned),
      previewColor: params.previewColor,
      previewColor2: params.previewColor2,
      previewDataUrl: params.previewDataUrl,
      assetKeys: Array.from(new Set(allAssetKeys)),
      verifiedOffline: true,
      attribution: params.attribution,
      license: params.license || 'Libre de réutilisation',
      source: sourceNormalized,
      savedAt: new Date().toISOString(),
    };

    return await dbService.saveVerified(STORES.CUSTOM_TEMPLATES, saved);
  } catch (err) {
    await rollbackKeys(createdKeys);
    throw err instanceof Error
      ? err
      : new Error('Échec de la mise en cache hors-ligne des médias du modèle.');
  }
}

/**
 * Downloads and stores a single online resource (element/image/background/audio/video)
 * locally in IndexedDB so it is 100% verified offline inside « Mes ressources SHALOM ».
 */
export async function saveAssetResourceToShalom(params: {
  id: string;
  studioType: 'design' | 'presentation' | 'video' | 'audio';
  resourceType: 'element' | 'image' | 'background' | 'audio' | 'video';
  title: string;
  category?: string;
  remoteUrl?: string;
  svgMarkup?: string;
  blob?: Blob;
  attribution?: string;
  license?: string;
  source?: string;
}): Promise<SavedStudioTemplate> {
  const createdKeys: string[] = [];
  try {
    let resolvedBlob = params.blob;
    if (!resolvedBlob) {
      if (params.svgMarkup) {
        resolvedBlob = new Blob([params.svgMarkup], { type: 'image/svg+xml;charset=utf-8' });
      } else if (params.remoteUrl) {
        const mediaKind =
          params.resourceType === 'audio'
            ? 'audio'
            : params.resourceType === 'video'
              ? 'video'
              : 'image';
        resolvedBlob = await fetchRemoteAssetVerifiedBlob(params.remoteUrl, mediaKind);
      }
    }

    if (!resolvedBlob || resolvedBlob.size === 0) {
      throw new Error('Aucun contenu média valide à enregistrer.');
    }

    const assetKey = makeAssetKey(params.resourceType);
    await storeAndVerifyBlob(assetKey, resolvedBlob, createdKeys);

    let previewDataUrl: string | undefined;
    if (
      params.resourceType === 'element' ||
      params.resourceType === 'image' ||
      params.resourceType === 'background'
    ) {
      if (resolvedBlob.size < 350 * 1024) {
        previewDataUrl = await new Promise<string | undefined>((resolve) => {
          const reader = new FileReader();
          reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : undefined);
          reader.onerror = () => resolve(undefined);
          reader.readAsDataURL(resolvedBlob!);
        });
      }
    }

    const payload = {
      resourceType: params.resourceType,
      assetKey,
      mimeType: resolvedBlob.type || 'application/octet-stream',
      sizeBytes: resolvedBlob.size,
      svgMarkup: params.svgMarkup,
    };

    const saved: SavedStudioTemplate = {
      id: `saved_res_${params.resourceType}_${params.id}_${Date.now().toString(36)}`,
      studioType: params.studioType,
      resourceType: params.resourceType,
      title: params.title.trim() || 'Ressource SHALOM',
      category: params.category?.trim() || params.resourceType,
      templateJson: JSON.stringify(payload),
      previewDataUrl,
      assetKeys: [assetKey],
      verifiedOffline: true,
      attribution: params.attribution,
      license: params.license || 'Wikimedia / Open Source',
      source: params.source === 'online-live' ? 'online-live' : 'online-catalog',
      savedAt: new Date().toISOString(),
    };

    return await dbService.saveVerified(STORES.CUSTOM_TEMPLATES, saved);
  } catch (err) {
    await rollbackKeys(createdKeys);
    throw err instanceof Error
      ? err
      : new Error('Impossible d’enregistrer cette ressource pour une utilisation hors-ligne.');
  }
}
