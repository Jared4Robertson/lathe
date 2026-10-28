// Authoring the interaction design, the technical specification and standards (LA-AUT-UC01, LA-AUT-UC16,
// LA-AUT-UC17, LA-AUT-UC18): views, endpoints and integrations, technical records and their files, tables and
// standards, proved through the store, the engine's load and the reference.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ALLOWED_LEVELS, type Reference, type SchemaDescription, type Workspace } from '../../src/index.ts';
import { everyKind } from '../store/fixture.ts';
import { adding, changing, complete, gaps, loadData, obligation, ofCheck, records, refusals, removeData, withTable, without } from '../helpers.ts';
import { described, latheReference, latheSchema, pairsOf, parentsOf, requiredOf } from './shared.ts';

let schema: SchemaDescription;
let reference: Reference;
let good: Workspace;
beforeAll(async () => {
  [schema, reference, good] = await Promise.all([latheSchema(), latheReference(), loadData(complete())]);
});
afterAll(removeData);

const record = (ws: Workspace, id: string) => ws.records.find((r) => r.id === id)!;
/** Lathe's technical kinds: the technical specification's kinds besides standards and their rules. */
const technical = () =>
  Object.values(schema.kinds).filter((k) => k.productId === null && k.stage === 'technical-specification' && !k.name.startsWith('standard')).map((k) => k.name).sort();

describe('files', () => {
  it('LA-AUT-UC01-R04-T01 A technical record names the file that builds it and a test the file that runs it, each relative to the repo root', async () => {
    for (const kind of [...technical(), ...Object.keys(ALLOWED_LEVELS)]) expect(schema.tables[kind].columns.find((c) => c.name === 'file'), kind).toMatchObject({ kind: 'text', required: false });
    expect(record(good, 'EX-LEND-CMD01-H').fields.file).toBe('src/loans.ts');
    expect(record(good, 'EX-LEND-UC01-R01-T01').fields.file).toBe('test/api.test.ts');
    expect(obligation(good, 'EX-LEND', 'uc_requirement')).toMatchObject({ total: 2, built: 2, proved: 2 });
    // A path that leaves the repo root names no file there; a test whose file does not name it proves nothing.
    const ws = await loadData(
      changing(changing(complete(), 'command_handler', (h) => h.id === 'EX-LEND-CMD02-H', { file: '../src/tools.ts' }), 'query_handler', (h) => h.id === 'EX-LEND-QRY01-H', { file: '../src/tools.ts' }),
      { silent: ['EX-LEND-UC02-R01-T01'] },
    );
    expect(ofCheck(ws, 'technical-file-missing').map((p) => p.message)).toEqual([
      'Command handler EX-LEND-CMD02-H names ../src/tools.ts, which does not exist yet.',
      'Query handler EX-LEND-QRY01-H names ../src/tools.ts, which does not exist yet.',
    ]);
    expect(records(ofCheck(ws, 'test-file-missing-id'))).toEqual(['EX-LEND-UC02-R01-T01']);
    expect(obligation(ws, 'EX-LEND', 'uc_requirement')).toMatchObject({ total: 2, proved: 1 });
  });
});

describe('the interaction design', () => {
  it('LA-AUT-UC18-R04-T01 An endpoint sits under the one command or query it exposes, and a step reaches it only through that command or query', async () => {
    expect(parentsOf(schema, 'endpoint')).toEqual(['command.command_id', 'query.query_id']);
    expect(schema.tables.endpoint.checks).toContainEqual('((command_id IS NULL) != (query_id IS NULL))');
    expect(record(good, 'EX-LEND-EP01')).toMatchObject({ parent: 'EX-LEND-CMD01', domain: 'EX-LEND' });
    const endpoint = everyKind().endpoint[0];
    const { command_id: _, ...orphan } = endpoint;
    expect((await refusals(withTable(everyKind(), 'endpoint', [orphan]))).map((p) => p.rule)).toEqual(['check']);
    expect((await refusals(withTable(everyKind(), 'endpoint', [{ ...endpoint, query_id: 'TL-LEND-QRY01' }]))).map((p) => p.rule)).toEqual(['check']);
    // A step invokes a command or a query, never an endpoint.
    expect(pairsOf(schema, 'invokes')).toEqual(['flow_step>command', 'flow_step>query']);
    const direct = await refusals(withTable(everyKind(), 'invokes', [{ source_id: 'TL-LEND-UC01-FL-S01', target_id: 'TL-LEND-EP01' }]));
    expect(direct).toEqual([expect.objectContaining({ table: 'invokes', file: 'data/invokes.jsonl', line: 1 })]);
  });

  it('LA-AUT-UC18-R05-T01 A view or an integration has no owner and takes its product from its ID, and one no step uses is an error', async () => {
    for (const kind of ['view', 'integration']) {
      expect(parentsOf(schema, kind), kind).toEqual([]);
      expect(schema.kinds[kind].idScope, kind).toBe('product');
    }
    expect(record(good, 'EX-V01')).toMatchObject({ parent: null, product: 'EX' });
    expect(record(good, 'EX-INT01')).toMatchObject({ parent: null, product: 'EX' });
    expect([...ofCheck(good, 'view-unused'), ...ofCheck(good, 'integration-unused')]).toEqual([]);
    const ws = await loadData(without(without(complete(), 'happens_in', () => true), 'exchanges_with', () => true));
    expect(ofCheck(ws, 'view-unused')).toEqual([expect.objectContaining({ severity: 'error', record: 'EX-V01' })]);
    expect(ofCheck(ws, 'integration-unused')).toEqual([expect.objectContaining({ severity: 'error', record: 'EX-INT01' })]);
    // An ID that names no product is refused.
    expect(await refusals(adding(everyKind(), { view: [{ id: 'XX-V09', title: 'Lost' }] }))).toEqual([expect.objectContaining({ rule: 'id-prefix', key: 'XX-V09' })]);
  });

  it('LA-AUT-UC18-R06-T01 A rule of the interaction design is a view requirement under its view or an API requirement under its endpoint', () => {
    expect(parentsOf(schema, 'view_requirement')).toEqual(['view.view_id']);
    expect(parentsOf(schema, 'api_requirement')).toEqual(['endpoint.endpoint_id']);
    const rules = Object.values(schema.kinds).filter((k) => k.stage === 'interaction-design' && k.obligation).map((k) => k.name).sort();
    expect(rules).toEqual(['api_requirement', 'view_requirement']);
    for (const kind of rules) expect(requiredOf(schema, kind), kind).toContain('statement');
    expect(record(good, 'EX-V01-R01')).toMatchObject({ parent: 'EX-V01', kind: 'view_requirement' });
    expect(record(good, 'EX-LEND-EP01-R01')).toMatchObject({ parent: 'EX-LEND-EP01', kind: 'api_requirement', domain: 'EX-LEND' });
    // The view takes its domain from the steps that happen in it, and its requirement counts there.
    expect(obligation(good, 'EX-LEND', 'view_requirement')).toMatchObject({ total: 1, proved: 1 });
    expect(obligation(good, 'EX-LEND', 'api_requirement')).toMatchObject({ total: 1, proved: 1 });
  });
});

describe('the technical specification', () => {
  it('LA-AUT-UC17-R07-T01 A technical record sits under the one design record it implements and names its file; a file not there yet is work to do', async () => {
    const designStages = ['domain-model', 'use-cases', 'interaction-design'];
    for (const kind of technical()) {
      const parents = schema.kinds[kind].parents;
      // A UI component has no owner (it renders views); a table may instead sit under a domain as its infrastructure.
      if (kind === 'ui_component') {
        expect(parents).toEqual([]);
        continue;
      }
      for (const p of parents) expect(designStages.includes(schema.kinds[p.kind].stage!), `${kind} under ${p.kind}`).toBe(true);
      if (kind !== 'table') {
        expect(parents, kind).toHaveLength(1);
        expect(schema.tables[kind].unique, kind).toContainEqual([parents[0].column]);
      }
    }
    expect(parentsOf(schema, 'table')).toEqual(['entity.entity_id', 'read_model.read_model_id', 'domain.domain_id']);
    // A second handler for one command is refused.
    const handler = everyKind().command_handler[0];
    expect((await refusals(adding(everyKind(), { command_handler: [{ ...handler, id: 'TL-LEND-CMD01-H2' }] }))).map((p) => p.rule)).toEqual(['unique']);
    // A file that does not exist yet is a warning, and what it implements is not built.
    const ws = await loadData(complete(), { missing: ['src/dates.ts'] });
    expect(ofCheck(ws, 'technical-file-missing')).toEqual([{ severity: 'warning', check: 'technical-file-missing', record: 'EX-LEND-DS01-SV', message: 'Service EX-LEND-DS01-SV names src/dates.ts, which does not exist yet.' }]);
    expect(gaps(ws)).toEqual(['built EX-LEND-DS01']);
  });

  it("LA-AUT-UC17-R08-T01 A table stores its name, its storage and its keys, its columns following from its record's fields", async () => {
    expect(schema.tables.table.columns.map((c) => c.name)).toEqual(['id', 'title', 'entity_id', 'read_model_id', 'domain_id', 'name', 'storage', 'file', 'description']);
    expect(requiredOf(schema, 'table')).toEqual(['name', 'storage']);
    expect(schema.tables.table.columns.find((c) => c.name === 'storage')!.values).toEqual(['table', 'view', 'materialized view', 'browser storage', 'file', 'in memory']);
    expect(schema.tables.table_key).toMatchObject({ role: 'part', ownerColumn: 'table_id' });
    expect(schema.tables.table.description).toContain("Its columns follow from its parent's fields, a value object's fields flattened into columns, so it stores only what fields cannot say");
    // The column names come from the fields; the keys name them.
    expect(record(good, 'EX-LEND-EN01').parts.entity_field.map((f) => f.column_name ?? null)).toEqual(['id', null, 'tool_id']);
    const keys = everyKind().table_key;
    expect(keys[1]).toMatchObject({ type: 'unique', invariant_id: 'TL-LEND-INV01' });
    expect(await refusals(everyKind())).toEqual([]);
    expect((await refusals(withTable(everyKind(), 'table_key', [{ ...keys[0], invariant_id: 'TL-LEND-INV01' }, keys[1], keys[2]]))).map((p) => [p.rule, p.line])).toEqual([['check', 1]]);
    const { storage: _, ...unstored } = everyKind().table[0];
    expect((await refusals(withTable(everyKind(), 'table', [unstored, ...everyKind().table.slice(1)]))).map((p) => p.message)).toEqual(['table.storage is required']);
  });
});

describe('standards', () => {
  it('LA-AUT-UC16-R01-T01 A standard sits under the product, its rules under it and their tests under each rule, and technical records meet a rule', async () => {
    expect(parentsOf(schema, 'standard')).toEqual(['product.product_id']);
    expect(parentsOf(schema, 'standard_rule')).toEqual(['standard.standard_id']);
    expect([schema.kinds.standard, schema.kinds.standard_rule].map((k) => [k.stage, k.idPattern, k.obligation])).toEqual([
      ['technical-specification', '<P>-STD-<name>', false],
      ['technical-specification', '<standard>-R<nn>', true],
    ]);
    const meets = schema.relations.meets;
    expect(meets).toMatchObject({ role: null, forwardLabel: 'Meets', reverseLabel: 'Met by' });
    expect(meets.pairs.every((p) => p.target === 'standard_rule')).toBe(true);
    expect(meets.pairs.map((p) => p.source).sort()).toEqual(technical().sort());
    expect(parentsOf(schema, 'standard_rule_test')).toEqual(['standard_rule.standard_rule_id']);
    expect([schema.kinds.standard_rule_test].map((k) => [k.stage, k.idPattern, k.obligation])).toEqual([['test-plan', '<standard rule>-T<nn>', false]]);
    expect(ALLOWED_LEVELS.standard_rule_test).toEqual(['unit', 'database', 'api', 'contract', 'e2e-api', 'e2e-ui', 'manual']);
    described(reference, ['standard', 'standard_rule', 'standard_rule_test'], ['meets']);
    expect(reference.relations.find((r) => r.relation === 'meets')).toMatchObject({ role: '', forward_label: 'Meets', reverse_label: 'Met by' });
    // A requirement or a test cannot meet a rule, and a rule that does not exist cannot be met.
    expect((await refusals(adding(everyKind(), { meets: [{ source_id: 'TL-LEND-UC01-R01', target_id: 'TL-STD-CODE-R01' }] }))).length).toBeGreaterThan(0);
    expect((await refusals(adding(everyKind(), { meets: [{ source_id: 'TL-LEND-INV01-T', target_id: 'TL-STD-CODE-R01' }] }))).length).toBeGreaterThan(0);
    expect(await refusals(withTable(everyKind(), 'meets', [{ source_id: 'TL-LEND-CMD01-H', target_id: 'TL-STD-CODE-R09' }]))).toEqual([
      expect.objectContaining({ rule: 'foreign-key', file: 'data/meets.jsonl', line: 1 }),
    ]);
  });

  it('LA-AUT-UC16-R02-T01 A standard rule is owed by the product, designed and built by the technical records that meet it and proved by its standard rule tests', async () => {
    expect(record(good, 'EX-STD-CODE-R01')).toMatchObject({ product: 'EX', domain: null });
    expect(record(good, 'EX-STD-CODE-R01-T01')).toMatchObject({ parent: 'EX-STD-CODE-R01', product: 'EX', domain: null });
    expect(obligation(good, null, 'standard_rule')).toMatchObject({ total: 1, designed: 1, built: 1, proved: 1 });
    expect(obligation(good, 'EX-LEND', 'standard_rule')).toMatchObject({ total: 0 });
    // With no standard rule test, it is designed and built but not proved.
    const ws = await loadData(without(complete(), 'standard_rule_test', () => true));
    expect(obligation(ws, null, 'standard_rule')).toMatchObject({ total: 1, designed: 1, built: 1, proved: 0 });
    // Its test not automated yet, it is not proved and is counted as such.
    const later = await loadData(changing(complete(), 'standard_rule_test', () => true, { state: 'not automated yet' }));
    expect(obligation(later, null, 'standard_rule')).toMatchObject({ proved: 0, not_automated: 1 });
    // A test whose file does not name it proves nothing either.
    const silent = await loadData(complete(), { silent: ['EX-STD-CODE-R01-T01'] });
    expect(obligation(silent, null, 'standard_rule')).toMatchObject({ proved: 0 });
  });

  it('LA-AUT-UC16-R02-T02 A standard rule that nothing meets is reported as not designed, not built and not proved; naming it in text does not meet it', async () => {
    const ws = await loadData(adding(complete(), {
      standard_rule: [{ id: 'EX-STD-CODE-R02', title: 'Typed errors', standard_id: 'EX-STD-CODE', statement: 'Code MUST throw typed errors.' }],
      ui_component: [{ id: 'EX-UI02', title: 'ErrorBanner', file: 'web/errors.tsx', description: 'Shows errors as EX-STD-CODE-R02 asks.' }],
      renders: [{ source_id: 'EX-UI02', target_id: 'EX-V01' }],
    }));
    expect(gaps(ws)).toEqual(['designed EX-STD-CODE-R02', 'proved EX-STD-CODE-R02']);
    expect(ofCheck(ws, 'not-proved')).toEqual([expect.objectContaining({ severity: 'warning', record: 'EX-STD-CODE-R02', message: 'Standard rule EX-STD-CODE-R02 is not proved yet.' })]);
    expect(ws.links.filter((l) => l.target === 'EX-STD-CODE-R02')).toEqual([]);
  });
});
