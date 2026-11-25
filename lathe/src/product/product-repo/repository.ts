// The Product repo's repository (LA-PRD-REPO07): a product repo's lathe.config.json at its root, read and written
// whole for `lathe init` (LA-PRD-CMD21) and `lathe upgrade` (LA-PRD-CMD24). Every load reads the file through the
// Platform's own reader (config.ts, LA-PLT-GU02), which this repository's product domain stands on.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { CONFIG_FILE } from '../../config.ts';


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
