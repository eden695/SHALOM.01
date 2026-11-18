// Local persistence helper for online Studio templates & offline SHALOM resources
import { dbService, STORES } from './db';
import { SavedStudioTemplate } from '../types';
import { saveTemplateBundleToShalom } from './studios/offlineResources';

export async function saveOnlineTemplateLocally(params: {
  id: string;
  studioType: 'design' | 'presentation' | 'video' | 'audio';
  title: string;
  category: string;
  templateObj: unknown;
  previewColor?: string;
  previewColor2?: string;
  previewDataUrl?: string;
  source?: string;
  attribution?: string;
  license?: string;
}): Promise<SavedStudioTemplate> {
  const obj =
    params.templateObj && typeof params.templateObj === 'object'
      ? (params.templateObj as Record<string, unknown>)
      : {};
  return saveTemplateBundleToShalom({
    id: params.id,
    studioType: params.studioType,
    title: params.title,
    category: params.category,
    templateObj: obj,
    previewColor: params.previewColor,
    previewColor2: params.previewColor2,
    previewDataUrl: params.previewDataUrl,
    source: params.source,
    attribution: params.attribution,
    license: params.license,
  });
}

export async function deleteSavedOnlineTemplate(id: string): Promise<void> {
  const existing = await dbService.getById<SavedStudioTemplate>(STORES.CUSTOM_TEMPLATES, id);
  await dbService.deleteItem(STORES.CUSTOM_TEMPLATES, id);

  if (existing?.assetKeys && existing.assetKeys.length > 0) {
    const remaining = await dbService.getAll<SavedStudioTemplate>(STORES.CUSTOM_TEMPLATES);
    const stillUsed = new Set<string>();
    for (const item of remaining) {
      if (Array.isArray(item.assetKeys)) {
        item.assetKeys.forEach((k) => stillUsed.add(k));
      }
    }
    for (const key of existing.assetKeys) {
      if (!stillUsed.has(key)) {
        try {
          await dbService.deleteMediaBlob(key);
        } catch {
          // ignore orphan cleanup failure
        }
      }
    }
  }
}
