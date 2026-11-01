// LA-CHK-INV06: a check's query, and every other query of the data, runs in a database closed to everything outside
// it. A load seals DuckDB before its first query of the data: no file or URL is read or written, no extension comes
// in, no setting changes, and no setting shows the process's environment. Lathe's checks and coverage run as before.
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { DuckDBInstance } from '@duckdb/node-api';
import { sealDatabase } from '../../../src/checking/check/rules.ts';
import { LATHE_DATA_DIR, loadWorkspace, openStore, StoreError } from '../../../src/index.ts';
import { sqlString } from '../../../src/platform/data/schema.ts';
import { closeEngine } from '../../../src/platform/data/store.ts';
import { adding, build, complete, ofCheck, removeData } from '../../helpers.ts';

const temps: string[] = [];
const tempDir = () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'lathe-sandbox-'));
  temps.push(dir);
  return dir;
};
afterAll(() => {
  removeData();
  for (const dir of temps) rmSync(dir, { recursive: true, force: true });
});

const row = (name: string, position: number, query: string) => ({
  name, product_id: 'EX', position, severity: 'warning', summary: `The house rule ${name}.`, explanation: 'Made for this test. Fix what it reports.', query,
});

const closed = /file system operations are disabled by configuration/;

describe('a sealed database', () => {
  it("LA-CHK-INV06-T a product's check that reads a file or the settings runs sealed: it reads nothing outside, and Lathe's checks and coverage run as before", async () => {
    const reads = [
      row('reads-environment', 1, "SELECT NULL AS record, content AS message FROM read_text('/proc/self/environ')"),
      row('reads-file', 2, `SELECT NULL AS record, column0 AS message FROM read_csv(${sqlString(path.join(LATHE_DATA_DIR, 'check.jsonl'))})`),
      row('lists-files', 3, "SELECT NULL AS record, file AS message FROM glob('*')"),
      row('reads-url', 4, "SELECT NULL AS record, content AS message FROM read_text('https://example.com/')"),
      row('reads-settings', 5, `SELECT NULL AS record, name || '=' || value || '.' AS message FROM duckdb_settings()
WHERE name IN ('enable_external_access', 'lock_configuration', 'autoload_known_extensions', 'autoinstall_known_extensions', 'allow_community_extensions', 'http_proxy') ORDER BY name`),
    ];
    const plain = await build(complete(), { missing: ['src/dates.ts'] });
    const root = await build(adding(complete(), { check: reads }), { missing: ['src/dates.ts'] });
    const clean = await loadWorkspace(plain);
    // DuckDB reads its HTTP proxy, password and all, from the environment when the engine starts.
    await closeEngine();
    const proxy = process.env.HTTP_PROXY;
    process.env.HTTP_PROXY = 'http://someone:a-secret@proxy.invalid:3128';
    const ws = await loadWorkspace(root).finally(() => {
      if (proxy === undefined) delete process.env.HTTP_PROXY;
      else process.env.HTTP_PROXY = proxy;
    });
    for (const name of ['reads-environment', 'reads-file', 'lists-files', 'reads-url']) {
      expect(ofCheck(ws, name), name).toEqual([{ severity: 'error', check: name, record: null, message: expect.stringMatching(closed) }]);
      expect(ofCheck(ws, name)[0].message).toMatch(new RegExp(`^The check ${name} could not run: Permission Error`));
    }
    expect(ofCheck(ws, 'reads-settings').map((p) => p.message)).toEqual([
      'allow_community_extensions=false.',
      'autoinstall_known_extensions=false.',
      'autoload_known_extensions=false.',
      'enable_external_access=false.',
      'http_proxy=.',
      'lock_configuration=true.',
    ]);
    expect(JSON.stringify(ws.problems)).not.toContain('a-secret');
    // Lathe's checks report what they report without the product's checks, and coverage is the same.
    const product = new Set(reads.map((r) => r.name));
    expect(ws.problems.filter((p) => !product.has(p.check))).toEqual(clean.problems);
    expect(ofCheck(ws, 'technical-file-missing').length).toBeGreaterThan(0);
    expect(ws.coverage).toEqual(clean.coverage);
    expect(ws.chains).toEqual(clean.chains);
  });

  it('LA-CHK-INV06-T after a load, no statement on the data reaches a file or an extension, or changes a setting', async () => {
    const dir = tempDir();
    const store = await openStore(await build(complete()));
    const connection = await store.connect();
    try {
      const refused: [string, RegExp][] = [
        [`COPY (SELECT 42) TO ${sqlString(path.join(dir, 'out.csv'))}`, closed],
        [`COPY (SELECT 'export const x = 1;') TO ${sqlString(path.join(dir, 'out.js'))} (FORMAT csv, HEADER false, QUOTE '')`, closed],
        [`EXPORT DATABASE ${sqlString(path.join(dir, 'export'))}`, closed],
        ["SELECT content FROM read_text('/proc/self/environ')", closed],
        [`SELECT * FROM read_csv(${sqlString(path.join(LATHE_DATA_DIR, 'check.jsonl'))})`, closed],
        [`ATTACH ${sqlString(path.join(dir, 'other.duckdb'))} AS other`, closed],
        ['INSTALL httpfs', /Permission Error/],
        ['LOAD httpfs', /Loading external extensions is disabled through configuration/],
        [`LOAD ${sqlString(path.join(dir, 'x.duckdb_extension'))}`, /Loading external extensions is disabled through configuration/],
        ...[
          'enable_external_access = true',
          'lock_configuration = false',
          'autoload_known_extensions = true',
          'autoinstall_known_extensions = true',
          'allow_unsigned_extensions = true',
          'allow_community_extensions = true',
          "http_proxy = 'http://proxy.invalid'",
        ].flatMap((setting): [string, RegExp][] => [
          [`SET ${setting}`, /the configuration has been locked/],
          [`SET GLOBAL ${setting}`, /the configuration has been locked/],
          [`RESET ${setting.split(' ')[0]}`, /the configuration has been locked/],
        ]),
        ['PRAGMA enable_external_access = true', /the configuration has been locked/],
      ];
      for (const [sql, error] of refused) await expect(connection.run(sql), sql).rejects.toThrow(error);
      expect(existsSync(path.join(dir, 'out.csv'))).toBe(false);
      expect(existsSync(path.join(dir, 'out.js'))).toBe(false);
      expect(existsSync(path.join(dir, 'other.duckdb'))).toBe(false);
      // The data still reads as before.
      expect((await connection.runAndReadAll('SELECT count(*) AS n FROM domain')).getRowObjectsJson()).toEqual([{ n: '1' }]);
    } finally {
      connection.closeSync();
      await store.close();
    }
  });

  it('LA-CHK-INV06-T a database that cannot be sealed refuses, with check-query-sealed', async () => {
    const instance = await DuckDBInstance.create(':memory:');
    const connection = await instance.connect();
    try {
      // Locked before it is sealed: the seal cannot set what it needs.
      await connection.run('SET lock_configuration = true');
      const error = await sealDatabase(connection).then(() => null, (e: unknown) => e);
      expect(error).toBeInstanceOf(StoreError);
      expect((error as StoreError).problems).toEqual([{ rule: 'check-query-sealed', message: expect.stringMatching(/^the database cannot be sealed against files, URLs, extensions and its settings, so no query of the data runs: .*locked/) }]);
    } finally {
      connection.closeSync();
      instance.closeSync();
    }
  });

  it('LA-CHK-INV06-T a check row that hides a COPY after an escape string loads refused, and writes nothing', async () => {
    const dir = tempDir();
    const victim = path.join(dir, 'victim.js');
    writeFileSync(victim, 'export const original = 1;\n');
    // The reviewer's row: E'a\'' hid the ; from the old rule, and the COPY overwrote a .js file of the Lathe that ran it.
    const probe = row('review-probe', 1, `SELECT 'x' AS record, E'a\\'' AS message WHERE false; COPY (SELECT $$export const original = 666;$$) TO $$${victim}$$ (FORMAT csv, HEADER false, QUOTE $$$$); SELECT 'y' AS record, 'z' AS message WHERE false`);
    const root = await build(complete());
    writeFileSync(path.join(root, 'data', 'check.jsonl'), `${JSON.stringify(probe)}\n`);
    const ws = await loadWorkspace(root);
    expect(ws.records).toEqual([]);
    expect(ws.problems).toEqual([{
      severity: 'error',
      check: 'data-refused',
      record: null,
      message: "data/check.jsonl:1: check review-probe's query holds a statement that is not a SELECT, as DuckDB reads it; a check's query is one SELECT [check-query-select]",
    }]);
    expect(readFileSync(victim, 'utf8')).toBe('export const original = 1;\n');
  });
});
