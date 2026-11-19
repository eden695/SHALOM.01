import React, { useState, useEffect } from 'react';
import {
  Share2,
  Copy,
  Download,
  CheckCircle2,
  ExternalLink,
  Smartphone,
  MessageCircle,
  Mail,
  FileText,
  Music,
  Film,
  Image as ImageIcon,
  AlertCircle,
  Loader2,
  Sparkles,
} from 'lucide-react';
import { Modal } from './Modal';
import {
  SharePayload,
  tryNativeShare,
  copyTextQuietly,
  triggerFileDownload,
  buildPlatformShareUrl,
} from '../../services/socialShare';
import { getNativeAndroidBridge } from '../../services/fileTransfer';

interface SocialShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  payload: SharePayload | null;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} Mo`;
}

export const SocialShareModal: React.FC<SocialShareModalProps> = ({
  isOpen,
  onClose,
  payload,
}) => {
  const [notice, setNotice] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [fallbackLink, setFallbackLink] = useState<{ label: string; url: string } | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const hasAndroidBridge = !!getNativeAndroidBridge()?.shareBase64File;
  const hasWebShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';

  useEffect(() => {
    if (!isOpen || !payload?.file) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(payload.file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [isOpen, payload]);

  useEffect(() => {
    if (!isOpen) {
      setNotice(null);
      setErrorMsg(null);
      setFallbackLink(null);
      setIsBusy(false);
    }
  }, [isOpen]);

  // Ensure returning to SHALOM from WhatsApp, Bluetooth, Gmail or external share sheet preserves UI state cleanly
  useEffect(() => {
    const resetBusyState = () => setIsBusy(false);
    window.addEventListener('focus', resetBusyState);
    window.addEventListener('pageshow', resetBusyState);
    document.addEventListener('visibilitychange', resetBusyState);
    return () => {
      window.removeEventListener('focus', resetBusyState);
      window.removeEventListener('pageshow', resetBusyState);
      document.removeEventListener('visibilitychange', resetBusyState);
    };
  }, []);

  if (!payload) return null;

  const fileMime = payload.file?.type || '';
  const isVideo = fileMime.startsWith('video/');
  const isAudio = fileMime.startsWith('audio/');
  const isImage = fileMime.startsWith('image/');
  const isDocument = !!payload.file && !isVideo && !isAudio && !isImage;

  const handleNativeShare = async () => {
    if (isBusy) return;
    setIsBusy(true);
    setFallbackLink(null);
    setErrorMsg(null);
    setNotice(null);

    try {
      await copyTextQuietly(payload.text);
      const result = await tryNativeShare(payload);
      if (result === 'shared') {
        setNotice(
          'Partage transmis avec succès. Vous êtes resté exactement sur votre écran SHALOM.'
        );
        return;
      }
      if (result === 'cancelled') {
        setNotice('Menu de partage fermé. Votre travail est intact.');
        return;
      }
      setErrorMsg(
        'Le menu de partage natif n’est pas exposé par ce navigateur/WebView. Utilisez « Télécharger » ou un raccourci ci-dessous (texte déjà copié).'
      );
    } finally {
      setIsBusy(false);
    }
  };

  const handlePlatformClick = async (
    platform: 'whatsapp' | 'facebook' | 'instagram' | 'x' | 'tiktok',
    label: string
  ) => {
    if (isBusy) return;
    setIsBusy(true);
    setFallbackLink(null);
    setErrorMsg(null);
    setNotice(null);

    try {
      await copyTextQuietly(payload.text);

      // Prioritize native Android/iOS system share sheet first so the ACTUAL file (image/video/PDF/doc/audio) + text travel together
      // AND returning from WhatsApp/other apps brings the user back cleanly to this exact SHALOM screen
      const nativeRes = await tryNativeShare(payload);
      if (nativeRes === 'shared') {
        setNotice(`Partagé vers ${label}. Votre projet SHALOM est intact.`);
        return;
      }
      if (nativeRes === 'cancelled') {
        setNotice(`Partage vers ${label} annulé.`);
        return;
      }

      if (payload.file) {
        const dlRes = await triggerFileDownload(payload.file, payload.file.name);
        if (dlRes.ok) {
          setNotice(
            `Texte copié et fichier enregistré dans ${dlRes.locationLabel} (${dlRes.fileName}). Ouvrez ${label} ci-dessous pour le joindre.`
          );
        } else {
          setErrorMsg(dlRes.error || 'Téléchargement impossible.');
        }
      } else {
        setNotice(`Texte copié ! Touchez le lien ci-dessous pour ouvrir ${label}.`);
      }

      setFallbackLink({
        label,
        url: buildPlatformShareUrl(platform, payload),
      });
    } finally {
      setIsBusy(false);
    }
  };

  const handleEmailShare = async () => {
    if (isBusy) return;
    setIsBusy(true);
    setErrorMsg(null);
    try {
      await copyTextQuietly(payload.text);
      const nativeRes = await tryNativeShare(payload);
      if (nativeRes === 'shared') {
        setNotice('Partagé par messagerie / e-mail.');
        return;
      }
      if (nativeRes === 'cancelled') {
        setNotice('Partage annulé.');
        return;
      }
      if (payload.file) {
        await triggerFileDownload(payload.file, payload.file.name);
      }
      const subject = encodeURIComponent(payload.title || 'Partage SHALOM');
      const body = encodeURIComponent(payload.text);
      setFallbackLink({
        label: 'Gmail / E-mail',
        url: `mailto:?subject=${subject}&body=${body}`,
      });
      setNotice('Lien e-mail prêt ci-dessous (texte copié).');
    } finally {
      setIsBusy(false);
    }
  };

  const handleCopyText = async () => {
    const ok = await copyTextQuietly(payload.text);
    setErrorMsg(null);
    setNotice(ok ? 'Texte copié dans le presse-papiers.' : 'Impossible de copier automatiquement.');
  };

  const handleDownloadMedia = async () => {
    if (!payload.file) return;
    setErrorMsg(null);
    const res = await triggerFileDownload(payload.file, payload.file.name);
    if (res.ok) {
      setNotice(`Enregistré dans ${res.locationLabel} : ${res.fileName}`);
    } else {
      setErrorMsg(res.error || 'Échec du téléchargement.');
    }
  };

  const platforms = [
    {
      id: 'whatsapp' as const,
      label: 'WhatsApp',
      className: 'bg-emerald-600 hover:bg-emerald-700 text-white',
    },
    {
      id: 'facebook' as const,
      label: 'Facebook',
      className: 'bg-[#1877F2] hover:bg-[#1565d8] text-white',
    },
    {
      id: 'instagram' as const,
      label: 'Instagram',
      className:
        'bg-gradient-to-r from-amber-500 via-rose-500 to-purple-600 hover:opacity-95 text-white',
    },
    {
      id: 'x' as const,
      label: 'X (Twitter)',
      className:
        'bg-slate-900 hover:bg-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 text-white',
    },
    {
      id: 'tiktok' as const,
      label: 'TikTok',
      className: 'bg-slate-950 hover:bg-black text-white border border-slate-700',
    },
  ];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Partager depuis SHALOM"
      subtitle={payload.title}
      maxWidth="lg"
    >
      <div className="space-y-4 text-xs">
        {/* Hero Media & File Preview Card */}
        <div className="rounded-2xl overflow-hidden bg-gradient-to-br from-[#0b1f42] via-[#102a56] to-[#173975] text-white border border-blue-900/60 shadow-md">
          {previewUrl && (isImage || isVideo || isAudio) && (
            <div className="bg-slate-950/90 p-3 border-b border-white/10">
              {isImage && (
                <img
                  src={previewUrl}
                  alt={payload.title}
                  className="w-full max-h-[32dvh] sm:max-h-56 object-contain mx-auto rounded-xl"
                  referrerPolicy="no-referrer"
                />
              )}
              {isVideo && (
                <video
                  src={previewUrl}
                  controls
                  playsInline
                  className="w-full max-h-[32dvh] sm:max-h-56 rounded-xl mx-auto"
                />
              )}
              {isAudio && <audio src={previewUrl} controls className="w-full" />}
            </div>
          )}

          <div className="p-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-white/10 border border-white/15 flex items-center justify-center shrink-0">
                {isImage ? (
                  <ImageIcon className="w-5 h-5 text-amber-300" />
                ) : isVideo ? (
                  <Film className="w-5 h-5 text-amber-300" />
                ) : isAudio ? (
                  <Music className="w-5 h-5 text-amber-300" />
                ) : (
                  <FileText className="w-5 h-5 text-amber-300" />
                )}
              </div>
              <div className="min-w-0">
                <div className="font-bold text-sm truncate">{payload.title}</div>
                <div className="text-[11px] text-blue-200 flex items-center gap-2 mt-0.5 tabular-nums">
                  {payload.file ? (
                    <>
                      <span className="truncate max-w-[180px]">{payload.file.name}</span>
                      <span aria-hidden="true">·</span>
                      <span>{formatFileSize(payload.file.size)}</span>
                    </>
                  ) : (
                    <span>Message texte & lien</span>
                  )}
                </div>
              </div>
            </div>

            {isDocument && payload.file && (
              <button
                type="button"
                onClick={handleDownloadMedia}
                className="px-3 py-1.5 rounded-lg bg-white/15 hover:bg-white/25 text-white font-semibold shrink-0 flex items-center gap-1"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Télécharger</span>
              </button>
            )}
          </div>
        </div>

        {/* Message Preview */}
        <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 whitespace-pre-wrap max-h-32 overflow-y-auto leading-relaxed">
          {payload.text}
        </div>

        {/* Primary Android / System Share Sheet Action */}
        <button
          type="button"
          onClick={handleNativeShare}
          disabled={isBusy}
          className="w-full py-3 px-4 rounded-xl bg-blue-700 hover:bg-blue-800 disabled:opacity-60 text-white font-bold flex items-center justify-center gap-2 shadow-sm transition"
        >
          {isBusy ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Smartphone className="w-4 h-4" />
          )}
          <span>
            {payload.file
              ? 'Ouvrir le menu de partage Android (WhatsApp, Bluetooth, Gmail...)'
              : 'Partager via les applications du téléphone'}
          </span>
        </button>

        <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 px-1">
          <span className="flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-amber-500 shrink-0" />
            <span>
              {hasAndroidBridge
                ? 'Pont natif Android actif · Retour direct sur cet écran'
                : hasWebShare
                  ? 'Partage système Web Share prêt · Retour conservé'
                  : 'Mode compatibilité · Téléchargement direct + lien'}
            </span>
          </span>
        </div>

        {/* Quick App Destinations */}
        <div className="space-y-2">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
            Destinations rapides
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {platforms.map((p) => (
              <button
                key={p.id}
                type="button"
                disabled={isBusy}
                onClick={() => handlePlatformClick(p.id, p.label)}
                className={`min-h-[44px] py-2 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition shadow-xs disabled:opacity-60 ${p.className}`}
              >
                {p.id === 'whatsapp' ? (
                  <MessageCircle className="w-3.5 h-3.5" />
                ) : (
                  <Share2 className="w-3.5 h-3.5" />
                )}
                <span>{p.label}</span>
              </button>
            ))}

            <button
              type="button"
              disabled={isBusy}
              onClick={handleEmailShare}
              className="min-h-[44px] py-2 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition shadow-xs disabled:opacity-60 bg-rose-600 hover:bg-rose-700 text-white"
            >
              <Mail className="w-3.5 h-3.5" />
              <span>Gmail / E-mail</span>
            </button>
          </div>
        </div>

        {errorMsg && (
          <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 text-amber-800 dark:text-amber-200 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span className="leading-relaxed">{errorMsg}</span>
          </div>
        )}

        {notice && (
          <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/50 text-emerald-800 dark:text-emerald-200 space-y-2">
            <div className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
              <span className="leading-relaxed">{notice}</span>
            </div>
            {fallbackLink && (
              <a
                href={fallbackLink.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs transition"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Ouvrir {fallbackLink.label}</span>
              </a>
            )}
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleCopyText}
              className="min-h-[44px] px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-semibold flex items-center gap-1.5"
            >
              <Copy className="w-3.5 h-3.5" />
              <span>Copier le texte</span>
            </button>

            {payload.file && (
              <button
                type="button"
                onClick={handleDownloadMedia}
                className="min-h-[44px] px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-semibold flex items-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Télécharger</span>
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] px-4 py-2 rounded-xl text-slate-600 dark:text-slate-300 font-semibold hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            Fermer
          </button>
        </div>
      </div>
    </Modal>
  );
};
