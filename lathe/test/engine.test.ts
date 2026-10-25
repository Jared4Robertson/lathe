// Engine behavior that needs its own temporary folders: adding checks, changing the meta-model,
// and rebuilding the workspace on every load.
import { cpSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, describe, expect, it } from 'vitest';
import { CHECKS_DIR, loadWorkspace, PACKAGE_DIR } from '../src/index.ts';

const fixture = (name: string) => path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures', name);
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

afterAll(() => {
  for (const dir of temps) rmSync(dir, { recursive: true, force: true });
});

describe('checks', () => {
  it('LA-CHK-T05 A new check needs only a new SQL file', async () => {
    const checks = tempDir();
    cpSync(CHECKS_DIR, checks, { recursive: true });
    writeFileSync(
      path.join(checks, '99-every-note-has-a-body.sql'),
      `-- A made-up check, added with no change to the engine.
--
-- It reports each use case in the notes domain. Its header documents it, as every check's must.
--
-- severity: warning
SELECT 'warning' AS severity, 'ignored' AS "check", id AS record, 'Record ' || id || ' is in the notes domain.' AS message
FROM records WHERE domain = 'EX-NOTE' AND kind = 'use_case'`,
    );
    const ws = await loadWorkspace(fixture('good'), { checksDir: checks });
    expect(ws.problems).toEqual([
      { severity: 'warning', check: 'every-note-has-a-body', record: 'EX-NOTE-UC01', message: 'Record EX-NOTE-UC01 is in the notes domain.' },
    ]);
  });

  it('LA-CHK-T06 Checks can read every loaded table, with file facts already computed', async () => {
    const checks = tempDir();
    writeFileSync(
      path.join(checks, '01-tables.sql'),
      `SELECT 'warning' AS severity, 'tables' AS "check", NULL AS record,
        (SELECT count(*) FROM records) || ' ' || (SELECT count(*) FROM fields) || ' ' || (SELECT count(*) FROM links) || ' '
        || ((SELECT count(*) FROM kinds) > 0) || ' ' || ((SELECT count(*) FROM relations) > 0) || ' '
        || (SELECT string_agg(record || ':' || file_exists || ':' || coalesce(contains_id::VARCHAR, '-'), ',' ORDER BY record) FROM file_facts) AS message`,
    );
    const ws = await loadWorkspace(fixture('broken-tests'), { checksDir: checks });
    const fields = ws.records.reduce((n, r) => n + Object.keys(r.fields).length, 0);
    expect(ws.problems).toHaveLength(1);
    expect(ws.problems[0].message).toBe(
      `${ws.records.length} ${fields} ${ws.links.length} true true BX-D-C01:false:-,BX-D-T01:true:false,BX-D-T02:false:false,BX-D-T03:true:true`,
    );
  });

  it('LA-CHK-T07 Every check runs, in file-name order, even after one fails', async () => {
    const checks = tempDir();
    const one = (name: string) => `SELECT 'warning' AS severity, 'x' AS "check", NULL AS record, '${name} ran.' AS message`;
    writeFileSync(path.join(checks, '20-third.sql'), one('third'));
    writeFileSync(path.join(checks, '03-first.sql'), one('first'));
    writeFileSync(path.join(checks, '10-broken.sql'), 'SELECT * FROM no_such_table');
    writeFileSync(path.join(checks, 'notes.txt'), 'Not a check.');
    const ws = await loadWorkspace(fixture('good'), { checksDir: checks });
    expect(ws.problems.map((p) => p.check)).toEqual(['first', 'broken', 'third']);
    expect(ws.problems[1]).toMatchObject({ severity: 'error', record: null, message: expect.stringContaining('10-broken.sql could not run') });
  });

  it('LA-CHK-T08 Each check is one SELECT query in its own file, named by its file', () => {
    const files = readdirSync(CHECKS_DIR).sort();
    expect(files.length).toBeGreaterThan(0);
    for (const file of files) {
      expect(file).toMatch(/^\d+-[a-z][a-z-]*\.sql$/);
      const sql = readFileSync(path.join(CHECKS_DIR, file), 'utf8')
        .split('\n')
        .filter((line) => !line.trim().startsWith('--'))
        .join('\n')
        .trim();
      expect(sql, file).toMatch(/^SELECT\b/);
      // One statement: no ';' outside string literals, except at the very end.
      const code = sql.replace(/'(?:[^']|'')*'/g, "''").replace(/;\s*$/, '');
      expect(code, file).not.toContain(';');
      // The query's own "check" column matches the name the engine gives it.
      const name = file.replace(/^\d+-/, '').replace(/\.sql$/, '');
      expect(sql, file).toContain(`'${name}' AS "check"`);
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
    expect(Object.keys(ws.records[0]).sort()).toEqual(['body', 'domain', 'fields', 'id', 'kind', 'mentions', 'parent', 'path', 'product', 'title']);
    expect(Object.keys(ws.links[0]).sort()).toEqual(['relation', 'source', 'target']);
    expect(Object.keys(ws.problems[0]).sort()).toEqual(['check', 'message', 'record', 'severity']);
    expect(Object.keys(ws.coverage[0]).sort()).toEqual(['domain', 'gaps', 'obligations', 'tests']);
    expect(Object.keys(ws.coverage[0].obligations[0]).sort()).toEqual(['built', 'designed', 'kind', 'label', 'planned', 'planned_any', 'proved', 'total']);
    expect(Object.keys(ws.coverage[0].gaps[0]).sort()).toEqual(['id', 'kind', 'missing']);
    // The result is plain JSON, as the app reads it from /api/spec.
    expect(JSON.parse(JSON.stringify(ws))).toEqual(ws);
  });

  it("LA-PLT-T04 Each record's product and domain come from its parents, and a parent loop is an error", async () => {
    const good = await loadWorkspace(fixture('good'));
    const at = (id: string) => good.records.find((r) => r.id === id);
    expect(at('EX')).toMatchObject({ product: 'EX', domain: null });
    expect(at('EX-NOTE')).toMatchObject({ product: 'EX', domain: 'EX-NOTE' });
    expect(at('EX-NOTE-UC01-R01')).toMatchObject({ product: 'EX', domain: 'EX-NOTE' });
    expect(at('EX-NOTE-DR01')).toMatchObject({ product: 'EX', domain: 'EX-NOTE' });

    // Loading finishes on a parent loop and reports each record on it.
    const broken = await loadWorkspace(fixture('broken-structure'));
    const cycle = broken.problems.filter((p) => p.check === 'parent-cycle');
    expect(cycle.map((p) => p.record).sort()).toEqual(['BX-D-A8', 'BX-D-A9']);
    expect(cycle.every((p) => p.severity === 'error')).toBe(true);
    expect(broken.records.find((r) => r.id === 'BX-D-A8')).toMatchObject({ product: null, domain: null });
  });

  it('LA-AUT-T18 A meta-model change takes effect on the next load and rechecks every record', async () => {
    const root = copyOf('good');
    const meta = tempDir();
    cpSync(path.join(PACKAGE_DIR, 'meta'), meta, { recursive: true });
    writeFileSync(
      path.join(root, 'specs/example/notes/memo.md'),
      '---\nid: EX-NOTE-M01\nkind: memo\ntitle: A memo\nparent: EX-NOTE\n---\nA kind that only the CSV defines.\n',
    );
    const unknown = (ws: Awaited<ReturnType<typeof loadWorkspace>>) =>
      ws.problems.filter((p) => p.check === 'unknown-kind').map((p) => p.record);

    expect(unknown(await loadWorkspace(root, { metaDir: meta }))).toEqual(['EX-NOTE-M01']);

    // Add a kind by editing the CSV only: the memo is now valid.
    const kinds = path.join(meta, 'kinds.csv');
    writeFileSync(kinds, `${readFileSync(kinds, 'utf8').trimEnd()}\nmemo,Memo,,,domain,,no,"A short note."\n`);
    const added = await loadWorkspace(root, { metaDir: meta });
    expect(added.kinds.map((k) => k.kind)).toContain('memo');
    expect(added.problems.filter((p) => p.severity === 'error')).toEqual([]);

    // Remove the endpoint kind: the existing endpoint record is rechecked and is now an error.
    writeFileSync(kinds, readFileSync(kinds, 'utf8').split('\n').filter((line) => !line.startsWith('endpoint,')).join('\n'));
    const removed = await loadWorkspace(root, { metaDir: meta });
    expect(unknown(removed)).toEqual(['EX-NOTE-E01']);
  });

  it('LA-PLT-T05 Each load reads the files afresh and writes nothing', async () => {
    const root = copyOf('good');
    const before = listing(root);
    const first = await loadWorkspace(root);
    expect(first.records.find((r) => r.id === 'EX-NOTE-UC01')?.title).toBe('Write a note');
    expect(listing(root)).toEqual(before);

    const file = path.join(root, 'specs/example/notes/01-define/use-cases/UC01.md');
    writeFileSync(file, readFileSync(file, 'utf8').replace('title: Write a note', 'title: Write a short note'));
    const second = await loadWorkspace(root);
    expect(second.records.find((r) => r.id === 'EX-NOTE-UC01')?.title).toBe('Write a short note');
    expect(listing(root)).toEqual(before);
    // The earlier result is a separate object, untouched by the second load.
    expect(first.records.find((r) => r.id === 'EX-NOTE-UC01')?.title).toBe('Write a note');
  });
});
