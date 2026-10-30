// Add a recent folder (LA-PLT-CMD19): puts a folder first in the recent folders, each once, at most ten.
import { addRecent } from '../model.ts';
import type { RecentFolderRepository } from '../repository.ts';
import { holdToRules } from '../rules.ts';

export interface AddRecentFolder {
  folder: string;
}

export function addRecentFolder(recents: RecentFolderRepository, input: AddRecentFolder): void {
  const next = addRecent(recents.load(), input.folder);
  holdToRules(next);
  recents.save(next);
}
