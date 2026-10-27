// Tests for the Authoring domain (LA-AUT): spec records as typed rows, and the rules every record follows, which the
// store's schema enforces.
import { cpSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { loadWorkspace, type Workspace } from '../src/index.ts';
import { everyKind, fixture, load, ofCheck, records, refusals, removeData, withTable, writeData, type Data } from './helpers.ts';

const REPO = path.resolve(fixture('.'), '..', '..', '..');

let good: Workspace;
beforeAll(async () => { good = await load('records-good'); });
afterAll(removeData);

/** The everyKind product with one table's rows replaced. */
const changed = (table: string, rows: Data[string]) => withTable(everyKind(), table, rows);

describe('spec records', () => {
  it("LA-AUT-T01 A record is one row of its kind's table, with typed columns, and its links are rows of their relations' tables", () => {
    expect(good.problems).toEqual([]);
    const uc = good.records.find((r) => r.id === 'MX-D-UC01')!;
    expect(uc).toMatchObject({
      kind: 'use_case',
      title: 'Make a mark',
      parent: 'MX-D',
      product: 'MX',
      domain: 'MX-D',
      fields: { domain_id: 'MX-D', goal: 'A writer makes a mark.' },
      parts: { use_case_actor: [{ use_case_id: 'MX-D-UC01', position: 1, role_name: 'Writer' }] },
    });
    expect(good.records.find((r) => r.id === 'MX-D-DR01')!.fields.statement).toBe('A mark MUST have exactly one owner.');
    expect(good.links).toContainEqual({ source: 'MX-D-UC01', relation: 'applies', target: 'MX-D-DR01' });
    expect(good.records).toHaveLength(8);
  });

  it('LA-AUT-T02 A record points at the code that builds it and the code that proves it (file)', () => {
    expect(good.records.find((r) => r.id === 'MX-D-C01')!.fields.file).toBe('code/mark_service.txt');
    expect(good.records.find((r) => r.id === 'MX-D-T01')!.fields.file).toBe('code/mark_test.txt');
    expect(good.coverage).toEqual([expect.objectContaining({
      domain: 'MX-D',
      obligations: expect.arrayContaining([
        expect.objectContaining({ kind: 'requirement', proved: 1 }),
        expect.objectContaining({ kind: 'domain_rule', proved: 1 }),
      ]),
      gaps: [],
    })]);
  });

  it("LA-AUT-T03 A data file's line order and each line's column order do not change what it means, and a file that is not <table>.jsonl is ignored", async () => {
    const from = fixture('records-good');
    const root = writeData({});
    cpSync(path.join(from, 'code'), path.join(root, 'code'), { recursive: true });
    for (const file of readdirSync(path.join(from, 'data'))) {
      const lines = readFileSync(path.join(from, 'data', file), 'utf8').trim().split('\n');
      // Lines reversed, and each line's columns in reverse order.
      const shuffled = lines.reverse().map((l) => JSON.stringify(Object.fromEntries(Object.entries(JSON.parse(l)).reverse())));
      writeFileSync(path.join(root, 'data', file), `${shuffled.join('\n')}\n`);
    }
    mkdirSync(path.join(root, 'data'), { recursive: true });
    writeFileSync(path.join(root, 'data', 'README.md'), 'Just notes.\n');
    const moved = await loadWorkspace(root);
    expect(moved.problems).toEqual([]);
    const byId = (ws: Workspace) => [...ws.records].sort((a, b) => a.id.localeCompare(b.id));
    expect(byId(moved)).toEqual(byId(good));
    expect(moved.links).toEqual(expect.arrayContaining(good.links));
    expect(moved.coverage).toEqual(good.coverage);
  });

  it('LA-AUT-T04 Two records with the same ID are refused, even of different kinds or products', async () => {
    const data = everyKind();
    expect(await refusals(changed('domain', [...data.domain, { id: 'TL-LEND-A1', title: 'Twin', product_id: 'TL' }]))).toEqual([
      expect.objectContaining({ rule: 'unique-id', key: 'TL-LEND-A1' }),
    ]);
    const other = withTable(changed('product', [...data.product, { id: 'BB', title: 'Another product' }]), 'domain', [...data.domain, { id: 'TL-LEND-A1', title: 'Twin', product_id: 'BB' }]);
    expect(await refusals(other)).toEqual([expect.objectContaining({ rule: 'unique-id', key: 'TL-LEND-A1' })]);
  });

  it('LA-AUT-T05 An ID that does not match the pattern is refused', async () => {
    const data = everyKind();
    const problems = await refusals(changed('aggregate', [...data.aggregate, { id: 'tl-lend-a9', title: 'Lower case', domain_id: 'TL-LEND' }]));
    // The registry every ID goes through holds IDs to capitals and digits in parts joined by hyphens.
    expect(problems).toEqual([expect.objectContaining({ rule: 'check', table: 'record_id' })]);
    expect(problems[0].message).toContain('tl-lend-a9');
  });

  it('LA-AUT-T06 A missing, unknown, disallowed or looping parent is refused, as is a product with a parent', async () => {
    const data = everyKind();
    const aggregate = (row: Data[string][number]) => changed('aggregate', [...data.aggregate, row]);
    // Missing: the parent column is required.
    expect(await refusals(aggregate({ id: 'TL-LEND-A9', title: 'No parent' }))).toEqual([expect.objectContaining({ rule: 'required', table: 'aggregate' })]);
    // Unknown: it names no domain.
    expect(await refusals(aggregate({ id: 'TL-LEND-A9', title: 'Lost', domain_id: 'TL-GONE' }))).toEqual([expect.objectContaining({ rule: 'foreign-key', key: 'TL-LEND-A9' })]);
    // Disallowed: an aggregate sits in a domain, so an aggregate's ID is not a domain.
    expect(await refusals(aggregate({ id: 'TL-LEND-A9', title: 'Inside', domain_id: 'TL-LEND-A1' }))).toEqual([expect.objectContaining({ rule: 'foreign-key', key: 'TL-LEND-A9' })]);
    // Looping: two layers inside each other.
    const loop = changed('layer', [
      { id: 'TL-LEND-LAY01', title: 'One', domain_id: 'TL-LEND', parent_layer_id: 'TL-LEND-LAY02', position: 1 },
      { id: 'TL-LEND-LAY02', title: 'Two', domain_id: 'TL-LEND', parent_layer_id: 'TL-LEND-LAY01', position: 1 },
    ]);
    const looped = await refusals(withTable(withTable(withTable(loop, 'component', data.component.map(({ layer_id: _l, ...c }) => c)), 'design_flow', data.design_flow.map(({ layer_id: _l, ...d }) => d)), 'layer', loop.layer));
    expect(looped.map((p) => p.rule)).toContain('foreign-key');
    expect(looped.map((p) => p.message).join(' ')).toContain('sits inside itself');
    // A product sits under nothing: it has no parent column.
    expect(await refusals(changed('product', [{ ...data.product[0], parent: 'BB' }]))).toEqual([expect.objectContaining({ rule: 'column', table: 'product' })]);
  });

  it("LA-AUT-T07 A record without a title, of an unknown kind or without its kind's required columns is refused", async () => {
    const data = everyKind();
    expect(await refusals(changed('aggregate', [...data.aggregate, { id: 'TL-LEND-A9', domain_id: 'TL-LEND' }]))).toEqual([expect.objectContaining({ rule: 'required', table: 'aggregate' })]);
    expect(await refusals(changed('aggregate', [...data.aggregate, { id: 'TL-LEND-A9', title: '  ', domain_id: 'TL-LEND' }]))).toEqual([expect.objectContaining({ rule: 'column', table: 'aggregate' })]);
    expect(await refusals({ ...data, widget: [{ id: 'TL-LEND-W01', title: 'A widget' }] })).toEqual([expect.objectContaining({ rule: 'unknown-table', file: 'data/widget.jsonl' })]);
    const noRoute = await refusals(changed('endpoint', [{ id: 'TL-LEND-E01', title: 'Borrow a tool', domain_id: 'TL-LEND', api_id: 'TL-LEND-API01', method: 'POST' }]));
    expect(noRoute).toEqual([expect.objectContaining({ rule: 'required', table: 'endpoint' })]);
    expect(noRoute[0].message).toContain('route');
  });

  it('LA-AUT-T08 A link to a record that does not exist is refused', async () => {
    expect(await refusals(changed('applies', [{ source_id: 'TL-LEND-UC01', target_id: 'TL-LEND-DR99' }]))).toEqual([
      expect.objectContaining({ rule: 'foreign-key', table: 'applies', file: 'data/applies.jsonl' }),
    ]);
  });

  it('LA-AUT-T09 A link whose relation is unknown or not allowed for its kinds is refused', async () => {
    const data = everyKind();
    expect(await refusals({ ...data, admires: [{ source_id: 'TL-LEND-V01', target_id: 'TL-LEND-UC01' }] })).toEqual([expect.objectContaining({ rule: 'unknown-table' })]);
    // A view fulfills a requirement, never a domain rule.
    expect(await refusals(changed('fulfills', [...data.fulfills, { source_id: 'TL-LEND-V01', target_id: 'TL-LEND-DR01' }]))).toEqual([
      expect.objectContaining({ rule: 'relation-pair', table: 'fulfills' }),
    ]);
  });

  it('LA-AUT-T10 A test whose file is missing or does not name what it proves is an error; a missing component file is only a warning', async () => {
    const data = everyKind();
    const root = writeData({
      ...data,
      test: [
        { id: 'TL-LEND-T01', title: 'Gone', domain_id: 'TL-LEND', test_type: 'unit', state: 'automated', file: 'test/gone.test.ts' },
        { id: 'TL-LEND-T02', title: 'Silent', domain_id: 'TL-LEND', test_type: 'unit', state: 'automated', file: 'test/silent.test.ts' },
      ],
      proves: [{ source_id: 'TL-LEND-T02', target_id: 'TL-LEND-UC01-R01' }],
      supports: [],
      runs: [],
      covers: [],
    });
    mkdirSync(path.join(root, 'test'));
    writeFileSync(path.join(root, 'test', 'silent.test.ts'), "it('saves a loan')\n");
    const ws = await loadWorkspace(root);
    expect(records(ofCheck(ws, 'test-file-missing'))).toEqual(['TL-LEND-T01']);
    expect(ofCheck(ws, 'test-file-missing')[0].severity).toBe('error');
    expect(ofCheck(ws, 'proof-not-in-file')).toEqual([expect.objectContaining({ severity: 'error', record: 'TL-LEND-T02' })]);
    const components = ofCheck(ws, 'component-file-missing');
    expect(components.length).toBeGreaterThan(0);
    expect(components.every((p) => p.severity === 'warning')).toBe(true);
  });

  it("LA-AUT-T11 Every rule and requirement in Lathe's own spec states its rule with MUST, SHOULD or MAY under a short title", async () => {
    // Lathe's own records only: other products in this repo are examples with their own owners.
    const ws = await loadWorkspace(REPO);
    const rules = ws.records.filter((r) => r.product === 'LA' && (r.kind === 'requirement' || r.kind === 'domain_rule'));
    expect(rules.length).toBeGreaterThan(0);
    const unstated = rules.filter((r) => !/\b(MUST|SHOULD|MAY)\b/.test(String(r.fields.statement))).map((r) => r.id);
    const longTitles = rules.filter((r) => r.title.split(/\s+/).length > 15).map((r) => r.id);
    expect({ unstated, longTitles }).toEqual({ unstated: [], longTitles: [] });
  });
});
