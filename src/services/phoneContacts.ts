// Real Android Multi-Contact Import Helper for SHALOM
// Priority:
//   1) Native Android JS bridge (window.ShalomAndroidContacts)
//   2) Web Contact Picker API (navigator.contacts.select with multi-select + getProperties detection)
//   3) Multi-contact Android .vcf / .csv file import via importContactsFromVcfOrCsv
import { dbService, STORES } from './db';
import { Contact } from '../types';

export type ContactImportErrorCode =
  | 'SUCCESS'
  | 'CANCELLED'
  | 'NO_CONTACTS'
  | 'PERMISSION_DENIED'
  | 'PICKER_UNAVAILABLE'
  | 'DATA_ERROR'
  | 'DUPLICATE_ONLY'
  | 'SAVE_FAILED'
  | 'UNSUPPORTED_ANDROID';

export interface RawPickedDeviceContact {
  externalId?: string;
  displayName?: string;
  firstName?: string;
  lastName?: string;
  phones?: string[];
  emails?: string[];
  photoDataUrl?: string;
}

export interface DeviceContactImportResult {
  code: ContactImportErrorCode;
  status: 'success' | 'cancelled' | 'unsupported' | 'insecure_context' | 'iframe_blocked' | 'error';
  sourceUsed: 'android-native' | 'web-picker' | 'vcf-file' | 'none';
  selectedCount: number;
  contacts: Contact[];
  addedCount: number;
  duplicateCount: number;
  skippedNoPhone: string[];
  message: string;
}

export interface PickContactsResult {
  status: 'success' | 'cancelled' | 'unsupported' | 'insecure_context' | 'iframe_blocked' | 'error';
  contacts: Contact[];
  addedCount: number;
  duplicateCount?: number;
  message?: string;
}

export interface ShalomAndroidContactsBridge {
  isAvailable?: () => boolean;
  supportsMultiSelect?: () => boolean;
  pickMultipleContacts?: (callbackName: string) => void;
  getCapabilityInfo?: () => string;
}

declare global {
  interface Window {
    ShalomAndroidContacts?: ShalomAndroidContactsBridge;
    __shalomOnAndroidContactsResult?: (rawJson: string) => void;
    __shalomOnAndroidContactsError?: (errorCode: string, detail?: string) => void;
  }
}

export const normalizePhone = (phone: string): string => {
  const cleaned = (phone || '').replace(/[^0-9+]/g, '');
  return cleaned.startsWith('00') ? `+${cleaned.slice(2)}` : cleaned;
};

export function isHttpsOrLocalhost(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.isSecureContext ||
    window.location.protocol === 'https:' ||
    window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1'
  );
}

export function isAndroidNativeBridgeAvailable(): boolean {
  if (typeof window === 'undefined') return false;
  const bridge = window.ShalomAndroidContacts;
  if (!bridge || typeof bridge.pickMultipleContacts !== 'function') return false;
  if (typeof bridge.isAvailable === 'function') {
    try {
      return Boolean(bridge.isAvailable());
    } catch {
      return true;
    }
  }
  return true;
}

export function isWebContactPickerSupported(): boolean {
  if (typeof navigator === 'undefined') return false;
  const nav = navigator as unknown as {
    contacts?: { select?: unknown };
  };
  return Boolean(nav.contacts && typeof nav.contacts.select === 'function');
}

export function isNativeContactPickerSupported(): boolean {
  return isAndroidNativeBridgeAvailable() || isWebContactPickerSupported();
}

export function isRunningInsideAndroidWebView(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  return /Android/i.test(ua) && (/; wv\)/i.test(ua) || /Version\/\d+/i.test(ua));
}

function splitFullName(fullName: string, given?: string, family?: string): { firstName: string; lastName: string } {
  const cleanFirst = (given || '').trim();
  const cleanLast = (family || '').trim();
  if (cleanFirst || cleanLast) {
    return {
      firstName: cleanFirst || cleanLast || 'Contact',
      lastName: cleanFirst ? cleanLast : '',
    };
  }
  const clean = (fullName || 'Contact').replace(/\s+/g, ' ').trim();
  const parts = clean.split(' ');
  return {
    firstName: parts[0] || 'Contact',
    lastName: parts.slice(1).join(' '),
  };
}

async function blobToSmallDataUrl(blob: Blob): Promise<string | undefined> {
  if (!blob || blob.size === 0 || blob.size > 400_000) return undefined;
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => {
      resolve(typeof reader.result === 'string' ? reader.result : undefined);
    };
    reader.onerror = () => resolve(undefined);
    reader.readAsDataURL(blob);
  });
}

function buildDedupeMaps(existingContacts: Contact[]) {
  const byPhone = new Map<string, Contact>();
  const byExternalId = new Map<string, Contact>();
  for (const c of existingContacts) {
    const pNorm = normalizePhone(c.phone);
    if (pNorm) byPhone.set(pNorm, c);
    if (Array.isArray(c.extraPhones)) {
      for (const ep of c.extraPhones) {
        const epNorm = normalizePhone(ep);
        if (epNorm) byPhone.set(epNorm, c);
      }
    }
    if (c.externalContactId) {
      byExternalId.set(c.externalContactId, c);
    }
  }
  return { byPhone, byExternalId };
}

export async function processAndSavePickedContacts(
  rawList: RawPickedDeviceContact[],
  existingContacts: Contact[],
  sourceUsed: 'android-native' | 'web-picker' | 'vcf-file'
): Promise<DeviceContactImportResult> {
  if (!Array.isArray(rawList) || rawList.length === 0) {
    return {
      code: 'CANCELLED',
      status: 'cancelled',
      sourceUsed,
      selectedCount: 0,
      contacts: [],
      addedCount: 0,
      duplicateCount: 0,
      skippedNoPhone: [],
      message: 'Aucun contact sélectionné.',
    };
  }

  const { byPhone, byExternalId } = buildDedupeMaps(existingContacts);
  const importedContacts: Contact[] = [];
  const skippedNoPhone: string[] = [];
  let addedCount = 0;
  let duplicateCount = 0;

  for (let i = 0; i < rawList.length; i++) {
    const raw = rawList[i];
    const { firstName, lastName } = splitFullName(
      raw.displayName || `${raw.firstName || ''} ${raw.lastName || ''}`,
      raw.firstName,
      raw.lastName
    );
    const fullNameLabel = `${firstName} ${lastName}`.trim() || `Contact #${i + 1}`;

    const cleanPhones = Array.from(
      new Set((raw.phones || []).map((p) => (p || '').trim()).filter((p) => normalizePhone(p).length >= 3))
    );

    if (cleanPhones.length === 0) {
      skippedNoPhone.push(fullNameLabel);
      continue;
    }

    const extId = raw.externalId?.trim() || undefined;
    let existingMatch: Contact | undefined = extId ? byExternalId.get(extId) : undefined;
    if (!existingMatch) {
      for (const p of cleanPhones) {
        const match = byPhone.get(normalizePhone(p));
        if (match) {
          existingMatch = match;
          break;
        }
      }
    }

    if (existingMatch) {
      duplicateCount++;
      if (!importedContacts.some((c) => c.id === existingMatch!.id)) {
        importedContacts.push(existingMatch);
      }
      continue;
    }

    const primaryPhone = cleanPhones[0];
    const extraPhones = cleanPhones.slice(1);
    const cleanEmail = (raw.emails || []).map((e) => (e || '').trim()).find(Boolean) || undefined;

    const newContact: Contact = {
      id: `c_dev_${Date.now()}_${i}_${Math.random().toString(36).slice(2, 5)}`,
      firstName,
      lastName,
      phone: primaryPhone,
      extraPhones: extraPhones.length > 0 ? extraPhones : undefined,
      email: cleanEmail,
      photoDataUrl: raw.photoDataUrl || undefined,
      externalContactId: extId,
      category: 'personnel',
      createdAt: new Date().toISOString(),
    };

    try {
      const saved = await dbService.saveVerified(STORES.CONTACTS, newContact);
      byPhone.set(normalizePhone(saved.phone), saved);
      extraPhones.forEach((ep) => byPhone.set(normalizePhone(ep), saved));
      if (extId) byExternalId.set(extId, saved);
      importedContacts.push(saved);
      addedCount++;
    } catch (err) {
      return {
        code: 'SAVE_FAILED',
        status: 'error',
        sourceUsed,
        selectedCount: rawList.length,
        contacts: importedContacts,
        addedCount,
        duplicateCount,
        skippedNoPhone,
        message:
          err instanceof Error
            ? `Échec d’enregistrement local après ${addedCount} contact(s) : ${err.message}`
            : 'Échec de sauvegarde dans le stockage local SHALOM.',
      };
    }
  }

  if (addedCount === 0 && duplicateCount > 0 && skippedNoPhone.length === 0) {
    return {
      code: 'DUPLICATE_ONLY',
      status: 'success',
      sourceUsed,
      selectedCount: rawList.length,
      contacts: importedContacts,
      addedCount: 0,
      duplicateCount,
      skippedNoPhone,
      message: `Tous les contacts sélectionnés (${duplicateCount}) figurent déjà dans votre répertoire SHALOM.`,
    };
  }

  if (addedCount === 0 && duplicateCount === 0 && skippedNoPhone.length > 0) {
    return {
      code: 'NO_CONTACTS',
      status: 'error',
      sourceUsed,
      selectedCount: rawList.length,
      contacts: [],
      addedCount: 0,
      duplicateCount: 0,
      skippedNoPhone,
      message: `${skippedNoPhone.length} contact(s) sélectionné(s) ne possède(nt) aucun numéro de téléphone (${skippedNoPhone.slice(0, 3).join(', ')}).`,
    };
  }

  const parts: string[] = [];
  parts.push(`${rawList.length} contact(s) sélectionné(s)`);
  if (addedCount > 0) parts.push(`${addedCount} importé(s) et enregistré(s)`);
  if (duplicateCount > 0) parts.push(`${duplicateCount} doublon(s) ignoré(s)`);
  if (skippedNoPhone.length > 0) {
    parts.push(`${skippedNoPhone.length} ignoré(s) sans numéro (${skippedNoPhone.slice(0, 2).join(', ')})`);
  }

  return {
    code: 'SUCCESS',
    status: 'success',
    sourceUsed,
    selectedCount: rawList.length,
    contacts: importedContacts,
    addedCount,
    duplicateCount,
    skippedNoPhone,
    message: parts.join(' · ') + '.',
  };
}

function openAndroidBridgePicker(): Promise<RawPickedDeviceContact[]> {
  return new Promise((resolve, reject) => {
    const bridge = window.ShalomAndroidContacts;
    if (!bridge || typeof bridge.pickMultipleContacts !== 'function') {
      reject({ code: 'PICKER_UNAVAILABLE', message: 'Pont natif Android absent.' });
      return;
    }

    let settled = false;
    const timeout = window.setTimeout(() => {
      if (settled) return;
      settled = true;
      delete window.__shalomOnAndroidContactsResult;
      delete window.__shalomOnAndroidContactsError;
      reject({
        code: 'PICKER_UNAVAILABLE',
        message: 'Le sélecteur Android n’a pas répondu à temps.',
      });
    }, 120_000);

    window.__shalomOnAndroidContactsResult = (rawJson: string) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      delete window.__shalomOnAndroidContactsResult;
      delete window.__shalomOnAndroidContactsError;
      try {
        const parsed = JSON.parse(rawJson || '[]');
        if (!Array.isArray(parsed)) {
          reject({ code: 'DATA_ERROR', message: 'Réponse JSON du pont Android invalide.' });
          return;
        }
        resolve(parsed as RawPickedDeviceContact[]);
      } catch {
        reject({ code: 'DATA_ERROR', message: 'Données de contacts Android corrompues.' });
      }
    };

    window.__shalomOnAndroidContactsError = (errorCode: string, detail?: string) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      delete window.__shalomOnAndroidContactsResult;
      delete window.__shalomOnAndroidContactsError;
      reject({
        code: errorCode || 'DATA_ERROR',
        message: detail || 'Erreur du sélecteur Android.',
      });
    };

    try {
      bridge.pickMultipleContacts('__shalomOnAndroidContactsResult');
    } catch (err) {
      if (!settled) {
        settled = true;
        clearTimeout(timeout);
        delete window.__shalomOnAndroidContactsResult;
        delete window.__shalomOnAndroidContactsError;
        reject({
          code: 'PICKER_UNAVAILABLE',
          message: err instanceof Error ? err.message : 'Erreur d’appel du pont Android.',
        });
      }
    }
  });
}

export async function importDeviceContactsWithReport(
  existingContacts: Contact[],
  options?: { multiple?: boolean }
): Promise<DeviceContactImportResult> {
  // 1) Priority 1: Native Android JS Bridge (inside compiled APK with ShalomContactsBridge)
  if (isAndroidNativeBridgeAvailable()) {
    try {
      const pickedRaw = await openAndroidBridgePicker();
      return await processAndSavePickedContacts(pickedRaw, existingContacts, 'android-native');
    } catch (err: unknown) {
      const eObj = (err || {}) as { code?: string; message?: string };
      const code = (eObj.code as ContactImportErrorCode) || 'DATA_ERROR';
      if (code === 'CANCELLED') {
        return {
          code: 'CANCELLED',
          status: 'cancelled',
          sourceUsed: 'android-native',
          selectedCount: 0,
          contacts: [],
          addedCount: 0,
          duplicateCount: 0,
          skippedNoPhone: [],
          message: 'Sélection annulée dans le répertoire Android.',
        };
      }
      if (code === 'PERMISSION_DENIED') {
        return {
          code: 'PERMISSION_DENIED',
          status: 'error',
          sourceUsed: 'android-native',
          selectedCount: 0,
          contacts: [],
          addedCount: 0,
          duplicateCount: 0,
          skippedNoPhone: [],
          message:
            'Autorisation d’accès aux contacts refusée sur Android. Accordez l’accès ou utilisez l’importation multi-contacts .vcf.',
        };
      }
      return {
        code,
        status: 'error',
        sourceUsed: 'android-native',
        selectedCount: 0,
        contacts: [],
        addedCount: 0,
        duplicateCount: 0,
        skippedNoPhone: [],
        message: eObj.message || 'Impossible de lire les contacts depuis le pont Android.',
      };
    }
  }

  // 2) Priority 2: Web Contact Picker API (Chrome Android 80+, Edge, TWA)
  if (!isHttpsOrLocalhost()) {
    return {
      code: 'UNSUPPORTED_ANDROID',
      status: 'insecure_context',
      sourceUsed: 'none',
      selectedCount: 0,
      contacts: [],
      addedCount: 0,
      duplicateCount: 0,
      skippedNoPhone: [],
      message:
        'Le sélecteur natif Web exige une origine sécurisée HTTPS. Utilisez l’importation de fichier contacts (.vcf) depuis votre téléphone.',
    };
  }

  const nav = navigator as unknown as {
    contacts?: {
      getProperties?: () => Promise<string[]>;
      select: (
        props: string[],
        opts: { multiple: boolean }
      ) => Promise<
        Array<{
          name?: string[];
          tel?: string[];
          email?: string[];
          icon?: Blob[];
        }>
      >;
    };
  };

  if (!nav.contacts || typeof nav.contacts.select !== 'function') {
    const inWv = isRunningInsideAndroidWebView();
    return {
      code: inWv ? 'UNSUPPORTED_ANDROID' : 'PICKER_UNAVAILABLE',
      status: 'unsupported',
      sourceUsed: 'none',
      selectedCount: 0,
      contacts: [],
      addedCount: 0,
      duplicateCount: 0,
      skippedNoPhone: [],
      message: inWv
        ? 'Cette WebView Android (Website 2 APK) n’expose pas navigator.contacts ni le pont natif ShalomAndroidContacts. Sélectionnez plusieurs contacts via « Importer un fichier .vcf » (exporté depuis l’app Contacts Android) ou intégrez le module Java natif.'
        : 'Le sélecteur natif multi-contacts n’est pas disponible dans ce navigateur. Importez directement vos contacts via un fichier .vcf.',
    };
  }

  try {
    let requestedProps = ['name', 'tel', 'email'];
    if (typeof nav.contacts.getProperties === 'function') {
      try {
        const supported = await nav.contacts.getProperties();
        const candidate = ['name', 'tel', 'email', 'icon'].filter((p) => supported.includes(p));
        if (candidate.includes('tel')) requestedProps = candidate;
      } catch {
        requestedProps = ['name', 'tel'];
      }
    }

    const wantMultiple = options?.multiple ?? true;
    let picked: Array<{ name?: string[]; tel?: string[]; email?: string[]; icon?: Blob[] }>;

    try {
      picked = await nav.contacts.select(requestedProps, { multiple: wantMultiple });
    } catch (firstErr: unknown) {
      const fName = firstErr instanceof DOMException ? firstErr.name : '';
      // Fallback if multiple: true or optional property failed on older Android Chromium
      if (fName === 'TypeError' && wantMultiple) {
        picked = await nav.contacts.select(['name', 'tel'], { multiple: false });
      } else {
        throw firstErr;
      }
    }

    if (!picked || picked.length === 0) {
      return {
        code: 'CANCELLED',
        status: 'cancelled',
        sourceUsed: 'web-picker',
        selectedCount: 0,
        contacts: [],
        addedCount: 0,
        duplicateCount: 0,
        skippedNoPhone: [],
        message: 'Aucun contact sélectionné.',
      };
    }

    const rawList: RawPickedDeviceContact[] = [];
    for (let i = 0; i < picked.length; i++) {
      const p = picked[i];
      let photoDataUrl: string | undefined;
      if (p.icon && p.icon[0] instanceof Blob) {
        photoDataUrl = await blobToSmallDataUrl(p.icon[0]);
      }
      rawList.push({
        displayName: (p.name?.[0] || '').trim() || 'Contact',
        phones: Array.isArray(p.tel) ? p.tel : [],
        emails: Array.isArray(p.email) ? p.email : [],
        photoDataUrl,
      });
    }

    return await processAndSavePickedContacts(rawList, existingContacts, 'web-picker');
  } catch (err: unknown) {
    const errName = err instanceof DOMException ? err.name : '';
    const errMsg = err instanceof Error ? err.message : '';

    if (
      errName === 'SecurityError' ||
      errMsg.toLowerCase().includes('top-level') ||
      errMsg.toLowerCase().includes('iframe')
    ) {
      return {
        code: 'PICKER_UNAVAILABLE',
        status: 'iframe_blocked',
        sourceUsed: 'web-picker',
        selectedCount: 0,
        contacts: [],
        addedCount: 0,
        duplicateCount: 0,
        skippedNoPhone: [],
        message:
          'L’accès direct au répertoire est bloqué dans cet aperçu intégré. Ouvrez l’app en HTTPS plein écran ou importez un fichier .vcf multi-contacts.',
      };
    }
    if (errName === 'NotAllowedError') {
      return {
        code: 'PERMISSION_DENIED',
        status: 'error',
        sourceUsed: 'web-picker',
        selectedCount: 0,
        contacts: [],
        addedCount: 0,
        duplicateCount: 0,
        skippedNoPhone: [],
        message: 'Permission d’accès au répertoire refusée.',
      };
    }
    if (errName === 'AbortError') {
      return {
        code: 'CANCELLED',
        status: 'cancelled',
        sourceUsed: 'web-picker',
        selectedCount: 0,
        contacts: [],
        addedCount: 0,
        duplicateCount: 0,
        skippedNoPhone: [],
        message: 'Sélection annulée par l’utilisateur.',
      };
    }
    return {
      code: 'DATA_ERROR',
      status: 'error',
      sourceUsed: 'web-picker',
      selectedCount: 0,
      contacts: [],
      addedCount: 0,
      duplicateCount: 0,
      skippedNoPhone: [],
      message: errMsg
        ? `Erreur lors de la lecture du répertoire : ${errMsg}`
        : 'Impossible de lire les contacts sélectionnés.',
    };
  }
}

// Backward-compatible wrapper
export async function pickContactsFromDevice(
  existingContacts: Contact[],
  options?: { multiple?: boolean }
): Promise<PickContactsResult> {
  const res = await importDeviceContactsWithReport(existingContacts, options);
  return {
    status: res.status,
    contacts: res.contacts,
    addedCount: res.addedCount,
    duplicateCount: res.duplicateCount,
    message: res.message,
  };
}

function unfoldVcardText(rawText: string): string {
  // RFC 2425 / 6350 folded lines start with a single space or tab after CRLF/LF
  return rawText.replace(/\r\n[ \t]/g, '').replace(/\n[ \t]/g, '');
}

function decodeVcardValue(rawVal: string, paramsPart: string): string {
  let clean = rawVal.replace(/\r/g, '').trim();
  if (/ENCODING=QUOTED-PRINTABLE/i.test(paramsPart)) {
    try {
      const hexClean = clean.replace(/=\r?\n/g, '').replace(/=([0-9A-F]{2})/gi, (_, hex) => {
        return `%${hex}`;
      });
      clean = decodeURIComponent(hexClean);
    } catch {
      // keep clean raw fallback
    }
  }
  return clean;
}

export async function importContactsFromVcfOrCsv(
  file: File,
  existingContacts: Contact[]
): Promise<{
  contacts: Contact[];
  addedCount: number;
  duplicateCount: number;
  skippedNoPhone: string[];
  message: string;
}> {
  const text = await file.text();
  if (!text || !text.trim()) {
    return {
      contacts: [],
      addedCount: 0,
      duplicateCount: 0,
      skippedNoPhone: [],
      message: 'Le fichier sélectionné est vide.',
    };
  }

  const rawList: RawPickedDeviceContact[] = [];

  if (file.name.toLowerCase().endsWith('.vcf') || /BEGIN:VCARD/i.test(text)) {
    const unfolded = unfoldVcardText(text);
    const cards = unfolded.split(/BEGIN:VCARD/i).slice(1);
    for (const card of cards) {
      const fnMatch = card.match(/^FN([^:]*):(.+)$/im);
      const nMatch = card.match(/^N([^:]*):([^;\r\n]*);?([^;\r\n]*)/im);
      const telMatches = Array.from(card.matchAll(/^TEL([^:]*):(.+)$/gim));
      const emailMatches = Array.from(card.matchAll(/^EMAIL([^:]*):(.+)$/gim));
      const uidMatch = card.match(/^UID(?:;[^:]*)?:(.+)$/im);
      const photoMatch = card.match(/^PHOTO;([^:]+):(.+)$/im);

      const fnDecoded = fnMatch ? decodeVcardValue(fnMatch[2], fnMatch[1] || '') : '';
      const givenDecoded = nMatch ? decodeVcardValue(nMatch[3] || '', nMatch[1] || '') : '';
      const familyDecoded = nMatch ? decodeVcardValue(nMatch[2] || '', nMatch[1] || '') : '';

      let photoDataUrl: string | undefined;
      if (photoMatch && /BASE64|ENCODING=b/i.test(photoMatch[1])) {
        const mime = /PNG/i.test(photoMatch[1]) ? 'image/png' : 'image/jpeg';
        const b64 = photoMatch[2].replace(/\s+/g, '');
        if (b64.length > 20 && b64.length < 350_000) {
          photoDataUrl = `data:${mime};base64,${b64}`;
        }
      }

      rawList.push({
        externalId: uidMatch?.[1]?.trim(),
        displayName: fnDecoded || `${givenDecoded} ${familyDecoded}`.trim() || 'Contact',
        firstName: givenDecoded || undefined,
        lastName: familyDecoded || undefined,
        phones: telMatches.map((m) => decodeVcardValue(m[2], m[1] || '')).filter(Boolean),
        emails: emailMatches.map((m) => decodeVcardValue(m[2], m[1] || '')).filter(Boolean),
        photoDataUrl,
      });
    }
  } else {
    const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
    for (let i = 1; i < lines.length; i++) {
      const parts = lines[i].split(',').map((s) => s.replace(/(^"|"$)/g, '').trim());
      if (parts.length >= 2 && (parts[0] || parts[1])) {
        rawList.push({
          firstName: parts[0],
          lastName: parts[1] || '',
          phones: parts[2] ? [parts[2]] : [],
          emails: parts[3] ? [parts[3]] : [],
        });
      }
    }
  }

  const res = await processAndSavePickedContacts(rawList, existingContacts, 'vcf-file');
  return {
    contacts: res.contacts,
    addedCount: res.addedCount,
    duplicateCount: res.duplicateCount,
    skippedNoPhone: res.skippedNoPhone,
    message: res.message,
  };
}
