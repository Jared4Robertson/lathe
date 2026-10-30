// The Shell settings' repository (LA-PLT-REPO20): settings.json in the shell's user data folder, read whole on each
// load (the person may have edited it by hand since) and written whole on each save.
import { existsSync } from 'node:fs';
import { readJson, writeJson } from '../store.ts';
import { parseSettings, storedSettings, type Settings } from './model.ts';

export class ShellSettingsRepository {
  private readonly file: () => string;
  constructor(file: () => string) {
    this.file = file;
  }

  /** The settings as the file holds them now, or the defaults. */
  load(): Settings {
    return parseSettings(readJson(this.file()));
  }

  save(settings: Settings): void {
    writeJson(this.file(), storedSettings(settings));
  }

  /** Whether the file exists yet. */
  stored(): boolean {
    return existsSync(this.file());
  }

  /** Where the settings are kept, for opening them in an editor. */
  location(): string {
    return this.file();
  }
}
