// Unified File Import, Dedicated "SHALOM DOWNLOAD" Folder, Android Share Target & Native Bridge Service

export const SHALOM_DOWNLOAD_FOLDER = 'SHALOM DOWNLOAD';

export interface ShalomAndroidBridge {
  saveBase64ToDownloads?: (
    base64Data: string,
    fileName: string,
    mimeType: string,
    subFolder?: string
  ) => string | boolean;
  saveBase64ToFolder?: (
    base64Data: string,
    fileName: string,
    mimeType: string,
    folderName: string
  ) => string | boolean;
  shareBase64File?: (
    base64Data: string,
    fileName: string,
    mimeType: string,
    title: string,
    text: string
  ) => string | boolean;
  openDownloadedFile?: (fileName: string, mimeType?: string) => boolean;
  getDownloadsFolderLabel?: () => string;
  chooseShalomFolder?: () => string | boolean;
  openShalomFolder?: () => boolean;
  consumePendingSharedFiles?: () => string; // JSON array of { fileName, mimeType, base64Data }
}

declare global {
  interface Window {
    ShalomAndroid?: ShalomAndroidBridge;
    Android?: ShalomAndroidBridge;
    __TAURI__?: unknown;
    __TAURI_INTERNALS__?: unknown;
  }
}

export type ShalomRuntimeEnv =
  | 'tauri-desktop'
  | 'android-bridge'
  | 'android-webview'
  | 'iframe'
  | 'desktop-browser';

export interface VirtualShalomFileEntry {
  id: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  locationLabel: string;
  savedAt: string;
}

export interface ChooseShalomFolderOutcome {
  mode: 'tauri' | 'android-saf' | 'native-dir' | 'virtual-fallback';
  folderLabel: string | null;
  requiresVirtualExplorer: boolean;
  reason?: string;
}

export interface DownloadResult {
  ok: boolean;
  fileName: string;
  sizeBytes: number;
  method: 'android-native-bridge' | 'directory-picker' | 'browser-download';
  locationLabel: string;
  error?: string;
}

export interface RecentDownloadEntry {
  id: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  locationLabel: string;
  downloadedAt: string;
}

export interface PendingSharedFileItem {
  id: string;
  fileName: string;
  mimeType: string;
  blob: Blob;
  receivedAt: string;
  source: 'web-share-target' | 'android-intent';
}

const RECENT_DOWNLOADS_KEY = 'shalom_recent_downloads_v1';
const SHARE_INBOX_DB = 'shalom_share_target_db';
const SHARE_INBOX_STORE = 'pending_shares';
const FS_HANDLE_DB = 'shalom_fs_handles_v1';
const FS_HANDLE_STORE = 'handles';
const FS_DOWNLOAD_HANDLE_KEY = 'shalom_download_root_dir';
const VIRTUAL_FOLDER_DB = 'shalom_virtual_folder_v1';
const VIRTUAL_FOLDER_STORE = 'exports';

export function getNativeAndroidBridge(): ShalomAndroidBridge | null {
  if (typeof window === 'undefined') return null;
  if (window.ShalomAndroid && typeof window.ShalomAndroid === 'object') {
    return window.ShalomAndroid;
  }
  if (window.Android && typeof window.Android === 'object') {
    return window.Android;
  }
  return null;
}

export function isAndroidDevice(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /android/i.test(navigator.userAgent || '');
}

export function isAndroidWebView(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  return /android/i.test(ua) && (/; wv\)/i.test(ua) || /Version\/\d+\.\d+/i.test(ua));
}

export function isInsideIframe(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
}

export function isInsideCrossOriginIframe(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    if (window.self === window.top) return false;
    // Accessing top.location.origin throws DOMException in cross-origin iframes
    return window.top?.location.origin !== window.location.origin;
  } catch {
    return true;
  }
}

export function isTauriDesktop(): boolean {
  if (typeof window === 'undefined') return false;
  return Boolean(window.__TAURI__ || window.__TAURI_INTERNALS__);
}

export function detectShalomEnvironment(): ShalomRuntimeEnv {
  if (isTauriDesktop()) return 'tauri-desktop';
  if (getNativeAndroidBridge()) return 'android-bridge';
  if (isAndroidWebView()) return 'android-webview';
  if (isInsideIframe()) return 'iframe';
  return 'desktop-browser';
}

export function getLocalizedDownloadsLabel(isEn = false): string {
  const bridge = getNativeAndroidBridge();
  if (bridge?.getDownloadsFolderLabel) {
    try {
      const label = bridge.getDownloadsFolderLabel();
      if (label && label.trim()) {
        return label.includes(SHALOM_DOWNLOAD_FOLDER)
          ? label.trim()
          : `${label.trim()} / ${SHALOM_DOWNLOAD_FOLDER}`;
      }
    } catch {
      // ignore
    }
  }
  if (isAndroidDevice()) {
    return `Downloads / ${SHALOM_DOWNLOAD_FOLDER}`;
  }
  return isEn
    ? `Downloads / ${SHALOM_DOWNLOAD_FOLDER}`
    : `Téléchargements / ${SHALOM_DOWNLOAD_FOLDER}`;
}

const EXTENSION_MIME_MAP: Record<string, string> = {
  pdf: 'application/pdf',
  epub: 'application/epub+zip',
  txt: 'text/plain;charset=utf-8',
  md: 'text/markdown;charset=utf-8',
  csv: 'text/csv;charset=utf-8',
  json: 'application/json;charset=utf-8',
  html: 'text/html;charset=utf-8',
  htm: 'text/html;charset=utf-8',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  rtf: 'application/rtf',
  odt: 'application/vnd.oasis.opendocument.text',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  gif: 'image/gif',
  svg: 'image/svg+xml',
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
  m4a: 'audio/mp4',
  aac: 'audio/aac',
  ogg: 'audio/ogg',
  opus: 'audio/opus',
  flac: 'audio/flac',
  mp4: 'video/mp4',
  webm: 'video/webm',
  mkv: 'video/x-matroska',
  mov: 'video/quicktime',
};

export function getExtension(fileName: string): string {
  const clean = fileName.split('?')[0].split('#')[0];
  const idx = clean.lastIndexOf('.');
  if (idx <= 0 || idx === clean.length - 1) return '';
  return clean.slice(idx + 1).toLowerCase();
}

export function inferMimeType(fileName: string, rawMime?: string): string {
  const trimmed = (rawMime || '').trim();
  if (trimmed && trimmed !== 'application/octet-stream' && trimmed !== 'binary/octet-stream') {
    return trimmed;
  }
  const ext = getExtension(fileName);
  return EXTENSION_MIME_MAP[ext] || trimmed || 'application/octet-stream';
}

export function sanitizeFileName(rawName: string, fallbackBase = 'fichier_shalom', fallbackExt = ''): string {
  const trimmed = (rawName || '').trim();
  if (!trimmed) {
    return fallbackExt ? `${fallbackBase}.${fallbackExt.replace(/^\./, '')}` : fallbackBase;
  }
  const lastDot = trimmed.lastIndexOf('.');
  let base = lastDot > 0 ? trimmed.slice(0, lastDot) : trimmed;
  let ext = lastDot > 0 ? trimmed.slice(lastDot + 1) : fallbackExt.replace(/^\./, '');

  base = base
    .replace(/[\\/:*?"<>|\x00-\x1f]/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120);
  if (!base) base = fallbackBase;

  ext = ext.replace(/[^a-z0-9]/gi, '').toLowerCase().slice(0, 12);
  return ext ? `${base}.${ext}` : base;
}

export function resolveUniqueFileName(desiredName: string, existingNames: string[]): string {
  const lowerSet = new Set(existingNames.map((n) => n.toLowerCase()));
  if (!lowerSet.has(desiredName.toLowerCase())) return desiredName;

  const dotIdx = desiredName.lastIndexOf('.');
  const base = dotIdx > 0 ? desiredName.slice(0, dotIdx) : desiredName;
  const ext = dotIdx > 0 ? desiredName.slice(dotIdx) : '';

  let counter = 1;
  while (counter < 500) {
    const candidate = `${base} (${counter})${ext}`;
    if (!lowerSet.has(candidate.toLowerCase())) return candidate;
    counter++;
  }
  return `${base}_${Date.now()}${ext}`;
}

export async function blobToBase64(blob: Blob): Promise<string> {
  const buffer = await blob.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

function base64ToBlob(base64Data: string, mimeType: string): Blob {
  const cleanB64 = base64Data.includes(',') ? base64Data.split(',')[1] : base64Data;
  const byteChars = atob(cleanB64);
  const byteNums = new Uint8Array(byteChars.length);
  for (let i = 0; i < byteChars.length; i++) {
    byteNums[i] = byteChars.charCodeAt(i);
  }
  return new Blob([byteNums], { type: mimeType || 'application/octet-stream' });
}

export function getRecentDownloads(): RecentDownloadEntry[] {
  try {
    const raw = localStorage.getItem(RECENT_DOWNLOADS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function recordRecentDownload(entry: RecentDownloadEntry) {
  try {
    const prev = getRecentDownloads();
    const next = [entry, ...prev.filter((e) => e.fileName !== entry.fileName)].slice(0, 25);
    localStorage.setItem(RECENT_DOWNLOADS_KEY, JSON.stringify(next));
  } catch {
    // ignore storage errors
  }
}

// Optional Desktop / Chrome File System Access persistence for exact "SHALOM DOWNLOAD" subfolder
type DirHandleLike = {
  name: string;
  queryPermission?: (opts: { mode: 'readwrite' }) => Promise<'granted' | 'denied' | 'prompt'>;
  requestPermission?: (opts: { mode: 'readwrite' }) => Promise<'granted' | 'denied' | 'prompt'>;
  getDirectoryHandle: (name: string, opts?: { create?: boolean }) => Promise<DirHandleLike>;
  getFileHandle: (name: string, opts?: { create?: boolean }) => Promise<{
    createWritable: () => Promise<{
      write: (data: Blob) => Promise<void>;
      close: () => Promise<void>;
    }>;
  }>;
};

async function openHandleDb(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === 'undefined') return null;
  return new Promise((resolve) => {
    const req = indexedDB.open(FS_HANDLE_DB, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(FS_HANDLE_STORE)) {
        req.result.createObjectStore(FS_HANDLE_STORE, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => resolve(null);
  });
}

async function getPersistedShalomDownloadDir(): Promise<DirHandleLike | null> {
  try {
    const db = await openHandleDb();
    if (!db) return null;
    const handle = await new Promise<DirHandleLike | null>((resolve) => {
      const tx = db.transaction(FS_HANDLE_STORE, 'readonly');
      const req = tx.objectStore(FS_HANDLE_STORE).get(FS_DOWNLOAD_HANDLE_KEY);
      req.onsuccess = () => resolve((req.result as { handle?: DirHandleLike } | undefined)?.handle || null);
      req.onerror = () => resolve(null);
    });
    if (!handle) return null;
    if (handle.queryPermission) {
      const perm = await handle.queryPermission({ mode: 'readwrite' });
      if (perm !== 'granted') return null;
    }
    return handle;
  } catch {
    return null;
  }
}

async function openVirtualFolderDb(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === 'undefined') return null;
  return new Promise((resolve) => {
    const req = indexedDB.open(VIRTUAL_FOLDER_DB, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(VIRTUAL_FOLDER_STORE)) {
        req.result.createObjectStore(VIRTUAL_FOLDER_STORE, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => resolve(null);
  });
}

export async function saveBlobToVirtualShalomFolder(
  blob: Blob,
  fileName: string,
  mimeType: string,
  locationLabel: string
): Promise<void> {
  try {
    if (!blob || blob.size === 0 || blob.size > 60 * 1024 * 1024) return;
    const db = await openVirtualFolderDb();
    if (!db) return;
    const buffer = await blob.arrayBuffer();
    const id = `vsh_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    await new Promise<void>((resolve) => {
      const tx = db.transaction(VIRTUAL_FOLDER_STORE, 'readwrite');
      const store = tx.objectStore(VIRTUAL_FOLDER_STORE);
      store.put({
        id,
        fileName,
        mimeType,
        sizeBytes: buffer.byteLength,
        locationLabel,
        savedAt: new Date().toISOString(),
        buffer,
      });
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } catch {
    // non-fatal mirror cache failure
  }
}

export async function listVirtualShalomFiles(): Promise<VirtualShalomFileEntry[]> {
  try {
    const db = await openVirtualFolderDb();
    if (!db) return [];
    const items = await new Promise<Array<VirtualShalomFileEntry & { buffer?: ArrayBuffer }>>(
      (resolve) => {
        const tx = db.transaction(VIRTUAL_FOLDER_STORE, 'readonly');
        const req = tx.objectStore(VIRTUAL_FOLDER_STORE).getAll();
        req.onsuccess = () => resolve((req.result as never[]) || []);
        req.onerror = () => resolve([]);
      }
    );
    return items
      .map((item) => ({
        id: item.id,
        fileName: item.fileName,
        mimeType: item.mimeType,
        sizeBytes: item.sizeBytes,
        locationLabel: item.locationLabel,
        savedAt: item.savedAt,
      }))
      .sort((a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime());
  } catch {
    return [];
  }
}

export async function getVirtualShalomFileBlob(
  id: string
): Promise<{ blob: Blob; entry: VirtualShalomFileEntry } | null> {
  try {
    const db = await openVirtualFolderDb();
    if (!db) return null;
    const rec = await new Promise<
      (VirtualShalomFileEntry & { buffer?: ArrayBuffer }) | null
    >((resolve) => {
      const tx = db.transaction(VIRTUAL_FOLDER_STORE, 'readonly');
      const req = tx.objectStore(VIRTUAL_FOLDER_STORE).get(id);
      req.onsuccess = () => resolve((req.result as never) || null);
      req.onerror = () => resolve(null);
    });
    if (!rec || !rec.buffer) return null;
    return {
      blob: new Blob([rec.buffer], { type: rec.mimeType || 'application/octet-stream' }),
      entry: {
        id: rec.id,
        fileName: rec.fileName,
        mimeType: rec.mimeType,
        sizeBytes: rec.sizeBytes,
        locationLabel: rec.locationLabel,
        savedAt: rec.savedAt,
      },
    };
  } catch {
    return null;
  }
}

export async function deleteVirtualShalomFile(id: string): Promise<void> {
  try {
    const db = await openVirtualFolderDb();
    if (!db) return;
    await new Promise<void>((resolve) => {
      const tx = db.transaction(VIRTUAL_FOLDER_STORE, 'readwrite');
      tx.objectStore(VIRTUAL_FOLDER_STORE).delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } catch {
    // ignore
  }
}

export async function chooseShalomDownloadDirectory(): Promise<ChooseShalomFolderOutcome> {
  const env = detectShalomEnvironment();

  // 1. Android Native Bridge (SAF / Download/SHALOM DOWNLOAD)
  const bridge = getNativeAndroidBridge();
  if (bridge?.chooseShalomFolder) {
    try {
      const res = bridge.chooseShalomFolder();
      if (res === true || (typeof res === 'string' && res.trim() && res !== 'false')) {
        return {
          mode: 'android-saf',
          folderLabel:
            typeof res === 'string' && res !== 'true'
              ? res
              : `Downloads / ${SHALOM_DOWNLOAD_FOLDER}`,
          requiresVirtualExplorer: false,
        };
      }
    } catch {
      // fall through safely
    }
  }
  if (env === 'android-webview' || env === 'android-bridge') {
    if (bridge?.openShalomFolder) {
      try {
        bridge.openShalomFolder();
      } catch {
        // ignore
      }
    }
    return {
      mode: 'android-saf',
      folderLabel: `Downloads / ${SHALOM_DOWNLOAD_FOLDER}`,
      requiresVirtualExplorer: true,
      reason: 'Accès rapide aux fichiers exportés dans Téléchargements / SHALOM DOWNLOAD.',
    };
  }

  // 2. Cross-origin iframe safety check — NEVER invoke showDirectoryPicker inside cross-origin iframe
  if (isInsideIframe()) {
    return {
      mode: 'virtual-fallback',
      folderLabel: null,
      requiresVirtualExplorer: true,
      reason:
        'Mode aperçu intégré : l’explorateur interne « DOSSIER SHALOM » conserve vos exports en IndexedDB avec téléchargement direct.',
    };
  }

  // 3. Desktop File System Access API (Chrome / Edge / Tauri WebView desktop)
  const win = window as unknown as {
    showDirectoryPicker?: (opts?: {
      id?: string;
      mode?: 'readwrite';
      startIn?: string;
    }) => Promise<DirHandleLike>;
  };

  if (typeof win.showDirectoryPicker === 'function') {
    try {
      const picked = await win.showDirectoryPicker({
        id: 'shalom-download-root',
        mode: 'readwrite',
        startIn: 'downloads',
      });
      const shalomDir =
        picked.name.toUpperCase() === SHALOM_DOWNLOAD_FOLDER
          ? picked
          : await picked.getDirectoryHandle(SHALOM_DOWNLOAD_FOLDER, { create: true });
      const db = await openHandleDb();
      if (db) {
        await new Promise<void>((resolve) => {
          const tx = db.transaction(FS_HANDLE_STORE, 'readwrite');
          tx.objectStore(FS_HANDLE_STORE).put({ id: FS_DOWNLOAD_HANDLE_KEY, handle: shalomDir });
          tx.oncomplete = () => resolve();
          tx.onerror = () => resolve();
        });
      }
      return {
        mode: env === 'tauri-desktop' ? 'tauri' : 'native-dir',
        folderLabel: `${picked.name}/${SHALOM_DOWNLOAD_FOLDER}`,
        requiresVirtualExplorer: false,
      };
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        return {
          mode: 'native-dir',
          folderLabel: null,
          requiresVirtualExplorer: false,
        };
      }
      // SecurityError / NotAllowedError fallback cleanly into virtual SHALOM explorer
      return {
        mode: 'virtual-fallback',
        folderLabel: null,
        requiresVirtualExplorer: true,
        reason:
          'Accès dossier système refusé par le navigateur : ouverture de l’explorateur interne « DOSSIER SHALOM ».',
      };
    }
  }

  // 4. Fallback for Firefox / Safari / non-FSA browsers
  return {
    mode: 'virtual-fallback',
    folderLabel: null,
    requiresVirtualExplorer: true,
    reason:
      'Votre navigateur gère les téléchargements automatiquement. Retrouvez et gérez vos exports dans l’explorateur « DOSSIER SHALOM ».',
  };
}

export function supportsDirectorySelection(): boolean {
  return (
    typeof window !== 'undefined' &&
    'showDirectoryPicker' in window &&
    !isAndroidWebView() &&
    !isInsideIframe()
  );
}

export async function downloadBlobToDevice(
  blob: Blob,
  desiredFileName: string,
  mimeHint?: string
): Promise<DownloadResult> {
  const cleanName = sanitizeFileName(desiredFileName);
  const mimeType = inferMimeType(cleanName, mimeHint || blob.type);
  const locationLabel = getLocalizedDownloadsLabel();

  if (!blob || blob.size === 0) {
    return {
      ok: false,
      fileName: cleanName,
      sizeBytes: 0,
      method: 'browser-download',
      locationLabel,
      error: 'Le fichier est vide (0 octet) et ne peut pas être téléchargé.',
    };
  }

  const recentNames = getRecentDownloads().map((r) => r.fileName);
  const finalName = resolveUniqueFileName(cleanName, recentNames);

  // 1. Native Android Bridge -> dedicated "Download/SHALOM DOWNLOAD/" folder via MediaStore
  const bridge = getNativeAndroidBridge();
  if (bridge?.saveBase64ToFolder || bridge?.saveBase64ToDownloads) {
    try {
      const b64 = await blobToBase64(blob);
      const res = bridge.saveBase64ToFolder
        ? bridge.saveBase64ToFolder(b64, finalName, mimeType, SHALOM_DOWNLOAD_FOLDER)
        : bridge.saveBase64ToDownloads!(b64, finalName, mimeType, SHALOM_DOWNLOAD_FOLDER);

      const succeeded =
        res === true || (typeof res === 'string' && res !== 'false' && !res.startsWith('ERROR:'));
      if (succeeded) {
        const finalLoc =
          typeof res === 'string' && res.trim() && res !== 'true'
            ? res
            : `Download / ${SHALOM_DOWNLOAD_FOLDER}`;
        await saveBlobToVirtualShalomFolder(blob, finalName, mimeType, finalLoc);
        recordRecentDownload({
          id: `dl_${Date.now()}`,
          fileName: finalName,
          mimeType,
          sizeBytes: blob.size,
          locationLabel: finalLoc,
          downloadedAt: new Date().toISOString(),
        });
        return {
          ok: true,
          fileName: finalName,
          sizeBytes: blob.size,
          method: 'android-native-bridge',
          locationLabel: finalLoc,
        };
      }
    } catch (err) {
      return {
        ok: false,
        fileName: finalName,
        sizeBytes: blob.size,
        method: 'android-native-bridge',
        locationLabel,
        error: err instanceof Error ? err.message : 'Échec du pont natif Android.',
      };
    }
  }

  // 2. Desktop File System Access handle if user selected their SHALOM DOWNLOAD folder
  try {
    const dirHandle = await getPersistedShalomDownloadDir();
    if (dirHandle) {
      const fileHandle = await dirHandle.getFileHandle(finalName, { create: true });
      const writable = await fileHandle.createWritable();
      await writable.write(blob);
      await writable.close();
      const folderPath = `${SHALOM_DOWNLOAD_FOLDER}/${finalName}`;
      await saveBlobToVirtualShalomFolder(blob, finalName, mimeType, folderPath);
      recordRecentDownload({
        id: `dl_${Date.now()}`,
        fileName: finalName,
        mimeType,
        sizeBytes: blob.size,
        locationLabel: folderPath,
        downloadedAt: new Date().toISOString(),
      });
      return {
        ok: true,
        fileName: finalName,
        sizeBytes: blob.size,
        method: 'directory-picker',
        locationLabel: folderPath,
      };
    }
  } catch {
    // Fall back to standard browser DownloadManager
  }

  // 3. Standard browser / PWA / Android Chrome DownloadManager flow + IndexedDB virtual folder mirror
  try {
    const typedBlob = blob.type === mimeType ? blob : new Blob([blob], { type: mimeType });
    await saveBlobToVirtualShalomFolder(typedBlob, finalName, mimeType, locationLabel);
    const url = URL.createObjectURL(typedBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = finalName;
    link.rel = 'noopener';
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    window.setTimeout(() => {
      try {
        URL.revokeObjectURL(url);
      } catch {
        // ignore
      }
    }, 30000);

    recordRecentDownload({
      id: `dl_${Date.now()}`,
      fileName: finalName,
      mimeType,
      sizeBytes: blob.size,
      locationLabel,
      downloadedAt: new Date().toISOString(),
    });

    return {
      ok: true,
      fileName: finalName,
      sizeBytes: blob.size,
      method: 'browser-download',
      locationLabel,
    };
  } catch (err) {
    return {
      ok: false,
      fileName: finalName,
      sizeBytes: blob.size,
      method: 'browser-download',
      locationLabel,
      error: err instanceof Error ? err.message : 'Erreur lors du téléchargement.',
    };
  }
}

export async function readFileAsVerifiedBlob(file: File): Promise<{
  blob: Blob;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
}> {
  if (!file) {
    throw new Error('Aucun fichier fourni.');
  }
  const cleanName = sanitizeFileName(file.name, 'document_shalom');
  const mimeType = inferMimeType(cleanName, file.type);

  if (file.size === 0) {
    throw new Error(
      `Le fichier « ${cleanName} » est vide (0 octet) ou son téléchargement Android n'est pas terminé.`
    );
  }

  let buffer: ArrayBuffer;
  try {
    buffer = await file.arrayBuffer();
  } catch {
    throw new Error(
      `Impossible de lire « ${cleanName} ». Vérifiez que le fichier est bien téléchargé localement sur l'appareil.`
    );
  }

  if (!buffer || buffer.byteLength === 0) {
    throw new Error(`Le contenu de « ${cleanName} » est illisible (0 octet lu).`);
  }

  const verifiedBlob = new Blob([buffer], { type: mimeType });
  return {
    blob: verifiedBlob,
    fileName: cleanName,
    mimeType,
    sizeBytes: buffer.byteLength,
  };
}

// =========================================================================
// ANDROID SHARE TARGET & WEB SHARE INBOX QUEUE (Coffres des Partages)
// =========================================================================

export async function consumePendingSharedFiles(): Promise<PendingSharedFileItem[]> {
  const results: PendingSharedFileItem[] = [];

  // 1. Check Native Android Intent Bridge (ACTION_SEND / ACTION_VIEW)
  const bridge = getNativeAndroidBridge();
  if (bridge?.consumePendingSharedFiles) {
    try {
      const rawJson = bridge.consumePendingSharedFiles();
      const arr = JSON.parse(rawJson || '[]') as Array<{
        fileName?: string;
        mimeType?: string;
        base64Data?: string;
      }>;
      if (Array.isArray(arr)) {
        arr.forEach((item, idx) => {
          if (!item.base64Data) return;
          const fileName = sanitizeFileName(item.fileName || `partage_android_${idx + 1}`);
          const mimeType = inferMimeType(fileName, item.mimeType);
          const blob = base64ToBlob(item.base64Data, mimeType);
          if (blob.size > 0) {
            results.push({
              id: `intent_${Date.now()}_${idx}`,
              fileName,
              mimeType,
              blob,
              receivedAt: new Date().toISOString(),
              source: 'android-intent',
            });
          }
        });
      }
    } catch {
      // ignore invalid bridge payload
    }
  }

  // 2. Check PWA Web Share Target Queue populated by sw.js
  if (typeof indexedDB !== 'undefined') {
    try {
      const db = await new Promise<IDBDatabase | null>((resolve) => {
        const req = indexedDB.open(SHARE_INBOX_DB, 1);
        req.onupgradeneeded = () => {
          if (!req.result.objectStoreNames.contains(SHARE_INBOX_STORE)) {
            req.result.createObjectStore(SHARE_INBOX_STORE, { keyPath: 'id' });
          }
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => resolve(null);
      });

      if (db) {
        const stored = await new Promise<
          Array<{
            id: string;
            fileName: string;
            mimeType: string;
            buffer?: ArrayBuffer;
            blob?: Blob;
            receivedAt: string;
          }>
        >((resolve) => {
          const tx = db.transaction(SHARE_INBOX_STORE, 'readonly');
          const req = tx.objectStore(SHARE_INBOX_STORE).getAll();
          req.onsuccess = () => resolve((req.result as never[]) || []);
          req.onerror = () => resolve([]);
        });

        if (stored.length > 0) {
          for (const entry of stored) {
            const blob = entry.buffer
              ? new Blob([entry.buffer], { type: entry.mimeType || 'application/octet-stream' })
              : entry.blob instanceof Blob
                ? entry.blob
                : null;
            if (blob && blob.size > 0) {
              results.push({
                id: entry.id,
                fileName: sanitizeFileName(entry.fileName || 'fichier_partage'),
                mimeType: inferMimeType(entry.fileName || '', entry.mimeType),
                blob,
                receivedAt: entry.receivedAt || new Date().toISOString(),
                source: 'web-share-target',
              });
            }
          }
          // Clear inbox after reading
          await new Promise<void>((resolve) => {
            const tx = db.transaction(SHARE_INBOX_STORE, 'readwrite');
            tx.objectStore(SHARE_INBOX_STORE).clear();
            tx.oncomplete = () => resolve();
            tx.onerror = () => resolve();
          });
        }
      }
    } catch {
      // ignore IndexedDB share queue errors
    }
  }

  return results;
}

// Lightweight Pure-TS ZIP/EPUB text extractor using standard DecompressionStream('deflate-raw')
async function inflateRawBytes(compressed: Uint8Array): Promise<Uint8Array> {
  if (typeof DecompressionStream === 'undefined') {
    throw new Error('DecompressionStream non disponible.');
  }
  const ds = new DecompressionStream('deflate-raw');
  const writer = ds.writable.getWriter();
  const safeCopy = new Uint8Array(compressed.byteLength);
  safeCopy.set(compressed);
  await writer.write(safeCopy);
  await writer.close();
  const outBuf = await new Response(ds.readable).arrayBuffer();
  return new Uint8Array(outBuf);
}

interface ZipEntry {
  name: string;
  compressionMethod: number;
  compressedSize: number;
  uncompressedSize: number;
  localHeaderOffset: number;
}

function parseZipCentralDirectory(bytes: Uint8Array): ZipEntry[] {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let eocdOffset = -1;
  const minOffset = Math.max(0, bytes.length - 65557);
  for (let i = bytes.length - 22; i >= minOffset; i--) {
    if (view.getUint32(i, true) === 0x06054b50) {
      eocdOffset = i;
      break;
    }
  }
  if (eocdOffset === -1) return [];

  const totalEntries = view.getUint16(eocdOffset + 10, true);
  const cdOffset = view.getUint32(eocdOffset + 16, true);
  const decoder = new TextDecoder('utf-8');
  const entries: ZipEntry[] = [];

  let ptr = cdOffset;
  for (let i = 0; i < totalEntries && ptr + 46 <= bytes.length; i++) {
    if (view.getUint32(ptr, true) !== 0x02014b50) break;
    const compressionMethod = view.getUint16(ptr + 10, true);
    const compressedSize = view.getUint32(ptr + 20, true);
    const uncompressedSize = view.getUint32(ptr + 24, true);
    const fileNameLen = view.getUint16(ptr + 28, true);
    const extraLen = view.getUint16(ptr + 30, true);
    const commentLen = view.getUint16(ptr + 32, true);
    const localHeaderOffset = view.getUint32(ptr + 42, true);
    const nameBytes = bytes.subarray(ptr + 46, ptr + 46 + fileNameLen);
    entries.push({
      name: decoder.decode(nameBytes),
      compressionMethod,
      compressedSize,
      uncompressedSize,
      localHeaderOffset,
    });
    ptr += 46 + fileNameLen + extraLen + commentLen;
  }

  return entries;
}

async function readZipEntryBytes(bytes: Uint8Array, entry: ZipEntry): Promise<Uint8Array | null> {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const off = entry.localHeaderOffset;
  if (off + 30 > bytes.length || view.getUint32(off, true) !== 0x04034b50) return null;
  const nameLen = view.getUint16(off + 26, true);
  const extraLen = view.getUint16(off + 28, true);
  const dataStart = off + 30 + nameLen + extraLen;
  const slice = bytes.subarray(dataStart, dataStart + entry.compressedSize);

  if (entry.compressionMethod === 0) return slice;
  if (entry.compressionMethod === 8) return inflateRawBytes(slice);
  return null;
}

export async function extractEpubReadableText(blob: Blob): Promise<string> {
  const buffer = await blob.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  const entries = parseZipCentralDirectory(bytes);
  if (entries.length === 0) {
    throw new Error('Archive EPUB invalide ou protégée.');
  }

  const decoder = new TextDecoder('utf-8');
  const htmlEntries = entries
    .filter((e) => /\.(xhtml|html|htm)$/i.test(e.name) && !e.name.toLowerCase().includes('nav'))
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));

  if (htmlEntries.length === 0) {
    throw new Error('Aucun chapitre texte trouvé dans cet EPUB.');
  }

  const parser = new DOMParser();
  const parts: string[] = [];
  const maxChapters = Math.min(htmlEntries.length, 60);

  for (let i = 0; i < maxChapters; i++) {
    const raw = await readZipEntryBytes(bytes, htmlEntries[i]);
    if (!raw) continue;
    const htmlStr = decoder.decode(raw);
    const doc = parser.parseFromString(htmlStr, 'text/html');
    doc.querySelectorAll('script, style').forEach((el) => el.remove());
    const text = (doc.body?.textContent || '')
      .replace(/\r/g, '')
      .replace(/[ \t]+\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
    if (text.length > 20) {
      parts.push(text);
    }
  }

  if (parts.length === 0) {
    throw new Error('Le contenu texte de cet EPUB n’a pas pu être extrait.');
  }

  return parts.join('\n\n────────────────────────\n\n');
}
