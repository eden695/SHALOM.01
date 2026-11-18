// VCF / CSV File Import & Phone Normalization Helpers for SHALOM Contacts
import { dbService, STORES } from './db';
import { Contact } from '../types';

export interface RawPickedDeviceContact {
  externalId?: string;
  displayName?: string;
  firstName?: string;
  lastName?: string;
  phones?: string[];
  emails?: string[];
  photoDataUrl?: string;
}

export const normalizePhone = (phone: string): string => {
  const cleaned = (phone || '').replace(/[^0-9+]/g, '');
  return cleaned.startsWith('00') ? `+${cleaned.slice(2)}` : cleaned;
};

function splitFullName(
  fullName: string,
  given?: string,
  family?: string
): { firstName: string; lastName: string } {
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

async function saveParsedContacts(
  rawList: RawPickedDeviceContact[],
  existingContacts: Contact[]
): Promise<{
  contacts: Contact[];
  addedCount: number;
  duplicateCount: number;
  skippedNoPhone: string[];
  message: string;
}> {
  if (!Array.isArray(rawList) || rawList.length === 0) {
    return {
      contacts: [],
      addedCount: 0,
      duplicateCount: 0,
      skippedNoPhone: [],
      message: 'Aucun contact trouvé dans ce fichier.',
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
      id: `c_imp_${Date.now()}_${i}_${Math.random().toString(36).slice(2, 5)}`,
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

    const saved = await dbService.saveVerified(STORES.CONTACTS, newContact);
    byPhone.set(normalizePhone(saved.phone), saved);
    extraPhones.forEach((ep) => byPhone.set(normalizePhone(ep), saved));
    if (extId) byExternalId.set(extId, saved);
    importedContacts.push(saved);
    addedCount++;
  }

  const parts: string[] = [];
  if (addedCount > 0) parts.push(`${addedCount} contact(s) importé(s)`);
  if (duplicateCount > 0) parts.push(`${duplicateCount} doublon(s) ignoré(s)`);
  if (skippedNoPhone.length > 0) parts.push(`${skippedNoPhone.length} sans numéro ignoré(s)`);

  return {
    contacts: importedContacts,
    addedCount,
    duplicateCount,
    skippedNoPhone,
    message: parts.length > 0 ? `${parts.join(' · ')}.` : 'Aucun contact valide trouvé.',
  };
}

function unfoldVcardText(rawText: string): string {
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
      // keep raw fallback
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

  return saveParsedContacts(rawList, existingContacts);
}
