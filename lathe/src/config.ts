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
  /** The schema version the product's data is for; 1 when the config names none. */
  schema: number;
}

/** The most children of one kind a record has before too-many-children warns, when the product has no product_setting row. */
export const DEFAULT_MAX_CHILDREN = 15;

interface ConfigFile {
  /** The schema version the data is for; default 1. */
  schema?: unknown;
  /** The folder of data files, one <table>.jsonl per table; default data. */
  data?: unknown;
}

/** The keys lathe.config.json may hold; any other key is an error, never silently ignored. */
const CONFIG_KEYS = ['schema', 'data'] as const;

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

/**
 * This Lathe's schema version: a whole number, kept in schema/version.json, that a breaking schema change raises by
 * one (with a converter in upgrades/ and a new major version of the package).
 */
export const SCHEMA_VERSION: number = (() => {
  const file = path.join(PACKAGE_DIR, 'schema', 'version.json');
  const version = (JSON.parse(readFileSync(file, 'utf8')) as { schema?: unknown }).schema;
  if (typeof version !== 'number' || !Number.isInteger(version) || version < 1) throw new Error(`${file}: schema must be a whole number from 1.`);
  return version;
})();

/** A product whose data is for another schema version than this Lathe's: it stops every load, with what to do. */
export class SchemaVersionError extends Error {
  readonly product: number;
  readonly lathe: number;
  constructor(product: number, lathe: number) {
    super(schemaVersionMessage(product, lathe));
    this.name = 'SchemaVersionError';
    this.product = product;
    this.lathe = lathe;
  }
}

/** What to do when the product's schema version is not this Lathe's: upgrade the data, or update Lathe. */
export function schemaVersionMessage(product: number, lathe: number): string {
  const versions = `This product's data is for schema ${product}; this Lathe uses schema ${lathe}.`;
  return product < lathe
    ? `${versions} Run \`npx lathe upgrade\` to move it forward.`
    : `${versions} It needs a newer Lathe: update @jaredrob/lathe.`;
}

/** The product's config, refused unless its data is for this Lathe's schema version. Every load reads it this way. */
export function loadConfig(root: string): LatheConfig {
  const config = readConfig(root);
  if (config.schema !== SCHEMA_VERSION) throw new SchemaVersionError(config.schema, SCHEMA_VERSION);
  return config;
}

/** The product's config whatever its schema version: only `lathe upgrade` reads it this way. */
export function readConfig(root: string): LatheConfig {
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
    throw new Error(`${CONFIG_FILE} must hold one JSON object, such as { "schema": 1, "data": "data" }.`);
  }
  const unknown = Object.keys(config).filter((key) => !(CONFIG_KEYS as readonly string[]).includes(key));
  if (unknown.length) {
    throw new Error(`${CONFIG_FILE}: unknown setting${unknown.length === 1 ? '' : 's'} ${unknown.map((k) => `"${k}"`).join(', ')}. The settings are ${CONFIG_KEYS.join(', ')}.`);
  }
  if (config.data !== undefined && (typeof config.data !== 'string' || config.data.trim() === '')) {
    throw new Error(`${CONFIG_FILE}: data must name a folder, such as "data".`);
  }
  if (config.schema !== undefined && (typeof config.schema !== 'number' || !Number.isInteger(config.schema) || config.schema < 1)) {
    throw new Error(`${CONFIG_FILE}: schema must be a whole number from 1, such as 1.`);
  }
  // A config with no schema is for schema 1, the first versioned one. Lathe's own package, opened for its own
  // reference and checks with no config of its own, is always at its own schema.
  const unnamed = root === PACKAGE_DIR && !existsSync(file) ? SCHEMA_VERSION : 1;
  return { root, dataDir: path.resolve(root, (config.data as string | undefined) ?? 'data'), schema: (config.schema as number | undefined) ?? unnamed };
}
