// The engine's load: the Workspace contract, records with their scope, check rows run in order, product kinds, and
// a load that reads the files afresh and writes nothing. Then the Tool Library, Lathe's worked example, checks clean.
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { LATHE_DATA_DIR, loadWorkspace, openStore, PACKAGE_DIR, tableText, type Row, type Workspace } from '../src/index.ts';
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
  it('LA-CHK-T05 A new check needs only a new check row', async () => {
    const own = await build(adding(complete(), {
      check: [{
        name: 'every-loan-command', product_id: 'EX', position: 1, severity: 'warning',
        summary: 'A made-up check, added with no change to the engine.', explanation: 'It reports each command of the Loan aggregate. Remove it.',
        query: "SELECT id AS record, 'Command ' || id || ' changes a loan.' AS message FROM command WHERE aggregate_id = 'EX-LEND-A1' ORDER BY id",
      }],
    }));
    const loaded = await loadWorkspace(own);
    expect(loaded.problems).toEqual([
      { severity: 'warning', check: 'every-loan-command', record: 'EX-LEND-CMD01', message: 'Command EX-LEND-CMD01 changes a loan.' },
      { severity: 'warning', check: 'every-loan-command', record: 'EX-LEND-CMD03', message: 'Command EX-LEND-CMD03 changes a loan.' },
    ]);
  });

  it('LA-CHK-T06 Checks can read every typed table and the engine\'s views, with file facts already computed', async () => {
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
    expect(loaded.problems[0].message).toBe(`${loaded.records.length} ${loaded.links.length} ${tests} ${files}/${files} 11 11`);
  });

  it('LA-CHK-T07 Every check runs, in position order, even after one fails', async () => {
    const one = (name: string) => `SELECT NULL AS record, '${name} ran.' AS message`;
    const checks = await checksFolder([
      { name: 'first', query: one('first') },
      { name: 'broken', query: 'SELECT * FROM no_such_table' },
      { name: 'third', query: one('third') },
    ]);
    const loaded = await loadWorkspace(root, { latheDataDir: checks });
    expect(loaded.problems.map((p) => p.check)).toEqual(['first', 'broken', 'third']);
    expect(loaded.problems[1]).toMatchObject({ severity: 'error', record: null, message: expect.stringContaining('The check broken could not run') });
  });

  it("LA-CHK-T08 Each check is one SELECT query in its row, and Lathe's checks are named and placed in order", async () => {
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
});

describe('loading', () => {
  it('LA-PLT-T03 loadWorkspace returns the Workspace contract', () => {
    expect(Object.keys(ws).sort()).toEqual(['coverage', 'kinds', 'links', 'problems', 'records', 'relations', 'stages']);
    expect(Object.keys(ws.kinds[0]).sort()).toEqual(['description', 'id_scope', 'kind', 'label', 'obligation', 'parent_kinds', 'position', 'required_fields', 'stage']);
    expect(ws.stages.map((s) => s.stage)).toEqual(['domain-model', 'use-cases', 'interaction-design', 'technical-specification', 'test-plan']);
    expect(Object.keys(ws.stages[0]).sort()).toEqual(['description', 'label', 'position', 'stage']);
    expect(Object.keys(ws.relations[0]).sort()).toEqual(['description', 'forward_label', 'relation', 'reverse_label', 'role', 'source_kind', 'target_kind']);
    expect(Object.keys(ws.records[0]).sort()).toEqual(['aggregate', 'domain', 'fields', 'id', 'kind', 'parent', 'parts', 'product', 'title']);
    expect(Object.keys(ws.links[0]).sort()).toEqual(['relation', 'source', 'target']);
    expect(Object.keys(ws.coverage[0]).sort()).toEqual(['domain', 'gaps', 'obligations', 'product', 'tests']);
    expect(Object.keys(ws.coverage[0].obligations[0]).sort()).toEqual(['built', 'designed', 'kind', 'label', 'not_automated', 'proof_only', 'proved', 'total']);
    expect(Object.keys(ws.coverage[0].tests).sort()).toEqual(['automated', 'manual', 'not_automated']);
    // Kinds come in kind order, stage by stage, with product and question outside the stages.
    expect(ws.kinds.slice(0, 3).map((k) => k.kind)).toEqual(['product', 'domain', 'aggregate']);
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

  it("LA-PLT-T04 Each record's product, domain and aggregate come from its parents, or from its ID when it has no owner", () => {
    const at = (id: string) => ws.records.find((r) => r.id === id);
    expect(at('EX')).toMatchObject({ product: 'EX', domain: null, aggregate: null, parent: null });
    expect(at('EX-LEND')).toMatchObject({ product: 'EX', domain: 'EX-LEND', aggregate: null, parent: 'EX' });
    expect(at('EX-LEND-EN01-DM')).toMatchObject({ product: 'EX', domain: 'EX-LEND', aggregate: 'EX-LEND-A1', parent: 'EX-LEND-EN01' });
    expect(at('EX-LEND-UC01-R01-T01')).toMatchObject({ product: 'EX', domain: 'EX-LEND', aggregate: null, parent: 'EX-LEND-UC01-R01' });
    // A value object, a view and a UI component have no owner: their product comes from their ID, and a specification's domain too.
    expect(at('EX-VO01')).toMatchObject({ product: 'EX', domain: null, parent: null });
    expect(at('EX-VO01-C01-T')).toMatchObject({ product: 'EX', domain: null, parent: 'EX-VO01-C01' });
    expect(at('EX-V01')).toMatchObject({ product: 'EX', domain: null, parent: null });
    expect(at('EX-LEND-SP01')).toMatchObject({ product: 'EX', domain: 'EX-LEND', parent: null });
    // An endpoint sits under the one of its two parent columns that holds a value.
    expect(at('EX-LEND-EP01')).toMatchObject({ parent: 'EX-LEND-CMD01', aggregate: 'EX-LEND-A1' });
  });

  it('A product whose data the store refuses loads no records, and each refusal is a data-refused error', async () => {
    const broken = await build(complete());
    const file = path.join(broken, 'data', 'command.jsonl');
    writeFileSync(file, readFileSync(file, 'utf8').replace('"aggregate_id":"EX-LEND-A2"', '"aggregate_id":"EX-LEND-A9"'));
    const loaded = await loadWorkspace(broken);
    expect(loaded.records).toEqual([]);
    expect(loaded.stages).toEqual([]);
    expect(loaded.problems.length).toBeGreaterThan(0);
    expect(loaded.problems.every((p) => p.check === 'data-refused' && p.severity === 'error')).toBe(true);
    expect(loaded.problems.map((p) => p.message).join('\n')).toContain('EX-LEND-A9');
  });

  it("LA-AUT-T18 A product's own kind takes effect on the next load, with its own table and stage", async () => {
    const own = await build(adding(complete(), {
      product_kind: [{ name: 'memo', product_id: 'EX', label: 'Memo', description: 'A short note.', parent_kind: 'domain', stage: 'use-cases', obligation: false }],
      memo: [{ id: 'EX-LEND-M01', title: 'A memo', domain_id: 'EX-LEND' }],
    }));
    const added = await loadWorkspace(own);
    expect(added.kinds.at(-1)).toMatchObject({ kind: 'memo', stage: 'use-cases', position: null, id_scope: null, parent_kinds: ['domain'] });
    expect(added.records.find((r) => r.id === 'EX-LEND-M01')).toMatchObject({ kind: 'memo', parent: 'EX-LEND', domain: 'EX-LEND' });
    expect(added.problems).toEqual([]);

    // Removing the kind while a memo is left is refused: the memo's rows have no table.
    const again = await openStore(own);
    await expect(again.remove('product_kind', { name: 'memo' })).rejects.toThrow(/memo/);
    await again.close();
  });

  it('LA-PLT-T05 Each load reads the files afresh and writes nothing', async () => {
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
  it('checks with no errors, and every obligation it has is designed and proved', async () => {
    const tl = await loadWorkspace(path.join(PACKAGE_DIR, '..', 'examples', 'tool-library'));
    expect(tl.problems.filter((p) => p.severity === 'error')).toEqual([]);
    const lending = tl.coverage.find((c) => c.domain === 'TL-LEND')!;
    for (const o of lending.obligations) expect(o.designed, o.kind).toBe(o.total);
    expect(lending.obligations.find((o) => o.kind === 'pattern_rule')).toMatchObject({ total: 3, proved: 3, proof_only: true });
  });
});
