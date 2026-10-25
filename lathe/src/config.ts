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
  /** Folder of CSV diagrams (diagrams.csv plus one folder per diagram). */
  diagramsDir: string;
  /** Meta-model folders, in order: Lathe's defaults first, then the product's extensions. */
  metaDirs: string[];
  /** The product's own checks folder (SQL files run after Lathe's checks), or null when it has none. */
  checksDir: string | null;
  /** Extra ID prefixes a record body may cite besides every product's and domain's ID (FORMAT.md section 12). */
  idPrefixes: string[];
}

interface ConfigFile {
  specs?: string;
  diagrams?: string;
  /** A folder with kinds.csv and/or relations.csv whose rows are added to Lathe's defaults. */
  metaExtensions?: string;
  /** A folder of the product's own check SQL files, run after Lathe's checks (FORMAT.md section 13). */
  checks?: string;
  /** Extra ID prefixes, such as ["STD", "SYS"]: a body token starting with one followed by "-" is a citation. */
  idPrefixes?: unknown;
}

const ID_PREFIX = /^[A-Z][A-Z0-9]*(?:-[A-Z0-9]+)*$/;

// Reads the optional idPrefixes list: each entry must be ID-shaped (FORMAT.md section 2).
function readIdPrefixes(value: unknown): string[] {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value) || !value.every((p) => typeof p === 'string' && ID_PREFIX.test(p.trim()))) {
    throw new Error(`${CONFIG_FILE}: idPrefixes must be a list of ID prefixes such as ["STD", "SYS"].`);
  }
  return [...new Set(value.map((p: string) => p.trim()))];
}

/** The installed Lathe package's own folder (holding meta/, checks/ and diagrams/), from source or from dist. */
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
  const inside = (value: string | undefined, fallback: string) => path.resolve(root, value ?? fallback);
  const metaDirs = [path.join(PACKAGE_DIR, 'meta')];
  if (config.metaExtensions) metaDirs.push(inside(config.metaExtensions, ''));
  return {
    root,
    specsDir: inside(config.specs, 'specs'),
    diagramsDir: inside(config.diagrams, 'diagrams'),
    metaDirs,
    checksDir: config.checks ? inside(config.checks, '') : null,
    idPrefixes: readIdPrefixes(config.idPrefixes),
  };
}
