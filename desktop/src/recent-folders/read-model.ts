// The Recent folders read model (LA-PLT-RM04): each recent folder with the name File › Open Recent shows for it.
import { displayPath } from '../folders.ts';
import type { RecentFolders } from './model.ts';

/** A recent folder as the menu lists it. */
export interface RecentFolderItem {
  folder: string;
  /** The folder as people read it: under the home folder it starts with "~". */
  label: string;
}

/** The read model's table, kept in memory: the items, latest first. */
export type RecentFoldersTable = readonly RecentFolderItem[];

/** The projection: the table from the recent folders as stored. */
export function recentFoldersTableFrom(folders: RecentFolders, home?: string): RecentFoldersTable {
  return folders.map((folder) => ({ folder, label: displayPath(folder, home) }));
}
