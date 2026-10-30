// The Recent folders' query: List the recent folders (LA-PLT-QRY06), given only the read model's reader.
import type { RecentFolderItem } from './read-model.ts';
import type { RecentFoldersReader } from './reader.ts';

export function listRecentFolders(reader: RecentFoldersReader): readonly RecentFolderItem[] {
  return reader.items();
}
