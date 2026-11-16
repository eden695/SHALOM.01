// Social Sharing Helper for SHALOM (Android Native Share Sheet, WhatsApp, Gmail, Bluetooth, Facebook, Instagram, X, TikTok)
import {
  blobToBase64,
  downloadBlobToDevice,
  getNativeAndroidBridge,
  inferMimeType,
  sanitizeFileName,
} from './fileTransfer';

export type SocialPlatform = 'native' | 'whatsapp' | 'facebook' | 'instagram' | 'x' | 'tiktok';

export interface SharePayload {
  title: string;
  text: string;
  url?: string;
  file?: File;
}

export async function normalizeMediaToShareFile(
  blob: Blob,
  fileNameBase: string,
  mediaType?: 'image' | 'video' | 'audio' | 'document',
  mimeHint?: string
): Promise<File> {
  const safeBase = sanitizeFileName(fileNameBase, 'shalom_media');
  const rawMime = inferMimeType(safeBase, mimeHint || blob.type || '');

  if (
    mediaType === 'document' ||
    rawMime.includes('pdf') ||
    rawMime.includes('epub') ||
    rawMime.startsWith('text/') ||
    rawMime.includes('word') ||
    rawMime.includes('officedocument')
  ) {
    const ext = rawMime.includes('pdf')
      ? 'pdf'
      : rawMime.includes('epub')
        ? 'epub'
        : rawMime.includes('markdown')
          ? 'md'
          : rawMime.includes('wordprocessingml')
            ? 'docx'
            : rawMime.includes('msword')
              ? 'doc'
              : 'txt';
    const finalName = safeBase.includes('.') ? safeBase : `${safeBase}.${ext}`;
    return new File([blob], finalName, { type: rawMime || 'application/octet-stream' });
  }

  if (mediaType === 'audio' || rawMime.startsWith('audio/')) {
    const ext = rawMime.includes('mp3') || rawMime.includes('mpeg')
      ? 'mp3'
      : rawMime.includes('wav')
        ? 'wav'
        : rawMime.includes('mp4') || rawMime.includes('m4a')
          ? 'm4a'
          : rawMime.includes('ogg')
            ? 'ogg'
            : 'webm';
    const baseWithoutExt = safeBase.replace(/\.[^.]+$/, '');
    return new File([blob], `${baseWithoutExt}.${ext}`, { type: rawMime || 'audio/wav' });
  }

  if (mediaType === 'video' || rawMime.startsWith('video/')) {
    const ext = rawMime.includes('mp4') ? 'mp4' : 'webm';
    const baseWithoutExt = safeBase.replace(/\.[^.]+$/, '');
    return new File([blob], `${baseWithoutExt}.${ext}`, { type: rawMime || 'video/webm' });
  }

  const baseWithoutExt = safeBase.replace(/\.[^.]+$/, '');
  if (rawMime === 'image/png') {
    return new File([blob], `${baseWithoutExt}.png`, { type: 'image/png' });
  }
  if (rawMime === 'image/jpeg' || rawMime === 'image/jpg') {
    return new File([blob], `${baseWithoutExt}.jpg`, { type: 'image/jpeg' });
  }

  if (rawMime.startsWith('image/')) {
    try {
      const url = URL.createObjectURL(blob);
      const jpegBlob = await new Promise<Blob | null>((resolve) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          canvas.width = img.naturalWidth || 1080;
          canvas.height = img.naturalHeight || 1080;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(null);
            return;
          }
          ctx.drawImage(img, 0, 0);
          canvas.toBlob((res) => resolve(res), 'image/jpeg', 0.92);
        };
        img.onerror = () => resolve(null);
        img.src = url;
      });
      URL.revokeObjectURL(url);
      if (jpegBlob && jpegBlob.size > 0) {
        return new File([jpegBlob], `${baseWithoutExt}.jpg`, { type: 'image/jpeg' });
      }
    } catch {
      // fallback below
    }
    return new File([blob], `${baseWithoutExt}.jpg`, { type: rawMime || 'image/jpeg' });
  }

  return new File([blob], safeBase, { type: rawMime || 'application/octet-stream' });
}

export async function copyTextQuietly(text: string): Promise<boolean> {
  if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // fallback below
    }
  }
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

export async function triggerFileDownload(file: Blob | File, fileName: string) {
  return downloadBlobToDevice(file, fileName, file.type);
}

export async function tryNativeShare(
  payload: SharePayload
): Promise<'shared' | 'cancelled' | 'unsupported'> {
  // 1. Check Native Android WebView Bridge first (FileProvider + Intent.ACTION_SEND)
  const bridge = getNativeAndroidBridge();
  if (bridge?.shareBase64File && payload.file) {
    try {
      const b64 = await blobToBase64(payload.file);
      const mime = inferMimeType(payload.file.name, payload.file.type);
      const res = bridge.shareBase64File(
        b64,
        payload.file.name,
        mime,
        payload.title || 'SHALOM',
        payload.text || ''
      );
      if (res === true || (typeof res === 'string' && res !== 'false' && !res.startsWith('ERROR:'))) {
        return 'shared';
      }
      if (res === 'cancelled') {
        return 'cancelled';
      }
    } catch {
      // Fall through to standard Web Share API
    }
  }

  // 2. Standard Android / Mobile / Desktop Web Share API
  const nav = navigator as Navigator & { canShare?: (data: ShareData) => boolean };
  if (typeof nav.share !== 'function') return 'unsupported';

  const candidates: ShareData[] = [];
  if (payload.file) {
    const fileMime = inferMimeType(payload.file.name, payload.file.type);
    const shareFile =
      payload.file.type === fileMime
        ? payload.file
        : new File([payload.file], payload.file.name, { type: fileMime });

    candidates.push({ title: payload.title, text: payload.text, files: [shareFile] });
    candidates.push({ text: payload.text, files: [shareFile] });
    candidates.push({ files: [shareFile] });
  } else {
    candidates.push({
      title: payload.title,
      text: payload.text,
      ...(payload.url ? { url: payload.url } : {}),
    });
  }

  for (const data of candidates) {
    if (nav.canShare && !nav.canShare(data)) continue;
    try {
      await nav.share(data);
      return 'shared';
    } catch (err: unknown) {
      if (
        err instanceof Error &&
        (err.name === 'AbortError' || err.message?.toLowerCase().includes('cancel'))
      ) {
        return 'cancelled';
      }
    }
  }
  return 'unsupported';
}

export function buildPlatformShareUrl(
  platform: Exclude<SocialPlatform, 'native'>,
  payload: SharePayload
): string {
  const shareUrl =
    payload.url || (typeof window !== 'undefined' ? window.location.origin : 'https://shalom.app');
  const encodedText = encodeURIComponent(payload.text);
  const encodedUrl = encodeURIComponent(shareUrl);

  switch (platform) {
    case 'whatsapp':
      return `https://wa.me/?text=${encodedText}`;
    case 'facebook':
      return `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}&quote=${encodedText}`;
    case 'x':
      return `https://twitter.com/intent/tweet?text=${encodedText}`;
    case 'instagram':
      return 'https://www.instagram.com/';
    case 'tiktok':
      return 'https://www.tiktok.com/upload';
  }
}

export function formatPrayerShareText(
  title: string,
  focus: string,
  bibleVerse?: string
): string {
  const parts = [`🙏 ${title}`, '', focus];
  if (bibleVerse?.trim()) {
    parts.push('', `📖 ${bibleVerse.trim()}`);
  }
  parts.push('', '— SHALOM');
  return parts.join('\n');
}
