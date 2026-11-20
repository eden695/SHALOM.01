import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import {
  Vault,
  BookOpen,
  Upload,
  Download,
  FileText,
  Plus,
  Trash2,
  Eye,
  CheckCircle2,
  Search,
  Lock,
  Share2,
  Globe,
  ExternalLink,
  Loader2,
  AlertCircle,
  CheckSquare,
  Square,
  Smartphone,
  ShoppingBag,
  Pencil,
  FolderDown,
  FolderOpen,
  Type,
} from 'lucide-react';
import { useShalomDB } from '../../hooks/useShalomDB';
import { dbService, STORES } from '../../services/db';
import { useLanguage } from '../../contexts/LanguageContext';
import { useModuleSubView } from '../../contexts/NavigationContext';
import {
  smartFetch,
  classifyConnectivityError,
  getConnectivitySnapshot,
  getUserFriendlyNetworkMessage,
} from '../../services/connectivity';
import { VaultDocument } from '../../types';
import { Modal } from '../common/Modal';
import { ConfirmDialog } from '../common/ConfirmDialog';
import { SocialShareModal } from '../common/SocialShareModal';
import { ShalomFolderExplorerModal } from './ShalomFolderExplorerModal';
import { SharePayload, normalizeMediaToShareFile } from '../../services/socialShare';
import {
  chooseShalomDownloadDirectory,
  consumePendingSharedFiles,
  downloadBlobToDevice,
  extractEpubReadableText,
  getExtension,
  getLocalizedDownloadsLabel,
  getNativeAndroidBridge,
  getRecentDownloads,
  inferMimeType,
  readFileAsVerifiedBlob,
  RecentDownloadEntry,
  resolveUniqueFileName,
} from '../../services/fileTransfer';

interface OnlineBookEntry {
  bookId: string;
  source: 'wikisource' | 'openlibrary';
  wikiLang?: 'fr' | 'en';
  wikiPage?: string;
  openLibraryKey?: string;
  iaId?: string;
  coverUrl?: string;
  title: string;
  author: string;
  category: 'livre' | 'etude';
  description: string;
  sourceUrl: string;
  epubUrl?: string;
  pdfUrl?: string;
}

function extractCleanTextFromWikisourceHtml(html: string): {
  text: string;
  subPages: string[];
} {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');

  const subPages: string[] = [];
  doc.querySelectorAll('a[href^="/wiki/"]').forEach((a) => {
    const href = a.getAttribute('href') || '';
    if (
      !href.includes(':') &&
      !href.includes('#') &&
      (href.includes('/Chapitre') ||
        href.includes('/Livre') ||
        href.includes('/Chapter') ||
        href.includes('/Part'))
    ) {
      const pageName = decodeURIComponent(href.replace(/^\/wiki\//, ''));
      if (!subPages.includes(pageName)) subPages.push(pageName);
    }
  });

  doc
    .querySelectorAll(
      '#headertemplate, .ws-noexport, .mw-editsection, .prp-page-qualityheader, .footertemplate, style, script'
    )
    .forEach((el) => el.remove());

  const blocks: string[] = [];
  doc.querySelectorAll('h1, h2, h3, h4, p, li, blockquote').forEach((el) => {
    const txt = (el.textContent || '').replace(/\s+/g, ' ').trim();
    if (txt && txt.length > 1) {
      blocks.push(txt);
    }
  });

  const cleanText =
    blocks.length > 0
      ? blocks.join('\n\n')
      : (doc.body.textContent || '').replace(/\n{3,}/g, '\n\n').trim();

  return { text: cleanText, subPages };
}

async function fetchWikisourceBookText(
  wikiLang: string,
  pageTitle: string,
  onProgress?: (msg: string) => void
): Promise<string> {
  const endpoint = `https://${wikiLang}.wikisource.org/w/api.php`;
  const fetchPage = async (title: string) => {
    const url = `${endpoint}?action=parse&page=${encodeURIComponent(
      title
    )}&prop=text&format=json&origin=*`;
    const res = await smartFetch(url, { mode: 'cors' }, { timeoutMs: 12000, retries: 1, serviceName: 'Wikisource' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = (await res.json()) as {
      parse?: { title?: string; text?: { '*': string } };
      error?: { info?: string };
    };
    if (data.error || !data.parse?.text?.['*']) {
      throw new Error(data.error?.info || 'Page introuvable sur Wikisource.');
    }
    return extractCleanTextFromWikisourceHtml(data.parse.text['*']);
  };

  onProgress?.('Connexion à Wikisource...');
  const root = await fetchPage(pageTitle);

  const prefix = pageTitle.split('/')[0];
  const relevantSubs = root.subPages
    .filter((sp) => sp.startsWith(prefix) && sp !== pageTitle)
    .slice(0, 12);

  if (root.text.length < 1800 && relevantSubs.length > 0) {
    const sections: string[] = [root.text];
    for (let i = 0; i < relevantSubs.length; i++) {
      onProgress?.(`Téléchargement chapitre ${i + 1}/${relevantSubs.length}...`);
      try {
        const sub = await fetchPage(relevantSubs[i]);
        if (sub.text.trim()) {
          sections.push(
            `\n==============================\n${relevantSubs[i].replace(/_/g, ' ')}\n==============================\n\n${sub.text}`
          );
        }
      } catch {
        // continue with remaining chapters
      }
    }
    return sections.join('\n\n');
  }

  return root.text;
}

export const SpiritualVaultModule: React.FC = () => {
  const { lang } = useLanguage();
  const { vaultDocuments, reloadData } = useShalomDB();
  const isEn = lang === 'en';

  const [subTab, setSubTab] = useModuleSubView<'vault' | 'library'>('vault', 'vault');
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [isImporting, setIsImporting] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);

  // Play Store Books search query
  const [playStoreQuery, setPlayStoreQuery] = useState('');
  const [lastPlayStoreQuery, setLastPlayStoreQuery] = useState('');

  // Online book search (Wikisource + Open Library)
  const [onlineSearchQuery, setOnlineSearchQuery] = useState('');
  const [lastOnlineQuery, setLastOnlineQuery] = useState('');
  const [onlineSearchLang, setOnlineSearchLang] = useState<'fr' | 'en'>(
    lang === 'en' ? 'en' : 'fr'
  );
  const [onlineResults, setOnlineResults] = useState<OnlineBookEntry[]>([]);
  const [isSearchingOnline, setIsSearchingOnline] = useState(false);

  const [downloadingBookId, setDownloadingBookId] = useState<string | null>(null);
  const [downloadProgressMsg, setDownloadProgressMsg] = useState<string | null>(null);

  const [isNoteModalOpen, setIsNoteModalOpen] = useState(false);
  const [noteTitle, setNoteTitle] = useState('');
  const [noteCategory, setNoteCategory] = useState<VaultDocument['category']>('note');
  const [noteAuthor, setNoteAuthor] = useState('');
  const [noteContent, setNoteContent] = useState('');

  // Edit / Rename / Organize modal state
  const [editingDoc, setEditingDoc] = useState<VaultDocument | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editCategory, setEditCategory] = useState<VaultDocument['category']>('livre');
  const [editAuthor, setEditAuthor] = useState('');
  const [editDescription, setEditDescription] = useState('');

  // Document reader state
  const [viewingDoc, setViewingDoc] = useState<VaultDocument | null>(null);
  const [viewingBlobUrl, setViewingBlobUrl] = useState<string | null>(null);
  const [viewingText, setViewingText] = useState<string | null>(null);
  const [viewerLoading, setViewerLoading] = useState(false);
  const [viewerError, setViewerError] = useState<string | null>(null);
  const [readerFontSize, setReaderFontSize] = useState(14);

  const [notice, setNotice] = useState<string | null>(null);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);
  const [recentDownloads, setRecentDownloads] = useState<RecentDownloadEntry[]>(() =>
    getRecentDownloads()
  );
  const [showDownloadsLog, setShowDownloadsLog] = useState(false);

  const [selectedDocIds, setSelectedDocIds] = useState<string[]>([]);
  const [confirmDeleteDocs, setConfirmDeleteDocs] = useState<VaultDocument[] | null>(null);
  const [sharePayload, setSharePayload] = useState<SharePayload | null>(null);
  const [folderExplorerOpen, setFolderExplorerOpen] = useState(false);
  const [folderExplorerReason, setFolderExplorerReason] = useState<string | null>(null);

  const fileImportInputRef = useRef<HTMLInputElement | null>(null);
  const isSyncingSharedRef = useRef(false);
  const vaultDocumentsRef = useRef<VaultDocument[]>(vaultDocuments);

  useEffect(() => {
    vaultDocumentsRef.current = vaultDocuments;
  }, [vaultDocuments]);

  useEffect(() => {
    let activeUrl: string | null = null;
    let cancelled = false;

    if (!viewingDoc) {
      setViewingBlobUrl(null);
      setViewingText(null);
      setViewerError(null);
      setViewerLoading(false);
      return;
    }

    setViewerLoading(true);
    setViewerError(null);
    setViewingBlobUrl(null);
    setViewingText(null);

    if (viewingDoc.textContent) {
      setViewingText(viewingDoc.textContent);
      setViewerLoading(false);
      return;
    }

    if (viewingDoc.blobKey) {
      dbService
        .getMediaBlob(viewingDoc.blobKey)
        .then(async (blob) => {
          if (cancelled) return;
          if (!blob || blob.size === 0) {
            setViewerError(
              isEn
                ? 'Stored file data could not be found or is empty.'
                : 'Le fichier enregistré est introuvable ou vide dans le stockage local.'
            );
            setViewerLoading(false);
            return;
          }

          const ext = getExtension(viewingDoc.fileName);
          const mime = inferMimeType(viewingDoc.fileName, viewingDoc.mimeType);

          if (ext === 'epub' || mime.includes('epub')) {
            try {
              const extracted = await extractEpubReadableText(blob);
              if (!cancelled) {
                setViewingText(extracted);
                setViewerLoading(false);
              }
            } catch (err) {
              if (!cancelled) {
                activeUrl = URL.createObjectURL(blob);
                setViewingBlobUrl(activeUrl);
                setViewerError(
                  err instanceof Error
                    ? `${err.message} Utilisez « Téléchargements » ou « Partager » pour l’ouvrir dans votre lecteur EPUB Android.`
                    : 'Utilisez « Téléchargements » ou « Partager » pour lire ce fichier EPUB.'
                );
                setViewerLoading(false);
              }
            }
            return;
          }

          if (
            mime.startsWith('text/') ||
            ext === 'txt' ||
            ext === 'md' ||
            ext === 'csv' ||
            ext === 'json'
          ) {
            const txt = await blob.text();
            if (!cancelled) {
              setViewingText(txt);
              setViewerLoading(false);
            }
            return;
          }

          const typedBlob = blob.type === mime ? blob : new Blob([blob], { type: mime });
          activeUrl = URL.createObjectURL(typedBlob);
          if (!cancelled) {
            setViewingBlobUrl(activeUrl);
            setViewerLoading(false);
          }
        })
        .catch(() => {
          if (!cancelled) {
            setViewerError('Erreur lors de l’ouverture du document.');
            setViewerLoading(false);
          }
        });
    } else {
      setViewerLoading(false);
    }

    return () => {
      cancelled = true;
      if (activeUrl) URL.revokeObjectURL(activeUrl);
    };
  }, [viewingDoc, isEn]);

  const inferVaultCategory = (fileName: string, mimeType: string): VaultDocument['category'] => {
    const ext = getExtension(fileName);
    if (ext === 'epub' || ext === 'pdf') return 'livre';
    if (ext === 'txt' || ext === 'md' || ext === 'doc' || ext === 'docx' || ext === 'odt') {
      return 'etude';
    }
    if (mimeType.startsWith('image/')) return 'certificat';
    return 'autre';
  };

  const processImportedFileList = useCallback(
    async (files: FileList | File[]) => {
      const fileArray = Array.from(files);
      if (fileArray.length === 0) return;

      setIsImporting(true);
      setErrorBanner(null);
      setNotice(null);

      const existingNames = vaultDocumentsRef.current.map((d) => d.fileName);
      let addedCount = 0;
      const addedNames: string[] = [];
      const failedMessages: string[] = [];

      for (let i = 0; i < fileArray.length; i++) {
        const rawFile = fileArray[i];
        try {
          // 1. Immediately read bytes from Android content:// URI or file handle and verify size > 0
          const verified = await readFileAsVerifiedBlob(rawFile);
          const uniqueFileName = resolveUniqueFileName(verified.fileName, [
            ...existingNames,
            ...addedNames,
          ]);

          const stamp = Date.now() + i;
          const blobKey = `vault_blob_${stamp}_${Math.random().toString(36).slice(2, 6)}`;

          // 2. Write to IndexedDB MEDIA_BLOBS
          await dbService.saveMediaBlob(blobKey, verified.blob, verified.mimeType);

          // 3. Verify real persistence in IndexedDB before creating catalog entry (no fake imports)
          const check = await dbService.verifyMediaBlob(blobKey, verified.sizeBytes);
          if (!check.exists || check.size === 0) {
            await dbService.deleteItem(STORES.MEDIA_BLOBS, blobKey).catch(() => {});
            throw new Error(
              `Le stockage local n’a pas confirmé l’enregistrement de « ${uniqueFileName} ».`
            );
          }

          const ext = getExtension(uniqueFileName);
          const baseTitle = ext
            ? uniqueFileName.slice(0, -(ext.length + 1))
            : uniqueFileName;

          const doc: VaultDocument = {
            id: `vdoc_${stamp}_${i}`,
            title: baseTitle || uniqueFileName,
            category: inferVaultCategory(uniqueFileName, verified.mimeType),
            fileName: uniqueFileName,
            mimeType: verified.mimeType,
            sizeBytes: check.size,
            blobKey,
            createdAt: new Date().toISOString(),
          };

          await dbService.put(STORES.VAULT_DOCUMENTS, doc);
          addedCount++;
          addedNames.push(uniqueFileName);
        } catch (err) {
          const reason =
            err instanceof Error ? err.message : `Échec d’importation pour « ${rawFile.name} »`;
          failedMessages.push(reason);
        }
      }

      await reloadData();
      setIsImporting(false);

      if (addedCount > 0) {
        // Ensure immediate visibility in Vault: switch tab and clear active filters
        setSubTab('vault');
        setCategoryFilter('all');
        setSearchQuery('');
        setNotice(
          isEn
            ? `${addedCount} file(s) imported & verified in your Spiritual Vault: ${addedNames.join(', ')}`
            : `${addedCount} fichier(s) importé(s) et vérifié(s) dans votre Coffre : ${addedNames.join(', ')}`
        );
      }

      if (failedMessages.length > 0) {
        setErrorBanner(failedMessages.join(' · '));
      }
    },
    [isEn, reloadData, setSubTab]
  );

  const syncPendingSharedFiles = useCallback(async () => {
    if (isSyncingSharedRef.current) return;
    isSyncingSharedRef.current = true;
    try {
      const pendingItems = await consumePendingSharedFiles();
      if (pendingItems.length > 0) {
        const currentDocs = await dbService.getAll<VaultDocument>(STORES.VAULT_DOCUMENTS);
        vaultDocumentsRef.current = currentDocs;
        const freshFiles = pendingItems
          .filter(
            (item) =>
              !currentDocs.some(
                (d) => d.fileName === item.fileName && d.sizeBytes === item.blob.size
              )
          )
          .map(
            (item) =>
              new File([item.blob], item.fileName, {
                type: item.mimeType || item.blob.type || 'application/octet-stream',
              })
          );
        if (freshFiles.length > 0) {
          await processImportedFileList(freshFiles);
        }
        setRecentDownloads(getRecentDownloads());
      }
    } catch {
      // ignore background share queue read errors
    } finally {
      isSyncingSharedRef.current = false;
    }
  }, [processImportedFileList]);

  useEffect(() => {
    void syncPendingSharedFiles();
    const handleFocus = () => {
      void syncPendingSharedFiles();
    };
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        void syncPendingSharedFiles();
      }
    };
    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [syncPendingSharedFiles]);

  const handleChooseDownloadDirectory = async () => {
    try {
      const outcome = await chooseShalomDownloadDirectory();
      if (outcome.folderLabel) {
        setNotice(
          isEn
            ? `Export folder ready: ${outcome.folderLabel}`
            : `Dossier d’export prêt : ${outcome.folderLabel}`
        );
      }
      if (outcome.requiresVirtualExplorer) {
        setFolderExplorerReason(outcome.reason || null);
        setFolderExplorerOpen(true);
      }
    } catch (err) {
      if (err instanceof Error && err.name !== 'AbortError') {
        setFolderExplorerReason(
          isEn
            ? 'Opening internal SHALOM FOLDER explorer.'
            : 'Ouverture de l’explorateur interne DOSSIER SHALOM.'
        );
        setFolderExplorerOpen(true);
      }
    }
  };

  const handleImportFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    await processImportedFileList(files);
    e.target.value = '';
  };

  const handleDropFiles = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      await processImportedFileList(e.dataTransfer.files);
    }
  };

  const handleSaveNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!noteTitle.trim() || !noteContent.trim()) return;
    const bytes = new TextEncoder().encode(noteContent).length;
    const doc: VaultDocument = {
      id: `vdoc_${Date.now()}`,
      title: noteTitle.trim(),
      category: noteCategory,
      author: noteAuthor.trim() || undefined,
      fileName: `${noteTitle.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_') || 'note'}.txt`,
      mimeType: 'text/plain;charset=utf-8',
      sizeBytes: bytes,
      textContent: noteContent,
      createdAt: new Date().toISOString(),
    };
    await dbService.put(STORES.VAULT_DOCUMENTS, doc);
    setNoteTitle('');
    setNoteAuthor('');
    setNoteContent('');
    setIsNoteModalOpen(false);
    setCategoryFilter('all');
    setSearchQuery('');
    setNotice(
      isEn
        ? 'Private spiritual note saved in vault.'
        : 'Document enregistré dans votre Coffre Spirituel.'
    );
    await reloadData();
  };

  const openEditDocModal = (doc: VaultDocument) => {
    setEditingDoc(doc);
    setEditTitle(doc.title);
    setEditCategory(doc.category);
    setEditAuthor(doc.author || '');
    setEditDescription(doc.description || '');
  };

  const handleSaveEditDoc = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingDoc || !editTitle.trim()) return;
    const ext = getExtension(editingDoc.fileName);
    const updatedTitle = editTitle.trim();
    const updated: VaultDocument = {
      ...editingDoc,
      title: updatedTitle,
      category: editCategory,
      author: editAuthor.trim() || undefined,
      description: editDescription.trim() || undefined,
      fileName: ext ? `${updatedTitle.replace(/[\\/:*?"<>|]/g, '_')}.${ext}` : updatedTitle,
    };
    await dbService.put(STORES.VAULT_DOCUMENTS, updated);
    if (viewingDoc?.id === updated.id) {
      setViewingDoc(updated);
    }
    setEditingDoc(null);
    setNotice(
      isEn
        ? `Updated « ${updated.title} » in your Vault.`
        : `« ${updated.title} » renommé et classé dans votre Coffre.`
    );
    await reloadData();
  };

  const handlePlayStoreSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const q = playStoreQuery.trim();
    if (!q) return;
    setLastPlayStoreQuery(q);
    setPlayStoreQuery('');
    const targetUrl = `https://play.google.com/store/search?q=${encodeURIComponent(
      `${q} livre bible`
    )}&c=apps`;
    const link = document.createElement('a');
    link.href = targetUrl;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleSearchOnlineBooks = async (e: React.FormEvent) => {
    e.preventDefault();
    const q = onlineSearchQuery.trim();
    if (!q) {
      setOnlineResults([]);
      setLastOnlineQuery('');
      return;
    }

    const langCode: 'fr' | 'en' = isEn ? 'en' : 'fr';
    if (!getConnectivitySnapshot().isOnline) {
      setErrorBanner(getUserFriendlyNetworkMessage('offline', langCode));
      return;
    }

    setOnlineSearchQuery('');
    setLastOnlineQuery(q);
    setIsSearchingOnline(true);
    setErrorBanner(null);

    try {
      const wsPromise = smartFetch(
        `https://${onlineSearchLang}.wikisource.org/w/api.php?action=opensearch&search=${encodeURIComponent(
          q
        )}&limit=6&format=json&origin=*`,
        { mode: 'cors' },
        { timeoutMs: 9000, retries: 1, serviceName: 'Wikisource', lang: langCode }
      ).then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      });

      const olPromise = smartFetch(
        `https://openlibrary.org/search.json?q=${encodeURIComponent(q)}&limit=8`,
        { mode: 'cors' },
        { timeoutMs: 9000, retries: 1, serviceName: 'Open Library', lang: langCode }
      ).then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      });

      const [wsSettled, olSettled] = await Promise.allSettled([wsPromise, olPromise]);
      const wsData = wsSettled.status === 'fulfilled' ? wsSettled.value : null;
      const olData = olSettled.status === 'fulfilled' ? olSettled.value : null;
      const anyServiceResponded =
        wsSettled.status === 'fulfilled' || olSettled.status === 'fulfilled';
      const firstFailure =
        wsSettled.status === 'rejected'
          ? wsSettled.reason
          : olSettled.status === 'rejected'
            ? olSettled.reason
            : null;

      const combined: OnlineBookEntry[] = [];

      if (Array.isArray(wsData)) {
        const titles = (wsData[1] as string[]) || [];
        const urls = (wsData[3] as string[]) || [];
        titles.forEach((title, idx) => {
          const wikiPage = title.replace(/ /g, '_');
          combined.push({
            bookId: `ws_${onlineSearchLang}_${wikiPage}`,
            source: 'wikisource',
            wikiLang: onlineSearchLang,
            wikiPage,
            title,
            author: `Wikisource (${onlineSearchLang.toUpperCase()})`,
            category: 'livre',
            description: isEn
              ? 'Full public-domain text downloadable offline into your SHALOM Vault.'
              : 'Livre / texte intégral téléchargeable hors-ligne dans votre Coffre SHALOM.',
            sourceUrl:
              urls[idx] ||
              `https://${onlineSearchLang}.wikisource.org/wiki/${encodeURIComponent(wikiPage)}`,
            epubUrl: `https://ws-export.wmcloud.org/?lang=${onlineSearchLang}&format=epub&page=${encodeURIComponent(
              wikiPage
            )}`,
            pdfUrl: `https://ws-export.wmcloud.org/?lang=${onlineSearchLang}&format=pdf&page=${encodeURIComponent(
              wikiPage
            )}`,
          });
        });
      }

      if (olData && Array.isArray((olData as { docs?: unknown[] }).docs)) {
        const docs = (
          olData as {
            docs: Array<{
              key?: string;
              title?: string;
              author_name?: string[];
              first_publish_year?: number;
              cover_i?: number;
              ia?: string[];
            }>;
          }
        ).docs;

        docs.forEach((d) => {
          if (!d.title || !d.key) return;
          const workId = d.key.replace(/^\/works\//, '');
          const iaId = Array.isArray(d.ia) && d.ia.length > 0 ? d.ia[0] : undefined;
          const author =
            Array.isArray(d.author_name) && d.author_name.length > 0
              ? d.author_name.slice(0, 2).join(', ')
              : isEn
                ? 'Author'
                : 'Auteur';
          combined.push({
            bookId: `ol_${workId}`,
            source: 'openlibrary',
            openLibraryKey: d.key,
            iaId,
            coverUrl: d.cover_i
              ? `https://covers.openlibrary.org/b/id/${d.cover_i}-M.jpg`
              : undefined,
            title: d.title,
            author: d.first_publish_year ? `${author} (${d.first_publish_year})` : author,
            category: 'livre',
            description: iaId
              ? isEn
                ? 'Digital book available via Open Library & Internet Archive (EPUB/PDF/Online).'
                : 'Livre numérique trouvé sur Open Library (consultation en ligne, EPUB/PDF ou fiche Coffre).'
              : isEn
                ? 'Book referenced on Open Library & Google Books.'
                : 'Livre référencé sur Open Library et Google Livres.',
            sourceUrl: `https://openlibrary.org${d.key}`,
            epubUrl: iaId ? `https://archive.org/download/${iaId}/${iaId}.epub` : undefined,
            pdfUrl: iaId ? `https://archive.org/download/${iaId}/${iaId}.pdf` : undefined,
          });
        });
      }

      setOnlineResults(combined);
      if (combined.length === 0) {
        if (!anyServiceResponded && firstFailure) {
          setErrorBanner(classifyConnectivityError(firstFailure, langCode).message);
        } else {
          setErrorBanner(
            isEn
              ? `No books found for « ${q} ». Try another title or search directly on Google Books / Play Store.`
              : `Aucun livre trouvé pour « ${q} ». Essayez un autre titre ou recherchez sur Google Livres / Play Store.`
          );
        }
      }
    } catch (err) {
      setErrorBanner(classifyConnectivityError(err, isEn ? 'en' : 'fr').message);
    } finally {
      setIsSearchingOnline(false);
    }
  };

  const handleDownloadOnlineBookIntoVault = async (book: OnlineBookEntry) => {
    const existing = vaultDocuments.find((d) => d.bookId === book.bookId);
    if (existing) {
      setSubTab('vault');
      setNotice(
        isEn
          ? `« ${book.title} » is already saved in your Vault.`
          : `« ${book.title} » est déjà enregistré dans votre Coffre.`
      );
      return;
    }

    setDownloadingBookId(book.bookId);
    setDownloadProgressMsg(
      isEn ? 'Downloading book into your Vault...' : 'Téléchargement du livre dans votre Coffre...'
    );
    setErrorBanner(null);

    try {
      let bodyText = '';
      if (book.source === 'wikisource' && book.wikiLang && book.wikiPage) {
        bodyText = await fetchWikisourceBookText(
          book.wikiLang,
          book.wikiPage,
          (msg) => setDownloadProgressMsg(msg)
        );
      } else {
        const googleUrl = `https://books.google.com/books?q=${encodeURIComponent(
          `${book.title} ${book.author}`
        )}`;
        bodyText = [
          book.description,
          '',
          `Lien de lecture en ligne : ${book.sourceUrl}`,
          `Rechercher sur Google Livres : ${googleUrl}`,
          book.epubUrl ? `Téléchargement EPUB : ${book.epubUrl}` : '',
          book.pdfUrl ? `Téléchargement PDF : ${book.pdfUrl}` : '',
        ]
          .filter(Boolean)
          .join('\n');
      }

      const fullContent = `${book.title}\n${book.author}\nSource en ligne : ${book.sourceUrl}\n\n========================================\n\n${bodyText}`;
      const blob = new Blob([fullContent], { type: 'text/plain;charset=utf-8' });
      const blobKey = `vault_book_${book.bookId}_${Date.now()}`;
      await dbService.saveMediaBlob(blobKey, blob, 'text/plain;charset=utf-8');
      const verified = await dbService.verifyMediaBlob(blobKey, 1);
      if (!verified.exists) {
        throw new Error('Échec de vérification de sauvegarde locale.');
      }

      const doc: VaultDocument = {
        id: `vdoc_${book.bookId}_${Date.now()}`,
        title: book.title,
        category: book.category,
        author: book.author,
        description: book.description,
        fileName: `${book.title.replace(/[^a-z0-9àâéèêîôùûç_-]+/gi, '_').slice(0, 50)}.txt`,
        mimeType: 'text/plain;charset=utf-8',
        sizeBytes: blob.size,
        blobKey,
        textContent: fullContent,
        isBuiltInBook: false,
        bookId: book.bookId,
        sourceUrl: book.sourceUrl,
        epubUrl: book.epubUrl,
        createdAt: new Date().toISOString(),
      };
      await dbService.put(STORES.VAULT_DOCUMENTS, doc);

      await reloadData();
      setSubTab('vault');
      setCategoryFilter('all');
      setSearchQuery('');
      setNotice(
        isEn
          ? `« ${book.title} » saved inside your SHALOM Vault!`
          : `« ${book.title} » enregistré dans votre Coffre Spirituel !`
      );
    } catch (err: unknown) {
      const classified = classifyConnectivityError(err, isEn ? 'en' : 'fr');
      setErrorBanner(classified.message);
    } finally {
      setDownloadingBookId(null);
      setDownloadProgressMsg(null);
    }
  };

  const handleSaveDocToPhone = async (doc: VaultDocument) => {
    setErrorBanner(null);
    let blob: Blob | null = null;
    if (doc.blobKey) {
      blob = await dbService.getMediaBlob(doc.blobKey);
    }
    if (!blob && doc.textContent) {
      blob = new Blob([doc.textContent], { type: 'text/plain;charset=utf-8' });
    }
    if (!blob || blob.size === 0) {
      setErrorBanner(
        isEn
          ? `Cannot download « ${doc.title} »: file data is missing or empty.`
          : `Impossible de télécharger « ${doc.title} » : contenu introuvable ou vide.`
      );
      return;
    }

    const res = await downloadBlobToDevice(blob, doc.fileName || doc.title, doc.mimeType);
    setRecentDownloads(getRecentDownloads());
    if (res.ok) {
      setNotice(
        isEn
          ? `Saved « ${res.fileName} » (${formatSize(res.sizeBytes)}) to ${res.locationLabel}.`
          : `« ${res.fileName} » (${formatSize(res.sizeBytes)}) enregistré dans ${res.locationLabel}.`
      );
    } else {
      setErrorBanner(res.error || 'Échec du téléchargement.');
    }
  };

  const handleBulkSaveToPhone = async () => {
    const targets = vaultDocuments.filter((d) => selectedDocIds.includes(d.id));
    for (const doc of targets) {
      await handleSaveDocToPhone(doc);
    }
  };

  const handleShareVaultDoc = async (doc: VaultDocument) => {
    let file: File | undefined;
    if (doc.blobKey) {
      const blob = await dbService.getMediaBlob(doc.blobKey);
      if (blob && blob.size > 0) {
        const mime = inferMimeType(doc.fileName, doc.mimeType);
        const isDocOrMedia =
          mime.includes('pdf') ||
          mime.includes('epub') ||
          mime.startsWith('text/') ||
          mime.includes('word') ||
          mime.includes('officedocument')
            ? 'document'
            : mime.startsWith('audio/')
              ? 'audio'
              : mime.startsWith('video/')
                ? 'video'
                : 'image';
        file = await normalizeMediaToShareFile(blob, doc.fileName || doc.title, isDocOrMedia, mime);
      }
    } else if (doc.textContent) {
      const blob = new Blob([doc.textContent], { type: 'text/plain;charset=utf-8' });
      file = new File([blob], doc.fileName || `${doc.title}.txt`, {
        type: 'text/plain;charset=utf-8',
      });
    }

    const lines = [
      `📖 ${doc.title}`,
      doc.author ? `✍️ ${doc.author}` : '',
      doc.sourceUrl ? `🔗 Lien : ${doc.sourceUrl}` : '',
      doc.epubUrl ? `📥 EPUB : ${doc.epubUrl}` : '',
      '',
      'Partagé depuis Mon Coffre Spirituel · SHALOM',
    ].filter(Boolean);

    setSharePayload({
      title: doc.title,
      text: lines.join('\n'),
      url: doc.sourceUrl,
      file,
    });
  };

  const handleShareOnlineBook = (book: OnlineBookEntry) => {
    setSharePayload({
      title: book.title,
      text: `📖 ${book.title}\n✍️ ${book.author}\n\n🔗 Lire en ligne : ${book.sourceUrl}${book.epubUrl ? `\n📥 EPUB : ${book.epubUrl}` : ''}\n\nPartagé depuis SHALOM`,
      url: book.sourceUrl,
    });
  };

  const handleConfirmDelete = async () => {
    if (!confirmDeleteDocs || confirmDeleteDocs.length === 0) return;
    const blobKeys = confirmDeleteDocs
      .map((d) => d.blobKey)
      .filter((k): k is string => !!k);
    const ids = confirmDeleteDocs.map((d) => d.id);
    if (blobKeys.length > 0) {
      await dbService.deleteItems(STORES.MEDIA_BLOBS, blobKeys);
    }
    await dbService.deleteItems(STORES.VAULT_DOCUMENTS, ids);
    setSelectedDocIds((prev) => prev.filter((id) => !ids.includes(id)));
    if (viewingDoc && ids.includes(viewingDoc.id)) setViewingDoc(null);
    setConfirmDeleteDocs(null);
    await reloadData();
  };

  const filteredVaultDocs = useMemo(() => {
    return vaultDocuments.filter((doc) => {
      const matchesCat = categoryFilter === 'all' || doc.category === categoryFilter;
      const q = searchQuery.trim().toLowerCase();
      const matchesSearch =
        !q ||
        doc.title.toLowerCase().includes(q) ||
        doc.fileName.toLowerCase().includes(q) ||
        (doc.author || '').toLowerCase().includes(q) ||
        (doc.description || '').toLowerCase().includes(q);
      return matchesCat && matchesSearch;
    });
  }, [vaultDocuments, categoryFilter, searchQuery]);

  const toggleSelectDoc = (id: string) => {
    setSelectedDocIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const toggleAllDocs = () => {
    const visibleIds = filteredVaultDocs.map((d) => d.id);
    const allSel = visibleIds.length > 0 && visibleIds.every((id) => selectedDocIds.includes(id));
    setSelectedDocIds(allSel ? [] : visibleIds);
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} o`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
  };

  const playStoreAppsHref = lastPlayStoreQuery
    ? `https://play.google.com/store/search?q=${encodeURIComponent(
        `${lastPlayStoreQuery} livre bible`
      )}&c=apps`
    : 'https://play.google.com/store/search?q=livres+chretiens+bible+ebook&c=apps';

  const downloadsFolderLabel = getLocalizedDownloadsLabel(isEn);
  const androidBridge = getNativeAndroidBridge();

  return (
    <div
      className="space-y-6 animate-in fade-in duration-200"
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragOver(true);
      }}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={handleDropFiles}
    >
      {/* Single shared file input for the entire Spiritual Vault */}
      <input
        ref={fileImportInputRef}
        type="file"
        multiple
        accept="*/*"
        onChange={handleImportFiles}
        className="hidden"
      />
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white flex items-center gap-2 font-display">
            <Vault className="w-6 h-6 text-blue-700 dark:text-blue-400" />
            <span>{isEn ? 'My Spiritual Vault' : 'Mon Coffre Spirituel'}</span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-1.5">
            <Lock className="w-3.5 h-3.5 shrink-0" />
            <span>
              {isEn
                ? 'Import books, PDF, EPUB & files from your phone storage, read offline, export to Downloads or share'
                : 'Importez vos livres téléchargés (PDF, EPUB, Docs, Images), lisez hors-ligne ou exportez dans Téléchargements'}
            </span>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 max-w-full">
          <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200/60 dark:border-slate-700/60 overflow-x-auto no-scrollbar max-w-full">
            <button
              type="button"
              onClick={() => setSubTab('vault')}
              className={`min-h-[38px] sm:min-h-0 px-3 py-1.5 text-xs font-semibold rounded-lg transition whitespace-nowrap shrink-0 ${
                subTab === 'vault'
                  ? 'bg-white dark:bg-[#0f2b5c] text-blue-700 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              {isEn ? `My Vault (${vaultDocuments.length})` : `Mon Coffre (${vaultDocuments.length})`}
            </button>
            <button
              type="button"
              onClick={() => setSubTab('library')}
              className={`min-h-[38px] sm:min-h-0 px-3 py-1.5 text-xs font-semibold rounded-lg transition flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
                subTab === 'library'
                  ? 'bg-white dark:bg-[#0f2b5c] text-blue-700 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              <Globe className="w-3.5 h-3.5" />
              <span>{isEn ? 'Online Books' : 'Livres en ligne'}</span>
            </button>
          </div>
        </div>
      </div>

      {isImporting && (
        <div className="p-3.5 rounded-xl bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900 text-xs font-semibold text-blue-800 dark:text-blue-200 flex items-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin shrink-0" />
          <span>
            {isEn
              ? 'Reading & verifying file transfer into SHALOM Vault...'
              : 'Lecture et vérification de l’enregistrement dans le Coffre SHALOM...'}
          </span>
        </div>
      )}

      {notice && (
        <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/50 text-xs font-semibold text-emerald-700 dark:text-emerald-300 flex items-center justify-between gap-2">
          <span className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{notice}</span>
          </span>
          <button type="button" onClick={() => setNotice(null)} className="text-[11px] underline shrink-0">
            OK
          </button>
        </div>
      )}

      {errorBanner && (
        <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 text-xs font-semibold text-red-700 dark:text-red-300 flex items-center justify-between gap-2">
          <span className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorBanner}</span>
          </span>
          <button type="button" onClick={() => setErrorBanner(null)} className="text-[11px] underline shrink-0">
            OK
          </button>
        </div>
      )}

      {isDragOver && (
        <div className="p-6 rounded-2xl border-2 border-dashed border-blue-600 bg-blue-50/70 dark:bg-blue-950/30 text-center text-xs font-bold text-blue-700 dark:text-blue-300">
          {isEn ? 'Drop your books or documents to store them in the Vault' : 'Déposez vos livres ou documents ici pour les enregistrer dans le Coffre'}
        </div>
      )}

      {/* TAB 1: MON COFFRE PERSONNEL */}
      {subTab === 'vault' && (
        <div className="space-y-4">
          {/* Permanent Action Bar (visible even when Vault is empty!) */}
          <div className="flex flex-col sm:flex-row gap-3 justify-between items-stretch sm:items-center">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={isEn ? 'Search my vault...' : 'Rechercher un livre ou document...'}
                className="w-full pl-9 pr-3 py-2.5 text-xs rounded-xl bg-white dark:bg-[#0c1631] border border-slate-200 dark:border-slate-800"
              />
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => fileImportInputRef.current?.click()}
                className="min-h-[44px] px-4 py-2 rounded-xl bg-blue-700 hover:bg-blue-800 text-white text-xs font-bold flex items-center gap-2 transition shadow-xs whitespace-nowrap"
              >
                <Upload className="w-4 h-4 shrink-0" />
                <span>
                  {isEn ? 'Import Book / File' : 'Importer depuis l’appareil'}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setIsNoteModalOpen(true)}
                className="min-h-[44px] px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 text-xs font-bold flex items-center gap-1.5 whitespace-nowrap"
              >
                <Plus className="w-4 h-4" />
                <span>{isEn ? 'Write Note' : 'Écrire'}</span>
              </button>

              <button
                type="button"
                onClick={handleChooseDownloadDirectory}
                className="min-h-[44px] px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap"
                title={
                  isEn
                    ? 'Open DOSSIER SHALOM exports & download directory'
                    : 'Ouvrir votre DOSSIER SHALOM (exports et téléchargements)'
                }
              >
                <FolderOpen className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <span>DOSSIER SHALOM</span>
              </button>

              {recentDownloads.length > 0 && (
                <button
                  type="button"
                  onClick={() => setShowDownloadsLog((s) => !s)}
                  className="min-h-[44px] px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap"
                >
                  <FolderDown className="w-4 h-4 text-blue-600" />
                  <span>SHALOM DOWNLOAD ({recentDownloads.length})</span>
                </button>
              )}
            </div>
          </div>

          {showDownloadsLog && recentDownloads.length > 0 && (
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                  <FolderOpen className="w-4 h-4 text-blue-600" />
                  <span>Dossier cible : {downloadsFolderLabel}</span>
                </span>
                <button
                  type="button"
                  onClick={() => setShowDownloadsLog(false)}
                  className="text-[11px] font-semibold text-slate-500 underline"
                >
                  Fermer
                </button>
              </div>
              <div className="divide-y divide-slate-200/70 dark:divide-slate-800">
                {recentDownloads.slice(0, 5).map((dl) => (
                  <div key={dl.id} className="py-1.5 flex flex-wrap sm:flex-nowrap items-center justify-between gap-2">
                    <div className="min-w-0 flex-1 truncate">
                      <span className="font-semibold text-slate-800 dark:text-slate-200">
                        {dl.fileName}
                      </span>
                      <span className="text-slate-500 ml-2 tabular-nums">
                        {formatSize(dl.sizeBytes)} · {dl.locationLabel}
                      </span>
                    </div>
                    {androidBridge?.openDownloadedFile && (
                      <button
                        type="button"
                        onClick={() => androidBridge.openDownloadedFile?.(dl.fileName, dl.mimeType)}
                        className="min-h-[36px] sm:min-h-0 px-2.5 py-1 rounded-lg bg-blue-700 text-white text-[11px] font-bold shrink-0"
                      >
                        Ouvrir
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {vaultDocuments.length === 0 ? (
            <div className="py-12 px-6 text-center rounded-3xl bg-white dark:bg-[#0c1631] border border-dashed border-slate-300 dark:border-slate-800 space-y-5">
              <div className="w-14 h-14 rounded-2xl bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400 flex items-center justify-center mx-auto">
                <Vault className="w-7 h-7" />
              </div>
              <div className="space-y-1.5 max-w-md mx-auto">
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  {isEn ? 'Your Spiritual Vault is Ready' : 'Votre Coffre Spirituel est prêt'}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  {isEn
                    ? 'Select any book (PDF, EPUB), document, or image downloaded on your Android phone, or browse online libraries.'
                    : 'Sélectionnez directement un livre téléchargé sur votre téléphone (PDF, EPUB, Word, Texte, Image) depuis le gestionnaire de fichiers Android pour l’enregistrer ici.'}
                </p>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={() => fileImportInputRef.current?.click()}
                  className="min-h-[44px] px-5 py-3 rounded-xl bg-blue-700 hover:bg-blue-800 text-white text-xs sm:text-sm font-bold inline-flex items-center gap-2 shadow-sm"
                >
                  <Upload className="w-4 h-4" />
                  <span>
                    {isEn ? 'Select File from Phone' : 'Choisir un livre / fichier sur mon téléphone'}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setSubTab('library')}
                  className="min-h-[44px] px-5 py-3 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 text-xs sm:text-sm font-bold inline-flex items-center gap-2"
                >
                  <BookOpen className="w-4 h-4" />
                  <span>
                    {isEn ? 'Find Books Online' : 'Trouver des livres en ligne'}
                  </span>
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="flex gap-1.5 overflow-x-auto no-scrollbar sm:flex-wrap pb-0.5">
                {[
                  { id: 'all', label: isEn ? 'All' : 'Tous' },
                  { id: 'livre', label: isEn ? 'Books' : 'Livres' },
                  { id: 'etude', label: isEn ? 'Bible Studies' : 'Études' },
                  { id: 'note', label: isEn ? 'Personal Notes' : 'Notes' },
                  { id: 'certificat', label: isEn ? 'Images / Certificates' : 'Images / Actes' },
                  { id: 'autre', label: isEn ? 'Other' : 'Autres' },
                ].map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setCategoryFilter(cat.id)}
                    className={`min-h-[38px] sm:min-h-0 px-3 py-1.5 rounded-lg text-[11px] font-semibold transition whitespace-nowrap shrink-0 ${
                      categoryFilter === cat.id
                        ? 'bg-[#0b1f42] text-white dark:bg-blue-700'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>

              {/* Multi-selection bar */}
              {filteredVaultDocs.length > 0 && (
                <div className="flex flex-wrap items-center justify-between gap-2 px-1">
                  <button
                    type="button"
                    onClick={toggleAllDocs}
                    className="text-xs font-semibold text-slate-600 dark:text-slate-300 flex items-center gap-1.5 hover:text-blue-700"
                  >
                    {filteredVaultDocs.every((d) => selectedDocIds.includes(d.id)) ? (
                      <CheckSquare className="w-4 h-4 text-blue-600" />
                    ) : (
                      <Square className="w-4 h-4 text-slate-400" />
                    )}
                    <span>Tout sélectionner ({selectedDocIds.length})</span>
                  </button>

                  {selectedDocIds.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={handleBulkSaveToPhone}
                        className="px-3 py-1.5 rounded-xl bg-blue-700 hover:bg-blue-800 text-white text-xs font-bold flex items-center gap-1.5"
                      >
                        <Smartphone className="w-3.5 h-3.5" />
                        <span>Téléchargements ({selectedDocIds.length})</span>
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setConfirmDeleteDocs(
                            vaultDocuments.filter((d) => selectedDocIds.includes(d.id))
                          )
                        }
                        className="px-3 py-1.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold flex items-center gap-1.5"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Supprimer ({selectedDocIds.length})</span>
                      </button>
                    </div>
                  )}
                </div>
              )}

              {filteredVaultDocs.length === 0 ? (
                <div className="p-8 text-center rounded-2xl bg-white dark:bg-[#0c1631] border border-slate-200 dark:border-slate-800 text-xs text-slate-500 space-y-2">
                  <p>Aucun document ne correspond à ce filtre.</p>
                  <button
                    type="button"
                    onClick={() => {
                      setCategoryFilter('all');
                      setSearchQuery('');
                    }}
                    className="px-3 py-1.5 rounded-lg bg-blue-700 text-white font-bold"
                  >
                    Afficher tous mes documents ({vaultDocuments.length})
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {filteredVaultDocs.map((doc) => {
                    const isSel = selectedDocIds.includes(doc.id);
                    const ext = getExtension(doc.fileName).toUpperCase();
                    return (
                      <div
                        key={doc.id}
                        className={`p-4 rounded-2xl bg-white dark:bg-[#0c1631] border space-y-2.5 flex flex-col justify-between transition ${
                          isSel
                            ? 'border-blue-600 ring-2 ring-blue-600/20'
                            : 'border-slate-200/80 dark:border-slate-800/80'
                        }`}
                      >
                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-[11px] text-slate-500">
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => toggleSelectDoc(doc.id)}
                                aria-label="Sélectionner ce document"
                                className="text-slate-400 hover:text-blue-600"
                              >
                                {isSel ? (
                                  <CheckSquare className="w-4 h-4 text-blue-600" />
                                ) : (
                                  <Square className="w-4 h-4" />
                                )}
                              </button>
                              <span className="font-bold text-blue-700 dark:text-blue-400 uppercase">
                                {doc.category}
                                {ext ? ` · ${ext}` : ''}
                              </span>
                            </div>
                            <span className="tabular-nums font-medium">{formatSize(doc.sizeBytes)}</span>
                          </div>
                          <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                            <FileText className="w-4 h-4 text-amber-500 shrink-0" />
                            <span className="truncate">{doc.title}</span>
                          </h4>
                          <p className="text-[11px] text-slate-400 truncate">{doc.fileName}</p>
                          {doc.author && (
                            <p className="text-xs text-slate-500 dark:text-slate-400">{doc.author}</p>
                          )}
                          {doc.description && (
                            <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-2">
                              {doc.description}
                            </p>
                          )}
                        </div>

                        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
                          <span className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
                            {doc.createdAt.split('T')[0]} · {isEn ? 'Stored locally ✓' : 'Stocké localement ✓'}
                          </span>

                          <div className="flex flex-wrap items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => setViewingDoc(doc)}
                              className="min-h-[38px] sm:min-h-0 px-2.5 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 font-semibold flex items-center gap-1"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              <span>{isEn ? 'Open' : 'Ouvrir'}</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => openEditDocModal(doc)}
                              className="min-w-[38px] min-h-[38px] sm:min-w-0 sm:min-h-0 flex items-center justify-center p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200"
                              title={isEn ? 'Rename & Organize' : 'Renommer & Classer'}
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleSaveDocToPhone(doc)}
                              className="min-h-[38px] sm:min-h-0 px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-semibold flex items-center gap-1"
                              title={`Enregistrer dans ${downloadsFolderLabel}`}
                            >
                              <Download className="w-3.5 h-3.5" />
                              <span>{isEn ? 'Downloads' : 'Télécharger'}</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleShareVaultDoc(doc)}
                              className="min-w-[38px] min-h-[38px] sm:min-w-0 sm:min-h-0 flex items-center justify-center p-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300"
                              title={isEn ? 'Share' : 'Partager'}
                            >
                              <Share2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteDocs([doc])}
                              className="min-w-[38px] min-h-[38px] sm:min-w-0 sm:min-h-0 flex items-center justify-center p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/30 text-red-600"
                              title={isEn ? 'Delete' : 'Supprimer'}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* TAB 2: LIVRES EN LIGNE (PLAY STORE + GOOGLE LIVRES + RECHERCHE DIRECTE) */}
      {subTab === 'library' && (
        <div className="space-y-5">
          <div className="p-5 rounded-3xl bg-gradient-to-br from-[#0b1f42] via-[#132d5e] to-[#1a3c7c] text-white border border-blue-900/60 shadow-lg space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-xs font-bold text-amber-300 uppercase tracking-wider">
                  <ShoppingBag className="w-4 h-4" />
                  <span>Google Play Livres & Store</span>
                </div>
                <h3 className="text-base sm:text-lg font-extrabold font-display">
                  {isEn
                    ? 'Find Books on Google Play'
                    : 'Livres externes & Import dans le Coffre'}
                </h3>
                <p className="text-xs text-blue-100 leading-relaxed max-w-2xl">
                  {isEn
                    ? 'Android DRM-protected Google Play Books stay inside the Google Play Books app. For DRM-free PDF/EPUB files downloaded on your phone (or shared via Android Share → SHALOM), import them directly below.'
                    : 'Sur Android, les livres achetés/protégés par DRM dans Play Livres restent chiffrés dans l’application Google Play Livres. Pour tout livre PDF ou EPUB libre téléchargé (ou envoyé via « Partager → SHALOM »), importez-le directement ci-dessous.'}
                </p>
              </div>

              <div className="shrink-0 self-start sm:self-auto">
                <a
                  href={playStoreAppsHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="min-h-[44px] px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center gap-2 transition whitespace-nowrap"
                >
                  <ExternalLink className="w-4 h-4" />
                  <span>{isEn ? 'Open Google Play Store' : 'Ouvrir Google Play Store'}</span>
                </a>
              </div>
            </div>

            <form onSubmit={handlePlayStoreSearch} className="flex flex-col sm:flex-row gap-2 text-xs">
              <input
                type="text"
                value={playStoreQuery}
                onChange={(e) => setPlayStoreQuery(e.target.value)}
                placeholder={
                  isEn
                    ? 'Search Play Store book / Bible reader...'
                    : 'Chercher un livre / lecteur sur Play Store...'
                }
                className="flex-1 px-3.5 py-2.5 rounded-xl bg-white/10 border border-white/20 text-white placeholder:text-blue-200/70"
              />
              <button
                type="submit"
                className="min-h-[44px] px-4 py-2.5 rounded-xl bg-white text-[#0b1f42] hover:bg-blue-50 font-bold flex items-center justify-center gap-1.5 whitespace-nowrap"
              >
                <Search className="w-3.5 h-3.5" />
                <span>{isEn ? 'Search Play Store' : 'Rechercher sur Play Store'}</span>
              </button>
              <button
                type="button"
                onClick={() => fileImportInputRef.current?.click()}
                className="min-h-[44px] px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold flex items-center justify-center gap-1.5 whitespace-nowrap"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>
                  {isEn ? 'Import Downloaded Book' : 'Importer un livre téléchargé → Coffre'}
                </span>
              </button>
            </form>
          </div>

          <form
            onSubmit={handleSearchOnlineBooks}
            className="p-4 rounded-2xl bg-white dark:bg-[#0c1631] border border-slate-200/80 dark:border-slate-800/80 flex flex-col sm:flex-row gap-2.5 text-xs"
          >
            <select
              value={onlineSearchLang}
              onChange={(e) => setOnlineSearchLang(e.target.value as 'fr' | 'en')}
              className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 font-semibold"
            >
              <option value="fr">Français</option>
              <option value="en">English</option>
            </select>
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={onlineSearchQuery}
                onChange={(e) => setOnlineSearchQuery(e.target.value)}
                placeholder={
                  isEn
                    ? 'Search books online to download to Vault...'
                    : 'Rechercher un livre en ligne (ex: Bible, Psaumes, Prière, Augustin)...'
                }
                className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800"
              />
            </div>
            <button
              type="submit"
              disabled={isSearchingOnline}
              className="px-4 py-2 rounded-xl bg-blue-700 hover:bg-blue-800 text-white font-bold flex items-center justify-center gap-1.5"
            >
              {isSearchingOnline ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Search className="w-4 h-4" />
              )}
              <span>{isEn ? 'Search' : 'Rechercher'}</span>
            </button>
            {onlineResults.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  setOnlineResults([]);
                  setLastOnlineQuery('');
                }}
                className="px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 font-semibold"
              >
                {isEn ? 'Clear' : 'Effacer'}
              </button>
            )}
          </form>

          {lastOnlineQuery && (
            <div className="text-xs text-slate-500 dark:text-slate-400 px-1">
              {isEn ? 'Search results for:' : 'Résultats de recherche pour :'}{' '}
              <strong className="text-slate-800 dark:text-slate-200">« {lastOnlineQuery} »</strong>
            </div>
          )}

          {downloadProgressMsg && (
            <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900 text-xs font-semibold text-blue-800 dark:text-blue-200 flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin shrink-0" />
              <span>{downloadProgressMsg}</span>
            </div>
          )}

          {onlineResults.length === 0 && !isSearchingOnline ? (
            <div className="py-10 px-6 text-center rounded-3xl bg-white dark:bg-[#0c1631] border border-dashed border-slate-300 dark:border-slate-800 space-y-2">
              <BookOpen className="w-8 h-8 text-blue-700 dark:text-blue-400 mx-auto opacity-80" />
              <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                {isEn ? 'Search for a book to get started' : 'Recherchez un livre ou importez depuis votre téléphone'}
              </h4>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                {isEn
                  ? 'Type any book title above to search online libraries, or open Play Store / Google Books and import your downloaded files into your Vault.'
                  : 'Saisissez un titre ci-dessus pour rechercher sur Wikisource & Open Library, ou importez un fichier téléchargé depuis votre gestionnaire Android.'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {onlineResults.map((book) => {
                const vaultCopy = vaultDocuments.find((d) => d.bookId === book.bookId);
                const isBusy = downloadingBookId === book.bookId;

                return (
                  <div
                    key={book.bookId}
                    className="p-5 rounded-2xl bg-white dark:bg-[#0c1631] border border-slate-200/80 dark:border-slate-800/80 space-y-3 flex flex-col justify-between shadow-xs"
                  >
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400">
                          {book.source === 'wikisource'
                            ? `Wikisource (${(book.wikiLang || 'fr').toUpperCase()})`
                            : 'Open Library'}{' '}
                          · {book.category}
                        </span>
                        <a
                          href={book.sourceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-700 dark:text-blue-400 hover:underline flex items-center gap-1 font-semibold"
                        >
                          <span>{isEn ? 'Open link' : 'Ouvrir'}</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>

                      <div className="flex items-start gap-3">
                        {book.coverUrl && (
                          <img
                            src={book.coverUrl}
                            alt={book.title}
                            className="w-12 h-16 object-cover rounded-lg border border-slate-200 dark:border-slate-800 shrink-0"
                            referrerPolicy="no-referrer"
                          />
                        )}
                        <div className="min-w-0">
                          <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white flex items-start gap-1.5">
                            {!book.coverUrl && (
                              <BookOpen className="w-4 h-4 text-blue-700 dark:text-blue-400 shrink-0 mt-0.5" />
                            )}
                            <span>{book.title}</span>
                          </h3>
                          <p className="text-xs font-medium text-slate-500 mt-0.5">{book.author}</p>
                        </div>
                      </div>
                      <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                        {book.description}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => handleDownloadOnlineBookIntoVault(book)}
                        className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition ${
                          vaultCopy
                            ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900/50'
                            : 'bg-blue-700 hover:bg-blue-800 text-white'
                        }`}
                      >
                        {isBusy ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : vaultCopy ? (
                          <CheckCircle2 className="w-3.5 h-3.5" />
                        ) : (
                          <Download className="w-3.5 h-3.5" />
                        )}
                        <span>
                          {isBusy
                            ? isEn
                              ? 'Downloading...'
                              : 'Téléchargement...'
                            : vaultCopy
                              ? isEn
                                ? 'In My Vault'
                                : 'Dans mon coffre'
                              : isEn
                                ? 'Add to Vault'
                                : 'Ajouter à mon coffre'}
                        </span>
                      </button>

                      {vaultCopy ? (
                        <button
                          type="button"
                          onClick={() => handleSaveDocToPhone(vaultCopy)}
                          className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-xs font-semibold flex items-center gap-1.5"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>{isEn ? 'Downloads' : 'Téléchargements'}</span>
                        </button>
                      ) : book.epubUrl ? (
                        <a
                          href={book.epubUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-xs font-semibold flex items-center gap-1.5"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>EPUB</span>
                        </a>
                      ) : (
                        <a
                          href={`https://books.google.com/books?q=${encodeURIComponent(book.title)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-xs font-semibold flex items-center gap-1.5"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          <span>Google Livres</span>
                        </a>
                      )}

                      <button
                        type="button"
                        onClick={() => handleShareOnlineBook(book)}
                        className="px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold flex items-center gap-1.5"
                      >
                        <Share2 className="w-3.5 h-3.5" />
                        <span>{isEn ? 'Share' : 'Partager'}</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Modal Write Private Document */}
      <Modal
        isOpen={isNoteModalOpen}
        onClose={() => setIsNoteModalOpen(false)}
        title={isEn ? 'Create Private Spiritual Document' : 'Créer un document spirituel privé'}
        maxWidth="lg"
      >
        <form onSubmit={handleSaveNote} className="space-y-4 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold mb-1">{isEn ? 'Title *' : 'Titre *'}</label>
              <input
                type="text"
                required
                value={noteTitle}
                onChange={(e) => setNoteTitle(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800"
              />
            </div>
            <div>
              <label className="block font-semibold mb-1">{isEn ? 'Category' : 'Catégorie'}</label>
              <select
                value={noteCategory}
                onChange={(e) => setNoteCategory(e.target.value as VaultDocument['category'])}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800"
              >
                <option value="note">{isEn ? 'Personal Note' : 'Note spirituelle'}</option>
                <option value="etude">{isEn ? 'Bible Study' : 'Étude biblique'}</option>
                <option value="livre">{isEn ? 'Book / Treatise' : 'Livre / Texte'}</option>
                <option value="certificat">{isEn ? 'Certificate / Act' : 'Certificat / Acte'}</option>
                <option value="autre">{isEn ? 'Other' : 'Autre'}</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block font-semibold mb-1">
              {isEn ? 'Author / Source (optional)' : 'Auteur / Source'}
            </label>
            <input
              type="text"
              value={noteAuthor}
              onChange={(e) => setNoteAuthor(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800"
            />
          </div>

          <div>
            <label className="block font-semibold mb-1">{isEn ? 'Content *' : 'Contenu *'}</label>
            <textarea
              rows={8}
              required
              value={noteContent}
              onChange={(e) => setNoteContent(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 leading-relaxed"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setIsNoteModalOpen(false)}
              className="px-4 py-2 rounded-xl text-slate-500 font-semibold"
            >
              {isEn ? 'Cancel' : 'Annuler'}
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl bg-blue-700 hover:bg-blue-800 text-white font-bold"
            >
              {isEn ? 'Save to Vault' : 'Enregistrer dans le coffre'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal Rename & Organize Document */}
      <Modal
        isOpen={!!editingDoc}
        onClose={() => setEditingDoc(null)}
        title={isEn ? 'Rename & Organize File' : 'Renommer & Classer le document'}
        subtitle={editingDoc?.fileName}
        maxWidth="md"
      >
        <form onSubmit={handleSaveEditDoc} className="space-y-4 text-xs">
          <div>
            <label className="block font-semibold mb-1">{isEn ? 'Title *' : 'Titre affiché *'}</label>
            <input
              type="text"
              required
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800"
            />
          </div>
          <div>
            <label className="block font-semibold mb-1">{isEn ? 'Category' : 'Dossier / Catégorie'}</label>
            <select
              value={editCategory}
              onChange={(e) => setEditCategory(e.target.value as VaultDocument['category'])}
              className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800"
            >
              <option value="livre">{isEn ? 'Books' : 'Livres'}</option>
              <option value="etude">{isEn ? 'Bible Studies' : 'Études bibliques'}</option>
              <option value="note">{isEn ? 'Personal Notes' : 'Notes spirituelles'}</option>
              <option value="certificat">{isEn ? 'Images / Certificates' : 'Images / Certificats'}</option>
              <option value="autre">{isEn ? 'Other' : 'Autres'}</option>
            </select>
          </div>
          <div>
            <label className="block font-semibold mb-1">{isEn ? 'Author' : 'Auteur / Source'}</label>
            <input
              type="text"
              value={editAuthor}
              onChange={(e) => setEditAuthor(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800"
            />
          </div>
          <div>
            <label className="block font-semibold mb-1">{isEn ? 'Notes / Description' : 'Description'}</label>
            <textarea
              rows={3}
              value={editDescription}
              onChange={(e) => setEditDescription(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800"
            />
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setEditingDoc(null)}
              className="px-4 py-2 rounded-xl text-slate-500 font-semibold"
            >
              {isEn ? 'Cancel' : 'Annuler'}
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl bg-blue-700 hover:bg-blue-800 text-white font-bold"
            >
              {isEn ? 'Save Changes' : 'Enregistrer'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal Document / Book Reader */}
      <Modal
        isOpen={!!viewingDoc}
        onClose={() => setViewingDoc(null)}
        title={viewingDoc?.title || ''}
        subtitle={viewingDoc ? `${viewingDoc.fileName} · ${formatSize(viewingDoc.sizeBytes)}` : ''}
        maxWidth="xl"
      >
        {viewingDoc && (
          <div className="space-y-4">
            {viewingDoc.sourceUrl && (
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
                <a
                  href={viewingDoc.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-700 dark:text-blue-400 hover:underline flex items-center gap-1 font-semibold"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>{viewingDoc.sourceUrl}</span>
                </a>
                {viewingDoc.epubUrl && (
                  <a
                    href={viewingDoc.epubUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 font-semibold"
                  >
                    EPUB
                  </a>
                )}
              </div>
            )}

            {viewerLoading && (
              <div className="p-8 text-center text-xs text-slate-500 flex flex-col items-center gap-2">
                <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
                <span>Préparation de la lecture hors-ligne...</span>
              </div>
            )}

            {viewerError && (
              <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 text-xs text-amber-800 dark:text-amber-200 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{viewerError}</span>
              </div>
            )}

            {viewingText && (
              <div className="space-y-2">
                <div className="flex items-center justify-end gap-2 text-xs">
                  <span className="text-slate-500 flex items-center gap-1">
                    <Type className="w-3.5 h-3.5" /> Taille :
                  </span>
                  <button
                    type="button"
                    onClick={() => setReaderFontSize((s) => Math.max(12, s - 2))}
                    className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 font-bold"
                  >
                    A-
                  </button>
                  <button
                    type="button"
                    onClick={() => setReaderFontSize((s) => Math.min(24, s + 2))}
                    className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 font-bold"
                  >
                    A+
                  </button>
                </div>
                <div
                  style={{ fontSize: `${readerFontSize}px` }}
                  className="p-4 sm:p-6 rounded-2xl bg-amber-50/40 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 max-h-[50dvh] sm:max-h-[60vh] overflow-y-auto overscroll-contain leading-relaxed whitespace-pre-wrap font-serif text-slate-800 dark:text-slate-100"
                >
                  {viewingText}
                </div>
              </div>
            )}

            {viewingBlobUrl && viewingDoc.mimeType.startsWith('image/') && (
              <img
                src={viewingBlobUrl}
                alt={viewingDoc.title}
                className="max-h-[50dvh] sm:max-h-[60vh] mx-auto rounded-xl object-contain"
              />
            )}

            {viewingBlobUrl && viewingDoc.mimeType.includes('pdf') && (
              <div className="space-y-2">
                <iframe
                  src={viewingBlobUrl}
                  title={viewingDoc.title}
                  className="w-full h-[45dvh] sm:h-[55vh] rounded-xl border border-slate-200 dark:border-slate-800 bg-white"
                />
                <p className="text-[11px] text-slate-500">
                  Astuce Android : si le PDF ne s’affiche pas dans le cadre ci-dessus, appuyez sur « Téléchargements » ou « Partager » pour l’ouvrir avec votre lecteur PDF du téléphone.
                </p>
              </div>
            )}

            {viewingBlobUrl && viewingDoc.mimeType.startsWith('audio/') && (
              <audio src={viewingBlobUrl} controls className="w-full" />
            )}

            {viewingBlobUrl && viewingDoc.mimeType.startsWith('video/') && (
              <video
                src={viewingBlobUrl}
                controls
                playsInline
                className="w-full max-h-[45dvh] sm:max-h-[55vh] rounded-xl"
              />
            )}

            {viewingBlobUrl &&
              !viewingText &&
              !viewingDoc.mimeType.startsWith('image/') &&
              !viewingDoc.mimeType.includes('pdf') &&
              !viewingDoc.mimeType.startsWith('audio/') &&
              !viewingDoc.mimeType.startsWith('video/') && (
                <div className="p-6 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center space-y-2 text-xs">
                  <FileText className="w-8 h-8 text-blue-700 mx-auto" />
                  <p className="font-bold text-slate-900 dark:text-white">{viewingDoc.fileName}</p>
                  <p className="text-slate-500">
                    Ce format ({viewingDoc.mimeType}) est conservé en sécurité dans votre Coffre. Enregistrez-le dans {downloadsFolderLabel} ou partagez-le vers votre application de lecture externe.
                  </p>
                </div>
              )}

            <div className="flex flex-wrap justify-between gap-2 pt-2">
              <button
                type="button"
                onClick={() => openEditDocModal(viewingDoc)}
                className="px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-semibold flex items-center gap-1.5"
              >
                <Pencil className="w-3.5 h-3.5" />
                <span>Renommer / Classer</span>
              </button>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => handleShareVaultDoc(viewingDoc)}
                  className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold flex items-center gap-1.5"
                >
                  <Share2 className="w-3.5 h-3.5" />
                  <span>{isEn ? 'Share' : 'Partager'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleSaveDocToPhone(viewingDoc)}
                  className="px-4 py-2 rounded-xl bg-blue-700 text-white text-xs font-bold flex items-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>{isEn ? 'Save to Downloads' : 'Téléchargements'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setViewingDoc(null)}
                  className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-semibold"
                >
                  {isEn ? 'Close' : 'Fermer'}
                </button>
              </div>
            </div>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        isOpen={!!confirmDeleteDocs && confirmDeleteDocs.length > 0}
        title={isEn ? 'Remove from Spiritual Vault?' : 'Supprimer du Coffre Spirituel ?'}
        message={
          confirmDeleteDocs && confirmDeleteDocs.length === 1
            ? `${isEn ? 'Delete' : 'Supprimer'} « ${confirmDeleteDocs[0].title} » ?`
            : `${isEn ? 'Delete' : 'Supprimer'} ${confirmDeleteDocs?.length || 0} document(s) sélectionné(s) ?`
        }
        confirmLabel={isEn ? 'Delete' : 'Supprimer'}
        cancelLabel={isEn ? 'Cancel' : 'Annuler'}
        isDestructive
        onConfirm={handleConfirmDelete}
        onCancel={() => setConfirmDeleteDocs(null)}
      />

      <SocialShareModal
        isOpen={!!sharePayload}
        onClose={() => setSharePayload(null)}
        payload={sharePayload}
      />

      <ShalomFolderExplorerModal
        isOpen={folderExplorerOpen}
        onClose={() => setFolderExplorerOpen(false)}
        reasonNotice={folderExplorerReason}
        onRequestNativeFolder={handleChooseDownloadDirectory}
        isEn={isEn}
      />
    </div>
  );
};
