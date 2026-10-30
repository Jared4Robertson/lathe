// The engine's load: the Workspace contract, records with their scope, check rows run in order, product kinds, and
// a load that reads the files afresh and writes nothing. Then the Tool Library, Lathe's worked example, checks clean.
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ADD_CHECK } from '../src/checking/check/commands/add-check.ts';
import { LATHE_DATA_DIR, loadWorkspace, openStore, PACKAGE_DIR, StoreError, tableText, type Row, type Workspace } from '../src/index.ts';
import { runCommand } from '../src/platform/commands/run.ts';
import { adding, build, complete, removeData } from './helpers.ts';

const temps: string[] = [];
const tempDir = () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'lathe-engine-'));
  temps.push(dir);
  return dir;
};
const listing = (dir: string) => readdirSync(dir, { recursive: true }).map(String).sort();

/** A Lathe data folder holding just these checks, in this order. */
async function checksFolder(checks: { name: string; query: string; severity?: string }[]): Promise<string> {
  const dir = tempDir();
  const store = await openStore(dir, { dataDir: path.join(dir, 'empty'), latheDataDir: null });
  const table = store.schema.tables.check;
  await store.close();
  const rows: Row[] = checks.map((c, i) => ({ name: c.name, position: i + 1, severity: c.severity ?? 'warning', summary: `The ${c.name} check.`, explanation: 'A check made for this test. Fix what it reports.', query: c.query }));
  mkdirSync(path.join(dir, 'data'));
  writeFileSync(path.join(dir, 'data', 'check.jsonl'), tableText(table, rows));
  return path.join(dir, 'data');
}

let root = '';
let ws: Workspace;
beforeAll(async () => {
  root = await build(complete());
  ws = await loadWorkspace(root);
});
afterAll(() => {
  removeData();
  for (const dir of temps) rmSync(dir, { recursive: true, force: true });
});

describe('checks', () => {
  it('LA-CHK-UC02-R01-T01 A new check needs only a new check row', async () => {
    const own = await build(adding(complete(), {
      check: [{
        name: 'every-loan-command', product_id: 'EX', position: 1, severity: 'warning',
        summary: 'A made-up check, added with no change to the engine.', explanation: 'It reports each command of the Loan aggregate. Remove it.',
        query: "SELECT c.id AS record, 'Command ' || c.id || ' changes a loan.' AS message FROM command c JOIN entity e ON e.id = c.entity_id WHERE e.aggregate_id = 'EX-LEND-A1' ORDER BY c.id",
      }],
    }));
    const loaded = await loadWorkspace(own);
    expect(loaded.problems).toEqual([
      { severity: 'warning', check: 'every-loan-command', record: 'EX-LEND-CMD01', message: 'Command EX-LEND-CMD01 changes a loan.' },
      { severity: 'warning', check: 'every-loan-command', record: 'EX-LEND-CMD03', message: 'Command EX-LEND-CMD03 changes a loan.' },
    ]);
  });

  it('LA-CHK-UC02-R02-T01 Checks can read every typed table and the engine\'s views, with file facts already computed', async () => {
    const checks = await checksFolder([{
      name: 'tables',
      query: `SELECT NULL AS record,
        (SELECT count(*) FROM record_id) || ' ' || (SELECT count(*) FROM link) || ' ' || (SELECT count(*) FROM test_run) || ' '
        || (SELECT count(*) FROM file_facts WHERE file_exists AND contains_id) || '/' || (SELECT count(*) FROM file_facts) || ' '
        || (SELECT count(*) FROM coverage_item) || ' ' || (SELECT count(DISTINCT kind) FROM test_level_allowed) AS message`,
    }]);
    const loaded = await loadWorkspace(root, { latheDataDir: checks });
    const files = loaded.records.filter((r) => typeof r.fields.file === 'string').length;
    const tests = loaded.records.filter((r) => r.kind.endsWith('_test')).length;
    expect(loaded.problems).toHaveLength(1);
    expect(loaded.problems[0].message).toBe(`${loaded.records.length} ${loaded.links.length} ${tests} ${files}/${files} 11 12`);
  });

  it('LA-CHK-UC02-R03-T01 Every check runs, in position order, even after one fails', async () => {
    const one = (name: string) => `SELECT NULL AS record, '${name} ran.' AS message`;
    const checks = await checksFolder([
      { name: 'first', query: one('first') },
      { name: 'broken', query: 'SELECT NULL AS record, NULL AS message FROM no_such_table' },
      { name: 'third', query: one('third') },
    ]);
    const loaded = await loadWorkspace(root, { latheDataDir: checks });
    expect(loaded.problems.map((p) => p.check)).toEqual(['first', 'broken', 'third']);
    expect(loaded.problems[1]).toMatchObject({ severity: 'error', record: null, message: expect.stringContaining('The check broken could not run') });
  });

  describe('LA-STD-CODE-R01-T01 a check is one row with one SELECT', () => {
    it("LA-CHK-INV04-T Each check is one SELECT query in its row, and Lathe's checks are named and placed in order", async () => {
      const store = await openStore(path.dirname(LATHE_DATA_DIR), { latheDataDir: null });
      const rows = store.rows('check');
      const kinds = new Set(Object.keys(store.schema.kinds));
      await store.close();
      expect(rows.length).toBeGreaterThan(0);
      expect(rows.map((r) => r.position).sort((a, b) => Number(a) - Number(b))).toEqual(rows.map((_, i) => i + 1));
      for (const row of rows) {
        const sql = String(row.query).trim();
        expect(sql, String(row.name)).toMatch(/^(SELECT|WITH)\b/);
        expect(row.product_id, String(row.name)).toBeUndefined();
        // One statement: no ';' outside string literals, except at the very end.
        const code = sql.replace(/'(?:[^']|'')*'/g, "''").replace(/;\s*$/, '');
        expect(code, String(row.name)).not.toContain(';');
        // Every kind a check names is one of Lathe's.
        for (const kind of (row.kinds as string[] | undefined) ?? []) expect(kinds.has(kind), `${String(row.name)}: ${kind}`).toBe(true);
      }
    });

    it("LA-CHK-INV04-T refuses a check whose query is not one SELECT returning record and message, or returns a severity its check's severity does not ask for, with check-query-select, changing no file", async () => {
      const store = await openStore(await build(complete()));
      const file = path.join(store.dataDir, 'check.jsonl');
      const read = () => (existsSync(file) ? readFileSync(file, 'utf8') : null);
      const before = read();
      const add = async (query: string, severity = 'warning') => {
        const error = await runCommand(store, ADD_CHECK, { name: 'house-rule', product_id: 'EX', position: 1, severity, summary: 'A house rule.', explanation: 'Made for this test. Fix what it reports.', query }).then(() => null, (e: unknown) => e);
        expect(error, query).toBeInstanceOf(StoreError);
        return (error as StoreError).problems.map((p) => [p.rule, p.message]);
      };
      try {
        expect(await add('DELETE FROM domain')).toEqual([
          ['check-query-select', "check house-rule's query starts with neither SELECT nor WITH; a check's query is one SELECT"],
          ['check-query-select', "check house-rule's query returns no record or message; a check's query returns record and message"],
        ]);
        expect(await add("SELECT NULL AS record, 'a;b' AS message; DROP TABLE domain")).toEqual([
          ['check-query-select', "check house-rule's query holds more than one statement; a check's query is one SELECT"],
        ]);
        expect(await add('SELECT NULL AS record WHERE false')).toEqual([
          ['check-query-select', "check house-rule's query returns no message; a check's query returns record and message"],
        ]);
        expect(await add("SELECT 'warning' AS severity, NULL AS record, NULL AS message")).toEqual([
          ['check-query-select', "check house-rule's query returns a severity, but the check's severity is warning; only an error_or_warning check returns one"],
        ]);
        expect(await add('SELECT NULL AS record, NULL AS message', 'error_or_warning')).toEqual([
          ['check-query-select', "check house-rule's severity is error_or_warning, so its query returns each row's severity (AS severity)"],
        ]);
      } finally {
        await store.close();
      }
      expect(read()).toBe(before);
    });
  });
});

describe('loading', () => {
  it('LA-PLT-UC01-R01-T01 loadWorkspace returns the Workspace contract', () => {
    expect(Object.keys(ws).sort()).toEqual(['chains', 'coverage', 'exceptions', 'kinds', 'links', 'problems', 'records', 'relations', 'stages']);
    expect(Object.keys(ws.chains[0]).sort()).toEqual(['build', 'design', 'files', 'links', 'obligation', 'tests']);
    expect(Object.keys(ws.kinds[0]).sort()).toEqual(['description', 'id_scope', 'kind', 'label', 'obligation', 'parent_kinds', 'position', 'required_fields', 'stage']);
    expect(ws.stages.map((s) => s.stage)).toEqual(['discovery', 'domain-model', 'use-cases', 'interaction-design', 'technical-specification', 'test-plan']);
    expect(Object.keys(ws.stages[0]).sort()).toEqual(['description', 'label', 'position', 'stage']);
    expect(Object.keys(ws.relations[0]).sort()).toEqual(['description', 'forward_label', 'relation', 'reverse_label', 'role', 'source_kind', 'target_kind']);
    expect(Object.keys(ws.records[0]).sort()).toEqual(['aggregate', 'domain', 'fields', 'id', 'kind', 'parent', 'parts', 'product', 'title']);
    expect(Object.keys(ws.links[0]).sort()).toEqual(['relation', 'source', 'target']);
    expect(Object.keys(ws.coverage[0]).sort()).toEqual(['domain', 'gaps', 'obligations', 'pattern_rules', 'product', 'proved_by', 'tests']);
    expect(Object.keys(ws.coverage[0].obligations[0]).sort()).toEqual(['built', 'designed', 'kind', 'label', 'not_automated', 'proof_only', 'proved', 'total']);
    expect(Object.keys(ws.coverage[0].tests).sort()).toEqual(['automated', 'manual', 'not_automated']);
    // Kinds come in kind order, stage by stage, with product and question outside the stages.
    expect(ws.kinds.slice(0, 3).map((k) => k.kind)).toEqual(['product', 'business_outcome', 'domain']);
    expect(ws.kinds.find((k) => k.kind === 'question')).toMatchObject({ stage: null, parent_kinds: ['product', 'domain'] });
    expect(ws.kinds.find((k) => k.kind === 'view')).toMatchObject({ stage: 'interaction-design', parent_kinds: [], id_scope: 'product', obligation: false });
    expect(ws.kinds.find((k) => k.kind === 'invariant')).toMatchObject({ stage: 'domain-model', obligation: true, required_fields: ['statement'] });
    // A record's typed columns and its parts come as stored.
    const entity = ws.records.find((r) => r.id === 'EX-LEND-EN01')!;
    expect(entity.fields).toMatchObject({ aggregate_id: 'EX-LEND-A1', role: 'root' });
    expect(entity.parts.entity_field).toHaveLength(3);
    // The result is plain JSON, as the app reads it from /api/spec.
    expect(JSON.parse(JSON.stringify(ws))).toEqual(ws);
  });

  it("LA-PLT-UC01-R02-T01 Each record's product, domain and aggregate come from its parents, or from its ID when it has no owner", () => {
    const at = (id: string) => ws.records.find((r) => r.id === id);
    expect(at('EX')).toMatchObject({ product: 'EX', domain: null, aggregate: null, parent: null });
    expect(at('EX-LEND')).toMatchObject({ product: 'EX', domain: 'EX-LEND', aggregate: null, parent: 'EX' });
    expect(at('EX-LEND-EN01-DM')).toMatchObject({ product: 'EX', domain: 'EX-LEND', aggregate: 'EX-LEND-A1', parent: 'EX-LEND-EN01' });
    expect(at('EX-LEND-UC01-R01-T01')).toMatchObject({ product: 'EX', domain: 'EX-LEND', aggregate: null, parent: 'EX-LEND-UC01-R01' });
    // A value object and a view have no owner: their product comes from their ID, a specification's domain too, and
    // the others' domain is the one domain that uses them (LA-PLT-UC01-R05), with what sits under them.
    expect(at('EX-VO01')).toMatchObject({ product: 'EX', domain: 'EX-LEND', parent: null });
    expect(at('EX-VO01-C01-T')).toMatchObject({ product: 'EX', domain: 'EX-LEND', parent: 'EX-VO01-C01' });
    expect(at('EX-V01')).toMatchObject({ product: 'EX', domain: 'EX-LEND', parent: null });
    expect(at('EX-LEND-SP01')).toMatchObject({ product: 'EX', domain: 'EX-LEND', parent: null });
    // An endpoint sits under the one of its two parent columns that holds a value.
    expect(at('EX-LEND-EP01')).toMatchObject({ parent: 'EX-LEND-CMD01', aggregate: 'EX-LEND-A1' });
  });

  it('LA-CHK-UC01-R04-T01 A product whose data the store refuses loads no records, and each refusal is a data-refused error', async () => {
    const broken = await build(complete());
    const file = path.join(broken, 'data', 'command.jsonl');
    writeFileSync(file, readFileSync(file, 'utf8').replace('"entity_id":"EX-LEND-EN03"', '"entity_id":"EX-LEND-EN09"'));
    const loaded = await loadWorkspace(broken);
    expect(loaded.records).toEqual([]);
    expect(loaded.stages).toEqual([]);
    expect(loaded.problems.length).toBeGreaterThan(0);
    expect(loaded.problems.every((p) => p.check === 'data-refused' && p.severity === 'error')).toBe(true);
    expect(loaded.problems.map((p) => p.message).join('\n')).toContain('EX-LEND-EN09');
  });

  /** The complete product with a kind of its own, memo, and one memo. */
  const withMemo = () =>
    build(adding(complete(), {
      product_kind: [{ name: 'memo', product_id: 'EX', label: 'Memo', description: 'A short note.', parent_kind: 'domain', stage: 'use-cases', obligation: false }],
      memo: [{ id: 'EX-LEND-M01', title: 'A memo', domain_id: 'EX-LEND' }],
    }));

  it("LA-AUT-UC04-R01-T01 A product's own kind takes effect on the next load, with its own table and stage", async () => {
    const added = await loadWorkspace(await withMemo());
    expect(added.kinds.at(-1)).toMatchObject({ kind: 'memo', stage: 'use-cases', position: null, id_scope: null, parent_kinds: ['domain'] });
    expect(added.records.find((r) => r.id === 'EX-LEND-M01')).toMatchObject({ kind: 'memo', parent: 'EX-LEND', domain: 'EX-LEND' });
    expect(added.problems).toEqual([]);
  });

  it("LA-PLT-UC02-R03-T01 A product's own kind is a row of its own data, adding a table for that product only", async () => {
    const own = await openStore(await withMemo());
    expect(own.rows('product_kind').map((r) => r.name)).toContain('memo');
    expect(own.schema.tables.memo).toBeDefined();
    await own.close();
    const plain = await openStore(root);
    expect(plain.schema.tables.memo).toBeUndefined();
    await plain.close();
  });

  it('LA-AUT-UC03-R02-T01 Removing a kind while a record of it is left is refused, since its rows would have no table', async () => {
    const again = await openStore(await withMemo());
    await expect(again.remove('product_kind', { name: 'memo' })).rejects.toThrow(/memo/);
    await again.close();
  });

  it('LA-PLT-UC01-R04-T01 Each load reads the files afresh and writes nothing', async () => {
    const fresh = await build(complete());
    const before = listing(fresh);
    const first = await loadWorkspace(fresh);
    expect(first.records.find((r) => r.id === 'EX-LEND-UC01')?.title).toBe('Borrow a tool');
    expect(listing(fresh)).toEqual(before);

    const store = await openStore(fresh);
    await store.set('use_case', 'EX-LEND-UC01', { title: 'Borrow a tool for a week' });
    await store.close();
    const second = await loadWorkspace(fresh);
    expect(second.records.find((r) => r.id === 'EX-LEND-UC01')?.title).toBe('Borrow a tool for a week');
    expect(listing(fresh)).toEqual(before);
    // The earlier result is a separate object, untouched by the second load.
    expect(first.records.find((r) => r.id === 'EX-LEND-UC01')?.title).toBe('Borrow a tool');
  });
});

describe('the Tool Library', () => {
  it('LA-TRC-UC07-R05-T03 checks with no errors, and every obligation it has is designed and proved, its pattern rules for proof alone', async () => {
    const tl = await loadWorkspace(path.join(PACKAGE_DIR, '..', 'examples', 'tool-library'));
    expect(tl.problems.filter((p) => p.severity === 'error')).toEqual([]);
    const lending = tl.coverage.find((c) => c.domain === 'TL-LEND')!;
    for (const o of lending.obligations) expect(o.designed, o.kind).toBe(o.total);
    expect(lending.obligations.find((o) => o.kind === 'pattern_rule')).toMatchObject({ total: 3, proved: 3, proof_only: true });
  });
});
