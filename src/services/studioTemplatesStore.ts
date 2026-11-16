// Local persistence helper for online Studio templates chosen by the user
import { dbService, STORES } from './db';
import { SavedStudioTemplate } from '../types';

export async function saveOnlineTemplateLocally(params: {
  id: string;
  studioType: 'design' | 'video' | 'audio';
  title: string;
  category: string;
  templateObj: unknown;
  previewColor?: string;
  previewColor2?: string;
  source?: string;
}): Promise<SavedStudioTemplate> {
  const sourceNormalized: 'online-catalog' | 'online-live' =
    params.source === 'online-live' ? 'online-live' : 'online-catalog';

  const saved: SavedStudioTemplate = {
    id: `saved_tpl_${params.studioType}_${params.id}`,
    studioType: params.studioType,
    title: params.title.trim() || 'Modèle en ligne',
    category: params.category.trim() || 'En ligne',
    templateJson: JSON.stringify(params.templateObj),
    previewColor: params.previewColor,
    previewColor2: params.previewColor2,
    source: sourceNormalized,
    savedAt: new Date().toISOString(),
  };

  return dbService.saveVerified(STORES.CUSTOM_TEMPLATES, saved);
}

export async function deleteSavedOnlineTemplate(id: string): Promise<void> {
  await dbService.deleteItem(STORES.CUSTOM_TEMPLATES, id);
}
