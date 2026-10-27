// Engine behavior that needs its own temporary folders: adding checks, adding kinds, and rebuilding the workspace
// on every load.
import { cpSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { LATHE_DATA_DIR, loadWorkspace, openStore, PACKAGE_DIR, tableText, type Row } from '../src/index.ts';
import { fixture } from './helpers.ts';

const temps: string[] = [];
const tempDir = () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'lathe-engine-'));
  temps.push(dir);
  return dir;
};
const copyOf = (name: string) => {
  const dir = tempDir();
  cpSync(fixture(name), dir, { recursive: true });
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

afterAll(() => {
  for (const dir of temps) rmSync(dir, { recursive: true, force: true });
});

describe('checks', () => {
  it('LA-CHK-T05 A new check needs only a new check row', async () => {
    const root = copyOf('good');
    const store = await openStore(root);
    await store.add('check', {
      name: 'every-note-use-case', product_id: 'EX', position: 1, severity: 'warning',
      summary: 'A made-up check, added with no change to the engine.', explanation: 'It reports each use case in the notes domain. Remove it.',
      query: "SELECT id AS record, 'Record ' || id || ' is in the notes domain.' AS message FROM use_case WHERE domain_id = 'EX-NOTE'",
    });
    await store.close();
    const ws = await loadWorkspace(root);
    expect(ws.problems).toEqual([
      { severity: 'warning', check: 'every-note-use-case', record: 'EX-NOTE-UC01', message: 'Record EX-NOTE-UC01 is in the notes domain.' },
    ]);
  });

  it('LA-CHK-T06 Checks can read every typed table, with file facts already computed', async () => {
    const checks = await checksFolder([{
      name: 'tables',
      query: `SELECT NULL AS record,
        (SELECT count(*) FROM record_id) || ' ' || (SELECT count(*) FROM link) || ' ' || (SELECT count(*) FROM test) || ' '
        || ((SELECT count(*) FROM meta_kind) > 0) || ' ' || ((SELECT count(*) FROM meta_relation) > 0) || ' '
        || (SELECT string_agg(record || ':' || file_exists || ':' || coalesce(contains_id::VARCHAR, '-'), ',' ORDER BY record) FROM file_facts) AS message`,
    }]);
    const ws = await loadWorkspace(fixture('good'), { latheDataDir: checks });
    expect(ws.problems).toHaveLength(1);
    expect(ws.problems[0].message).toBe(`${ws.records.length} ${ws.links.length} 1 true true EX-NOTE-C01:true:-,EX-NOTE-T01:true:true`);
  });

  it('LA-CHK-T07 Every check runs, in position order, even after one fails', async () => {
    const one = (name: string) => `SELECT NULL AS record, '${name} ran.' AS message`;
    const checks = await checksFolder([
      { name: 'first', query: one('first') },
      { name: 'broken', query: 'SELECT * FROM no_such_table' },
      { name: 'third', query: one('third') },
    ]);
    const ws = await loadWorkspace(fixture('good'), { latheDataDir: checks });
    expect(ws.problems.map((p) => p.check)).toEqual(['first', 'broken', 'third']);
    expect(ws.problems[1]).toMatchObject({ severity: 'error', record: null, message: expect.stringContaining('The check broken could not run') });
  });

  it("LA-CHK-T08 Each check is one SELECT query in its row, and Lathe's checks are named and placed in order", async () => {
    const store = await openStore(path.dirname(LATHE_DATA_DIR), { latheDataDir: null });
    const rows = store.rows('check');
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
    }
  });
});

describe('loading', () => {
  it('LA-PLT-T03 loadWorkspace returns the Workspace contract', async () => {
    const ws = await loadWorkspace(fixture('unfinished'));
    expect(Object.keys(ws).sort()).toEqual(['coverage', 'kinds', 'links', 'problems', 'records', 'relations', 'sections']);
    expect(Object.keys(ws.kinds[0]).sort()).toEqual(['description', 'kind', 'label', 'obligation', 'parent_kinds', 'proof_only', 'required_fields', 'section', 'stage']);
    expect(Object.keys(ws.sections[0]).sort()).toEqual(['description', 'label', 'order', 'section', 'stage']);
    expect(Object.keys(ws.relations[0]).sort()).toEqual(['description', 'forward_label', 'relation', 'reverse_label', 'role', 'source_kind', 'target_kind']);
    expect(Object.keys(ws.records[0]).sort()).toEqual(['domain', 'fields', 'id', 'kind', 'parent', 'parts', 'product', 'title']);
    expect(Object.keys(ws.links[0]).sort()).toEqual(['relation', 'source', 'target']);
    expect(Object.keys(ws.problems[0]).sort()).toEqual(['check', 'message', 'record', 'severity']);
    expect(Object.keys(ws.coverage[0]).sort()).toEqual(['domain', 'gaps', 'obligations', 'tests']);
    expect(Object.keys(ws.coverage[0].obligations[0]).sort()).toEqual(['built', 'designed', 'kind', 'label', 'planned', 'planned_any', 'proved', 'total']);
    expect(Object.keys(ws.coverage[0].gaps[0]).sort()).toEqual(['id', 'kind', 'missing']);
    // A record's typed columns and its parts come as stored.
    const requirement = ws.records.find((r) => r.kind === 'requirement')!;
    expect(typeof requirement.fields.statement).toBe('string');
    // The result is plain JSON, as the app reads it from /api/spec.
    expect(JSON.parse(JSON.stringify(ws))).toEqual(ws);
    // The sample workspace the app falls back to is the good fixture's, as the engine returns it today.
    const sample = JSON.parse(readFileSync(path.join(PACKAGE_DIR, 'fixtures', 'workspace.sample.json'), 'utf8'));
    expect(sample).toEqual(await loadWorkspace(fixture('good')));
  });

  it("LA-PLT-T04 Each record's product and domain come from its parents, and refused data is a data-refused error", async () => {
    const good = await loadWorkspace(fixture('good'));
    const at = (id: string) => good.records.find((r) => r.id === id);
    expect(at('EX')).toMatchObject({ product: 'EX', domain: null, parent: null });
    expect(at('EX-NOTE')).toMatchObject({ product: 'EX', domain: 'EX-NOTE', parent: 'EX' });
    expect(at('EX-NOTE-UC01-R01')).toMatchObject({ product: 'EX', domain: 'EX-NOTE', parent: 'EX-NOTE-UC01' });
    expect(at('EX-NOTE-DR01')).toMatchObject({ product: 'EX', domain: 'EX-NOTE' });

    // A parent loop cannot be stored: a layer inside itself through another layer is refused when the data loads.
    const root = copyOf('good');
    const store = await openStore(root);
    await store.apply([
      { op: 'add', table: 'layer', row: { id: 'EX-NOTE-LAY01', title: 'Outer', domain_id: 'EX-NOTE', position: 1 } },
      { op: 'add', table: 'layer', row: { id: 'EX-NOTE-LAY02', title: 'Inner', domain_id: 'EX-NOTE', parent_layer_id: 'EX-NOTE-LAY01', position: 1 } },
    ]);
    await store.close();
    const file = path.join(root, 'data', 'layer.jsonl');
    writeFileSync(file, readFileSync(file, 'utf8').replace('"title":"Outer","domain_id":"EX-NOTE"', '"title":"Outer","domain_id":"EX-NOTE","parent_layer_id":"EX-NOTE-LAY02"'));
    const broken = await loadWorkspace(root);
    expect(broken.records).toEqual([]);
    expect(broken.problems.length).toBeGreaterThan(0);
    expect(broken.problems.every((p) => p.check === 'data-refused' && p.severity === 'error')).toBe(true);
    expect(broken.problems.map((p) => p.message).join('\n')).toMatch(/cycle/);
  });

  it("LA-AUT-T18 A product's own kind takes effect on the next load, with its own table", async () => {
    const root = copyOf('good');
    const store = await openStore(root);
    await store.apply([
      { op: 'add', table: 'product_kind', row: { name: 'memo', product_id: 'EX', label: 'Memo', description: 'A short note.', parent_kind: 'domain', obligation: 'none' } },
      { op: 'add', table: 'memo', row: { id: 'EX-NOTE-M01', title: 'A memo', domain_id: 'EX-NOTE' } },
    ]);
    await store.close();
    const added = await loadWorkspace(root);
    expect(added.kinds.map((k) => k.kind)).toContain('memo');
    expect(added.records.find((r) => r.id === 'EX-NOTE-M01')).toMatchObject({ kind: 'memo', parent: 'EX-NOTE', domain: 'EX-NOTE' });
    expect(added.problems.filter((p) => p.severity === 'error')).toEqual([]);

    // Removing the kind while a memo is left is refused: the memo's rows have no table.
    const again = await openStore(root);
    await expect(again.remove('product_kind', { name: 'memo' })).rejects.toThrow(/memo/);
    await again.close();
  });

  it('LA-PLT-T05 Each load reads the files afresh and writes nothing', async () => {
    const root = copyOf('good');
    const before = listing(root);
    const first = await loadWorkspace(root);
    expect(first.records.find((r) => r.id === 'EX-NOTE-UC01')?.title).toBe('Write a note');
    expect(listing(root)).toEqual(before);

    const store = await openStore(root);
    await store.set('use_case', 'EX-NOTE-UC01', { title: 'Write a short note' });
    await store.close();
    const second = await loadWorkspace(root);
    expect(second.records.find((r) => r.id === 'EX-NOTE-UC01')?.title).toBe('Write a short note');
    expect(listing(root)).toEqual(before);
    // The earlier result is a separate object, untouched by the second load.
    expect(first.records.find((r) => r.id === 'EX-NOTE-UC01')?.title).toBe('Write a note');
  });
});
