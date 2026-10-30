// Clear the recent folders (LA-PLT-CMD20): File › Open Recent › Clear Menu empties the list.
import type { RecentFolderRepository } from '../repository.ts';
import { holdToRules } from '../rules.ts';

export function clearRecentFolders(recents: RecentFolderRepository): void {
  const next: string[] = [];
  holdToRules(next);
  recents.save(next);
}
