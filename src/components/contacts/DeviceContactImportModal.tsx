import React, { useRef, useState } from 'react';
import {
  Smartphone,
  Upload,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Users,
  Info,
  ShieldCheck,
} from 'lucide-react';
import { Modal } from '../common/Modal';
import { Contact } from '../../types';
import {
  DeviceContactImportResult,
  importContactsFromVcfOrCsv,
  importDeviceContactsWithReport,
  isAndroidNativeBridgeAvailable,
  isWebContactPickerSupported,
} from '../../services/phoneContacts';

interface DeviceContactImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  existingContacts: Contact[];
  onImported: (importedContacts: Contact[], summaryMessage: string) => void;
  title?: string;
}

export const DeviceContactImportModal: React.FC<DeviceContactImportModalProps> = ({
  isOpen,
  onClose,
  existingContacts,
  onImported,
  title = 'Ajouter depuis mes contacts',
}) => {
  const [isImporting, setIsImporting] = useState(false);
  const [result, setResult] = useState<DeviceContactImportResult | null>(null);
  const vcfInputRef = useRef<HTMLInputElement | null>(null);

  const hasNativeBridge = isAndroidNativeBridgeAvailable();
  const hasWebPicker = isWebContactPickerSupported();

  const handleOpenDevicePicker = async () => {
    setIsImporting(true);
    setResult(null);
    try {
      const res = await importDeviceContactsWithReport(existingContacts, { multiple: true });
      setResult(res);
      if (res.addedCount > 0 || res.contacts.length > 0) {
        onImported(res.contacts, res.message);
      }
    } finally {
      setIsImporting(false);
    }
  };

  const handleVcfFilesSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    setIsImporting(true);
    setResult(null);

    try {
      let runningExisting = [...existingContacts];
      const allContacts: Contact[] = [];
      let totalAdded = 0;
      let totalDupes = 0;
      const allSkipped: string[] = [];

      for (const file of files) {
        const res = await importContactsFromVcfOrCsv(file, runningExisting);
        res.contacts.forEach((c) => {
          if (!allContacts.some((x) => x.id === c.id)) allContacts.push(c);
          if (!runningExisting.some((x) => x.id === c.id)) runningExisting.push(c);
        });
        totalAdded += res.addedCount;
        totalDupes += res.duplicateCount;
        allSkipped.push(...res.skippedNoPhone);
      }

      const parts: string[] = [];
      if (totalAdded > 0) parts.push(`${totalAdded} nouveau(x) contact(s) importé(s)`);
      if (totalDupes > 0) parts.push(`${totalDupes} doublon(s) ignoré(s)`);
      if (allSkipped.length > 0) parts.push(`${allSkipped.length} sans numéro ignoré(s)`);
      const summary =
        parts.length > 0
          ? `${parts.join(' · ')}.`
          : 'Aucun contact valide avec numéro n’a été trouvé.';

      const finalResult: DeviceContactImportResult = {
        code: totalAdded > 0 ? 'SUCCESS' : totalDupes > 0 ? 'DUPLICATE_ONLY' : 'NO_CONTACTS',
        status: totalAdded > 0 || totalDupes > 0 ? 'success' : 'error',
        sourceUsed: 'vcf-file',
        selectedCount: totalAdded + totalDupes + allSkipped.length,
        contacts: allContacts,
        addedCount: totalAdded,
        duplicateCount: totalDupes,
        skippedNoPhone: allSkipped,
        message: summary,
      };
      setResult(finalResult);
      if (allContacts.length > 0) {
        onImported(allContacts, summary);
      }
    } finally {
      setIsImporting(false);
      e.target.value = '';
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      subtitle="Sélectionnez plusieurs contacts en une seule opération depuis votre téléphone Android"
      maxWidth="md"
    >
      <div className="space-y-4 text-xs">
        <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2">
          <div className="flex items-start gap-2.5">
            <ShieldCheck className="w-4 h-4 text-blue-700 dark:text-blue-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-semibold text-slate-900 dark:text-white">
                {hasNativeBridge
                  ? 'Pont natif Android SHALOM détecté (sélection multiple active)'
                  : hasWebPicker
                    ? 'Sélecteur multi-contacts Android / Chrome actif'
                    : 'Mode compatible WebView Android & export Contacts'}
              </p>
              <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
                {hasNativeBridge || hasWebPicker
                  ? 'Appuyez ci-dessous pour ouvrir votre répertoire et cocher plusieurs contacts d’un seul coup.'
                  : 'Dans un APK Website 2 APK standard, la WebView bloque l’accès direct sans pont Java natif. Utilisez le bouton ci-dessous si votre appareil l’autorise, ou sélectionnez vos contacts exportés (.vcf).'}
              </p>
            </div>
          </div>
        </div>

        <input
          ref={vcfInputRef}
          type="file"
          multiple
          accept=".vcf,.csv,text/vcard,text/x-vcard"
          onChange={handleVcfFilesSelected}
          className="hidden"
        />

        <div className="grid grid-cols-1 gap-2.5">
          <button
            type="button"
            disabled={isImporting}
            onClick={handleOpenDevicePicker}
            className="w-full min-h-[48px] px-4 py-3 rounded-xl bg-blue-700 hover:bg-blue-800 disabled:opacity-60 text-white font-bold flex items-center justify-center gap-2 shadow-sm transition"
          >
            {isImporting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Smartphone className="w-4 h-4" />
            )}
            <span>Ouvrir le répertoire du téléphone (Multi-sélection)</span>
          </button>

          <button
            type="button"
            disabled={isImporting}
            onClick={() => vcfInputRef.current?.click()}
            className="w-full min-h-[44px] px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 font-semibold flex items-center justify-center gap-2 transition"
          >
            <Upload className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <span>Importer un ou plusieurs fichiers contacts (.vcf / CSV)</span>
          </button>
        </div>

        {result && (
          <div
            className={`p-3.5 rounded-2xl border space-y-2 ${
              result.code === 'SUCCESS' || result.code === 'DUPLICATE_ONLY'
                ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-900/50 text-emerald-900 dark:text-emerald-200'
                : result.code === 'CANCELLED'
                  ? 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300'
                  : 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-900/50 text-amber-900 dark:text-amber-200'
            }`}
          >
            <div className="flex items-start gap-2 font-semibold">
              {result.code === 'SUCCESS' || result.code === 'DUPLICATE_ONLY' ? (
                <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-600 dark:text-emerald-400" />
              ) : result.code === 'CANCELLED' ? (
                <Info className="w-4 h-4 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
              )}
              <span>{result.message}</span>
            </div>

            {result.skippedNoPhone.length > 0 && (
              <p className="text-[11px] opacity-90 pl-6">
                Contacts sans numéro ignorés : {result.skippedNoPhone.join(', ')}
              </p>
            )}

            {(result.code === 'UNSUPPORTED_ANDROID' || result.code === 'PICKER_UNAVAILABLE') && (
              <div className="pl-6 text-[11px] space-y-1 opacity-95">
                <p className="font-semibold">Comment importer tout votre répertoire Android en 10 secondes :</p>
                <p>1. Ouvrez l’application « Contacts » de votre téléphone → Menu → Exporter vers un fichier .vcf.</p>
                <p>2. Appuyez sur « Importer un fichier contacts (.vcf) » ci-dessus et sélectionnez ce fichier.</p>
              </div>
            )}
          </div>
        )}

        <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800">
          <span className="text-[11px] text-slate-500 flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5" />
            <span className="tabular-nums">{existingContacts.length} contact(s) enregistré(s)</span>
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-900 dark:bg-slate-700 text-white font-bold"
          >
            Fermer
          </button>
        </div>
      </div>
    </Modal>
  );
};
