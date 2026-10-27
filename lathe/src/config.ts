// Where Lathe finds things in a product repo: lathe.config.json at the root, with defaults.
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const CONFIG_FILE = 'lathe.config.json';

export interface LatheConfig {
  /** The product repo's root. */
  root: string;
  /** Folder of data files, one data/<table>.jsonl per table (the store's source of truth). */
  dataDir: string;
}

/** The most children of one kind a record has before too-many-children warns, when the product has no product_setting row. */
export const DEFAULT_MAX_CHILDREN = 15;

interface ConfigFile {
  /** The folder of data files, one <table>.jsonl per table; default data. */
  data?: unknown;
}

/** The keys lathe.config.json may hold; any other key is an error, never silently ignored. */
const CONFIG_KEYS = ['data'] as const;

/** The installed Lathe package's own folder (holding schema/ and data/), from source or from dist. */
export const PACKAGE_DIR = (() => {
  let dir = path.dirname(fileURLToPath(import.meta.url));
  while (!existsSync(path.join(dir, 'schema', '001-meta.sql'))) {
    const up = path.dirname(dir);
    if (up === dir) throw new Error('Cannot find the Lathe package folder (schema/001-meta.sql).');
    dir = up;
  }
  return dir;
})();

export function loadConfig(root: string): LatheConfig {
  root = path.resolve(root);
  const file = path.join(root, CONFIG_FILE);
  let config: ConfigFile = {};
  if (existsSync(file)) {
    try {
      config = JSON.parse(readFileSync(file, 'utf8'));
    } catch (error) {
      throw new Error(`${CONFIG_FILE} is not valid JSON: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  if (typeof config !== 'object' || config === null || Array.isArray(config)) {
    throw new Error(`${CONFIG_FILE} must hold one JSON object, such as { "data": "data" }.`);
  }
  const unknown = Object.keys(config).filter((key) => !(CONFIG_KEYS as readonly string[]).includes(key));
  if (unknown.length) {
    throw new Error(`${CONFIG_FILE}: unknown setting${unknown.length === 1 ? '' : 's'} ${unknown.map((k) => `"${k}"`).join(', ')}. The settings are ${CONFIG_KEYS.join(', ')}.`);
  }
  if (config.data !== undefined && (typeof config.data !== 'string' || config.data.trim() === '')) {
    throw new Error(`${CONFIG_FILE}: data must name a folder, such as "data".`);
  }
  return { root, dataDir: path.resolve(root, (config.data as string | undefined) ?? 'data') };
}
