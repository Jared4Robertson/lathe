// The reference generated from the schema, the check rows and the coverage rules: buildReference, the check rows'
// documentation, the reference script, GET /api/reference and the committed REFERENCE.md.
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import type { IncomingMessage, ServerResponse } from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ALLOWED_LEVELS, buildReference, GAP_RULES, LATHE_DATA_DIR, openStore, PACKAGE_DIR, renderReference, type Reference } from '../src/index.ts';
import { handleApi } from '../src/server/api.ts';
import { everyKind } from './store/fixture.ts';
import { adding, build, complete, refusals, removeData, withTable, writeData } from './helpers.ts';

const here = path.dirname(fileURLToPath(import.meta.url));
const script = (...args: string[]) => spawnSync(process.execPath, [path.join(here, '..', 'scripts', 'reference.ts'), ...args], { encoding: 'utf8' });

const latheChecks = async () => {
  const store = await openStore(PACKAGE_DIR, { latheDataDir: null });
  try {
    return store.rows('check');
  } finally {
    await store.close();
  }
};

/** The complete product with a kind, a relation and two checks of its own. */
const extended = () =>
  adding(complete(), {
    product_kind: [{ name: 'cli_command', product_id: 'EX', label: 'CLI command', description: "A command of the library's CLI.", parent_kind: 'command', stage: 'technical-specification', obligation: false, id_pattern: '<command>-CLI', id_example: 'EX-LEND-CMD01-CLI' }],
    product_kind_field: [{ kind: 'cli_command', position: 1, name: 'usage', type: 'text', required: true, description: 'How it is typed.' }],
    product_relation: [{ name: 'documents', source_kind: 'cli_command', target_kind: 'view', product_id: 'EX', forward_label: 'Documents', reverse_label: 'Documented by', description: 'The CLI command is documented in the view.' }],
    check: [
      { name: 'one-handler-file', product_id: 'EX', position: 1, severity: 'warning', summary: 'A house rule.', explanation: 'Made for this test. Fix what it reports.', query: 'SELECT NULL AS record, NULL AS message WHERE false', kinds: ['command_handler'] },
      { name: 'any-record', product_id: 'EX', position: 2, severity: 'warning', summary: 'Another house rule.', explanation: 'Made for this test. Fix what it reports.', query: 'SELECT NULL AS record, NULL AS message WHERE false' },
    ],
  });

let defaults: Reference;
let own = '';
beforeAll(async () => {
  defaults = await buildReference(PACKAGE_DIR);
  own = await build(extended());
});
afterAll(removeData);

describe('check rows', () => {
  it('LA-CHK-INV03-T Every check row has a one-sentence summary, an explanation and a severity that matches its query', async () => {
    const rows = await latheChecks();
    expect(rows.length).toBeGreaterThan(10);
    for (const row of rows) {
      const name = String(row.name);
      expect(String(row.summary).match(/[.!?](\s|$)/g)?.length ?? 0, `${name}: ${row.summary}`).toBe(1);
      expect(String(row.explanation).trim(), name).not.toBe('');
      // A check that says which severity each row has returns a severity column; the others leave it to the row.
      const returnsSeverity = /AS severity\b/.test(String(row.query));
      expect(returnsSeverity, name).toBe(row.severity === 'error_or_warning');
    }
  });

  it('LA-CHK-INV03-T A check row is read as summary, explanation, severity, kinds and stage, and one without them is refused', async () => {
    expect(defaults.checks.find((c) => c.check === 'value-object-unused')).toEqual({
      check: 'value-object-unused',
      severity: 'error',
      summary: 'A value object that nothing uses.',
      explanation: expect.stringContaining('Type the fields that hold it with it, or remove it.'),
      origin: 'lathe',
      product: null,
      kinds: ['value_object'],
      stage: 'domain-model',
    });
    expect(defaults.checks.find((c) => c.check === 'too-many-children')).toMatchObject({ kinds: [], stage: null });
    const bare = { name: 'bare', position: 1, severity: 'warning', summary: 'Only a summary.', query: 'SELECT 1' };
    expect(await refusals(withTable(everyKind(), 'check', [bare]))).toEqual([expect.objectContaining({ rule: 'required', message: expect.stringContaining('check.explanation is required') })]);
    expect(await refusals(withTable(everyKind(), 'check', [{ ...bare, explanation: 'Why.', severity: 'fatal' }]))).toEqual([expect.objectContaining({ rule: 'column' })]);
  });
});

describe('the reference', () => {
  it("LA-AUT-UC11-R02-T01 The reference holds every stage, kind, table, relation, check and gap of Lathe's schema", async () => {
    expect(defaults.stages.map((s) => s.stage)).toEqual(['domain-model', 'use-cases', 'interaction-design', 'technical-specification', 'test-plan']);
    const useCase = defaults.kinds.find((k) => k.kind === 'use_case')!;
    expect(useCase).toMatchObject({
      label: 'Use case',
      stage: 'use-cases',
      parents: [{ kind: 'capability', column: 'capability_id' }],
      obligation: false,
      coverage: null,
      levels: null,
      id_scope: 'domain',
      id: { pattern: '<P>-<D>-UC<nn>', example: 'TL-LEND-UC01' },
      product: null,
    });
    // Children are the kinds that list it as a parent.
    expect(useCase.child_kinds).toEqual(['uc_requirement', 'flow']);
    expect(defaults.kinds.find((k) => k.kind === 'view')).toMatchObject({ parents: [], id_scope: 'product' });
    expect(defaults.kinds.find((k) => k.kind === 'endpoint')?.parents.map((p) => p.kind)).toEqual(['command', 'query']);
    // Obligations say what designs, builds and proves them; test kinds the levels they run at.
    expect(defaults.kinds.filter((k) => k.obligation).map((k) => k.kind)).toEqual(['constraint', 'invariant', 'specification', 'policy', 'domain_service', 'uc_requirement', 'pattern_rule', 'view_requirement', 'api_requirement', 'standard_rule']);
    expect(defaults.kinds.filter((k) => k.obligation).every((k) => k.coverage !== null)).toBe(true);
    expect(defaults.kinds.find((k) => k.kind === 'uc_requirement')?.coverage?.designed).toBe("A step of its use case's flow fulfills it.");
    expect(Object.fromEntries(defaults.kinds.filter((k) => k.levels).map((k) => [k.kind, k.levels]))).toEqual(ALLOWED_LEVELS);
    expect(defaults.kinds.every((k) => k.id !== null)).toBe(true);
    // Each kind's table, with its columns, keys and rules.
    const requirement = defaults.tables.find((t) => t.name === 'uc_requirement')!;
    expect(requirement.columns.map((c) => c.name)).toEqual(['id', 'title', 'use_case_id', 'statement', 'group_name']);
    expect(requirement.columns.find((c) => c.name === 'use_case_id')).toMatchObject({ required: true, references: 'use_case.id' });
    expect(defaults.tables.find((t) => t.name === 'entity_field')).toMatchObject({ role: 'part', owner_column: 'entity_id', primary_key: ['entity_id', 'position'] });
    expect(defaults.relations.find((r) => r.relation === 'fulfills')).toMatchObject({ role: 'design', pairs: [expect.objectContaining({ source_kind: 'flow_step', target_kind: 'uc_requirement' })] });
    // Every Lathe check row, in run order, then the engine's own problem; and every gap rule.
    expect(defaults.checks.filter((c) => c.origin === 'lathe').map((c) => c.check)).toEqual((await latheChecks()).sort((a, b) => Number(a.position) - Number(b.position)).map((r) => String(r.name)));
    expect(defaults.checks.filter((c) => c.origin === 'engine').map((c) => c.check)).toEqual(['data-refused']);
    expect(defaults.gaps.map((g) => g.gap)).toEqual(GAP_RULES.map((g) => g.name));
  });

  it("LA-AUT-UC11-R03-T01 A product's reference shows its own kinds and relations and its own checks", async () => {
    const ref = await buildReference(own);
    expect(ref.kinds.at(-1)).toMatchObject({ kind: 'cli_command', stage: 'technical-specification', obligation: false, position: null, id_scope: null, id: { pattern: '<command>-CLI', example: 'EX-LEND-CMD01-CLI' }, product: 'EX' });
    expect(ref.kinds.find((k) => k.kind === 'command')?.child_kinds).toContain('cli_command');
    expect(ref.tables.find((t) => t.name === 'cli_command')?.columns.map((c) => c.name)).toEqual(['id', 'title', 'command_id', 'usage']);
    expect(ref.relations.find((r) => r.relation === 'documents')).toMatchObject({ product: 'EX', pairs: [expect.objectContaining({ source_kind: 'cli_command', target_kind: 'view' })] });
    const theirs = ref.checks.filter((c) => c.origin === 'product');
    expect(theirs.map((c) => c.check)).toEqual(['one-handler-file', 'any-record']);
    expect(theirs[0]).toMatchObject({ product: 'EX', severity: 'warning', kinds: ['command_handler'], stage: 'technical-specification' });
    expect(ref.checks.at(-1)?.origin).toBe('product');
  });

  it('LA-AUT-UC11-R05-T01 The committed REFERENCE.md is the reference as the reference script writes it', () => {
    const committed = readFileSync(path.join(PACKAGE_DIR, 'REFERENCE.md'), 'utf8');
    // When this fails, run `npm --prefix lathe run reference` and commit REFERENCE.md.
    expect(committed).toBe(renderReference(defaults));
  });

  it('LA-AUT-UC11-R01-T01 The Markdown goes stage by stage, each with its kinds, tables, checks and gaps, then other tables, relations and checks of any kind, each with an anchor', () => {
    const markdown = renderReference(defaults);
    const at = (text: string) => markdown.indexOf(text);
    expect(at('# Lathe reference')).toBe(0);
    const order = ['data/<table>.jsonl', '\n## Domain model\n', '<a id="kind-aggregate">', '### Checks: domain model', '### Coverage gaps: domain model', '\n## Use cases\n', '\n## Interaction design\n', '\n## Technical specification\n', '\n## Test plan\n', '\n## Outside the stages\n', '<a id="kind-question">', '\n## Other tables\n', '\n## Relations\n', '\n## Checks of any kind\n', '<a id="check-data-refused">'];
    for (let i = 1; i < order.length; i++) expect(at(order[i - 1]), `${order[i - 1]} before ${order[i]}`).toBeLessThan(at(order[i]));
    for (const anchor of ['stage-test-plan', 'kind-use_case', 'table-use_case', 'table-entity_field', 'relation-fulfills', 'check-view-unused', 'check-data-refused', 'gap-use-case-without-flow']) {
      expect(markdown).toContain(`<a id="${anchor}"></a>`);
    }
    // Every link inside the document lands on one of its anchors.
    const anchors = new Set([...markdown.matchAll(/<a id="([^"]+)"><\/a>/g)].map((m) => m[1]));
    const targets = [...markdown.matchAll(/\]\(#([^)]+)\)/g)].map((m) => m[1]);
    expect(targets.length).toBeGreaterThan(100);
    expect(targets.filter((t) => !anchors.has(t))).toEqual([]);
  });

  it("LA-AUT-UC11-R02-T01 The reference says that clean architecture's use case is a command handler, and what proves each obligation", () => {
    const markdown = renderReference(defaults);
    expect(markdown).toContain("What clean architecture calls a use case or an interactor is what Lathe calls a command handler\n(`command_handler`)");
    const start = markdown.indexOf('<a id="kind-invariant"></a>');
    const invariant = markdown.slice(start, markdown.indexOf('<a id="table-invariant"></a>'));
    expect(invariant).toContain("  - **Designed:** By construction, under its aggregate.");
    expect(invariant).toContain('  - **Proved:** Its invariant test.');
    const test = markdown.slice(markdown.indexOf('<a id="kind-flow_test"></a>'));
    expect(test).toContain('- **Run by levels:** `e2e-ui`, `e2e-api`, `manual`');
  });
});

describe('the schema documents itself', () => {
  it('LA-AUT-INV24-T A product kind or relation without a description, or a check without its explanation, is refused', async () => {
    const data = everyKind();
    const kind = data.product_kind[0];
    expect(await refusals(withTable(data, 'product_kind', [{ ...kind, description: ' ' }]))).toEqual([expect.objectContaining({ table: 'product_kind' })]);
    const { description: _d, ...bare } = data.product_relation[0];
    expect(await refusals(withTable(data, 'product_relation', [bare]))).toEqual([expect.objectContaining({ rule: 'required', table: 'product_relation' })]);
    const check = data.check[0];
    expect(await refusals(withTable(data, 'check', [{ ...check, explanation: '' }]))).toEqual([expect.objectContaining({ table: 'check' })]);
  });

  it("LA-AUT-UC11-R06-T01 Lathe's stages, kinds, tables, checks and gaps are all documented, and a product's checks are held to the same rule", async () => {
    expect(defaults.stages.filter((s) => !s.description.trim())).toEqual([]);
    expect(defaults.kinds.filter((k) => k.description.trim() === '').map((k) => k.kind)).toEqual([]);
    expect(defaults.tables.filter((t) => t.description.trim() === '').map((t) => t.name)).toEqual([]);
    expect(defaults.checks.filter((c) => !c.summary.trim() || !c.explanation.trim()).map((c) => c.check)).toEqual([]);
    expect(defaults.gaps.filter((g) => !g.summary.trim())).toEqual([]);
    const ref = await buildReference(own);
    expect(ref.checks.filter((c) => c.origin === 'product').every((c) => c.summary.trim() && c.explanation.trim())).toBe(true);
  });
});

describe('relation labels', () => {
  it('LA-AUT-INV23-T A product relation without both labels is refused, and all of Lathe\'s are labeled', async () => {
    const data = everyKind();
    const [documents] = data.product_relation;
    const { reverse_label: _r, ...noReverse } = documents;
    expect(await refusals(withTable(data, 'product_relation', [noReverse]))).toEqual([expect.objectContaining({ rule: 'required', message: expect.stringContaining('reverse_label') })]);
    expect(await refusals(withTable(data, 'product_relation', [{ ...documents, forward_label: '  ' }]))).toEqual([expect.objectContaining({ table: 'product_relation' })]);
    expect(defaults.relations.filter((r) => !r.forward_label.trim() || !r.reverse_label.trim())).toEqual([]);
  });

  it('LA-AUT-UC11-R07-T01 The reference reads each relation by its labels', () => {
    expect(defaults.relations.find((r) => r.relation === 'fulfills')).toMatchObject({ forward_label: 'Fulfills', reverse_label: 'Fulfilled by' });
    const markdown = renderReference(defaults);
    expect(markdown).toContain('- **Reads:** Fulfills / Fulfilled by');
    const start = markdown.indexOf('<a id="kind-uc_requirement"></a>');
    const requirement = markdown.slice(start, markdown.indexOf('<a id="kind-', start + 1));
    expect(requirement).toMatch(/- \*\*Links in:\*\* .*Fulfilled by \(\[`fulfills`\]\(#relation-fulfills\)\)/);
  });
});

describe('the reference script and GET /api/reference', () => {
  it("LA-AUT-UC11-R01-T02 The reference script prints a product's reference, or writes it with --out", async () => {
    const expected = renderReference(await buildReference(own));
    const printed = script('--root', own, '--print');
    expect(printed.status).toBe(0);
    expect(printed.stdout).toBe(expected);
    const out = path.join(writeData({}), 'REFERENCE.md');
    const written = script('--root', own, '--out', out);
    expect(written.status).toBe(0);
    expect(readFileSync(out, 'utf8')).toBe(expected);
  });

  it('LA-AUT-EP01-R01-T01 GET /api/reference serves the product reference as JSON', async () => {
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
    const handled = await handleApi(own, { method: 'GET' } as IncomingMessage, res, '/api/reference');
    expect(handled).toBe(true);
    expect(status).toBe(200);
    expect(headers['content-type']).toBe('application/json');
    const reference = JSON.parse(body) as Reference;
    expect(reference).toEqual(JSON.parse(JSON.stringify(await buildReference(own))));
    expect(reference.kinds.some((k) => k.kind === 'cli_command')).toBe(true);
    expect(LATHE_DATA_DIR).toBe(path.join(PACKAGE_DIR, 'data'));
  });
});
