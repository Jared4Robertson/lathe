// The reference generated from the schema and the check rows: buildReference, the check rows' documentation, the
// reference script, GET /api/reference and the committed REFERENCE.md.
import { spawnSync } from 'node:child_process';
import { cpSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, describe, expect, it } from 'vitest';
import { buildReference, LATHE_DATA_DIR, openStore, PACKAGE_DIR, renderReference, type Reference } from '../src/index.ts';
import { handleApi } from '../src/server/api.ts';
import { everyKind, fixture, refusals, withTable } from './helpers.ts';

const here = path.dirname(fileURLToPath(import.meta.url));
const script = (...args: string[]) => spawnSync(process.execPath, [path.join(here, '..', 'scripts', 'reference.ts'), ...args], { encoding: 'utf8' });
const temps: string[] = [];
const tempDir = () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'lathe-reference-'));
  temps.push(dir);
  return dir;
};
afterAll(() => {
  for (const dir of temps) rmSync(dir, { recursive: true, force: true });
});

const latheChecks = async () => {
  const store = await openStore(PACKAGE_DIR, { latheDataDir: null });
  try {
    return store.rows('check');
  } finally {
    await store.close();
  }
};

describe('check rows', () => {
  it("LA-CHK-T45 Every check row has a one-sentence summary, an explanation and a severity that matches its query", async () => {
    const rows = await latheChecks();
    expect(rows.length).toBeGreaterThan(30);
    for (const row of rows) {
      const name = String(row.name);
      expect(String(row.summary).match(/[.!?](\s|$)/g)?.length ?? 0, `${name}: ${row.summary}`).toBe(1);
      expect(String(row.explanation).trim(), name).not.toBe('');
      // A check that says which severity each row has returns a severity column; the others leave it to the row.
      const returnsSeverity = /AS severity\b/.test(String(row.query));
      expect(returnsSeverity, name).toBe(row.severity === 'error_or_warning');
    }
  });

  it('LA-CHK-T46 A check row is read as summary, explanation, severity and kinds, and one without them is refused', async () => {
    const reference = await buildReference(PACKAGE_DIR);
    expect(reference.checks.find((c) => c.check === 'test-file-missing')).toEqual({
      check: 'test-file-missing',
      severity: 'error_or_warning',
      summary: "A test's `file`, and its `key_file` when it names one, exists.",
      explanation: expect.stringContaining('Fix the path'),
      origin: 'lathe',
      product: null,
      kinds: ['test'],
    });
    const bare = { name: 'bare', position: 1, severity: 'warning', summary: 'Only a summary.', query: 'SELECT 1' };
    expect(await refusals(withTable(everyKind(), 'check', [bare]))).toEqual([expect.objectContaining({ rule: 'required', message: expect.stringContaining('check.explanation is required') })]);
    expect(await refusals(withTable(everyKind(), 'check', [{ ...bare, explanation: 'Why.', severity: 'fatal' }]))).toEqual([expect.objectContaining({ rule: 'column' })]);
  });
});

describe('the reference', () => {
  let defaults: Reference;

  it("LA-AUT-T78 The reference holds every kind, table, relation, folder and check of Lathe's schema", async () => {
    defaults = await buildReference(PACKAGE_DIR);
    const useCase = defaults.kinds.find((k) => k.kind === 'use_case')!;
    expect(useCase).toMatchObject({
      label: 'Use case',
      stage: 'define',
      section: 'use-cases',
      parents: [{ kind: 'capability', column: 'capability_id' }, { kind: 'domain', column: 'domain_id' }],
      obligation: 'none',
      id: { pattern: '<P>-<D>-UC<nn>', example: 'TL-LEND-UC01' },
      product: null,
    });
    // Children are the kinds that list it as a parent.
    expect(useCase.child_kinds).toEqual(['requirement', 'question']);
    expect(defaults.kinds.find((k) => k.kind === 'requirement')?.obligation).toBe('full');
    expect(defaults.kinds.find((k) => k.kind === 'pattern_rule')?.obligation).toBe('proof');
    expect(defaults.kinds.every((k) => k.id !== null)).toBe(true);
    // Each kind's table, with its columns, keys and rules.
    const requirement = defaults.tables.find((t) => t.name === 'requirement')!;
    expect(requirement.columns.map((c) => c.name)).toEqual(['id', 'title', 'use_case_id', 'statement', 'group_name']);
    expect(requirement.columns.find((c) => c.name === 'use_case_id')).toMatchObject({ required: true, references: 'use_case.id' });
    expect(defaults.tables.find((t) => t.name === 'entity_field')).toMatchObject({ role: 'part', owner_column: 'entity_id', primary_key: ['entity_id', 'position'] });
    expect(defaults.relations.find((r) => r.relation === 'proves')).toMatchObject({ role: 'proof', pairs: expect.arrayContaining([expect.objectContaining({ source_kind: 'test', target_kind: 'requirement' })]) });
    expect(defaults.sections.map((s) => s.section)).toEqual(['domain-model', 'use-cases', 'interaction-design', 'technical-specification', 'test-plan', 'shared']);
    // Every Lathe check row, in run order, then the engine's own problem.
    expect(defaults.checks.filter((c) => c.origin === 'lathe').map((c) => c.check)).toEqual((await latheChecks()).sort((a, b) => Number(a.position) - Number(b.position)).map((r) => String(r.name)));
    expect(defaults.checks.filter((c) => c.origin === 'engine').map((c) => c.check)).toEqual(['data-refused']);
  });

  it("LA-AUT-T79 A product's reference shows its own kinds and relations and its own checks", async () => {
    const widened = await buildReference(fixture('widen-extension'));
    expect(widened.kinds.find((k) => k.kind === 'policy')).toMatchObject({ obligation: 'full', description: 'A policy the business sets.', id: null, product: 'WX' });
    expect(widened.kinds.find((k) => k.kind === 'domain')?.child_kinds).toContain('policy');
    expect(widened.tables.find((t) => t.name === 'policy')?.columns.map((c) => c.name)).toContain('domain_id');
    expect(widened.relations.find((r) => r.relation === 'proves')?.pairs).toContainEqual(expect.objectContaining({ source_kind: 'test', target_kind: 'policy' }));

    const house = await buildReference(fixture('product-checks-house'));
    const own = house.checks.filter((c) => c.origin === 'product');
    expect(own.map((c) => c.check)).toEqual(['one-record-view-per-aggregate', 'broken']);
    expect(own[0]).toMatchObject({ product: 'PC', severity: 'warning', kinds: ['aggregate', 'use_case'] });
    expect(house.checks.at(-1)?.origin).toBe('product');
  });

  it('LA-AUT-T80 The committed REFERENCE.md is the reference as the reference script writes it', async () => {
    const committed = readFileSync(path.join(PACKAGE_DIR, 'REFERENCE.md'), 'utf8');
    // When this fails, run `npm --prefix lathe run reference` and commit REFERENCE.md.
    expect(committed).toBe(renderReference(defaults ?? (await buildReference(PACKAGE_DIR))));
  });

  it('LA-AUT-T81 The Markdown gives the data model, then kinds with their tables, other tables, relations, folders and checks, each with an anchor', async () => {
    const markdown = renderReference(defaults ?? (await buildReference(PACKAGE_DIR)));
    const at = (text: string) => markdown.indexOf(text);
    expect(at('# Lathe reference')).toBe(0);
    expect(at('data/<table>.jsonl')).toBeLessThan(at('\n## Kinds\n'));
    expect(at('\n## Kinds\n')).toBeLessThan(at('\n## Other tables\n'));
    expect(at('\n## Other tables\n')).toBeLessThan(at('\n## Relations\n'));
    expect(at('\n## Relations\n')).toBeLessThan(at('\n## Folders\n'));
    expect(at('\n## Folders\n')).toBeLessThan(at('\n## Checks\n'));
    for (const anchor of ['kind-use_case', 'table-use_case', 'table-entity_field', 'relation-proves', 'folder-test-plan', 'check-unproved', 'check-data-refused']) {
      expect(markdown).toContain(`<a id="${anchor}"></a>`);
    }
    // Every link inside the document lands on one of its anchors.
    const anchors = new Set([...markdown.matchAll(/<a id="([^"]+)"><\/a>/g)].map((m) => m[1]));
    const targets = [...markdown.matchAll(/\]\(#([^)]+)\)/g)].map((m) => m[1]);
    expect(targets.length).toBeGreaterThan(100);
    expect(targets.filter((t) => !anchors.has(t))).toEqual([]);
  });
});

describe('the schema documents itself', () => {
  it('LA-AUT-T82 A product kind or relation without a description, or a check without its explanation, is refused', async () => {
    const data = everyKind();
    const kind = data.product_kind[0];
    expect(await refusals(withTable(data, 'product_kind', [{ ...kind, description: ' ' }]))).toEqual([expect.objectContaining({ table: 'product_kind' })]);
    const relation = data.product_relation[0];
    const { description: _d, ...bare } = relation;
    expect(await refusals(withTable(data, 'product_relation', [bare, data.product_relation[1]]))).toEqual([expect.objectContaining({ rule: 'required', table: 'product_relation' })]);
    const check = data.check[0];
    expect(await refusals(withTable(data, 'check', [{ ...check, explanation: '' }]))).toEqual([expect.objectContaining({ table: 'check' })]);
  });

  it("LA-AUT-T83 A product's own checks are held to the same rule, and Lathe's are all documented", async () => {
    // Every table and kind of Lathe's schema has its description, and every check row its summary and explanation.
    const reference = await buildReference(PACKAGE_DIR);
    expect(reference.kinds.filter((k) => k.description.trim() === '').map((k) => k.kind)).toEqual([]);
    expect(reference.tables.filter((t) => t.description.trim() === '').map((t) => t.name)).toEqual([]);
    expect(reference.checks.filter((c) => !c.summary.trim() || !c.explanation.trim()).map((c) => c.check)).toEqual([]);
    // A product check is a row of the same table, so the same columns are required of it.
    const house = await buildReference(fixture('product-checks-house'));
    expect(house.checks.filter((c) => c.origin === 'product').every((c) => c.summary.trim() && c.explanation.trim())).toBe(true);
  });
});

describe('relation labels', () => {
  it('LA-AUT-T86 A product relation without both labels is refused', async () => {
    const data = everyKind();
    const [enforces, proves] = data.product_relation;
    const { reverse_label: _r, ...noReverse } = enforces;
    expect(await refusals(withTable(data, 'product_relation', [noReverse, proves]))).toEqual([expect.objectContaining({ rule: 'required', message: expect.stringContaining('reverse_label') })]);
    expect(await refusals(withTable(data, 'product_relation', [{ ...enforces, forward_label: '  ' }, proves]))).toEqual([expect.objectContaining({ table: 'product_relation' })]);
    // Lathe's own relations are all labeled.
    const ref = await buildReference(PACKAGE_DIR);
    expect(ref.relations.filter((r) => !r.forward_label.trim() || !r.reverse_label.trim())).toEqual([]);
  });

  it('LA-AUT-T87 The reference reads each relation by its labels', async () => {
    const ref = await buildReference(fixture('good'));
    expect(ref.relations.find((r) => r.relation === 'satisfies')).toMatchObject({ forward_label: 'Satisfies', reverse_label: 'Designed by' });
    const markdown = renderReference(ref);
    expect(markdown).toContain('- **Reads:** Satisfies / Designed by');
    const start = markdown.indexOf('<a id="kind-requirement"></a>');
    const requirement = markdown.slice(start, markdown.indexOf('<a id="kind-', start + 1));
    expect(requirement).toMatch(/- \*\*Links in:\*\* .*Designed by \(\[`satisfies`\]\(#relation-satisfies\)\)/);
    expect(requirement).toMatch(/- \*\*Links in:\*\* .*Proved by \(\[`proves`\]\(#relation-proves\)\)/);
    expect(requirement).toMatch(/- \*\*Links in:\*\* .*Carried out in \(\[`fulfills`\]\(#relation-fulfills\)\)/);
  });
});

describe('the reference script and GET /api/reference', () => {
  it('LA-AUT-T84 The reference script prints a product\'s reference, or writes it with --out', async () => {
    const expected = renderReference(await buildReference(fixture('widen-extension')));
    const printed = script('--root', fixture('widen-extension'), '--print');
    expect(printed.status).toBe(0);
    expect(printed.stdout).toBe(expected);
    const out = path.join(tempDir(), 'REFERENCE.md');
    const written = script('--root', fixture('widen-extension'), '--out', out);
    expect(written.status).toBe(0);
    expect(readFileSync(out, 'utf8')).toBe(expected);
  });

  it('LA-AUT-T85 GET /api/reference serves the product reference as JSON', async () => {
    let status = 0;
    let body = '';
    const headers: Record<string, string> = {};
    const res = {
      set statusCode(value: number) {
        status = value;
      },
      setHeader: (name: string, value: string) => (headers[name] = value),
      end: (text: string) => (body = text),
    } as unknown as ServerResponse;
    const root = tempDir();
    cpSync(fixture('widen-extension'), root, { recursive: true });
    const handled = await handleApi(root, { method: 'GET' } as IncomingMessage, res, '/api/reference');
    expect(handled).toBe(true);
    expect(status).toBe(200);
    expect(headers['content-type']).toBe('application/json');
    const reference = JSON.parse(body) as Reference;
    expect(reference).toEqual(JSON.parse(JSON.stringify(await buildReference(root))));
    expect(reference.kinds.some((k) => k.kind === 'policy')).toBe(true);
    expect(LATHE_DATA_DIR).toBe(path.join(PACKAGE_DIR, 'data'));
  });
});
