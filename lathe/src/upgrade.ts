// `lathe upgrade`: moves a product's data forward, one way, from the schema version its lathe.config.json names to
// this Lathe's (SCHEMA_VERSION). Each breaking schema change comes with a converter, upgrades/<from>-to-<to>.ts, whose
// default export rewrites the raw rows of the data files (`files`): what the new schema cannot load as it is (a renamed
// or removed column, a moved table, a required text a record lacks). Every converter runs in order; then the data must
// load under the new schema, which runs every aggregate's rules, and only then is the config's schema raised. What a
// converter cannot convert it leaves as a to-do, never dropped. Nothing old is kept or read afterwards (hard cutovers).
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { ProductRepoConfigRepository, type StoredConfig } from './platform/product-repo/repository.ts';
import { readConfig, SCHEMA_VERSION, schemaVersionMessage } from './config.ts';
import { formatProblem, StoreError } from './platform/data/problems.ts';
import { openStore, type Store } from './platform/data/store.ts';
import { tableText } from './platform/data/rows.ts';

/** Where a converter says what it did, and what it could not do. */
export interface UpgradeNotes {
  /** A change it made, as one line for the summary. */
  changed(text: string): void;
  /** Something it could not convert, for the Owner to do by hand. */
  todo(text: string): void;
}

/** The product's data files as raw rows, before the new schema loads them: one JSON object per line. */
export interface RawData {
  /** The tables with a data file. */
  tables(): string[];
  /** A table's rows; none when it has no file. */
  read(table: string): Record<string, unknown>[];
  /** Replaces a table's rows; no rows removes its file. */
  write(table: string, rows: Record<string, unknown>[]): void;
}

/** A converter's default export: how it rewrites the raw rows. */
export interface Converter {
  files: (data: RawData, notes: UpgradeNotes) => void | Promise<void>;
}

/** A converter with the versions its file name gives. */
export interface ConverterStep {
  from: number;
  to: number;
  /** The file name without its extension, such as 1-to-2. */
  name: string;
  converter: Converter;
}

export interface UpgradeResult {
  /** The schema version the data was for, and the one it is for now (unchanged when the upgrade stopped). */
  from: number;
  to: number;
  /** Each converter run, with the changes it reported. */
  steps: { name: string; changes: string[] }[];
  /** What could not be converted, for the Owner to finish by hand. */
  todos: string[];
  /** False when the upgrade stopped before raising the schema version: the data no longer loads, as the to-dos say. */
  done: boolean;
}

/** The converters' folder: upgrades/ beside src/, in the source and in dist alike. */
export const UPGRADES_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'upgrades');

const CONVERTER_FILE = /^(\d+)-to-(\d+)\.(ts|js)$/;

/** Every converter in dir, in order. A converter moves the data forward by exactly one version. */
export async function readConverters(dir = UPGRADES_DIR): Promise<ConverterStep[]> {
  if (!existsSync(dir)) return [];
  const steps: ConverterStep[] = [];
  for (const file of readdirSync(dir).sort()) {
    const match = CONVERTER_FILE.exec(file);
    if (!match) continue;
    const from = Number(match[1]);
    const to = Number(match[2]);
    if (to !== from + 1) throw new Error(`${path.join(dir, file)}: a converter moves the data forward one version, such as 1-to-2.ts.`);
    const module = (await import(/* @vite-ignore */ pathToFileURL(path.join(dir, file)).href)) as { default?: Converter };
    if (!module.default || typeof module.default.files !== 'function') throw new Error(`${path.join(dir, file)}: a converter's default export holds its files function.`);
    steps.push({ from, to, name: `${from}-to-${to}`, converter: module.default });
  }
  return steps.sort((a, b) => a.from - b.from);
}

/** Why the git working tree at root is not clean, or null when it is. */
function dirtyTree(root: string): string | null {
  let status: string;
  try {
    status = execFileSync('git', ['status', '--porcelain'], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  } catch {
    return `${root} is not in a git repository, so the upgrade could not be reviewed as one commit. Put it under git first.`;
  }
  if (!status.trim()) return null;
  return `The git working tree has changes, so the upgrade would not be one reviewable commit. Commit or stash them first:\n${status.trimEnd()}`;
}

function rawData(dataDir: string, touched: Set<string>): RawData {
  const file = (table: string) => path.join(dataDir, `${table}.jsonl`);
  return {
    tables: () => (existsSync(dataDir) ? readdirSync(dataDir).filter((f) => f.endsWith('.jsonl')).map((f) => f.slice(0, -'.jsonl'.length)).sort() : []),
    read: (table) => {
      if (!existsSync(file(table))) return [];
      return readFileSync(file(table), 'utf8').split('\n').filter((line) => line.trim() !== '').map((line) => JSON.parse(line) as Record<string, unknown>);
    },
    write: (table, rows) => {
      touched.add(table);
      if (rows.length === 0) rmSync(file(table), { force: true });
      else writeFileSync(file(table), rows.map((row) => `${JSON.stringify(row)}\n`).join(''));
    },
  };
}

/**
 * Upgrades the product at root to `target` (this Lathe's schema version) by the converters, in order. Refuses a git
 * working tree with changes, or no git, so the upgrade is one reviewable commit. Throws when there is nothing to upgrade
 * from (the data is for a newer schema) or a converter is missing.
 */
export async function upgradeProduct(root: string, options: { converters?: ConverterStep[]; target?: number } = {}): Promise<UpgradeResult> {
  const config = readConfig(root);
  const target = options.target ?? SCHEMA_VERSION;
  const result: UpgradeResult = { from: config.schema, to: config.schema, steps: [], todos: [], done: true };
  if (config.schema === target) return result;
  if (config.schema > target) throw new Error(schemaVersionMessage(config.schema, target));
  const dirty = dirtyTree(config.root);
  if (dirty) throw new Error(dirty);
  const available = options.converters ?? (await readConverters());
  const chain: ConverterStep[] = [];
  for (let at = config.schema; at < target; at++) {
    const step = available.find((s) => s.from === at);
    if (!step) throw new Error(`This Lathe has no converter from schema ${at} to schema ${at + 1} (upgrades/${at}-to-${at + 1}.ts).`);
    chain.push(step);
  }

  const notesFor = (name: string): UpgradeNotes => {
    const changes: string[] = [];
    result.steps.push({ name, changes });
    return { changed: (text) => changes.push(text), todo: (text) => result.todos.push(`${name}: ${text}`) };
  };
  const notes = new Map(chain.map((step) => [step.name, notesFor(step.name)]));

  // The converters, in order, on the raw rows.
  const touched = new Set<string>();
  const data = rawData(config.dataDir, touched);
  for (const step of chain) await step.converter.files(data, notes.get(step.name)!);

  // The converted data must load under the new schema, with every aggregate's rules.
  let store: Store;
  try {
    store = await openStore(config.root, { dataDir: config.dataDir });
  } catch (error) {
    if (!(error instanceof StoreError)) throw error;
    result.todos.push(...error.problems.map((p) => `The data does not load under schema ${target}: ${formatProblem(p)}`));
    return { ...result, done: false };
  }
  try {
    // The tables rewritten raw take the store's own order and line format.
    for (const table of touched) {
      const description = store.schema.tables[table];
      if (!description) continue;
      const rows = store.rows(table).filter((row) => !store.isBuiltIn(row));
      if (rows.length) writeFileSync(path.join(config.dataDir, `${table}.jsonl`), tableText(description, rows));
    }
  } finally {
    await store.close();
  }

  // Only now is the data for the new schema.
  const repository = new ProductRepoConfigRepository(config.root);
  const written = { ...((repository.load() ?? {}) as StoredConfig) };
  delete written.schema;
  repository.save({ schema: target, ...written });
  return { ...result, to: target };
}
