// The Recent folders' policy (LA-PLT-PO03): when a folder opens, put it first in the recent folders.
import type { ProductWindowOpened } from '../product-window/events.ts';
import { addRecentFolder } from './commands/add-recent-folder.ts';
import type { RecentFolderRepository } from './repository.ts';

/** What the shell does beside the list: the system's recent documents, and the menu that lists the folders. */
export interface RecentFoldersShell {
  addRecentDocument: (folder: string) => void;
  recentFoldersChanged: () => void;
}

export function onWindowOpenedAddRecentFolder(event: ProductWindowOpened, recents: RecentFolderRepository, shell: RecentFoldersShell): void {
  addRecentFolder(recents, { folder: event.folder });
  shell.addRecentDocument(event.folder);
  shell.recentFoldersChanged();
}
