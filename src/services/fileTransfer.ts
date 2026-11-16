// Unified File Import, Android Downloads, MIME Inference, EPUB Reader & Native Bridge Service

export interface ShalomAndroidBridge {
  saveBase64ToDownloads?: (
    base64Data: string,
    fileName: string,
    mimeType: string
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
}

declare global {
  interface Window {
    ShalomAndroid?: ShalomAndroidBridge;
    Android?: ShalomAndroidBridge;
  }
}

export interface DownloadResult {
  ok: boolean;
  fileName: string;
  sizeBytes: number;
  method: 'android-native-bridge' | 'browser-download' | 'file-picker';
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

const RECENT_DOWNLOADS_KEY = 'shalom_recent_downloads_v1';

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

export function getLocalizedDownloadsLabel(isEn = false): string {
  const bridge = getNativeAndroidBridge();
  if (bridge?.getDownloadsFolderLabel) {
    try {
      const label = bridge.getDownloadsFolderLabel();
      if (label && label.trim()) return label.trim();
    } catch {
      // ignore
    }
  }
  if (typeof navigator !== 'undefined') {
    const lang = (navigator.language || '').toLowerCase();
    if (lang.startsWith('fr')) return 'Téléchargements (Downloads)';
    if (lang.startsWith('es')) return 'Descargas (Downloads)';
    if (lang.startsWith('pt')) return 'Transferências / Downloads';
    if (lang.startsWith('de')) return 'Downloads';
  }
  return isEn ? 'Downloads' : 'Téléchargements / Downloads';
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

  // Strip only OS-forbidden characters while keeping accents, spaces, hyphens, parentheses
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
    const next = [entry, ...prev.filter((e) => e.fileName !== entry.fileName)].slice(0, 20);
    localStorage.setItem(RECENT_DOWNLOADS_KEY, JSON.stringify(next));
  } catch {
    // ignore storage errors
  }
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

  // Ensure non-empty unique filename against recent downloads in session
  const recentNames = getRecentDownloads().map((r) => r.fileName);
  const finalName = resolveUniqueFileName(cleanName, recentNames);

  // 1. Check Native Android WebView Bridge (Website 2 APK / Custom Android Wrapper)
  const bridge = getNativeAndroidBridge();
  if (bridge?.saveBase64ToDownloads) {
    try {
      const b64 = await blobToBase64(blob);
      const res = bridge.saveBase64ToDownloads(b64, finalName, mimeType);
      const succeeded =
        res === true || (typeof res === 'string' && res !== 'false' && !res.startsWith('ERROR:'));
      if (succeeded) {
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
          method: 'android-native-bridge',
          locationLabel: typeof res === 'string' && res.trim() && res !== 'true' ? res : locationLabel,
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

  // 2. Standard browser / PWA / Android Chrome DownloadManager flow
  // IMPORTANT: Delay URL.revokeObjectURL by 30s so Android DownloadManager can finish reading the blob
  try {
    const typedBlob = blob.type === mimeType ? blob : new Blob([blob], { type: mimeType });
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

  // Read full ArrayBuffer right away so Android content:// URI permissions cannot expire mid-import
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
  // Find End of Central Directory (0x06054b50) scanning backwards from end
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

  if (entry.compressionMethod === 0) {
    return slice;
  }
  if (entry.compressionMethod === 8) {
    return inflateRawBytes(slice);
  }
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
