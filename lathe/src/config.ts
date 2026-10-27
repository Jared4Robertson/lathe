// Where Lathe finds things in a product repo: lathe.config.json at the root, with defaults.
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const CONFIG_FILE = 'lathe.config.json';

export interface LatheConfig {
  /** The product repo's root. */
  root: string;
  /** Folder of spec records. */
  specsDir: string;
  /** Folder of data files, one data/<table>.jsonl per table (the store's source of truth). */
  dataDir: string;
  /** Meta-model folders, in order: Lathe's defaults first, then the product's extensions. */
  metaDirs: string[];
  /** The product's own checks folder (SQL files run after Lathe's checks), or null when it has none. */
  checksDir: string | null;
  /** Extra ID prefixes a record body may cite besides every product's and domain's ID (FORMAT.md section 12). */
  idPrefixes: string[];
  /** The most children of one kind a record should have before too-many-children warns (structure.maxChildren). */
  maxChildren: number;
}

/** structure.maxChildren when lathe.config.json does not give it. */
export const DEFAULT_MAX_CHILDREN = 15;

interface ConfigFile {
  specs?: string;
  /** The folder of data files, one <table>.jsonl per table; default data. */
  data?: string;
  /** A folder with kinds.csv and/or relations.csv whose rows are added to Lathe's defaults. */
  metaExtensions?: string;
  /** A folder of the product's own check SQL files, run after Lathe's checks (FORMAT.md section 13). */
  checks?: string;
  /** Extra ID prefixes, such as ["STD", "SYS"]: a body token starting with one followed by "-" is a citation. */
  idPrefixes?: unknown;
  /** Structure settings: maxChildren, the most children of one kind a record should have. */
  structure?: unknown;
}

/** The keys lathe.config.json may hold; any other key is an error, never silently ignored. */
const CONFIG_KEYS = ['specs', 'data', 'metaExtensions', 'checks', 'idPrefixes', 'structure'] as const;

const ID_PREFIX = /^[A-Z][A-Z0-9]*(?:-[A-Z0-9]+)*$/;

// Reads the optional idPrefixes list: each entry must be ID-shaped (FORMAT.md section 2).
function readIdPrefixes(value: unknown): string[] {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value) || !value.every((p) => typeof p === 'string' && ID_PREFIX.test(p.trim()))) {
    throw new Error(`${CONFIG_FILE}: idPrefixes must be a list of ID prefixes such as ["STD", "SYS"].`);
  }
  return [...new Set(value.map((p: string) => p.trim()))];
}

// Reads the optional structure.maxChildren setting: a whole number of at least 1, default 15 (FORMAT.md section 5).
function readMaxChildren(structure: unknown): number {
  if (structure === undefined || structure === null) return DEFAULT_MAX_CHILDREN;
  if (typeof structure !== 'object' || Array.isArray(structure)) {
    throw new Error(`${CONFIG_FILE}: structure must be an object such as { "maxChildren": 15 }.`);
  }
  const value = (structure as { maxChildren?: unknown }).maxChildren;
  if (value === undefined || value === null) return DEFAULT_MAX_CHILDREN;
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 1) {
    throw new Error(`${CONFIG_FILE}: structure.maxChildren must be a whole number of at least 1, such as 15.`);
  }
  return value;
}

/** The installed Lathe package's own folder (holding meta/ and checks/), from source or from dist. */
export const PACKAGE_DIR = (() => {
  let dir = path.dirname(fileURLToPath(import.meta.url));
  while (!existsSync(path.join(dir, 'meta', 'kinds.csv'))) {
    const up = path.dirname(dir);
    if (up === dir) throw new Error('Cannot find the Lathe package folder (meta/kinds.csv).');
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
    throw new Error(`${CONFIG_FILE} must hold one JSON object, such as { "specs": "specs" }.`);
  }
  const unknown = Object.keys(config).filter((key) => !(CONFIG_KEYS as readonly string[]).includes(key));
  if (unknown.length) {
    throw new Error(`${CONFIG_FILE}: unknown setting${unknown.length === 1 ? '' : 's'} ${unknown.map((k) => `"${k}"`).join(', ')}. The settings are ${CONFIG_KEYS.join(', ')}.`);
  }
  const inside = (value: string | undefined, fallback: string) => path.resolve(root, value ?? fallback);
  const metaDirs = [path.join(PACKAGE_DIR, 'meta')];
  if (config.metaExtensions) metaDirs.push(inside(config.metaExtensions, ''));
  return {
    root,
    specsDir: inside(config.specs, 'specs'),
    dataDir: inside(config.data, 'data'),
    metaDirs,
    checksDir: config.checks ? inside(config.checks, '') : null,
    idPrefixes: readIdPrefixes(config.idPrefixes),
    maxChildren: readMaxChildren(config.structure),
  };
}
