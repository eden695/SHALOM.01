// Auto-Draft & Editable Project Persistence for all 3 SHALOM Studios
import { dbService, STORES } from './db';
import { StudioDraftItem } from '../types';

export async function saveStudioDraft(
  studioType: 'design' | 'audio' | 'video',
  title: string,
  projectJson: string,
  mediaAssetKeys: string[] = []
): Promise<void> {
  const id: StudioDraftItem['id'] = `draft_${studioType}`;
  const draft: StudioDraftItem = {
    id,
    studioType,
    title,
    projectJson,
    mediaAssetKeys,
    updatedAt: new Date().toISOString(),
  };
  await dbService.put(STORES.STUDIO_DRAFTS, draft);
}

export async function loadStudioDraft(
  studioType: 'design' | 'audio' | 'video'
): Promise<StudioDraftItem | null> {
  const id: StudioDraftItem['id'] = `draft_${studioType}`;
  return dbService.getById<StudioDraftItem>(STORES.STUDIO_DRAFTS, id);
}

export async function clearStudioDraft(studioType: 'design' | 'audio' | 'video'): Promise<void> {
  const id: StudioDraftItem['id'] = `draft_${studioType}`;
  await dbService.deleteItem(STORES.STUDIO_DRAFTS, id);
}
