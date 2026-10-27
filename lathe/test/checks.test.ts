import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { loadWorkspace, type Workspace } from '../src/index.ts';
import { everyKind, load, loadData, ofCheck, records, refusals, removeData, withTable, writeData, type Data } from './helpers.ts';

/** One obligation kind's line in a domain's coverage: total, designed, built and proved. */
const line = (kind: string, total: number, designed: number, built: number, proved: number) => expect.objectContaining({ kind, total, designed, built, proved });

const FIXTURES = ['good', 'broken-tests', 'configured', 'unfinished'];
const WARNINGS = ['unsatisfied', 'unproved', 'use-case-without-requirements', 'component-file-missing', 'rule-not-applied', 'use-case-without-flow', 'interaction-requirement-fulfills-nothing', 'test-type-mismatch', 'component-satisfies-nothing', 'test-proves-nothing'];
const workspaces: Record<string, Workspace> = {};
beforeAll(async () => {
  for (const name of FIXTURES) workspaces[name] = await load(name);
});
afterAll(removeData);

/** A small product: a use case with one requirement, nothing designed or proved. */
const small = (): Data => ({
  product: [{ id: 'BX', title: 'Broken product' }],
  domain: [{ id: 'BX-D', title: 'Domain', product_id: 'BX' }],
  use_case: [{ id: 'BX-D-UC01', title: 'Do it', domain_id: 'BX-D' }],
  requirement: [{ id: 'BX-D-UC01-R01', title: 'It is done', use_case_id: 'BX-D-UC01', statement: 'It MUST be done.' }],
  view: [{ id: 'BX-D-V01', title: 'A view', domain_id: 'BX-D' }],
  question: [{ id: 'BX-D-Q01', title: 'Anything?', product_id: 'BX', domain_id: 'BX-D', owner: 'Owner' }],
});

describe('Lathe-cited checks', () => {
  it('LA-AUT-T14 Duplicate IDs are refused by the store, in one table or across two', async () => {
    const data = everyKind();
    expect(await refusals(withTable(data, 'aggregate', [...data.aggregate, { id: 'TL-LEND-A1', title: 'Again', domain_id: 'TL-LEND' }]))).toEqual([
      expect.objectContaining({ rule: 'primary-key', file: 'data/aggregate.jsonl', key: 'TL-LEND-A1' }),
    ]);
    const twice = await refusals(withTable(data, 'view', [...data.view, { id: 'TL-LEND-A1', title: 'A view with an aggregate ID', domain_id: 'TL-LEND' }]));
    expect(twice).toEqual([expect.objectContaining({ rule: 'unique-id', key: 'TL-LEND-A1' })]);
    expect(twice[0].message).toContain('already a aggregate');
  });

  it('LA-AUT-T15 A link to a missing record is refused by the store', async () => {
    const data = everyKind();
    const problems = await refusals(withTable(data, 'applies', [{ source_id: 'TL-LEND-UC01', target_id: 'TL-LEND-DR99' }]));
    expect(problems).toEqual([expect.objectContaining({ rule: 'foreign-key', file: 'data/applies.jsonl', line: 1 })]);
    expect(problems[0].message).toContain('TL-LEND-DR99');
  });

  it('LA-AUT-T16 A disallowed relation is refused by the store; a question may be about any record', async () => {
    const data = small();
    // A view cannot satisfy: satisfies starts at a component or a technical step.
    expect(await refusals({ ...data, satisfies: [{ source_id: 'BX-D-V01', target_id: 'BX-D-UC01-R01' }] })).toEqual([
      expect.objectContaining({ rule: 'foreign-key', file: 'data/satisfies.jsonl' }),
    ]);
    // A view may fulfill a requirement, but not a domain rule: the pair is not allowed.
    const rule = { ...data, domain_rule: [{ id: 'BX-D-DR01', title: 'A rule', domain_id: 'BX-D', statement: 'It MUST hold.' }] };
    expect(await refusals({ ...rule, fulfills: [{ source_id: 'BX-D-V01', target_id: 'BX-D-DR01' }] })).toEqual([
      expect.objectContaining({ rule: 'relation-pair', table: 'fulfills' }),
    ]);
    // An unknown relation has no table.
    expect(await refusals({ ...data, admires: [{ source_id: 'BX-D-V01', target_id: 'BX-D-UC01' }] })).toEqual([
      expect.objectContaining({ rule: 'unknown-table', file: 'data/admires.jsonl' }),
    ]);
    expect(await refusals({ ...data, about: [{ source_id: 'BX-D-Q01', target_id: 'BX-D-V01' }] })).toEqual([]);
  });

  it("LA-AUT-T17 A test whose file lacks its ID is reported as an error", () => {
    const ws = workspaces['broken-tests'];
    expect(ofCheck(ws, 'test-file-missing-id')).toMatchObject([{ severity: 'error', record: 'BX-D-T01' }]);
    expect(ofCheck(ws, 'test-file-missing')).toMatchObject([{ severity: 'error', record: 'BX-D-T02' }]);
    // BX-D-T03's file names it, so neither file check reports it.
    expect(ws.problems.some((p) => p.record === 'BX-D-T03' && p.check.startsWith('test-file'))).toBe(false);
  });

  it('LA-TRC-T01 Coverage counts satisfied and proved requirements and lists the gaps', async () => {
    expect(workspaces.good.coverage).toMatchObject([
      { domain: 'EX-NOTE', obligations: expect.arrayContaining([line('requirement', 1, 1, 1, 1), line('domain_rule', 1, 1, 1, 1)]), gaps: [] },
    ]);
    const ws = await loadData(small());
    expect(ws.coverage).toMatchObject([
      {
        domain: 'BX-D',
        obligations: expect.arrayContaining([line('requirement', 1, 0, 0, 0), line('domain_rule', 0, 0, 0, 0)]),
        gaps: [
          { id: 'BX-D-UC01-R01', kind: 'requirement', missing: 'satisfies' },
          { id: 'BX-D-UC01-R01', kind: 'requirement', missing: 'proves' },
        ],
      },
    ]);
  });

  it('LA-CHK-T01 A malformed data file is a data-refused error naming the file and line, not a crash', async () => {
    const root = writeData(small());
    writeFileSync(path.join(root, 'data', 'aggregate.jsonl'), '{"id":"BX-D-A1","title":"Fine","domain_id":"BX-D"}\nnot json\n');
    const ws = await loadWorkspace(root);
    const found = ofCheck(ws, 'data-refused');
    expect(found).toEqual([expect.objectContaining({ severity: 'error', record: null })]);
    expect(found[0].message).toContain('data/aggregate.jsonl:2');
    expect(ws.records).toEqual([]);
    expect(ws.problems).toEqual(found);
  });
});

describe('product configuration', () => {
  const temps: string[] = [];
  afterAll(() => { for (const dir of temps) rmSync(dir, { recursive: true, force: true }); });

  it("LA-PLT-T01 A product's lathe.config.json chooses the data folder", async () => {
    const root = mkdtempSync(path.join(tmpdir(), 'lathe-configured-'));
    temps.push(root);
    mkdirSync(path.join(root, 'docs', 'data'), { recursive: true });
    writeFileSync(path.join(root, 'lathe.config.json'), JSON.stringify({ data: 'docs/data' }));
    writeFileSync(path.join(root, 'docs', 'data', 'product.jsonl'), '{"id":"CX","title":"Configured product"}\n');
    // data/ at the root is not the configured folder, so it is not read.
    mkdirSync(path.join(root, 'data'));
    writeFileSync(path.join(root, 'data', 'product.jsonl'), 'not read\n');
    const ws = await loadWorkspace(root);
    expect(ws.records.map((r) => r.id)).toEqual(['CX']);
    expect(ws.problems).toEqual([]);
  });

  it("LA-PLT-T02 A product's own kinds and relations add tables to the schema", () => {
    const ws = workspaces.configured;
    expect(ws.kinds.map((k) => k.kind)).toEqual(expect.arrayContaining(['product', 'requirement', 'report']));
    expect(ws.records.find((r) => r.id === 'CX-D-RP1')).toMatchObject({ kind: 'report', parent: 'CX-D', domain: 'CX-D' });
    expect(ws.relations).toContainEqual(expect.objectContaining({ relation: 'summarizes', source_kind: 'report', target_kind: 'aggregate' }));
    expect(ws.links).toContainEqual({ source: 'CX-D-RP1', relation: 'summarizes', target: 'CX-D-A1' });
    expect(ws.problems.filter((p) => p.severity === 'error')).toEqual([]);
  });
});

describe('coverage and the schema', () => {
  it('LA-TRC-T02 Coverage counts designed, built and proved separately', () => {
    expect(workspaces.unfinished.coverage).toMatchObject([
      {
        domain: 'UX-D',
        obligations: expect.arrayContaining([line('requirement', 3, 2, 1, 1), line('domain_rule', 1, 1, 1, 0)]),
        gaps: [
          { id: 'UX-D-DR01', kind: 'domain_rule', missing: 'proves' },
          { id: 'UX-D-UC01-R02', kind: 'requirement', missing: 'proves' },
          { id: 'UX-D-UC01-R03', kind: 'requirement', missing: 'satisfies' },
          { id: 'UX-D-UC01-R03', kind: 'requirement', missing: 'proves' },
        ],
      },
    ]);
    // Built never exceeds designed.
    for (const ws of Object.values(workspaces)) {
      for (const c of ws.coverage) {
        for (const o of c.obligations) {
          expect(o.built).toBeLessThanOrEqual(o.designed);
          expect(o.proved + o.planned).toBeLessThanOrEqual(o.total);
        }
      }
    }
  });

  it('LA-TRC-T03 Coverage gaps are warnings, so an unfinished design has no errors', () => {
    const ws = workspaces.unfinished;
    expect(ws.problems.filter((p) => p.severity === 'error')).toEqual([]);
    expect(records(ofCheck(ws, 'unsatisfied'))).toEqual(['UX-D-UC01-R03']);
    expect(records(ofCheck(ws, 'unproved'))).toEqual(['UX-D-DR01', 'UX-D-UC01-R02', 'UX-D-UC01-R03']);
    expect(ofCheck(ws, 'component-file-missing')).toMatchObject([{ severity: 'warning', record: 'UX-D-C02' }]);
  });

  it("LA-AUT-T19 A product kind or relation that names an undefined kind, repeats itself or has a bad field name is refused", async () => {
    const product = { product: [{ id: 'CX', title: 'Product' }] };
    const kind = { name: 'report', product_id: 'CX', label: 'Report', description: 'A report.', parent_kind: 'domain', obligation: 'none' };
    const unknownParent = await refusals({ ...product, product_kind: [{ ...kind, parent_kind: 'gadget' }] });
    expect(unknownParent).toEqual([expect.objectContaining({ rule: 'product-kind' })]);
    expect(unknownParent[0].message).toContain('gadget');
    expect(await refusals({ ...product, product_kind: [kind, kind] })).toEqual([expect.objectContaining({ rule: 'primary-key', table: 'product_kind' })]);
    const relation = { name: 'summarizes', source_kind: 'sprocket', target_kind: 'aggregate', product_id: 'CX', forward_label: 'Summarizes', reverse_label: 'Summarized by', description: 'It summarizes.' };
    const unknownEnd = await refusals({ ...product, product_relation: [relation] });
    expect(unknownEnd).toEqual([expect.objectContaining({ rule: 'product-kind' })]);
    expect(unknownEnd[0].message).toContain('sprocket');
    expect(await refusals({ ...product, product_kind: [kind], product_kind_field: [{ kind: 'report', position: 1, name: 'Bad-Name', type: 'text', required: false, description: 'A field.' }] })).toEqual([
      expect.objectContaining({ rule: 'check', table: 'product_kind_field' }),
    ]);
    // Lathe's own schema, and a product's own kinds, load with no error.
    for (const name of ['good', 'configured']) expect(workspaces[name].problems.filter((p) => p.severity === 'error')).toEqual([]);
  });
});

describe('the good workspace', () => {
  it('has no problems', () => {
    expect(workspaces.good.problems).toEqual([]);
  });

  it('loads records with their typed fields, parts, product and domain', () => {
    const uc = workspaces.good.records.find((r) => r.id === 'EX-NOTE-UC01');
    expect(uc).toEqual({
      id: 'EX-NOTE-UC01',
      kind: 'use_case',
      title: 'Write a note',
      parent: 'EX-NOTE',
      product: 'EX',
      domain: 'EX-NOTE',
      fields: { domain_id: 'EX-NOTE', goal: 'A person writes a note.' },
      parts: { use_case_actor: [{ use_case_id: 'EX-NOTE-UC01', position: 1, role_name: 'Person' }] },
    });
    expect(workspaces.good.records.find((r) => r.id === 'EX')).toMatchObject({ parent: null, product: 'EX', domain: null });
    expect(workspaces.good.records.find((r) => r.id === 'EX-NOTE-DR01')).toMatchObject({ product: 'EX', domain: 'EX-NOTE', parent: 'EX-NOTE-A1' });
  });

  it('loads links, kinds and relations from the schema', () => {
    const ws = workspaces.good;
    expect(ws.records).toHaveLength(10);
    expect(ws.links).toContainEqual({ source: 'EX-NOTE-C01', relation: 'satisfies', target: 'EX-NOTE-DR01' });
    expect(ws.links).toHaveLength(8);
    expect(ws.kinds.find((k) => k.kind === 'question')?.parent_kinds).toEqual(['aggregate', 'use_case', 'component', 'domain', 'product']);
    expect(ws.kinds.find((k) => k.kind === 'endpoint')?.required_fields).toEqual(['method', 'route']);
    expect(ws.kinds.find((k) => k.kind === 'product')).toMatchObject({ stage: '', parent_kinds: [], required_fields: [] });
    expect(ws.relations).toContainEqual(expect.objectContaining({ relation: 'about', source_kind: 'question', target_kind: '*' }));
  });
});

describe('problems', () => {
  it('LA-CHK-T10 Data the schema refuses is an error, and work to do is a warning', async () => {
    const seen = new Set<string>();
    const bare = small();
    bare.use_case = [...bare.use_case, { id: 'BX-D-UC02', title: 'Do nothing', domain_id: 'BX-D' }];
    const all = [...Object.values(workspaces), await loadData(bare)];
    for (const ws of all) {
      for (const p of ws.problems) {
        seen.add(p.check);
        expect(p.severity, `${p.check}: ${p.message}`).toBe(WARNINGS.includes(p.check) ? 'warning' : 'error');
      }
    }
    // Every kind of work to do appears in the fixtures; the structural warnings have their own fixtures in
    // structure.test.ts and purpose.test.ts.
    const structural = ['rule-not-applied', 'use-case-without-flow', 'interaction-requirement-fulfills-nothing', 'test-type-mismatch'];
    for (const check of [...WARNINGS.filter((w) => !structural.includes(w)), 'test-file-missing', 'test-file-missing-id']) expect(seen).toContain(check);
    // Broken data is never loaded: it is one data-refused error per refusal.
    const refused = await loadWorkspace(writeData({ ...small(), applies: [{ source_id: 'BX-D-UC01', target_id: 'BX-D-DR99' }] }));
    expect(refused.problems).toEqual([expect.objectContaining({ severity: 'error', check: 'data-refused' })]);
  });

  it('LA-CHK-T11 Every problem names its check and, when it has one, its record', () => {
    for (const ws of Object.values(workspaces)) {
      for (const p of ws.problems) {
        expect(p.check).toMatch(/^[a-z][a-z-]*$/);
        expect(p.message.trim().endsWith('.')).toBe(true);
        expect(p.record, `${p.check}: ${p.message}`).not.toBeNull();
        expect(p.message, p.check).toContain(p.record);
      }
    }
  });

  it('warns about a component file that does not exist yet', () => {
    expect(ofCheck(workspaces['broken-tests'], 'component-file-missing')).toMatchObject([
      { severity: 'warning', record: 'BX-D-C01', message: expect.stringContaining('code/later.ts') },
    ]);
  });

  it('warns about unsatisfied and unproved requirements', async () => {
    const ws = await loadData(small());
    expect(ofCheck(ws, 'unsatisfied')).toMatchObject([{ severity: 'warning', record: 'BX-D-UC01-R01' }]);
    expect(ofCheck(ws, 'unproved')).toMatchObject([{ severity: 'warning', record: 'BX-D-UC01-R01' }]);
  });
});

describe('loading', () => {
  it('returns an empty workspace with the schema when there is no data folder', async () => {
    const ws = await loadWorkspace(path.join(tmpdir(), 'lathe-does-not-exist'));
    expect(ws.records).toEqual([]);
    expect(ws.problems).toEqual([]);
    expect(ws.coverage).toEqual([]);
    expect(ws.kinds.length).toBeGreaterThan(0);
  });
});
