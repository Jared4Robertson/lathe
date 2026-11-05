// The schema cache: the migrated schema databases, built once and kept as DuckDB files, so a process starts by
// attaching one instead of running the migrations. It holds schemas only (tables, views, the meta-model's rows), never
// a product's data (LA-PLT-UC01-R04). Beside them, the validated-build stamps: one small file per set of data files
// whose whole build passed, named by a hash of the files' contents and of everything that judges them, so a load of
// the same files reads their rows without building them again (see validatedKey).
//
// Each file is named by its key, a hash of everything that shapes it: Lathe's version, DuckDB's, the migrations and
// the engine's own code (this folder), and for a product's kinds and relations the SQL that adds them. The key is also
// stamped inside the file, in a lathe_cache schema of its own, with the schema's description. A file is used only
// when its stamp names its key; a stale or corrupt file is removed and the schema built afresh, then cached again.
// A file is written under a name of its own and renamed into place, so two processes that build the same schema at
// once each write a whole file, and a reader never sees half of one.
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { mkdir, readdir, rename, rm, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { version as duckdbVersion, type DuckDBConnection } from '@duckdb/node-api';
import { PACKAGE_DIR } from '../../config.ts';
import { sqlName, sqlString, type Migration, type SchemaDescription } from './schema.ts';

/** Changed when the layout of a cache file changes, so files of the old layout are never read. */
const CACHE_FORMAT = 1;
/** The schema, in each cache file, that holds its stamp; copies of the schema drop it. */
const STAMP_SCHEMA = 'lathe_cache';

/**
 * Where the cache files live: LATHE_CACHE_DIR when it is set, or else .cache/lathe in the node_modules folder that
 * holds this Lathe (its own node_modules when it runs from source), so each install keeps its own and none lands in a
 * product's files.
 */
export function cacheDir(): string {
  if (process.env.LATHE_CACHE_DIR) return path.resolve(process.env.LATHE_CACHE_DIR);
  const parts = PACKAGE_DIR.split(path.sep);
  const at = parts.lastIndexOf('node_modules');
  const modules = at >= 0 ? parts.slice(0, at + 1).join(path.sep) : path.join(PACKAGE_DIR, 'node_modules');
  return path.join(modules, '.cache', 'lathe');
}

const hash = (...parts: string[]) => {
  const h = createHash('sha256');
  for (const part of parts) h.update(`${part.length}:${part}`);
  return h.digest('hex').slice(0, 32);
};

/** The key of the migrated base schema: Lathe's and DuckDB's versions, the migrations and the engine's code. */
export function baseKey(migrations: Migration[]): string {
  const here = fileURLToPath(import.meta.url);
  const code = readdirSync(path.dirname(here))
    .filter((f) => f.endsWith(path.extname(here)))
    .sort()
    .flatMap((f) => [f, readFileSync(path.join(path.dirname(here), f), 'utf8')]);
  const pkg = JSON.parse(readFileSync(path.join(PACKAGE_DIR, 'package.json'), 'utf8')) as { version: string };
  return hash(String(CACHE_FORMAT), pkg.version, duckdbVersion(), ...migrations.flatMap((m) => [m.name, m.sql]), ...code);
}

/** The key of a schema with a product's kinds and relations: the base's key followed by a hash of the SQL that adds them. */
export const productKey = (base: string, sql: string): string => `${base}-${hash(sql)}`;

const fileOf = (key: string) => path.join(cacheDir(), `${key}.duckdb`);

/**
 * Copies the cache file of key into a new in-memory database of the given name, and returns the schema stamped in it;
 * or returns undefined, making nothing, when there is no file or the file is stale or corrupt (and then removes it).
 * The file is attached read only while it is copied, then detached: no database of the engine stays on a file. A
 * sealed engine (LA-CHK-INV06) keeps the files of attached databases, and the files beside them, open to every query,
 * to read and to write; with none attached, it keeps none.
 */
export async function attachCached(connection: DuckDBConnection, name: string, key: string): Promise<SchemaDescription | undefined> {
  const file = fileOf(key);
  if (!existsSync(file)) return undefined;
  const source = `${name}_file`;
  try {
    await connection.run(`ATTACH ${sqlString(file)} AS ${sqlName(source)} (READ_ONLY)`);
    const [stamp] = (await connection.runAndReadAll(`SELECT key, schema FROM ${sqlName(source)}.${STAMP_SCHEMA}.stamp`)).getRowObjectsJson() as { key: string; schema: string }[];
    if (stamp?.key !== key) throw new Error('stale');
    await connection.run(`ATTACH ':memory:' AS ${sqlName(name)}`);
    await copyDatabase(connection, source, name, false);
    await connection.run(`DETACH DATABASE ${sqlName(source)}`);
    return JSON.parse(stamp.schema) as SchemaDescription;
  } catch {
    await connection.run(`DETACH DATABASE IF EXISTS ${sqlName(source)}`).catch(() => undefined);
    await connection.run(`DETACH DATABASE IF EXISTS ${sqlName(name)}`).catch(() => undefined);
    await rm(file, { force: true }).catch(() => undefined);
    return undefined;
  }
}

/**
 * Copies a database into another, the schema alone or with its rows, leaving out a cache file's stamp, so a copy of a
 * cached schema is the same as a copy of one built afresh.
 */
export async function copyDatabase(connection: DuckDBConnection, from: string, to: string, schemaOnly: boolean): Promise<void> {
  await connection.run(`COPY FROM DATABASE ${sqlName(from)} TO ${sqlName(to)}${schemaOnly ? ' (SCHEMA)' : ''}`);
  await connection.run(`DROP SCHEMA IF EXISTS ${sqlName(to)}.${STAMP_SCHEMA} CASCADE`);
}

let writes = 0;

/** How many products' schemas are kept per base schema; a product whose declarations change leaves its old one. */
const MAX_PRODUCT_FILES = 20;

// Writing the base schema's file removes every file of another base, which no process of this Lathe reads again;
// writing a product's keeps the MAX_PRODUCT_FILES written last. A file removed while another process reads it stays
// readable to that process.
async function prune(dir: string, key: string): Promise<void> {
  const base = key.split('-')[0];
  const names = await readdir(dir);
  if (key === base) {
    for (const name of names) if (!name.startsWith(base)) await rm(path.join(dir, name), { force: true });
    return;
  }
  const products = names.filter((n) => n.startsWith(`${base}-`) && n.endsWith('.duckdb'));
  if (products.length <= MAX_PRODUCT_FILES) return;
  const written = await Promise.all(products.map(async (name) => ({ name, at: (await stat(path.join(dir, name))).mtimeMs })));
  written.sort((a, b) => b.at - a.at);
  for (const { name } of written.slice(MAX_PRODUCT_FILES)) await rm(path.join(dir, name), { force: true });
}

/**
 * Writes the database source, a schema built afresh, to the cache as key's file, stamped with the key and its
 * description. Any failure (a cache folder that cannot be written) leaves no file and is otherwise ignored: the next
 * process builds the schema again. Then it prunes the folder (see prune).
 */
export async function writeCached(connection: DuckDBConnection, source: string, key: string, schema: SchemaDescription): Promise<void> {
  const dir = cacheDir();
  const file = fileOf(key);
  const temp = `${file}.${process.pid}-${++writes}.tmp`;
  const name = `lathe_cache_write_${writes}`;
  try {
    await mkdir(dir, { recursive: true });
    await connection.run(`ATTACH ${sqlString(temp)} AS ${sqlName(name)}`);
    try {
      await copyDatabase(connection, source, name, false);
      await connection.run(`CREATE SCHEMA ${sqlName(name)}.${STAMP_SCHEMA}`);
      await connection.run(`CREATE TABLE ${sqlName(name)}.${STAMP_SCHEMA}.stamp (key VARCHAR NOT NULL, schema VARCHAR NOT NULL)`);
      await connection.run(`INSERT INTO ${sqlName(name)}.${STAMP_SCHEMA}.stamp VALUES (${sqlString(key)}, ${sqlString(JSON.stringify(schema))})`);
    } finally {
      await connection.run(`DETACH DATABASE IF EXISTS ${sqlName(name)}`);
    }
    await rename(temp, file);
    await prune(dir, key);
  } catch {
    // The cache is only a shortcut; the schema this process built serves it either way.
  } finally {
    await rm(temp, { force: true }).catch(() => undefined);
    await rm(`${temp}.wal`, { force: true }).catch(() => undefined);
  }
}

// ---------- Validated builds ----------

/** How many validated-build stamps are kept per base schema; a product whose files change leaves its old ones. */
const MAX_VALIDATED_FILES = 50;
const VALIDATED = '.validated';

let code: string | undefined;

/**
 * A hash of every source file of the engine (the folder that holds src/, all of it: the aggregates' rules, the
 * integrity queries and the store), so a change to any rule that judges a build makes every stamp stale.
 */
function codeHash(): string {
  if (code) return code;
  const here = fileURLToPath(import.meta.url);
  const src = path.resolve(path.dirname(here), '..', '..');
  const files = (readdirSync(src, { recursive: true }) as string[]).filter((f) => f.endsWith(path.extname(here))).sort();
  const h = createHash('sha256');
  for (const file of files) h.update(`${file}\0`).update(readFileSync(path.join(src, file))).update('\0');
  code = h.digest('hex');
  return code;
}

/**
 * The key of a whole build of these data files: the base schema's key (Lathe's and DuckDB's versions, the migrations),
 * the engine's code, and each file's folder, name and exact contents, in the order a load reads them. The product's
 * kinds and relations are in its files, so their schema is in the key too.
 */
export function validatedKey(base: string, files: Iterable<readonly [string, string]>): string {
  const parts = [codeHash()];
  for (const [file, text] of files) parts.push(file, text);
  return `${base}-${hash(...parts)}`;
}

const validatedFile = (key: string) => path.join(cacheDir(), `${key}${VALIDATED}`);

/** Whether a whole build of the files with this key passed: its stamp is there and names the key. A stamp that does not is removed. */
export function isValidated(key: string): boolean {
  const file = validatedFile(key);
  try {
    if (readFileSync(file, 'utf8') === key) return true;
  } catch {
    return false;
  }
  rmSync(file, { force: true });
  return false;
}

/**
 * Records that a whole build of the files with this key passed, keeping the MAX_VALIDATED_FILES stamps of this base
 * written last. Written under a name of its own and renamed into place; any failure leaves no stamp and is otherwise
 * ignored: the next load builds whole again.
 */
export function markValidated(key: string): void {
  const dir = cacheDir();
  const file = validatedFile(key);
  const temp = `${file}.${process.pid}.tmp`;
  try {
    mkdirSync(dir, { recursive: true });
    writeFileSync(temp, key);
    renameSync(temp, file);
    const base = key.split('-')[0];
    const stamps = readdirSync(dir).filter((n) => n.startsWith(`${base}-`) && n.endsWith(VALIDATED));
    if (stamps.length <= MAX_VALIDATED_FILES) return;
    const written = stamps.map((name) => ({ name, at: statSync(path.join(dir, name)).mtimeMs })).sort((a, b) => b.at - a.at);
    for (const { name } of written.slice(MAX_VALIDATED_FILES)) rmSync(path.join(dir, name), { force: true });
  } catch {
    try {
      rmSync(temp, { force: true });
    } catch {
      // No folder to write in: there is no file to remove.
    }
  }
}

// ---------- Checked problems ----------

/** How many runs' problems are kept per base schema; each write leaves the one before it. */
const MAX_CHECKED_FILES = 50;
const CHECKED = '.problems.json';

const checkedFile = (key: string) => path.join(cacheDir(), `${key}${CHECKED}`);

/**
 * The problems the checks found in the data whose key is given (a content key, contentKey), when a run over exactly
 * that data was kept; undefined otherwise. A file that does not name its key is removed.
 */
export function readCheckedProblems<P>(key: string): P[] | undefined {
  const file = checkedFile(key);
  try {
    const kept = JSON.parse(readFileSync(file, 'utf8')) as { key: string; problems: P[] };
    if (kept.key === key) return kept.problems;
  } catch {
    if (!existsSync(file)) return undefined;
  }
  rmSync(file, { force: true });
  return undefined;
}

/**
 * Keeps the problems the checks found in the data with this key, keeping the MAX_CHECKED_FILES of this base written
 * last. Written under a name of its own and renamed into place; any failure keeps nothing and is otherwise ignored.
 */
export function writeCheckedProblems<P>(key: string, problems: readonly P[]): void {
  const dir = cacheDir();
  const file = checkedFile(key);
  const temp = `${file}.${process.pid}.tmp`;
  try {
    mkdirSync(dir, { recursive: true });
    writeFileSync(temp, JSON.stringify({ key, problems }));
    renameSync(temp, file);
    const base = key.split('-')[0];
    const kept = readdirSync(dir).filter((n) => n.startsWith(`${base}-`) && n.endsWith(CHECKED));
    if (kept.length <= MAX_CHECKED_FILES) return;
    const written = kept.map((name) => ({ name, at: statSync(path.join(dir, name)).mtimeMs })).sort((a, b) => b.at - a.at);
    for (const { name } of written.slice(MAX_CHECKED_FILES)) rmSync(path.join(dir, name), { force: true });
  } catch {
    rmSync(temp, { force: true });
  }
}

/** The key of a run of the checks: the data's content key and whatever else the run reads that the data does not hold (the config). */
export const checkedKey = (contentKey: string, ...more: string[]): string => `${contentKey}-${hash(...more)}`;
