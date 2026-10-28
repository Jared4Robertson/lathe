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
  /** Globs, relative to the root, of the product's test files, which test-case-unnamed reads; DEFAULT_TESTS when the config names none. */
  tests: string[];
  /** Globs, relative to the root, of the product's source files, which code-file-untraced reads; DEFAULT_SOURCE when the config names none. */
  source: string[];
  /**
   * The files, as glob patterns from the root, that declare the routes the product serves besides its endpoint
   * handlers' files (a router, a server's entry, a client's route table); none when the config names none.
   */
  routers: string[];
  /**
   * The folders, from the root, whose package.json lists the product's packages (its runtime and dev dependencies);
   * null when the config names none, and then the root and each folder directly under it that holds a package.json.
   */
  packages: string[] | null;
  /**
   * The other products this workspace shows beside its own (the folders its products key lists), as absolute roots,
   * each with its own lathe.config.json and data; none when the config names none.
   */
  products: string[];
}

/**
 * The test files a product has when lathe.config.json names none: the common test and spec file names. node_modules,
 * dist and the folders of another product (a folder with its own lathe.config.json) are never read, whatever the globs.
 */
export const DEFAULT_TESTS: readonly string[] = ['**/*.test.{ts,tsx,js,mjs}', '**/*.spec.{ts,tsx,js}'];

/**
 * The source files a product has when lathe.config.json names none: code in the common languages. Tests (the test
 * globs, and files in test folders), configs, generated files and build output are left out whatever the globs
 * (trace/source-files.ts).
 */
export const DEFAULT_SOURCE: readonly string[] = ['**/*.{ts,tsx,js,jsx,mjs,cjs,mts,cts,vue,svelte,py,rb,go,rs,java,kt,swift,cs,php}'];

/** The most children of one kind a record has before too-many-children warns, when the product has no product_setting row. */
export const DEFAULT_MAX_CHILDREN = 15;

interface ConfigFile {
  /** The schema version the data is for; default 1. */
  schema?: unknown;
  /** The folder of data files, one <table>.jsonl per table; default data. */
  data?: unknown;
  /** Globs of the product's test files; default DEFAULT_TESTS. */
  tests?: unknown;
  /** Globs of the product's source files; default DEFAULT_SOURCE. */
  source?: unknown;
  /** Glob patterns of the router files; default none. */
  routers?: unknown;
  /** The package folders whose package.json lists the product's packages; default the root and the folders under it. */
  packages?: unknown;
  /** The folders of the other products the workspace shows, each with its own lathe.config.json; default none. */
  products?: unknown;
}

/** The keys lathe.config.json may hold; any other key is an error, never silently ignored. */
const CONFIG_KEYS = ['schema', 'data', 'tests', 'source', 'routers', 'packages', 'products'] as const;

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

/**
 * The products a workspace shows: its own config first, then the config of each folder its products key lists, in
 * the listed order, each refused unless its data is for this Lathe's schema version. Only the workspace lists
 * products: a listed product that lists its own is refused.
 */
export function workspaceProducts(root: string): LatheConfig[] {
  const own = loadConfig(root);
  return [own, ...own.products.map((product) => {
    const config = loadConfig(product);
    if (config.products.length) {
      const folder = path.relative(own.root, product).split(path.sep).join('/');
      throw new Error(`${folder}/${CONFIG_FILE}: products is for the workspace only; list every product in ${CONFIG_FILE} at ${own.root}.`);
    }
    return config;
  })];
}

/** Why the products' IDs clash (one product ID in two products' folders), or null when each is in one folder. */
export function productClash(workspace: string, products: { root: string; ids: readonly string[] }[]): string | null {
  const seen = new Map<string, string>();
  const folder = (root: string) => path.relative(workspace, root).split(path.sep).join('/') || '.';
  for (const { root, ids } of products) {
    for (const id of ids) {
      const other = seen.get(id);
      if (other !== undefined && other !== root) return `The product ${id} is in two folders, ${folder(other)} and ${folder(root)}: a product's records live in its own folder only.`;
      seen.set(id, root);
    }
  }
  return null;
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
  const globs = (key: 'tests' | 'source', example: string) => {
    const value = config[key];
    if (value !== undefined && (!Array.isArray(value) || value.length === 0 || value.some((t) => typeof t !== 'string' || t.trim() === ''))) {
      throw new Error(`${CONFIG_FILE}: ${key} must list globs of the ${key === 'tests' ? 'test' : 'source'} files, such as ["${example}"].`);
    }
    return value as string[] | undefined;
  };
  const tests = globs('tests', '**/*.test.ts');
  const source = globs('source', 'src/**/*.ts');
  if (config.routers !== undefined && (!Array.isArray(config.routers) || config.routers.some((r) => typeof r !== 'string' || r.trim() === ''))) {
    throw new Error(`${CONFIG_FILE}: routers must be a list of file patterns from the root, such as ["src/router.ts"].`);
  }
  // A config with no schema is for schema 1, the first versioned one. Lathe's own package, opened for its own
  // reference and checks with no config of its own, is always at its own schema.
  const unnamed = root === PACKAGE_DIR && !existsSync(file) ? SCHEMA_VERSION : 1;
  return {
    root,
    dataDir: path.resolve(root, (config.data as string | undefined) ?? 'data'),
    schema: (config.schema as number | undefined) ?? unnamed,
    tests: tests ?? [...DEFAULT_TESTS],
    source: source ?? [...DEFAULT_SOURCE],
    routers: (config.routers as string[] | undefined) ?? [],
    packages: packageFolders(root, config.packages),
    products: productFolders(root, config.products),
  };
}

// The product folders the config lists, as absolute roots: each a folder other than the root, named once, that holds
// its own lathe.config.json.
function productFolders(root: string, value: unknown): string[] {
  if (value === undefined) return [];
  const shape = `${CONFIG_FILE}: products must list the folders of the other products this workspace shows, each holding its own ${CONFIG_FILE}, such as ["examples/tool-library"].`;
  if (!Array.isArray(value) || value.some((v) => typeof v !== 'string' || v.trim() === '')) throw new Error(shape);
  const roots: string[] = [];
  for (const folder of value as string[]) {
    const product = path.resolve(root, folder);
    if (product === root) throw new Error(`${shape} ${folder} is the workspace itself.`);
    if (roots.includes(product)) throw new Error(`${shape} ${folder} is listed twice.`);
    if (!existsSync(path.join(product, CONFIG_FILE))) throw new Error(`${shape} ${folder} holds no ${CONFIG_FILE}.`);
    roots.push(product);
  }
  return roots;
}

// The package folders the config lists, each a folder inside the root, as paths from the root ('.' for the root).
function packageFolders(root: string, value: unknown): string[] | null {
  if (value === undefined) return null;
  const shape = `${CONFIG_FILE}: packages must list folders inside the product root that hold a package.json, such as ["app", "server"].`;
  if (!Array.isArray(value) || value.some((v) => typeof v !== 'string' || v.trim() === '')) throw new Error(shape);
  return (value as string[]).map((folder) => {
    const rel = path.relative(root, path.resolve(root, folder));
    if (rel.startsWith('..') || path.isAbsolute(rel)) throw new Error(`${shape} ${folder} is outside it.`);
    if (otherProductHolds(root, rel)) throw new Error(`${shape} ${folder} is another product's folder.`);
    return rel.split(path.sep).join('/') || '.';
  });
}

/** Whether a folder, from the root, lies in another product's folder: it or a folder above it, below the root, holds its own lathe.config.json. */
export function otherProductHolds(root: string, rel: string): boolean {
  for (let at = rel; at !== '' && at !== '.'; at = path.dirname(at)) if (existsSync(path.join(root, at, CONFIG_FILE))) return true;
  return false;
}
