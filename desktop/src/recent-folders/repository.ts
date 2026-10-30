// The Recent folders' repository (LA-PLT-REPO06): recent-folders.json in the shell's user data folder, read once,
// on the first load, and rewritten whole on each save.
import { readJson, writeJson } from '../store.ts';
import { parseRecent, type RecentFolders } from './model.ts';

export class RecentFolderRepository {
  private readonly file: () => string;
  private kept: RecentFolders | null = null;
  constructor(file: () => string) {
    this.file = file;
  }

  load(): RecentFolders {
    this.kept ??= parseRecent(readJson(this.file()));
    return this.kept;
  }

  save(folders: RecentFolders): void {
    this.kept = [...folders];
    writeJson(this.file(), this.kept);
  }
}
