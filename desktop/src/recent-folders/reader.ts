// The Recent folders read model's reader: the one way its query reaches the table.
import type { RecentFolders } from './model.ts';
import { recentFoldersTableFrom, type RecentFolderItem, type RecentFoldersTable } from './read-model.ts';

export interface RecentFoldersReader {
  /** The recent folders, latest first. */
  items(): readonly RecentFolderItem[];
}

class InMemoryRecentFoldersReader implements RecentFoldersReader {
  private readonly table: RecentFoldersTable;
  constructor(table: RecentFoldersTable) {
    this.table = table;
  }

  items(): readonly RecentFolderItem[] {
    return this.table;
  }
}

export const recentFoldersReader = (folders: RecentFolders, home?: string): RecentFoldersReader => new InMemoryRecentFoldersReader(recentFoldersTableFrom(folders, home));
