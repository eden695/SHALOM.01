import React, { useState, useEffect } from 'react';
import {
  Settings,
  Shield,
  Download,
  Upload,
  HardDrive,
  User,
  Lock,
  CheckCircle2,
  Sun,
  Moon,
  KeyRound,
  Grid3X3,
  Hash,
  Image as ImageIcon,
  Camera,
  Trash2,
  BookOpen,
  RotateCcw,
  Loader2,
  Sparkles,
  Globe,
  Bell,
  BellOff,
  Clock,
  Info,
  Wifi,
  WifiOff,
  RefreshCw,
  FileText,
  ShieldCheck,
  Lightbulb,
  Eraser,
} from 'lucide-react';
import { dbService, STORES } from '../../services/db';
import { useShalomDB } from '../../hooks/useShalomDB';
import { useLanguage, WORLD_LANGUAGES } from '../../contexts/LanguageContext';
import { useModuleSubView } from '../../contexts/NavigationContext';
import { Modal } from '../common/Modal';
import { downloadBlobToDevice } from '../../services/fileTransfer';
import {
  getNotificationSettings,
  saveNotificationSettings,
  getUsageTipsEnabled,
  setUsageTipsEnabled,
  requestReminderNotificationPermission,
  showLocalReminderNotification,
} from '../../services/notifications';
import {
  hashSecret,
  getSecurityConfig,
  saveSecurityConfig,
  setAppSessionUnlocked,
  LOCKABLE_FEATURES,
} from '../../services/security';
import {
  UserProfile,
  LockMode,
  LockableFeatureId,
  SecurityConfig,
  AppLanguage,
  NotificationSettings,
} from '../../types';
import { PatternGrid } from '../security/PatternGrid';

interface SettingsModuleProps {
  initialSubTab?: string;
  isDarkMode: boolean;
  onToggleDarkMode: () => void;
  onLockNow: () => void;
  onSecurityChanged: (cfg: SecurityConfig) => void;
}

export const SettingsModule: React.FC<SettingsModuleProps> = ({
  initialSubTab = 'general',
  isDarkMode,
  onToggleDarkMode,
  onLockNow,
  onSecurityChanged,
}) => {
  const { userProfile, reloadData } = useShalomDB();
  const { lang, setLang, t, currentLanguageInfo } = useLanguage();
  const [subTab, setSubTab] = useModuleSubView<string>('settings', initialSubTab || 'general');
  const [langSearch, setLangSearch] = useState('');
  const [draftLanguage, setDraftLanguage] = useState<AppLanguage>(
    (userProfile?.language as AppLanguage) || lang
  );
  const [langAppliedNotice, setLangAppliedNotice] = useState<string | null>(null);

  const [saveNotice, setSaveNotice] = useState<string | null>(null);
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  const [userForm, setUserForm] = useState<UserProfile>({
    id: userProfile?.id || 'user_main',
    fullName: userProfile?.fullName || 'Utilisateur',
    phone: userProfile?.phone || '',
    email: userProfile?.email || '',
    avatarDataUrl: userProfile?.avatarDataUrl || undefined,
    dashboardVerseText: userProfile?.dashboardVerseText || '',
    dashboardVerseRef: userProfile?.dashboardVerseRef || '',
    theme: userProfile?.theme || 'light',
    language: userProfile?.language || lang,
    createdAt: userProfile?.createdAt || new Date().toISOString(),
  });

  // Security Protection Config State
  const [securityConfig, setSecurityConfig] = useState<SecurityConfig>(() => getSecurityConfig());
  const [draftLockMode, setDraftLockMode] = useState<LockMode>(() => getSecurityConfig().lockMode);
  const [draftLockOnLaunch, setDraftLockOnLaunch] = useState<boolean>(
    () => getSecurityConfig().lockOnLaunch
  );
  const [draftLockedFeatures, setDraftLockedFeatures] = useState<LockableFeatureId[]>(
    () => getSecurityConfig().lockedFeatures
  );
  const [draftAutoLockMinutes, setDraftAutoLockMinutes] = useState<number>(
    () => getSecurityConfig().autoLockMinutes || 0
  );

  // Notification Reminders & Usage Tips State
  const [notifSettings, setNotifSettings] = useState<NotificationSettings>(() =>
    getNotificationSettings()
  );
  const [notifPermission, setNotifPermission] = useState<string>(() =>
    typeof window !== 'undefined' && 'Notification' in window
      ? Notification.permission
      : 'unsupported'
  );
  const [notifNotice, setNotifNotice] = useState<string | null>(null);
  const [showUsageTips, setShowUsageTips] = useState<boolean>(() => getUsageTipsEnabled());

  // About / Connection / Update / Legal Modals State
  const [isOnline, setIsOnline] = useState<boolean>(() =>
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [updateCheckStatus, setUpdateCheckStatus] = useState<
    'idle' | 'checking' | 'up-to-date' | 'available' | 'offline' | 'error'
  >('idle');
  const [updateCheckMessage, setUpdateCheckMessage] = useState<string | null>(null);
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);

  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [patternStep1, setPatternStep1] = useState<string>('');
  const [patternStep2, setPatternStep2] = useState<string>('');
  const [securityNotice, setSecurityNotice] = useState<string | null>(null);
  const [isSavingSecurity, setIsSavingSecurity] = useState(false);

  const [storageStats, setStorageStats] = useState<{
    usageMB: number;
    quotaMB: number;
    percentage: number;
    persisted: boolean;
  }>({ usageMB: 0, quotaMB: 1000, percentage: 0, persisted: false });
  const [backupLoading, setBackupLoading] = useState(false);
  const [cacheClearing, setCacheClearing] = useState(false);
  const [restoreMessage, setRestoreMessage] = useState<string | null>(null);
  const [storageActionMessage, setStorageActionMessage] = useState<string | null>(null);

  useEffect(() => {
    if (userProfile) {
      setUserForm(userProfile);
      if (userProfile.language) {
        setDraftLanguage(userProfile.language as AppLanguage);
      }
    }
    dbService.getStorageEstimate().then(setStorageStats);
  }, [userProfile]);

  useEffect(() => {
    const syncConnection = () => setIsOnline(navigator.onLine);
    window.addEventListener('online', syncConnection);
    window.addEventListener('offline', syncConnection);
    return () => {
      window.removeEventListener('online', syncConnection);
      window.removeEventListener('offline', syncConnection);
    };
  }, []);

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const size = 256;
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        const minSide = Math.min(img.width, img.height);
        const sx = (img.width - minSide) / 2;
        const sy = (img.height - minSide) / 2;
        ctx.drawImage(img, sx, sy, minSide, minSide, 0, 0, size, size);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.88);
        setUserForm((prev) => ({ ...prev, avatarDataUrl: dataUrl }));
      };
      if (typeof reader.result === 'string') {
        img.src = reader.result;
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleApplyAndSaveLanguage = async () => {
    setLangAppliedNotice(null);
    const chosen = draftLanguage || lang;
    const nextProfile: UserProfile = {
      ...userForm,
      language: chosen,
    };
    setLang(chosen);
    setUserForm(nextProfile);
    await dbService.put(STORES.PROFILES, nextProfile);
    setLangAppliedNotice(
      chosen === 'en'
        ? 'Language applied and saved.'
        : 'Langue appliquée et enregistrée.'
    );
    reloadData();
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaveNotice(null);
    setIsSavingProfile(true);
    try {
      const chosenLang = draftLanguage || userForm.language || lang;
      const cleaned: UserProfile = {
        ...userForm,
        fullName: userForm.fullName.trim() || 'Utilisateur',
        dashboardVerseText: userForm.dashboardVerseText?.trim() || '',
        dashboardVerseRef: userForm.dashboardVerseRef?.trim() || '',
        language: chosenLang,
        showUsageTips,
      };
      setLang(chosenLang);
      setUsageTipsEnabled(showUsageTips);
      await Promise.all([
        dbService.put(STORES.PROFILES, cleaned),
        new Promise((resolve) => setTimeout(resolve, 350)),
      ]);
      setUserForm(cleaned);
      setSaveNotice(
        chosenLang === 'en'
          ? 'Your profile, language, and preferences have been saved.'
          : 'Vos paramètres, langue, profil et préférences ont bien été enregistrés.'
      );
      reloadData();
    } catch {
      setSaveNotice('Une erreur est survenue lors de l’enregistrement.');
    } finally {
      setIsSavingProfile(false);
    }
  };

  const toggleFeatureLock = (featureId: LockableFeatureId) => {
    setDraftLockedFeatures((prev) =>
      prev.includes(featureId) ? prev.filter((id) => id !== featureId) : [...prev, featureId]
    );
  };

  const handleSaveSecurityPolicy = async (e: React.FormEvent) => {
    e.preventDefault();
    setSecurityNotice(null);

    let secretToHash = '';
    const needsNewSecret =
      !securityConfig.secretHash ||
      securityConfig.lockMode !== draftLockMode ||
      newPin.length > 0 ||
      newPassword.length > 0 ||
      patternStep1.length > 0;

    if (needsNewSecret) {
      if (draftLockMode === 'pin') {
        if (!/^\d{4}$/.test(newPin)) {
          setSecurityNotice('Le code PIN doit contenir exactement 4 chiffres.');
          return;
        }
        if (newPin !== confirmPin) {
          setSecurityNotice('Les deux codes PIN ne correspondent pas.');
          return;
        }
        secretToHash = newPin;
      } else if (draftLockMode === 'password') {
        if (newPassword.length < 4) {
          setSecurityNotice('Le mot de passe doit contenir au moins 4 caractères.');
          return;
        }
        if (newPassword !== confirmPassword) {
          setSecurityNotice('Les deux mots de passe ne correspondent pas.');
          return;
        }
        secretToHash = newPassword;
      } else if (draftLockMode === 'pattern') {
        if (!patternStep1 || patternStep1.split('-').length < 4) {
          setSecurityNotice('Tracez un schéma reliant au moins 4 points.');
          return;
        }
        if (patternStep1 !== patternStep2) {
          setSecurityNotice('Les deux schémas tracés ne correspondent pas.');
          setPatternStep1('');
          setPatternStep2('');
          return;
        }
        secretToHash = patternStep1;
      }
    }

    setIsSavingSecurity(true);
    try {
      const finalHash = secretToHash ? await hashSecret(secretToHash) : securityConfig.secretHash;

      if (!draftLockOnLaunch && draftLockedFeatures.length === 0) {
        setSecurityNotice(
          'Sélectionnez au moins « Verrouiller l’ouverture de l’application » ou une fonctionnalité à protéger.'
        );
        return;
      }

      const nextConfig: SecurityConfig = {
        isEnabled: true,
        lockMode: draftLockMode,
        secretHash: finalHash,
        lockOnLaunch: draftLockOnLaunch,
        lockedFeatures: draftLockedFeatures,
        autoLockMinutes: draftAutoLockMinutes,
      };

      await new Promise((resolve) => setTimeout(resolve, 350));
      saveSecurityConfig(nextConfig);
      setSecurityConfig(nextConfig);
      onSecurityChanged(nextConfig);
      setAppSessionUnlocked(true);

      setNewPin('');
      setConfirmPin('');
      setNewPassword('');
      setConfirmPassword('');
      setPatternStep1('');
      setPatternStep2('');
      setSecurityNotice('Protection enregistrée et activée avec succès.');
    } finally {
      setIsSavingSecurity(false);
    }
  };

  const handleDisableSecurity = () => {
    const disabled: SecurityConfig = {
      isEnabled: false,
      lockMode: draftLockMode,
      secretHash: '',
      lockOnLaunch: false,
      lockedFeatures: [],
      autoLockMinutes: 0,
    };
    saveSecurityConfig(disabled);
    setSecurityConfig(disabled);
    setDraftLockOnLaunch(false);
    setDraftLockedFeatures([]);
    setDraftAutoLockMinutes(0);
    onSecurityChanged(disabled);
    setAppSessionUnlocked(true);
    setSecurityNotice('Protection désactivée.');
  };

  const handleUpdateReminder = async (
    key: keyof NotificationSettings,
    patch: Partial<{ enabled: boolean; time: string }>
  ) => {
    const next: NotificationSettings = {
      ...notifSettings,
      [key]: {
        ...notifSettings[key],
        ...patch,
      },
    };
    setNotifSettings(next);
    saveNotificationSettings(next);

    if (patch.enabled) {
      const perm = await requestReminderNotificationPermission();
      setNotifPermission(perm);
      if (perm === 'granted') {
        setNotifNotice('Rappel activé et enregistré.');
      } else if (perm === 'denied') {
        setNotifNotice(
          'Rappel enregistré. Les notifications système sont bloquées par le navigateur, mais le rappel s’affichera directement dans SHALOM.'
        );
      } else {
        setNotifNotice('Rappel enregistré (alerte intégrée dans SHALOM active).');
      }
    } else if (patch.enabled === false) {
      setNotifNotice('Ce rappel a été désactivé.');
    } else {
      setNotifNotice('Heure du rappel mise à jour.');
    }
  };

  const handleToggleUsageTips = (nextValue: boolean) => {
    setShowUsageTips(nextValue);
    setUsageTipsEnabled(nextValue);
    setUserForm((prev) => ({ ...prev, showUsageTips: nextValue }));
    setSaveNotice(
      nextValue
        ? 'Les conseils d’utilisation sont maintenant activés sur l’accueil.'
        : 'Les conseils d’utilisation ont été masqués.'
    );
  };

  const handleClearCacheOnly = async () => {
    setCacheClearing(true);
    setStorageActionMessage(null);
    try {
      let deletedCount = 0;
      if (typeof window !== 'undefined' && 'caches' in window) {
        const keys = await window.caches.keys();
        await Promise.all(keys.map((key) => window.caches.delete(key)));
        deletedCount = keys.length;
      }
      const stats = await dbService.getStorageEstimate();
      setStorageStats(stats);
      setStorageActionMessage(
        deletedCount > 0
          ? `Cache vidé (${deletedCount} espace(s) de cache supprimé(s)). Toutes vos données personnelles (prières, notes, contacts, livres et médias) sont intactes.`
          : 'Aucun fichier en cache à supprimer. Vos données personnelles restent 100 % intactes.'
      );
    } catch {
      setStorageActionMessage(
        'Impossible d’accéder au cache système dans cet environnement, mais vos données personnelles n’ont pas été modifiées.'
      );
    } finally {
      setCacheClearing(false);
    }
  };

  const handleCheckForUpdates = async () => {
    if (!navigator.onLine) {
      setUpdateCheckStatus('offline');
      setUpdateCheckMessage(
        'Connexion Internet requise pour vérifier la disponibilité d’une nouvelle version.'
      );
      return;
    }

    setUpdateCheckStatus('checking');
    setUpdateCheckMessage('Vérification auprès du serveur en cours...');
    try {
      let hasNewSw = false;
      if ('serviceWorker' in navigator) {
        try {
          const reg = await navigator.serviceWorker.getRegistration();
          if (reg) {
            await reg.update();
            if (reg.waiting || reg.installing) {
              hasNewSw = true;
            }
          }
        } catch {
          // ignore SW update check errors in non-SW environments
        }
      }

      let hasNewHtmlBundle = false;
      try {
        const res = await fetch(`./index.html?check=${Date.now()}`, { cache: 'no-store' });
        if (res.ok) {
          const html = await res.text();
          const remoteMatches = Array.from(html.matchAll(/assets\/index-[A-Za-z0-9_-]+\.js/g)).map(
            (m) => m[0]
          );
          const currentScripts = Array.from(document.querySelectorAll('script[src]')).map(
            (s) => s.getAttribute('src') || ''
          );
          if (remoteMatches.length > 0 && currentScripts.some((s) => s.includes('assets/index-'))) {
            const matchesCurrent = remoteMatches.some((rm) =>
              currentScripts.some((cs) => cs.includes(rm))
            );
            if (!matchesCurrent) {
              hasNewHtmlBundle = true;
            }
          }
        }
      } catch {
        // ignore fetch issue if local dev or offline
      }

      if (hasNewSw || hasNewHtmlBundle) {
        setUpdateCheckStatus('available');
        setUpdateCheckMessage(
          'Une nouvelle version de SHALOM est disponible ! Appuyez sur « Actualiser l’application » pour l’appliquer.'
        );
      } else {
        setUpdateCheckStatus('up-to-date');
        setUpdateCheckMessage(
          `Vous utilisez déjà la dernière version disponible (${__SHALOM_APP_VERSION__}).`
        );
      }
    } catch {
      setUpdateCheckStatus('error');
      setUpdateCheckMessage('Impossible de joindre le serveur de mise à jour pour le moment.');
    }
  };

  const handleDownloadBackup = async () => {
    try {
      setBackupLoading(true);
      const jsonBackup = await dbService.exportBackup(false);
      const blob = new Blob([jsonBackup], { type: 'application/json' });
      const fileName = `shalom_sauvegarde_${new Date().toISOString().split('T')[0]}.json`;
      const res = await downloadBlobToDevice(blob, fileName, 'application/json');
      if (res.ok) {
        setRestoreMessage(`Sauvegarde « ${res.fileName} » enregistrée dans ${res.locationLabel}.`);
      } else {
        setRestoreMessage(res.error || 'Erreur lors de la sauvegarde.');
      }
    } catch {
      setRestoreMessage('Erreur lors de la sauvegarde.');
    } finally {
      setBackupLoading(false);
    }
  };

  const handleRestoreFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      const content = evt.target?.result as string;
      if (!content) return;
      const result = await dbService.restoreBackup(content);
      setRestoreMessage(result.message);
      if (result.success) reloadData();
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleDownloadLogo = async (format: 'png' | 'jpg') => {
    const fileName = `shalom_logo_512x512.${format}`;
    try {
      const response = await fetch(`./${fileName}`);
      const blob = await response.blob();
      const res = await downloadBlobToDevice(
        blob,
        fileName,
        format === 'png' ? 'image/png' : 'image/jpeg'
      );
      if (res.ok) {
        setSaveNotice(`Logo « ${res.fileName} » enregistré dans ${res.locationLabel}.`);
      } else {
        setSaveNotice(res.error || 'Erreur lors du téléchargement du logo.');
      }
    } catch {
      setSaveNotice('Erreur lors du téléchargement du logo.');
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white flex items-center gap-2 font-display">
            <Settings className="w-6 h-6 text-blue-700 dark:text-blue-400" />
            <span>Paramètres & Sécurité</span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Profil personnel, protection au choix et sauvegarde locale
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200/60 dark:border-slate-700/60 self-start sm:self-auto">
          {[
            { id: 'general', label: 'Profil & Apparence' },
            { id: 'notifications', label: 'Notifications' },
            { id: 'security', label: 'Sécurité' },
            { id: 'backup', label: 'Sauvegarde & Cache' },
            { id: 'about', label: 'À propos' },
          ].map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setSubTab(t.id)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition ${
                subTab === t.id
                  ? 'bg-white dark:bg-[#0f2b5c] text-blue-700 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* 1. Mon Profil */}
      {subTab === 'general' && (
        <div className="max-w-xl space-y-6">
          <form onSubmit={handleSaveProfile} className="space-y-5">
            {saveNotice && (
              <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/50 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                {saveNotice}
              </div>
            )}

            <div className="p-5 rounded-2xl bg-white dark:bg-[#0c1631] border border-slate-200/80 dark:border-slate-800/80 space-y-4 shadow-xs">
              <div className="flex items-center gap-2 text-blue-700 dark:text-blue-400 font-bold text-xs uppercase tracking-wider">
                <User className="w-4 h-4" />
                <span>Mon Profil & Apparence</span>
              </div>

              {/* Photo de profil utilisateur */}
              <div className="flex items-center gap-4 p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                <div className="w-16 h-16 rounded-full overflow-hidden bg-[#0b1f42] text-white flex items-center justify-center font-bold text-lg shrink-0 border-2 border-amber-400/50">
                  {userForm.avatarDataUrl ? (
                    <img
                      src={userForm.avatarDataUrl}
                      alt={userForm.fullName || 'Profil'}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span>{(userForm.fullName || 'U').trim().charAt(0).toUpperCase()}</span>
                  )}
                </div>

                <div className="flex-1 space-y-2">
                  <span className="block text-xs font-semibold text-slate-800 dark:text-slate-200">
                    Photo de profil
                  </span>
                  <div className="flex flex-wrap items-center gap-2">
                    <label className="px-3 py-1.5 rounded-lg bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition">
                      <Camera className="w-3.5 h-3.5" />
                      <span>{userForm.avatarDataUrl ? 'Changer la photo' : 'Ajouter une photo'}</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleAvatarChange}
                        className="hidden"
                      />
                    </label>
                    {userForm.avatarDataUrl && (
                      <button
                        type="button"
                        onClick={() => setUserForm({ ...userForm, avatarDataUrl: undefined })}
                        className="px-2.5 py-1.5 rounded-lg text-xs font-semibold text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 flex items-center gap-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Retirer</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1">Votre nom complet / prénom</label>
                <input
                  type="text"
                  placeholder="Ex: David Kouassi"
                  value={userForm.fullName}
                  onChange={(e) => setUserForm({ ...userForm, fullName: e.target.value })}
                  className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1">Téléphone</label>
                <input
                  type="tel"
                  value={userForm.phone || ''}
                  onChange={(e) => setUserForm({ ...userForm, phone: e.target.value })}
                  className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800"
                />
              </div>

              {/* Verset affiché dans le Dashboard */}
              <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-xs font-bold text-blue-700 dark:text-blue-400">
                    <BookOpen className="w-3.5 h-3.5" />
                    <span>Verset affiché à l’Accueil (Dashboard)</span>
                  </span>
                  {(userForm.dashboardVerseText || userForm.dashboardVerseRef) && (
                    <button
                      type="button"
                      onClick={() =>
                        setUserForm({ ...userForm, dashboardVerseText: '', dashboardVerseRef: '' })
                      }
                      className="text-[11px] font-semibold text-slate-500 hover:text-blue-700 flex items-center gap-1"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>Verset par défaut</span>
                    </button>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold mb-1">
                    Texte du verset (collez votre verset ici)
                  </label>
                  <textarea
                    rows={3}
                    placeholder="Collez ici le verset à afficher sur l’écran d’accueil..."
                    value={userForm.dashboardVerseText || ''}
                    onChange={(e) =>
                      setUserForm({ ...userForm, dashboardVerseText: e.target.value })
                    }
                    className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold mb-1">
                    Référence (facultatif)
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: Psaume 23:1"
                    value={userForm.dashboardVerseRef || ''}
                    onChange={(e) =>
                      setUserForm({ ...userForm, dashboardVerseRef: e.target.value })
                    }
                    className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1">{t('settings.languageLabel')}</label>
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2.5">
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
                      <Globe className="w-4 h-4 text-blue-700 dark:text-blue-400 shrink-0" />
                      <span>
                        {currentLanguageInfo.nativeName} ({currentLanguageInfo.code}) · {t('settings.languageDesc')}
                      </span>
                    </span>
                  </div>

                  <input
                    type="text"
                    value={langSearch}
                    onChange={(e) => setLangSearch(e.target.value)}
                    placeholder="Rechercher une langue (Français, English, Lingala, Swahili, العربية, Español...)"
                    className="w-full px-3 py-1.5 text-xs rounded-lg bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800"
                  />

                  <select
                    value={draftLanguage}
                    onChange={(e) => {
                      setDraftLanguage(e.target.value as AppLanguage);
                      setLangAppliedNotice(null);
                    }}
                    size={6}
                    className="w-full px-2.5 py-1.5 text-xs rounded-lg bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800"
                  >
                    {WORLD_LANGUAGES.filter((opt) => {
                      const q = langSearch.trim().toLowerCase();
                      if (!q) return true;
                      return (
                        opt.nativeName.toLowerCase().includes(q) ||
                        opt.labelFr.toLowerCase().includes(q) ||
                        opt.code.toLowerCase().includes(q)
                      );
                    }).map((opt) => (
                      <option key={opt.code} value={opt.code}>
                        {opt.nativeName} — {opt.labelFr} ({opt.code})
                      </option>
                    ))}
                  </select>

                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                    <span className="text-[11px] text-slate-500">
                      Sélectionnée : <strong>{draftLanguage}</strong>
                      {draftLanguage !== lang ? ' (non encore appliquée)' : ' (active)'}
                    </span>
                    <button
                      type="button"
                      onClick={handleApplyAndSaveLanguage}
                      className="px-3.5 py-2 rounded-xl bg-blue-700 hover:bg-blue-800 text-white text-xs font-bold flex items-center gap-1.5 transition"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Appliquer et enregistrer la langue</span>
                    </button>
                  </div>

                  {langAppliedNotice && (
                    <p className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">
                      {langAppliedNotice}
                    </p>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1">Thème visuel</label>
                <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs">
                  <span>Mode Sombre / Nuit</span>
                  <button
                    type="button"
                    onClick={onToggleDarkMode}
                    className="px-3 py-1.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center gap-1.5 font-bold"
                  >
                    {isDarkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4" />}
                    <span>{isDarkMode ? 'Activé' : 'Désactivé'}</span>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1">Aide et conseils d’utilisation</label>
                <div className="flex items-center justify-between gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs">
                  <div className="flex items-start gap-2.5">
                    <Lightbulb className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-semibold text-slate-900 dark:text-white block">
                        Afficher les conseils d’utilisation
                      </span>
                      <span className="text-[11px] text-slate-500">
                        Astuces pratiques affichées sur l’écran d’accueil de SHALOM
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleToggleUsageTips(!showUsageTips)}
                    className={`px-3 py-1.5 rounded-lg border font-bold shrink-0 transition ${
                      showUsageTips
                        ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300'
                        : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400'
                    }`}
                  >
                    {showUsageTips ? 'Activés' : 'Désactivés'}
                  </button>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              {saveNotice && (
                <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/50 text-xs font-semibold text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>{saveNotice}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={isSavingProfile}
                className="px-6 py-2.5 rounded-xl bg-blue-700 hover:bg-blue-800 disabled:opacity-70 text-white font-bold text-xs shadow-sm transition inline-flex items-center gap-2"
              >
                {isSavingProfile ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Enregistrement en cours...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Enregistrer</span>
                  </>
                )}
              </button>
            </div>
          </form>

          <div className="p-5 rounded-2xl bg-white dark:bg-[#0c1631] border border-slate-200/80 dark:border-slate-800/80 space-y-4 shadow-xs">
            <div className="flex items-center gap-2 text-blue-700 dark:text-blue-400 font-bold text-xs uppercase tracking-wider">
              <ImageIcon className="w-4 h-4" />
              <span>Logo officiel SHALOM (512 × 512 px)</span>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-4">
              <div className="w-24 h-24 rounded-2xl overflow-hidden shadow-md border border-slate-200/70 dark:border-slate-700/70 shrink-0 bg-slate-100 dark:bg-slate-900">
                <img
                  src="./shalom_logo_512x512.png"
                  alt="Logo SHALOM 512x512"
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-contain"
                />
              </div>

              <div className="space-y-2.5 flex-1 text-center sm:text-left">
                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                  Téléchargez le logo en haute netteté <strong>512 × 512 px</strong> pour vos documents, réseaux ou icônes externes.
                </p>

                <div className="flex flex-wrap justify-center sm:justify-start gap-2">
                  <button
                    type="button"
                    onClick={() => handleDownloadLogo('png')}
                    className="px-3.5 py-2 rounded-xl bg-blue-700 hover:bg-blue-800 text-white text-xs font-bold flex items-center gap-1.5 transition"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>PNG transparent (512×512)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleDownloadLogo('jpg')}
                    className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 text-xs font-semibold flex items-center gap-1.5 transition"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>JPG plein cadre (512×512)</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 1b. Paramètres de Notifications & Rappels */}
      {subTab === 'notifications' && (
        <div className="max-w-2xl space-y-5">
          <div className="p-5 sm:p-6 rounded-2xl bg-white dark:bg-[#0c1631] border border-slate-200/80 dark:border-slate-800/80 space-y-5 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 text-blue-700 dark:text-blue-400 font-bold text-xs uppercase tracking-wider">
                  <Bell className="w-4 h-4" />
                  <span>Rappels quotidiens de vie spirituelle</span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Activez, désactivez séparément et personnalisez l’heure de chaque rappel.
                </p>
              </div>

              <button
                type="button"
                onClick={async () => {
                  const perm = await requestReminderNotificationPermission();
                  setNotifPermission(perm);
                  const sent = showLocalReminderNotification(
                    'SHALOM · Test de rappel',
                    'Vos rappels spirituels quotidiens sont prêts.'
                  );
                  setNotifNotice(
                    sent
                      ? 'Notification de test envoyée avec succès.'
                      : 'Aperçu enregistré. Si l’appareil bloque les alertes système, le rappel s’affichera en bannière dans l’application.'
                  );
                }}
                className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-semibold flex items-center gap-1.5 self-start sm:self-auto"
              >
                <Bell className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                <span>Tester une notification</span>
              </button>
            </div>

            {notifNotice && (
              <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/50 text-xs font-semibold text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{notifNotice}</span>
              </div>
            )}

            <div className="space-y-3">
              {[
                {
                  key: 'dailyPrayer' as const,
                  title: 'Rappel quotidien de prière',
                  desc: 'Un moment dédié chaque jour pour votre vie de prière et d’intercession.',
                },
                {
                  key: 'meditation' as const,
                  title: 'Rappel de méditation',
                  desc: 'Une pause calme pour méditer la Parole et cultiver la paix intérieure.',
                },
                {
                  key: 'bibleReading' as const,
                  title: 'Rappel de lecture biblique',
                  desc: 'Un rendez-vous régulier pour lire votre passage biblique du jour.',
                },
              ].map((item) => {
                const cfg = notifSettings[item.key];
                return (
                  <div
                    key={item.key}
                    className={`p-4 rounded-xl border transition space-y-3 ${
                      cfg.enabled
                        ? 'bg-blue-50/50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-900/60'
                        : 'bg-slate-50 dark:bg-slate-900/60 border-slate-200 dark:border-slate-800'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-2.5">
                        {cfg.enabled ? (
                          <Bell className="w-4 h-4 text-blue-700 dark:text-blue-400 shrink-0 mt-0.5" />
                        ) : (
                          <BellOff className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                        )}
                        <div>
                          <h4 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
                            {item.title}
                          </h4>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                            {item.desc}
                          </p>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleUpdateReminder(item.key, { enabled: !cfg.enabled })}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold shrink-0 border transition ${
                          cfg.enabled
                            ? 'bg-blue-700 text-white border-blue-700'
                            : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                        }`}
                      >
                        {cfg.enabled ? 'Activé' : 'Désactivé'}
                      </button>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-200/70 dark:border-slate-800">
                      <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-300">
                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                        <span>Heure personnalisée :</span>
                      </label>
                      <input
                        type="time"
                        value={cfg.time}
                        onChange={(e) => handleUpdateReminder(item.key, { time: e.target.value })}
                        className="px-3 py-1.5 text-xs font-bold rounded-lg bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500 dark:text-slate-400">
              <span>
                Autorisation système :{' '}
                <strong className="text-slate-800 dark:text-slate-200">
                  {notifPermission === 'granted'
                    ? 'Accordée'
                    : notifPermission === 'denied'
                    ? 'Refusée (alerte interne active)'
                    : notifPermission === 'unsupported'
                    ? 'Non supportée (alerte interne active)'
                    : 'Non demandée'}
                </strong>
              </span>
              {notifPermission === 'default' && (
                <button
                  type="button"
                  onClick={async () => {
                    const perm = await requestReminderNotificationPermission();
                    setNotifPermission(perm);
                  }}
                  className="text-blue-700 dark:text-blue-400 font-bold hover:underline"
                >
                  Autoriser les notifications
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 2. Protection au choix */}
      {subTab === 'security' && (
        <form onSubmit={handleSaveSecurityPolicy} className="max-w-3xl space-y-6">
          {/* Hero Protection Summary */}
          <div className="p-5 sm:p-6 rounded-3xl bg-white dark:bg-[#0c1631] border border-slate-200 dark:border-slate-800 shadow-xs space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-start gap-3.5">
                <div
                  className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 border ${
                    securityConfig.isEnabled
                      ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-900/60 text-emerald-700 dark:text-emerald-400'
                      : 'bg-slate-100 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                  }`}
                >
                  <Shield className="w-6 h-6" />
                </div>
                <div className="space-y-1">
                  <h2 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-white tracking-tight">
                    Sécurité & Verrouillage SHALOM
                  </h2>
                  <p className="text-xs text-slate-600 dark:text-slate-400 flex flex-wrap items-center gap-1.5">
                    <span
                      className={`font-bold ${
                        securityConfig.isEnabled
                          ? 'text-emerald-700 dark:text-emerald-400'
                          : 'text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      {securityConfig.isEnabled ? 'Protection active' : 'Protection désactivée'}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span className="tabular-nums">
                      {draftLockedFeatures.length + (draftLockOnLaunch ? 1 : 0)} élément(s) protégé(s)
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>
                      Mode{' '}
                      {draftLockMode === 'pin'
                        ? 'Code PIN'
                        : draftLockMode === 'password'
                          ? 'Mot de passe'
                          : 'Schéma 3×3'}
                    </span>
                  </p>
                </div>
              </div>

              {securityConfig.isEnabled && (
                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={onLockNow}
                    className="min-h-[44px] px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-900 dark:text-slate-100 text-xs font-bold flex items-center gap-1.5 transition"
                  >
                    <Lock className="w-4 h-4" />
                    <span>Verrouiller</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleDisableSecurity}
                    className="min-h-[44px] px-4 py-2 rounded-xl border border-red-200 dark:border-red-900/60 text-red-600 dark:text-red-400 text-xs font-bold hover:bg-red-50 dark:hover:bg-red-950/30 transition"
                  >
                    Désactiver
                  </button>
                </div>
              )}
            </div>

            {securityNotice && (
              <div className="p-3.5 rounded-2xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/60 text-xs font-semibold text-blue-900 dark:text-blue-200 flex items-center gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-blue-700 dark:text-blue-400 shrink-0" />
                <span>{securityNotice}</span>
              </div>
            )}
          </div>

          {/* 1. Périmètre de protection */}
          <div className="p-5 sm:p-6 rounded-3xl bg-white dark:bg-[#0c1631] border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
            <div className="space-y-0.5">
              <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">
                01. Périmètre de protection
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Choisissez librement de verrouiller l’ouverture complète ou uniquement certains modules sensibles.
              </p>
            </div>

            <label className="min-h-[56px] p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-4 cursor-pointer hover:border-blue-400 dark:hover:border-blue-700 transition">
              <div className="space-y-0.5">
                <span className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white block">
                  Bloquer l’ouverture de l’application
                </span>
                <span className="text-[11px] text-slate-500 dark:text-slate-400 block">
                  Demande votre code ou schéma dès le lancement de SHALOM
                </span>
              </div>
              <div className="relative inline-flex items-center shrink-0">
                <input
                  type="checkbox"
                  checked={draftLockOnLaunch}
                  onChange={(e) => setDraftLockOnLaunch(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 rounded-full bg-slate-300 dark:bg-slate-700 peer-checked:bg-blue-700 transition-colors after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-transform peer-checked:after:translate-x-5 shadow-inner" />
              </div>
            </label>

            <div className="pt-1 space-y-2">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
                Modules protégés individuellement
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {LOCKABLE_FEATURES.map((feat) => {
                  const checked = draftLockedFeatures.includes(feat.id);
                  return (
                    <label
                      key={feat.id}
                      className={`min-h-[46px] px-3.5 py-2.5 rounded-2xl border text-xs flex items-center justify-between gap-3 cursor-pointer transition ${
                        checked
                          ? 'border-blue-600 bg-blue-50/80 dark:bg-blue-950/40 text-blue-900 dark:text-blue-200 font-bold'
                          : 'border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/40 text-slate-700 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-700'
                      }`}
                    >
                      <span className="truncate">{feat.label}</span>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleFeatureLock(feat.id)}
                        className="w-4 h-4 accent-blue-700 shrink-0 rounded"
                      />
                    </label>
                  );
                })}
              </div>
            </div>
          </div>

          {/* 2. Méthode de déverrouillage */}
          <div className="p-5 sm:p-6 rounded-3xl bg-white dark:bg-[#0c1631] border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
            <div className="space-y-0.5">
              <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">
                02. Méthode de déverrouillage
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Définissez un code PIN à 4 chiffres, un mot de passe personnel ou un schéma 3×3.
              </p>
            </div>

            <div className="grid grid-cols-3 gap-2.5">
              {[
                { id: 'pin', label: 'Code PIN', hint: '4 chiffres', icon: Hash },
                { id: 'password', label: 'Mot de passe', hint: 'Texte libre', icon: KeyRound },
                { id: 'pattern', label: 'Schéma 3×3', hint: 'Tracé tactile', icon: Grid3X3 },
              ].map((m) => {
                const Icon = m.icon;
                const active = draftLockMode === m.id;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => {
                      setDraftLockMode(m.id as LockMode);
                      setSecurityNotice(null);
                    }}
                    className={`min-h-[72px] p-3 rounded-2xl border flex flex-col items-center justify-center gap-1 text-center transition ${
                      active
                        ? 'border-blue-600 bg-blue-50 dark:bg-blue-950/50 text-blue-800 dark:text-blue-200 ring-2 ring-blue-600/20'
                        : 'border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/40 text-slate-700 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-700'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span className="text-xs font-bold leading-tight">{m.label}</span>
                    <span className="text-[10px] opacity-75">{m.hint}</span>
                  </button>
                );
              })}
            </div>

            <div className="p-4 sm:p-5 rounded-2xl bg-slate-50 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800 space-y-3">
              {securityConfig.secretHash && securityConfig.lockMode === draftLockMode && (
                <div className="text-xs text-emerald-700 dark:text-emerald-400 font-semibold flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>
                    Un secret ({draftLockMode}) est déjà enregistré. Laissez ces champs vides pour le conserver.
                  </span>
                </div>
              )}

              {draftLockMode === 'pin' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-200 mb-1.5">
                      Nouveau PIN (4 chiffres)
                    </label>
                    <input
                      type="password"
                      inputMode="numeric"
                      maxLength={4}
                      placeholder="••••"
                      value={newPin}
                      onChange={(e) => setNewPin(e.target.value.replace(/[^0-9]/g, ''))}
                      className="w-full min-h-[44px] px-3 py-2 text-center text-base font-mono tracking-[0.4em] rounded-xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-200 mb-1.5">
                      Confirmer le PIN
                    </label>
                    <input
                      type="password"
                      inputMode="numeric"
                      maxLength={4}
                      placeholder="••••"
                      value={confirmPin}
                      onChange={(e) => setConfirmPin(e.target.value.replace(/[^0-9]/g, ''))}
                      className="w-full min-h-[44px] px-3 py-2 text-center text-base font-mono tracking-[0.4em] rounded-xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"
                    />
                  </div>
                </div>
              )}

              {draftLockMode === 'password' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-200 mb-1.5">
                      Mot de passe
                    </label>
                    <input
                      type="password"
                      placeholder="Min. 4 caractères"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="w-full min-h-[44px] px-3.5 py-2 rounded-xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-200 mb-1.5">
                      Confirmer
                    </label>
                    <input
                      type="password"
                      placeholder="Confirmer"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="w-full min-h-[44px] px-3.5 py-2 rounded-xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"
                    />
                  </div>
                </div>
              )}

              {draftLockMode === 'pattern' && (
                <div className="text-center space-y-2.5">
                  {!patternStep1 ? (
                    <PatternGrid
                      key="pattern-step-1"
                      label="Étape 1/2 : Tracez votre schéma (min. 4 points)"
                      onPatternComplete={(pat) => {
                        if (pat.split('-').length >= 4) {
                          setSecurityNotice(null);
                          setPatternStep1(pat);
                        } else {
                          setSecurityNotice('Reliez au moins 4 points.');
                        }
                      }}
                    />
                  ) : !patternStep2 ? (
                    <div className="space-y-2">
                      <PatternGrid
                        key="pattern-step-2"
                        label="Étape 2/2 : Confirmez le même schéma"
                        onPatternComplete={(pat) => {
                          if (pat !== patternStep1) {
                            setSecurityNotice('Les deux schémas ne correspondent pas. Tracez à nouveau.');
                            return;
                          }
                          setSecurityNotice(null);
                          setPatternStep2(pat);
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setPatternStep1('');
                          setPatternStep2('');
                        }}
                        className="min-h-[40px] px-3 text-xs font-semibold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 underline"
                      >
                        Recommencer
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-2 py-2">
                      <div className="text-xs font-bold text-emerald-700 dark:text-emerald-400 flex items-center justify-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Schéma confirmé et prêt à être enregistré.</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setPatternStep1('');
                          setPatternStep2('');
                        }}
                        className="min-h-[40px] px-3 text-xs font-semibold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 underline"
                      >
                        Tracer un autre schéma
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* 3. Verrouillage automatique */}
          <div className="p-5 sm:p-6 rounded-3xl bg-white dark:bg-[#0c1631] border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400 flex items-center justify-center shrink-0">
                  <Clock className="w-5 h-5" />
                </div>
                <div className="space-y-0.5">
                  <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">
                    03. Verrouillage après inactivité
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Verrouille automatiquement l’application si vous n’interagissez plus.
                  </p>
                </div>
              </div>
              <select
                value={draftAutoLockMinutes}
                onChange={(e) => setDraftAutoLockMinutes(Number(e.target.value))}
                className="min-h-[44px] px-3.5 py-2 text-xs font-bold rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white shrink-0"
              >
                <option value={0}>Désactivé (Jamais)</option>
                <option value={1}>Après 1 minute</option>
                <option value={3}>Après 3 minutes</option>
                <option value={5}>Après 5 minutes</option>
                <option value={15}>Après 15 minutes</option>
                <option value={30}>Après 30 minutes</option>
              </select>
            </div>

            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-end gap-2.5">
              <button
                type="submit"
                disabled={isSavingSecurity}
                className="w-full sm:w-auto min-h-[48px] px-6 py-3 rounded-xl bg-blue-700 hover:bg-blue-800 disabled:opacity-70 text-white text-xs sm:text-sm font-bold flex items-center justify-center gap-2 shadow-sm transition"
              >
                {isSavingSecurity ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Enregistrement en cours...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Enregistrer la protection</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      )}

      {/* 3. Sauvegarde */}
      {subTab === 'backup' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="p-5 rounded-2xl bg-white dark:bg-[#0c1631] border border-slate-200/80 dark:border-slate-800/80 space-y-4 shadow-xs">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-blue-700 dark:text-blue-400 font-bold text-xs uppercase tracking-wider">
                <HardDrive className="w-4 h-4" />
                <span>Stockage Local Haute Capacité</span>
              </div>
              {storageStats.persisted && (
                <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400">
                  Mémoire persistante active
                </span>
              )}
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold">
                <span className="tabular-nums">Utilisé : {storageStats.usageMB} Mo</span>
                <span className="tabular-nums">
                  Capacité :{' '}
                  {storageStats.quotaMB >= 1024
                    ? `${(storageStats.quotaMB / 1024).toFixed(1)} Go`
                    : `${storageStats.quotaMB} Mo`}
                </span>
              </div>
              <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                <div
                  className="h-full bg-blue-700 rounded-full transition-all duration-300"
                  style={{ width: `${Math.max(2, storageStats.percentage)}%` }}
                />
              </div>
              <p className="text-[11px] text-slate-500">
                Vos audios, vidéos, photos et données sont stockés dans IndexedDB haute capacité sur cet appareil.
              </p>

              <div className="flex flex-wrap items-center gap-2 pt-1">
                {!storageStats.persisted && (
                  <button
                    type="button"
                    onClick={async () => {
                      const ok = await dbService.requestPersistentStorage();
                      const stats = await dbService.getStorageEstimate();
                      setStorageStats(stats);
                      setStorageActionMessage(
                        ok
                          ? 'Mémoire persistante haute capacité activée.'
                          : 'La mémoire maximale disponible sur ce navigateur est déjà allouée.'
                      );
                    }}
                    className="px-3 py-1.5 rounded-xl bg-blue-700 hover:bg-blue-800 text-white text-xs font-bold flex items-center gap-1.5"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Activer la mémoire étendue</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={async () => {
                    const count = await dbService.purgeOrphanMediaBlobs();
                    const stats = await dbService.getStorageEstimate();
                    setStorageStats(stats);
                    setStorageActionMessage(
                      count > 0
                        ? `${count} fichier(s) résiduel(s) nettoyé(s) pour libérer de la mémoire.`
                        : 'Mémoire déjà propre et optimisée.'
                    );
                  }}
                  className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold"
                >
                  Optimiser la mémoire
                </button>

                <button
                  type="button"
                  onClick={handleClearCacheOnly}
                  disabled={cacheClearing}
                  className="px-3 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/40 dark:hover:bg-amber-900/50 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300 text-xs font-bold flex items-center gap-1.5 disabled:opacity-60"
                >
                  {cacheClearing ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Eraser className="w-3.5 h-3.5" />
                  )}
                  <span>Vider uniquement le cache</span>
                </button>
              </div>

              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                « Vider uniquement le cache » supprime les fichiers temporaires hors-ligne de l’application sans jamais effacer vos prières, autels, livres, médias ou contacts.
              </p>

              {storageActionMessage && (
                <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                  {storageActionMessage}
                </p>
              )}
            </div>
          </div>

          <div className="p-5 rounded-2xl bg-white dark:bg-[#0c1631] border border-slate-200/80 dark:border-slate-800/80 space-y-4 shadow-xs">
            <div className="flex items-center gap-2 text-blue-700 dark:text-blue-400 font-bold text-xs uppercase tracking-wider">
              <Download className="w-4 h-4" />
              <span>Exporter / Restaurer (JSON)</span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleDownloadBackup}
                disabled={backupLoading}
                className="px-4 py-2 rounded-xl bg-blue-700 hover:bg-blue-800 text-white text-xs font-bold flex items-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Télécharger Sauvegarde</span>
              </button>

              <label className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold flex items-center gap-1.5 cursor-pointer">
                <Upload className="w-3.5 h-3.5" />
                <span>Restaurer</span>
                <input type="file" accept=".json" onChange={handleRestoreFile} className="hidden" />
              </label>
            </div>

            {restoreMessage && (
              <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                {restoreMessage}
              </p>
            )}
          </div>
        </div>
      )}

      {/* 4. Informations sur SHALOM */}
      {subTab === 'about' && (
        <div className="max-w-2xl space-y-5">
          <div className="p-5 sm:p-6 rounded-2xl bg-white dark:bg-[#0c1631] border border-slate-200/80 dark:border-slate-800/80 space-y-5 shadow-xs">
            <div className="flex items-center gap-3">
              <img
                src="./shalom_logo.jpg"
                alt="SHALOM"
                className="w-14 h-14 rounded-2xl object-cover border border-slate-200 dark:border-slate-700 shadow-xs"
              />
              <div>
                <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                  Informations sur SHALOM
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Compagnon spirituel personnel · Stockage local sécurisé
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800">
                <span className="text-[11px] text-slate-500 block">Version installée</span>
                <strong className="text-sm font-extrabold text-slate-900 dark:text-white mt-0.5 block">
                  v{__SHALOM_APP_VERSION__}
                </strong>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800">
                <span className="text-[11px] text-slate-500 block">Date de dernière mise à jour</span>
                <strong className="text-sm font-extrabold text-slate-900 dark:text-white mt-0.5 block">
                  {__SHALOM_BUILD_DATE__}
                </strong>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800">
                <span className="text-[11px] text-slate-500 block">État de connexion</span>
                <div className="flex items-center gap-1.5 mt-0.5 font-bold">
                  {isOnline ? (
                    <>
                      <Wifi className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                      <span className="text-emerald-700 dark:text-emerald-300">En ligne (connecté)</span>
                    </>
                  ) : (
                    <>
                      <WifiOff className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                      <span className="text-amber-700 dark:text-amber-300">Hors ligne</span>
                    </>
                  )}
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800">
                <span className="text-[11px] text-slate-500 block">État du stockage</span>
                <strong className="text-xs font-bold text-slate-900 dark:text-white mt-0.5 block tabular-nums">
                  {storageStats.usageMB} Mo utilisés /{' '}
                  {storageStats.quotaMB >= 1024
                    ? `${(storageStats.quotaMB / 1024).toFixed(1)} Go`
                    : `${storageStats.quotaMB} Mo`}{' '}
                  ({storageStats.persisted ? 'Persistant' : 'Standard'})
                </strong>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <span className="text-xs font-bold text-slate-900 dark:text-white block">
                    Disponibilité d’une nouvelle version
                  </span>
                  <span className="text-[11px] text-slate-500">
                    Vérifier si une mise à jour de SHALOM est disponible en ligne
                  </span>
                </div>

                <button
                  type="button"
                  onClick={handleCheckForUpdates}
                  disabled={updateCheckStatus === 'checking'}
                  className="px-3.5 py-2 rounded-xl bg-blue-700 hover:bg-blue-800 disabled:opacity-60 text-white text-xs font-bold flex items-center gap-1.5"
                >
                  <RefreshCw
                    className={`w-3.5 h-3.5 ${updateCheckStatus === 'checking' ? 'animate-spin' : ''}`}
                  />
                  <span>Vérifier les mises à jour</span>
                </button>
              </div>

              {updateCheckMessage && (
                <div
                  className={`p-3 rounded-lg text-xs font-semibold flex flex-wrap items-center justify-between gap-2 ${
                    updateCheckStatus === 'available'
                      ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
                      : updateCheckStatus === 'up-to-date'
                      ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  <span>{updateCheckMessage}</span>
                  {updateCheckStatus === 'available' && (
                    <button
                      type="button"
                      onClick={async () => {
                        if ('serviceWorker' in navigator) {
                          const reg = await navigator.serviceWorker.getRegistration();
                          if (reg?.waiting) {
                            reg.waiting.postMessage({ type: 'SKIP_WAITING' });
                          }
                        }
                        window.location.reload();
                      }}
                      className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold"
                    >
                      Actualiser l’application
                    </button>
                  )}
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <button
                type="button"
                onClick={() => setShowTermsModal(true)}
                className="p-3.5 rounded-xl bg-slate-50 hover:bg-slate-100 dark:bg-slate-900 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 text-left flex items-center gap-3 transition"
              >
                <FileText className="w-4 h-4 text-blue-700 dark:text-blue-400 shrink-0" />
                <div>
                  <span className="text-xs font-bold text-slate-900 dark:text-white block">
                    Conditions d’utilisation
                  </span>
                  <span className="text-[11px] text-slate-500">Consulter les conditions</span>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setShowPrivacyModal(true)}
                className="p-3.5 rounded-xl bg-slate-50 hover:bg-slate-100 dark:bg-slate-900 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 text-left flex items-center gap-3 transition"
              >
                <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <div>
                  <span className="text-xs font-bold text-slate-900 dark:text-white block">
                    Politique de confidentialité
                  </span>
                  <span className="text-[11px] text-slate-500">Protection de vos données</span>
                </div>
              </button>
            </div>

            <div className="p-4 rounded-xl bg-blue-50/70 dark:bg-blue-950/20 border border-blue-200/80 dark:border-blue-900/50 space-y-2 text-xs">
              <h4 className="font-bold text-blue-900 dark:text-blue-200 flex items-center gap-1.5">
                <Info className="w-4 h-4 shrink-0" />
                <span>Compatibilité Android & APK (WebView / Website 2 APK Builder)</span>
              </h4>
              <p className="text-slate-700 dark:text-slate-300 leading-relaxed">
                En mode navigateur / PWA Android, les importations du Coffre utilisent le sélecteur de documents système (URI <code>content://</code> lues intégralement en mémoire puis vérifiées en IndexedDB) et les téléchargements sont transmis au gestionnaire Android vers votre dossier public <strong>Téléchargements / Downloads</strong>.
              </p>
              <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
                Si vous empaquetez SHALOM en APK via <em>Website 2 APK Builder</em> ou une WebView Android personnalisée, activez l’accès stockage/téléchargements, le sélecteur de fichiers WebView (<code>onShowFileChooser</code>) et, en option avancée, le pont JavaScript <code>window.ShalomAndroid</code> (<code>saveBase64ToDownloads</code>, <code>shareBase64File</code>, <code>openDownloadedFile</code>) vers <code>MediaStore.Downloads</code>.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Modale Conditions d'utilisation */}
      <Modal
        isOpen={showTermsModal}
        onClose={() => setShowTermsModal(false)}
        title="Conditions d’utilisation de SHALOM"
        subtitle={`Version v${__SHALOM_APP_VERSION__} · Dernière mise à jour : ${__SHALOM_BUILD_DATE__}`}
        maxWidth="2xl"
      >
        <div className="space-y-4 text-xs sm:text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
          <div>
            <h4 className="font-bold text-slate-900 dark:text-white mb-1">1. Objet de l’application</h4>
            <p>
              SHALOM est un espace spirituel personnel destiné à accompagner la prière, la méditation, l’organisation chrétienne, la création visuelle/audio/vidéo et la conservation personnelle de ressources bibliques.
            </p>
          </div>
          <div>
            <h4 className="font-bold text-slate-900 dark:text-white mb-1">2. Usage personnel et responsabilité</h4>
            <p>
              Vous demeurez entièrement propriétaire et responsable des contenus que vous rédigez, enregistrez, importez ou partagez depuis votre appareil (notes, témoignages, audios, vidéos, contacts et livres).
            </p>
          </div>
          <div>
            <h4 className="font-bold text-slate-900 dark:text-white mb-1">3. Services externes et liens tiers</h4>
            <p>
              Lorsque vous ouvrez Google Play Store, Google Livres, Open Library, Wikisource ou des plateformes sociales pour partager un contenu, vous êtes soumis aux conditions propres à chacun de ces services tiers.
            </p>
          </div>
          <div>
            <h4 className="font-bold text-slate-900 dark:text-white mb-1">4. Sauvegarde de vos données</h4>
            <p>
              Vos données étant stockées localement sur votre appareil, nous vous recommandons d’utiliser régulièrement la fonction « Exporter / Restaurer (JSON) » dans Sauvegarde afin de conserver une copie de sécurité en cas de changement d’appareil.
            </p>
          </div>
        </div>
      </Modal>

      {/* Modale Politique de confidentialité */}
      <Modal
        isOpen={showPrivacyModal}
        onClose={() => setShowPrivacyModal(false)}
        title="Politique de confidentialité de SHALOM"
        subtitle="Approche 100 % locale et confidentielle"
        maxWidth="2xl"
      >
        <div className="space-y-4 text-xs sm:text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
          <div>
            <h4 className="font-bold text-slate-900 dark:text-white mb-1">1. Stockage strictement local</h4>
            <p>
              SHALOM fonctionne sans compte cloud imposé : vos prières, autels, journaux, contacts, enregistrements et fichiers du Coffre Spirituel sont enregistrés exclusivement sur votre appareil (IndexedDB et stockage local du navigateur).
            </p>
          </div>
          <div>
            <h4 className="font-bold text-slate-900 dark:text-white mb-1">2. Aucune collecte ni revente</h4>
            <p>
              SHALOM ne collecte, ne vend et ne transmet aucune de vos données spirituelles ou personnelles à des serveurs publicitaires ou tiers.
            </p>
          </div>
          <div>
            <h4 className="font-bold text-slate-900 dark:text-white mb-1">3. Sécurité locale</h4>
            <p>
              Votre code PIN, mot de passe ou schéma est transformé localement par hachage SHA-256 avant enregistrement sur votre appareil. Vous pouvez aussi activer le verrouillage automatique après inactivité depuis l’onglet Sécurité.
            </p>
          </div>
          <div>
            <h4 className="font-bold text-slate-900 dark:text-white mb-1">4. Recherches en ligne volontaires</h4>
            <p>
              Seules les recherches volontaires de livres en ligne (Open Library, Wikisource) ou l’ouverture manuelle de Play Store effectuent une requête réseau directe pour récupérer les résultats demandés.
            </p>
          </div>
        </div>
      </Modal>
    </div>
  );
};
