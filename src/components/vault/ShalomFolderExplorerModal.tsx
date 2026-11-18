import React, { useCallback, useEffect, useState } from 'react';
import {
  FolderOpen,
  Download,
  Trash2,
  FileText,
  Music,
  Film,
  Image as ImageIcon,
  FolderSync,
  Info,
} from 'lucide-react';
import { Modal } from '../common/Modal';
import {
  VirtualShalomFileEntry,
  deleteVirtualShalomFile,
  detectShalomEnvironment,
  getLocalizedDownloadsLabel,
  getVirtualShalomFileBlob,
  listVirtualShalomFiles,
  supportsDirectorySelection,
} from '../../services/fileTransfer';

interface ShalomFolderExplorerModalProps {
  isOpen: boolean;
  onClose: () => void;
  reasonNotice?: string | null;
  onRequestNativeFolder?: () => void;
  isEn?: boolean;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}

export const ShalomFolderExplorerModal: React.FC<ShalomFolderExplorerModalProps> = ({
  isOpen,
  onClose,
  reasonNotice,
  onRequestNativeFolder,
  isEn = false,
}) => {
  const [files, setFiles] = useState<VirtualShalomFileEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewEntry, setPreviewEntry] = useState<VirtualShalomFileEntry | null>(null);

  const env = detectShalomEnvironment();
  const folderLabel = getLocalizedDownloadsLabel(isEn);
  const nativeSupported = supportsDirectorySelection();

  const refreshFiles = useCallback(async () => {
    setLoading(true);
    try {
      const list = await listVirtualShalomFiles();
      setFiles(list);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      refreshFiles();
    } else if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
      setPreviewEntry(null);
    }
  }, [isOpen, refreshFiles, previewUrl]);

  const handleDownloadEntry = async (entry: VirtualShalomFileEntry) => {
    const rec = await getVirtualShalomFileBlob(entry.id);
    if (!rec) return;
    const url = URL.createObjectURL(rec.blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = entry.fileName;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.setTimeout(() => URL.revokeObjectURL(url), 15000);
  };

  const handlePreviewEntry = async (entry: VirtualShalomFileEntry) => {
    const rec = await getVirtualShalomFileBlob(entry.id);
    if (!rec) return;
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(URL.createObjectURL(rec.blob));
    setPreviewEntry(entry);
  };

  const handleDeleteEntry = async (id: string) => {
    await deleteVirtualShalomFile(id);
    if (previewEntry?.id === id) {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
      setPreviewEntry(null);
    }
    refreshFiles();
  };

  const renderIcon = (mime: string) => {
    if (mime.startsWith('image/')) return <ImageIcon className="w-4 h-4 text-blue-600 shrink-0" />;
    if (mime.startsWith('audio/')) return <Music className="w-4 h-4 text-amber-600 shrink-0" />;
    if (mime.startsWith('video/')) return <Film className="w-4 h-4 text-emerald-600 shrink-0" />;
    return <FileText className="w-4 h-4 text-slate-500 shrink-0" />;
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEn ? 'DOSSIER SHALOM · Export Explorer' : 'DOSSIER SHALOM · Explorateur d’exports'}
      subtitle={folderLabel}
      maxWidth="lg"
    >
      <div className="space-y-4 text-xs">
        <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-2 flex-1 min-w-[200px]">
            <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-semibold text-slate-900 dark:text-white">
                {env === 'iframe'
                  ? isEn
                    ? 'Integrated Web Preview · Virtual SHALOM Folder active'
                    : 'Aperçu Web intégré · Dossier virtuel SHALOM actif'
                  : env === 'android-webview' || env === 'android-bridge'
                    ? 'Android · Download / SHALOM DOWNLOAD'
                    : folderLabel}
              </p>
              <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
                {reasonNotice ||
                  (isEn
                    ? 'All creations, mixed audio, videos, and vault documents exported from SHALOM are cached here for instant preview or re-download.'
                    : 'Toutes vos créations, mixages audio, vidéos et documents exportés sont conservés ici hors-ligne pour aperçu ou téléchargement direct.')}
              </p>
            </div>
          </div>

          {nativeSupported && onRequestNativeFolder && (
            <button
              type="button"
              onClick={onRequestNativeFolder}
              className="min-h-[40px] px-3 py-2 rounded-xl bg-blue-700 hover:bg-blue-800 text-white font-bold flex items-center gap-1.5 whitespace-nowrap shrink-0"
            >
              <FolderSync className="w-3.5 h-3.5" />
              <span>{isEn ? 'Link local folder' : 'Lier un dossier local'}</span>
            </button>
          )}
        </div>

        {previewUrl && previewEntry && (
          <div className="p-3 rounded-xl bg-slate-950 text-white space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="font-semibold truncate">{previewEntry.fileName}</span>
              <button
                type="button"
                onClick={() => {
                  URL.revokeObjectURL(previewUrl);
                  setPreviewUrl(null);
                  setPreviewEntry(null);
                }}
                className="text-[11px] text-slate-300 hover:text-white underline"
              >
                {isEn ? 'Close preview' : 'Fermer l’aperçu'}
              </button>
            </div>
            {previewEntry.mimeType.startsWith('image/') ? (
              <img
                src={previewUrl}
                alt={previewEntry.fileName}
                className="max-h-56 mx-auto rounded-lg object-contain"
              />
            ) : previewEntry.mimeType.startsWith('audio/') ? (
              <audio src={previewUrl} controls className="w-full" />
            ) : previewEntry.mimeType.startsWith('video/') ? (
              <video src={previewUrl} controls playsInline className="w-full max-h-56 rounded-lg" />
            ) : (
              <iframe
                src={previewUrl}
                title={previewEntry.fileName}
                className="w-full h-48 rounded-lg bg-white"
              />
            )}
          </div>
        )}

        {loading ? (
          <p className="text-center py-6 text-slate-500">
            {isEn ? 'Loading virtual SHALOM folder...' : 'Chargement du dossier SHALOM...'}
          </p>
        ) : files.length === 0 ? (
          <div className="py-10 px-4 text-center rounded-xl border border-dashed border-slate-300 dark:border-slate-700 space-y-2">
            <FolderOpen className="w-8 h-8 text-slate-400 mx-auto" />
            <p className="font-semibold text-slate-700 dark:text-slate-200">
              {isEn ? 'No exported files in DOSSIER SHALOM yet' : 'Aucun export dans DOSSIER SHALOM pour le moment'}
            </p>
            <p className="text-[11px] text-slate-500">
              {isEn
                ? 'Export any creation, audio mix, video, or vault book to see it appear here.'
                : 'Exportez une création, un mix audio, une vidéo ou un document du Coffre pour le retrouver ici.'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-200 dark:divide-slate-800 max-h-72 overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-800">
            {files.map((item) => (
              <div
                key={item.id}
                className="p-2.5 flex items-center justify-between gap-2 bg-white dark:bg-[#0c1631]"
              >
                <button
                  type="button"
                  onClick={() => handlePreviewEntry(item)}
                  className="flex items-center gap-2.5 min-w-0 flex-1 text-left"
                >
                  {renderIcon(item.mimeType)}
                  <div className="min-w-0">
                    <div className="font-semibold text-slate-900 dark:text-white truncate">
                      {item.fileName}
                    </div>
                    <div className="text-[11px] text-slate-500 tabular-nums truncate">
                      {formatBytes(item.sizeBytes)} · {new Date(item.savedAt).toLocaleDateString()} ·{' '}
                      {item.locationLabel}
                    </div>
                  </div>
                </button>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleDownloadEntry(item)}
                    className="min-h-[36px] px-2.5 py-1.5 rounded-lg bg-blue-700 hover:bg-blue-800 text-white font-semibold flex items-center gap-1"
                    title={isEn ? 'Download' : 'Télécharger'}
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">{isEn ? 'Save' : 'Enregistrer'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteEntry(item.id)}
                    className="min-h-[36px] min-w-[36px] rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 flex items-center justify-center"
                    aria-label="Supprimer export"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
};
