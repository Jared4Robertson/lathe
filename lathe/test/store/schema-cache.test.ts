// The schema cache (LA-PLT-UC01-R11): a process attaches the migrated schema from a cache file instead of running the
// migrations, and the result is the same as a schema built afresh. A stale or corrupt file is never used: it is
// replaced by a schema built afresh. Two processes that start at once with no cache both load, and leave whole files.
import { execFile } from 'node:child_process';
import { mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { DuckDBInstance } from '@duckdb/node-api';
import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { readMigrations, type Migration } from '../../src/index.ts';
import { baseKey } from '../../src/platform/data/cache.ts';
import { closeEngine, openStore } from '../../src/platform/data/store.ts';
import { everyKind, removeData, writeData } from './fixture.ts';

const run = promisify(execFile);
const root = writeData(everyKind());
const dirs: string[] = [];
const cacheFolder = () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'lathe-cache-'));
  dirs.push(dir);
  return dir;
};
const before = process.env.LATHE_CACHE_DIR;

afterEach(async () => {
  await closeEngine();
  if (before === undefined) delete process.env.LATHE_CACHE_DIR;
  else process.env.LATHE_CACHE_DIR = before;
});
afterAll(() => {
  removeData();
  for (const dir of dirs) rmSync(dir, { recursive: true, force: true });
});

/** Opens the fixture with the engine started afresh on the cache folder, and returns what the store holds. */
async function load(dir: string) {
  await closeEngine();
  process.env.LATHE_CACHE_DIR = dir;
  const store = await openStore(root);
  try {
    return {
      schema: store.schema,
      placements: await store.placements(),
      parents: await store.query('SELECT * FROM record_parent ORDER BY id'),
      tables: await store.query("SELECT schema_name, table_name FROM duckdb_tables() WHERE database_name = current_database() ORDER BY ALL"),
    };
  } finally {
    await store.close();
    // Waits for the cache files to be written.
    await closeEngine();
  }
}

// A folder that can never be made (it sits under a file), so nothing is cached: the schema is built afresh.
const uncached = () => path.join(writeFileAt(cacheFolder(), 'file'), 'cache');
function writeFileAt(dir: string, name: string): string {
  writeFileSync(path.join(dir, name), '');
  return path.join(dir, name);
}

const baseFile = (dir: string) => path.join(dir, `${baseKey(readMigrations())}.duckdb`);
const files = (dir: string) => readdirSync(dir).sort();
const stamp = (file: string) => {
  const s = statSync(file);
  return `${s.ino} ${s.mtimeMs}`;
};

const fresh = await load(uncached());

describe('the schema cache', () => {
  it('LA-PLT-UC01-R11-T01 A cached schema gives what one built afresh gives, and is used without being built again', async () => {
    const dir = cacheFolder();
    // The first process builds the schema and caches Lathe's and the product's (the fixture declares a kind).
    expect(await load(dir)).toEqual(fresh);
    const cached = files(dir);
    expect(cached).toHaveLength(2);
    expect(cached.every((f) => f.endsWith('.duckdb'))).toBe(true);
    const was = cached.map((f) => stamp(path.join(dir, f)));
    // The next attaches both files, and gives the same schema, rows and tables (no trace of the cache's stamp).
    expect(await load(dir)).toEqual(fresh);
    expect(files(dir)).toEqual(cached);
    expect(cached.map((f) => stamp(path.join(dir, f)))).toEqual(was);
  });

  it('LA-PLT-UC01-R11-T01 A stale cache file is never used: a change to a migration changes the key, and a file whose stamp names another key is built afresh', async () => {
    const migrations = readMigrations();
    const changed: Migration[] = migrations.map((m, i) => (i === migrations.length - 1 ? { ...m, sql: `${m.sql}\n-- changed` } : m));
    expect(baseKey(changed)).not.toBe(baseKey(migrations));

    const dir = cacheFolder();
    await load(dir);
    // Each file (Lathe's schema and the product's), altered to say another schema under another key: were one used,
    // the store's schema would show it.
    for (const name of files(dir)) {
      const instance = await DuckDBInstance.create(path.join(dir, name));
      const connection = await instance.connect();
      const [{ schema }] = (await connection.runAndReadAll('SELECT schema FROM lathe_cache.stamp')).getRowObjectsJson() as { schema: string }[];
      const altered = JSON.parse(schema);
      altered.tables.domain.description = 'stale';
      await connection.run(`UPDATE lathe_cache.stamp SET key = 'another', schema = '${JSON.stringify(altered).replace(/'/g, "''")}'`);
      await connection.run('CHECKPOINT');
      connection.closeSync();
      instance.closeSync();
    }

    // A file of an older base schema, which this Lathe never reads.
    writeFileSync(path.join(dir, '0123456789abcdef0123456789abcdef.duckdb'), 'an older schema');

    expect(await load(dir)).toEqual(fresh);
    // They were replaced by whole files of the right keys, which the next process uses as they are; writing the base
    // removed the older base's file.
    expect(files(dir)).toHaveLength(2);
    const was = files(dir).map((f) => stamp(path.join(dir, f)));
    expect(await load(dir)).toEqual(fresh);
    expect(files(dir).map((f) => stamp(path.join(dir, f)))).toEqual(was);
  });

  it('LA-PLT-UC01-R11-T01 A corrupt cache file, garbage or cut short, is never used: the schema is built afresh and cached again', async () => {
    const dir = cacheFolder();
    await load(dir);
    const file = baseFile(dir);
    const whole = readFileSync(file);
    for (const broken of [Buffer.from('not a database'), whole.subarray(0, Math.floor(whole.length / 3))]) {
      writeFileSync(file, broken);
      expect(await load(dir)).toEqual(fresh);
      expect(statSync(file).size).toBe(whole.length);
    }
    // A product's file, too.
    const product = files(dir).find((f) => f !== path.basename(file))!;
    writeFileSync(path.join(dir, product), 'not a database');
    expect(await load(dir)).toEqual(fresh);
    expect(statSync(path.join(dir, product)).size).toBeGreaterThan(1000);
  });

  it('LA-PLT-UC01-R11-T01 Two processes starting at once with no cache both load the same, and leave only whole files', async () => {
    const dir = cacheFolder();
    const index = path.resolve(import.meta.dirname, '../../src/index.ts');
    const script = `import { openStore } from ${JSON.stringify(index)};
const store = await openStore(${JSON.stringify(root)});
console.log(JSON.stringify({ tables: Object.keys(store.schema.tables).length, placements: await store.placements() }));
await store.close();`;
    const start = () => run(process.execPath, ['--input-type=module', '-e', script], { env: { ...process.env, LATHE_CACHE_DIR: dir } });
    const [a, b] = await Promise.all([start(), start()]);
    const expected = JSON.stringify({ tables: Object.keys(fresh.schema.tables).length, placements: fresh.placements });
    expect(a.stdout.trim()).toBe(expected);
    expect(b.stdout.trim()).toBe(expected);
    // Each wrote its own file and renamed it into place: no half-written file is left, and the files serve the next.
    const cached = files(dir);
    expect(cached).toHaveLength(2);
    expect(cached.every((f) => f.endsWith('.duckdb'))).toBe(true);
    const was = cached.map((f) => stamp(path.join(dir, f)));
    expect(await load(dir)).toEqual(fresh);
    expect(cached.map((f) => stamp(path.join(dir, f)))).toEqual(was);
  });
});
