// The validated-build stamps (LA-PLT-UC01-R17): a load of data files whose whole build passed, exactly as they are,
// reads their rows without building them again, and answers as the whole build does; a changed file is built whole
// and refused as before, and a stamp that does not name its key is never used.
import { execFile } from 'node:child_process';
import { appendFileSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { StoreError } from '../../src/platform/data/problems.ts';
import { closeEngine, openStore } from '../../src/platform/data/store.ts';
import { everyKind, removeData, writeData } from './fixture.ts';

const exec = promisify(execFile);
const dirs: string[] = [];
const cacheFolder = () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'lathe-validated-'));
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

const stamps = (dir: string) => readdirSync(dir).filter((f) => f.endsWith('.validated')).sort();

/** Opens the product with the engine started afresh on the cache folder: what the store holds, whether it was built whole, and its refusal. */
async function load(root: string, dir: string) {
  await closeEngine();
  process.env.LATHE_CACHE_DIR = dir;
  const steps: Record<string, number> = {};
  let store;
  try {
    store = await openStore(root, { steps });
  } catch (error) {
    if (error instanceof StoreError) return { refused: error.problems, built: 'commit' in steps };
    throw error;
  }
  try {
    // Built whole at the load, or not yet: the 'commit' step is the whole build's.
    const built = 'commit' in steps;
    const tables = Object.fromEntries(Object.values(store.schema.tables).filter((t) => t.stored).map((t) => [t.name, store.rows(t.name)]));
    return {
      built,
      schema: store.schema,
      tables,
      record: store.record('TL-LEND-UC01'),
      origin: store.origin(store.rows('use_case')[0]),
      // SQL builds the database when the load did not.
      scope: await store.query('SELECT id, product_id, domain_id FROM record_scope ORDER BY id'),
    };
  } finally {
    await store.close();
    await closeEngine();
  }
}

describe('validated builds', () => {
  it('LA-PLT-UC01-R17-T01 Files a whole build passed load without building again, and answer exactly as the whole build does', async () => {
    const root = writeData(everyKind());
    const dir = cacheFolder();
    const whole = await load(root, dir);
    expect(whole.built).toBe(true);
    expect(stamps(dir)).toHaveLength(1);
    const cached = await load(root, dir);
    expect(cached.built).toBe(false);
    expect({ ...cached, built: true }).toEqual(whole);
    expect(stamps(dir)).toHaveLength(1);
  });

  it('LA-PLT-UC01-R17-T01 A changed file is built whole: refused as before when it breaks a rule, and stamped anew when it passes', async () => {
    const root = writeData(everyKind());
    const dir = cacheFolder();
    await load(root, dir);
    const file = path.join(root, 'data', 'domain.jsonl');
    const text = readFileSync(file, 'utf8');

    // A domain whose product is not there: refused with exactly the problems an uncached load gives, and stamped never.
    appendFileSync(file, `${JSON.stringify({ id: 'TL-SHIP', title: 'Shipping', product_id: 'XX', position: 1, subdomain_type: 'supporting', description: 'Sending tools.' })}\n`);
    const refused = await load(root, dir);
    expect(refused.refused?.length).toBeGreaterThan(0);
    expect(refused).toEqual(await load(root, cacheFolder()));
    expect(await load(root, dir)).toEqual(refused);
    expect(stamps(dir)).toHaveLength(1);

    // Back as it was: the old stamp serves it again.
    writeFileSync(file, text);
    expect((await load(root, dir)).built).toBe(false);

    // A change that passes: built whole once, then served by its own stamp.
    writeFileSync(file, text.replace('Lending tools to members', 'Lending tools to neighbors'));
    expect((await load(root, dir)).built).toBe(true);
    expect(stamps(dir)).toHaveLength(2);
    expect((await load(root, dir)).built).toBe(false);
  });

  it('LA-PLT-UC01-R17-T01 A stamp that does not name its key, garbage or empty, is never used: the files are built whole and stamped again', async () => {
    const root = writeData(everyKind());
    const dir = cacheFolder();
    const whole = await load(root, dir);
    const [name] = stamps(dir);
    const key = readFileSync(path.join(dir, name), 'utf8');
    for (const broken of ['not a key', '']) {
      writeFileSync(path.join(dir, name), broken);
      expect(await load(root, dir)).toEqual(whole);
      expect(readFileSync(path.join(dir, name), 'utf8')).toBe(key);
    }
  });

  it('LA-PLT-UC01-R17-T01 A cold CLI command answers and refuses as the whole build does', async () => {
    const root = writeData(everyKind());
    const dir = cacheFolder();
    const bin = path.resolve(import.meta.dirname, '../../bin/lathe.ts');
    const cli = async (cache: string) => {
      const args = [bin, 'use-case', 'get-use-case', '--id', 'TL-LEND-UC01', '--root', root];
      try {
        const { stdout, stderr } = await exec(process.execPath, args, { env: { ...process.env, LATHE_CACHE_DIR: cache } });
        return { code: 0, stdout, stderr };
      } catch (error) {
        const { code, stdout, stderr } = error as { code: number; stdout: string; stderr: string };
        return { code, stdout, stderr };
      }
    };
    const whole = await cli(dir);
    expect(whole.code).toBe(0);
    expect(whole.stdout).toContain('TL-LEND-UC01');
    expect(stamps(dir)).toHaveLength(1);
    expect(await cli(dir)).toEqual(whole);

    appendFileSync(path.join(root, 'data', 'use_case.jsonl'), `${JSON.stringify({ id: 'TL-LEND-UC02', title: 'Return a tool', capability_id: 'TL-NONE', goal: 'Bring it back.' })}\n`);
    const refused = await cli(dir);
    expect(refused.code).not.toBe(0);
    expect(refused).toEqual(await cli(cacheFolder()));
  }, 30_000);
});
