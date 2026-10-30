// The Product repo's repository (LA-PLT-REPO07): a product repo's lathe.config.json at its root, read and written
// whole. It is the only code that reads or writes the file: loadConfig and readConfig (config.ts) read it through
// load, and `lathe init` (LA-PLT-CMD21) and `lathe upgrade` (LA-PLT-CMD24) write it through save.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

/** The config file's name, at the product repo's root. */
export const CONFIG_FILE = 'lathe.config.json';

/** lathe.config.json as written: its settings by key, checked by readConfig. */
export type StoredConfig = Record<string, unknown>;

export class ProductRepoConfigRepository {
  readonly file: string;
  constructor(root: string) {
    this.file = path.join(root, CONFIG_FILE);
  }

  /** Whether the repo has its config yet. */
  exists(): boolean {
    return existsSync(this.file);
  }

  /** The config as written, or undefined when the repo has none; refused when it is not JSON. */
  load(): unknown {
    if (!this.exists()) return undefined;
    try {
      return JSON.parse(readFileSync(this.file, 'utf8')) as unknown;
    } catch (error) {
      throw new Error(`${CONFIG_FILE} is not valid JSON: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /** Writes the config whole, as two-space JSON with a final newline. */
  save(config: StoredConfig): void {
    writeFileSync(this.file, `${JSON.stringify(config, null, 2)}\n`);
  }
}
