// Authoring a domain model (LA-MOD-UC02, LA-MOD-UC10, LA-MOD-UC12, LA-MOD-UC20, LA-MOD-UC21): domains, entities,
// value objects and fields, commands, events and policies, rules, read models and queries, proved through the store,
// the engine's load and the reference.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { loadWorkspace, renderReference, type Reference, type Row, type SchemaDescription, type Workspace } from '../../src/index.ts';
import { everyKind } from '../store/fixture.ts';
import { adding, build, changing, complete, gaps, loadData, obligation, ofCheck, records, refusals, removeData, withTable, without } from '../helpers.ts';
import { described, latheReference, latheSchema, pairsOf, parentsOf, requiredOf } from '../shared.ts';

let schema: SchemaDescription;
let reference: Reference;
let good: Workspace;
beforeAll(async () => {
  [schema, reference, good] = await Promise.all([latheSchema(), latheReference(), loadData(complete())]);
});
afterAll(removeData);

const fieldsOf = (ws: Workspace, id: string, part: string) => ws.records.find((r) => r.id === id)!.parts[part] ?? [];

describe('domains', () => {
  it('LA-MOD-UC02-R01-T01 The reference says a domain is one business capability, and the domain-named-for-technology check calls it a vertical slice whose technology is its technical records', () => {
    const domain = reference.kinds.find((k) => k.kind === 'domain')!;
    expect(domain.description).toContain('for one business capability');
    const check = reference.checks.find((c) => c.check === 'domain-named-for-technology')!;
    expect(check).toMatchObject({ kinds: ['domain'], stage: 'domain-model', severity: 'warning' });
    expect(check.explanation).toContain('A domain is a vertical slice of business capability');
    expect(check.explanation).toContain('the technical records that implement them');
    expect(check.explanation).toContain('Technology is expressed through the technical kinds inside each domain, never as a domain of its own.');
    // The domain kind's entry in the reference links to the check.
    const text = renderReference(reference);
    const entry = text.slice(text.indexOf('<a id="kind-domain"></a>'), text.indexOf('<a id="kind-aggregate"></a>'));
    expect(entry).toContain('[`domain-named-for-technology`](#check-domain-named-for-technology)');
  });

  it('LA-MOD-UC02-R03-T01 Each domain says its subdomain type: core, supporting or generic', async () => {
    const column = schema.tables.domain.columns.find((c) => c.name === 'subdomain_type')!;
    expect(column).toMatchObject({ required: true, kind: 'enum', values: ['core', 'supporting', 'generic'] });
    expect(column.description).toContain("core: the product's edge");
    expect(column.description).toContain('how much modeling the domain deserves');
    expect(good.records.find((r) => r.id === 'EX-LEND')!.fields.subdomain_type).toBe('core');
    const domain = everyKind().domain[0];
    const { subdomain_type: _, ...untyped } = domain;
    expect(await refusals(withTable(everyKind(), 'domain', [untyped]))).toEqual([
      expect.objectContaining({ rule: 'required', file: 'data/domain.jsonl', line: 1, message: 'domain.subdomain_type is required' }),
    ]);
    expect(await refusals(withTable(everyKind(), 'domain', [{ ...domain, subdomain_type: 'platform' }]))).toEqual([
      expect.objectContaining({ rule: 'column', file: 'data/domain.jsonl', line: 1, message: expect.stringContaining('is not one of core, supporting, generic') }),
    ]);
  });
});

describe('entities and value objects', () => {
  it('LA-MOD-UC10-R01-T01 LA-MOD-UC24-R01-T01 An entity sits under an aggregate and needs a role, a value object has no owner, and entities link to entities by has_one and has_many', () => {
    expect(parentsOf(schema, 'entity')).toEqual(['aggregate.aggregate_id']);
    expect(requiredOf(schema, 'entity')).toEqual(['aggregate_id', 'role', 'description']);
    expect(schema.tables.entity.columns.find((c) => c.name === 'role')!.values).toEqual(['root', 'child']);
    expect(parentsOf(schema, 'value_object')).toEqual([]);
    expect(schema.kinds.value_object.idScope).toBe('product');
    expect(parentsOf(schema, 'constraint')).toEqual(['value_object.value_object_id']);
    // The four field tables, each a part of its record.
    for (const [table, owner] of [['entity_field', 'entity_id'], ['value_object_field', 'value_object_id'], ['event_field', 'domain_event_id'], ['read_model_field', 'read_model_id']]) {
      expect(schema.tables[table], table).toMatchObject({ role: 'part', ownerColumn: owner });
    }
    expect(pairsOf(schema, 'has_one')).toEqual(['entity>entity']);
    expect(pairsOf(schema, 'has_many')).toEqual(['entity>entity']);
    for (const k of described(reference, ['entity', 'value_object', 'constraint'], ['entity_field', 'value_object_field', 'event_field', 'read_model_field', 'has_one', 'has_many'])) {
      expect(k.stage, k.kind).toBe('domain-model');
    }
    expect(good.links).toContainEqual({ source: 'EX-LEND-EN01', relation: 'has_one', target: 'EX-LEND-EN02' });
  });

  it('LA-MOD-UC10-R01-T02 A well-formed domain model gives no entity problem, and each entity rule fails on its own data', async () => {
    expect(good.problems).toEqual([]);
    // A child its root does not reach is a warning; a has_many into another aggregate is refused.
    const broken = await loadData(without(complete(), 'has_one', () => true));
    expect(records(ofCheck(broken, 'entity-unreferenced'))).toEqual(['EX-LEND-EN02']);
    expect((await refusals(adding(complete(), { has_many: [{ source_id: 'EX-LEND-EN01', target_id: 'EX-LEND-EN03' }] }))).map((p) => p.rule)).toEqual(['has-crosses-aggregate']);
    // A second root, an entity with no role, and a has_one from an entity to itself are refused.
    const data = everyKind();
    expect((await refusals(changing(data, 'entity', (e) => e.id === 'TL-LEND-EN02', { role: 'root', in_root_table: undefined }))).map((p) => p.rule)).toEqual(['aggregate-root']);
    expect((await refusals(changing(data, 'entity', (e) => e.id === 'TL-LEND-EN01', { role: undefined }))).map((p) => p.rule)).toEqual(['required']);
    expect((await refusals(withTable(data, 'has_one', [{ source_id: 'TL-LEND-EN01', target_id: 'TL-LEND-EN01' }]))).length).toBeGreaterThan(0);
  });

  it("LA-MOD-UC10-R02-T01 An entity has its fields in order, each with a name, a meaning, exactly one type and whether it is required", async () => {
    const fields = fieldsOf(good, 'EX-LEND-EN01', 'entity_field');
    expect(fields.map((f) => [f.position, f.name])).toEqual([[1, 'Loan ID'], [2, 'Borrower email'], [3, 'Tool']]);
    expect(fields[0]).toMatchObject({ meaning: 'The loan number.', type: 'whole number', required: true });
    expect(fields[1]).toMatchObject({ type_value_object_id: 'EX-VO01', required: true });
    expect(fields[2]).toMatchObject({ type_aggregate_id: 'EX-LEND-A2' });
    expect(requiredOf(schema, 'entity_field')).toEqual(['entity_id', 'position', 'name', 'meaning', 'required']);
    // Exactly one type: none, or two, is refused.
    const first = (f: Row) => f.entity_id === 'TL-LEND-EN01' && f.position === 1;
    for (const typed of [{ type: undefined }, { type_value_object_id: 'TL-VO01' }]) {
      expect(await refusals(changing(everyKind(), 'entity_field', first, typed))).toEqual([
        expect.objectContaining({ rule: 'check', file: 'data/entity_field.jsonl', line: 1 }),
      ]);
    }
  });

  it("LA-PAT-AGGREGATE-COMMANDS-R09-T01 LA-PAT-AGGREGATE-COMMANDS-R09-T04 LA-PAT-AGGREGATE-COMMANDS-R09-T05 LA-PAT-AGGREGATE-COMMANDS-R09-T06 LA-PAT-AGGREGATE-COMMANDS-R09-T07 LA-PAT-AGGREGATE-COMMANDS-R09-T08 An entity's fields are rows of their own table under it, read back in position order, each naming its column when it has one", async () => {
    // Written out of order, read back by position.
    const shuffled = complete();
    shuffled.entity_field = [shuffled.entity_field[2], shuffled.entity_field[0], shuffled.entity_field[1], ...shuffled.entity_field.slice(3)];
    shuffled.entity_field[1] = { ...shuffled.entity_field[1], example: '31' };
    const ws = await loadData(shuffled);
    const fields = fieldsOf(ws, 'EX-LEND-EN01', 'entity_field');
    expect(fields.map((f) => [f.position, f.name])).toEqual([[1, 'Loan ID'], [2, 'Borrower email'], [3, 'Tool']]);
    expect(fields[0]).toMatchObject({ column_name: 'id', example: '31' });
    expect(fields[1].column_name ?? null).toBeNull();
    expect(fields[2]).toMatchObject({ column_name: 'tool_id' });
    // Only entities carry entity_field rows.
    for (const r of ws.records.filter((x) => x.kind !== 'entity')) expect(r.parts.entity_field, r.id).toBeUndefined();
  });

  it('LA-MOD-UC10-R02-T02 An entity, event or read model with no fields is a coverage gap', async () => {
    expect(gaps(good)).toEqual([]);
    const ws = await loadData(adding(complete(), {
      entity: [{ id: 'EX-LEND-EN04', title: 'Note', aggregate_id: 'EX-LEND-A1', role: 'child', in_root_table: true, description: 'A note on the loan.' }],
      domain_event: [{ id: 'EX-LEND-EV03', title: 'Note added', aggregate_id: 'EX-LEND-A1', published: false, description: 'A note was written on a loan.' }],
      read_model: [{ id: 'EX-LEND-RM02', title: 'Notes', domain_id: 'EX-LEND', description: 'The notes on each loan.' }],
      has_one: [{ source_id: 'EX-LEND-EN01', target_id: 'EX-LEND-EN04' }],
    }));
    const found = ws.coverage.flatMap((c) => c.gaps).filter((g) => g.missing.endsWith('-without-fields'));
    expect(found).toEqual([
      { id: 'EX-LEND-EN04', kind: 'entity', missing: 'entity-without-fields', message: 'Entity EX-LEND-EN04 lists no fields.' },
      { id: 'EX-LEND-EV03', kind: 'domain_event', missing: 'event-without-fields', message: 'Domain event EX-LEND-EV03 carries no fields.' },
      { id: 'EX-LEND-RM02', kind: 'read_model', missing: 'read-model-without-fields', message: 'Read model EX-LEND-RM02 lists no fields.' },
    ]);
  });

  it("LA-MOD-UC10-R08-T01 Another aggregate is referenced by a field typed by it: a foreign key in its own domain, a plain ID from another domain", async () => {
    // A field typed by another aggregate of its domain, held by a foreign key to that aggregate's table.
    expect(fieldsOf(good, 'EX-LEND-EN01', 'entity_field').find((f) => f.name === 'Tool')).toMatchObject({ type_aggregate_id: 'EX-LEND-A2' });
    const data = adding(everyKind(), {
      domain: [{ id: 'TL-SHOP', title: 'Shop', product_id: 'TL', position: 2, subdomain_type: 'supporting', description: 'Selling spare parts.' }],
      aggregate: [{ id: 'TL-SHOP-A1', title: 'Sale', domain_id: 'TL-SHOP', identity: 'Sale ID', description: 'One sale of parts.' }],
      entity: [{ id: 'TL-SHOP-EN01', title: 'Sale', aggregate_id: 'TL-SHOP-A1', role: 'root', description: 'The sale itself.' }],
      entity_field: [{ entity_id: 'TL-SHOP-EN01', position: 1, name: 'Loan', meaning: 'The loan the sale ends.', type_aggregate_id: 'TL-LEND-A1', required: true, column_name: 'loan_id' }],
      table: [{ id: 'TL-SHOP-EN01-TB', title: 'Sales', entity_id: 'TL-SHOP-EN01', name: 'sales', storage: 'table' }],
      table_key: [{ table_id: 'TL-SHOP-EN01-TB', position: 1, type: 'primary', columns: ['id'] }],
    });
    // From another domain, the field typed by the aggregate is a plain ID: it loads with no foreign key.
    expect(await refusals(data)).toEqual([]);
    // In its own domain, a foreign key holds the reference: the fixture's key from TL-LEND-RM01-TB to TL-LEND-EN01-TB loads.
    expect(everyKind().table_key[2]).toMatchObject({ type: 'foreign', target_table_id: 'TL-LEND-EN01-TB' });
    expect(await refusals(everyKind())).toEqual([]);
    // A foreign key into another domain's table is refused.
    const crossing = adding(data, { table_key: [{ table_id: 'TL-SHOP-EN01-TB', position: 2, type: 'foreign', columns: ['loan_id'], target_table_id: 'TL-LEND-EN01-TB' }] });
    expect(await refusals(crossing)).toEqual([
      expect.objectContaining({ rule: 'foreign-key-crosses-domain', message: expect.stringContaining('table TL-SHOP-EN01-TB is in domain TL-SHOP, so its foreign key cannot point at table TL-LEND-EN01-TB') }),
    ]);
    // A part link (has_one or has_many) into another aggregate is refused, never a way to refer to it.
    expect(await refusals(adding(complete(), { has_many: [{ source_id: 'EX-LEND-EN01', target_id: 'EX-LEND-EN03' }] }))).toEqual([
      expect.objectContaining({ rule: 'has-crosses-aggregate', message: expect.stringContaining('an entity of aggregate EX-LEND-A2: parts stay inside their aggregate; type a field by the other aggregate instead') }),
    ]);
  });
});

describe('commands, events and policies', () => {
  it('LA-MOD-UC12-R01-T01 LA-MOD-UC25-R01-T01 A domain event sits under an aggregate, a command under the entity it changes raises and checks, and a policy under a command hears one event and exchanges with integrations', () => {
    expect(parentsOf(schema, 'domain_event')).toEqual(['aggregate.aggregate_id']);
    expect(requiredOf(schema, 'domain_event')).toEqual(['aggregate_id', 'published', 'description']);
    expect(parentsOf(schema, 'command')).toEqual(['entity.entity_id']);
    expect(parentsOf(schema, 'policy')).toEqual(['command.command_id']);
    expect(pairsOf(schema, 'raises')).toEqual(['command>domain_event']);
    expect(schema.relations.raises.scope).toBe('aggregate');
    expect(pairsOf(schema, 'checks')).toEqual(['command>specification']);
    expect(pairsOf(schema, 'hears')).toEqual(['policy>domain_event']);
    expect(schema.tables.hears.unique).toContainEqual(['source_id']);
    // A policy, like a flow step, exchanges with the integrations it reaches as it acts.
    expect(pairsOf(schema, 'exchanges_with')).toEqual(['flow_step>integration', 'policy>integration']);
    described(reference, ['domain_event', 'command', 'policy'], ['raises', 'checks', 'hears', 'exchanges_with']);
    expect(reference.relations.find((r) => r.relation === 'raises')).toMatchObject({ forward_label: 'Raises', reverse_label: 'Raised by' });
    expect(reference.relations.find((r) => r.relation === 'hears')).toMatchObject({ forward_label: 'Hears', reverse_label: 'Heard by' });
  });

  it("LA-MOD-UC25-R02-T01 A domain event's fields are its event_field rows in position order, as an entity's are", async () => {
    const data = adding(complete(), {
      event_field: [{ domain_event_id: 'EX-LEND-EV01', position: 2, name: 'Due', meaning: 'When the tool is due.', type: 'date', required: true, example: '2026-11-01' }],
    });
    data.event_field = [data.event_field[2], data.event_field[0], data.event_field[1]];
    const ws = await loadData(data);
    expect(fieldsOf(ws, 'EX-LEND-EV01', 'event_field').map((f) => [f.position, f.name])).toEqual([[1, 'Loan'], [2, 'Due']]);
    expect(fieldsOf(ws, 'EX-LEND-EV01', 'event_field')[1]).toMatchObject({ meaning: 'When the tool is due.', type: 'date', required: true, example: '2026-11-01' });
    for (const r of ws.records.filter((x) => x.kind !== 'domain_event')) expect(r.parts.event_field, r.id).toBeUndefined();
    // The same shape as an entity's fields.
    const shape = (table: string) => schema.tables[table].columns.slice(1).map((c) => [c.name, c.required]);
    expect(shape('event_field')).toEqual(shape('entity_field'));
  });

  it('LA-MOD-UC25-R02-T02 A domain event with no fields is a gap, and a field without a name, or named twice, is refused', async () => {
    const ws = await loadData(without(complete(), 'event_field', (f) => f.domain_event_id === 'EX-LEND-EV02'));
    expect(gaps(ws)).toEqual(['event-without-fields EX-LEND-EV02']);
    const field = everyKind().event_field[0];
    expect(await refusals(withTable(everyKind(), 'event_field', [{ ...field, name: '  ' }]))).toEqual([
      expect.objectContaining({ rule: 'column', file: 'data/event_field.jsonl', line: 1, message: expect.stringContaining('event_field.name "  " is empty') }),
    ]);
    const { name: _, ...nameless } = field;
    expect(await refusals(withTable(everyKind(), 'event_field', [nameless]))).toEqual([
      expect.objectContaining({ rule: 'required', file: 'data/event_field.jsonl', line: 1, message: 'event_field.name is required' }),
    ]);
    // Named twice, as people read it: trimmed and in any letter case.
    const twice = await refusals(withTable(everyKind(), 'event_field', [field, { ...field, position: 2, name: ' loan id' }]));
    expect(twice).toEqual([expect.objectContaining({ file: 'data/event_field.jsonl', line: 2 })]);
  });

  it('LA-MOD-UC12-R06-T01 A command changes only its own aggregate, the one of the entity it sits under, and the schema keeps no way to record another', async () => {
    expect(schema.tables.command.columns.find((c) => c.name === 'entity_id')!.required).toBe(true);
    expect(Object.keys(schema.tables).filter((t) => /^command_|exception|_share$/.test(t))).toEqual(['command_handler']);
    const ws = await loadData(complete());
    expect(ws.problems).toEqual([]);
    // Data naming another aggregate a command changes has no table to load into.
    expect(await refusals(adding(complete(), { command_change: [{ command_id: 'EX-LEND-CMD01', aggregate_id: 'EX-LEND-A2', reason: 'Both at once.' }] }))).not.toEqual([]);
  });
});

describe('rules', () => {
  it('LA-MOD-UC20-R01-T01 Constraints sit under a value object, invariants under an aggregate, specifications have no owner and read one domain\'s aggregates, and policies sit under their command, each with a statement', async () => {
    expect(parentsOf(schema, 'constraint')).toEqual(['value_object.value_object_id']);
    expect(parentsOf(schema, 'invariant')).toEqual(['aggregate.aggregate_id']);
    expect(parentsOf(schema, 'specification')).toEqual([]);
    expect(schema.kinds.specification.idScope).toBe('domain');
    expect(parentsOf(schema, 'policy')).toEqual(['command.command_id']);
    for (const kind of ['constraint', 'invariant', 'specification', 'policy']) {
      expect(requiredOf(schema, kind), kind).toContain('statement');
      expect(schema.kinds[kind].obligation, kind).toBe(true);
    }
    expect(pairsOf(schema, 'reads')).toContain('specification>aggregate');
    expect(schema.relations.reads.scope).toBe('domain');
    expect(good.records.find((r) => r.id === 'EX-LEND-SP01')).toMatchObject({ parent: null, domain: 'EX-LEND' });
    // A specification reading another domain's aggregate is refused.
    const crossing = adding(everyKind(), {
      domain: [{ id: 'TL-SHOP', title: 'Shop', product_id: 'TL', position: 2, subdomain_type: 'supporting', description: 'Selling spare parts.' }],
      aggregate: [{ id: 'TL-SHOP-A1', title: 'Sale', domain_id: 'TL-SHOP', identity: 'Sale ID', description: 'One sale of parts.' }],
      reads: [{ source_id: 'TL-LEND-SP01', target_id: 'TL-SHOP-A1' }],
    });
    expect(await refusals(crossing)).toEqual([expect.objectContaining({ rule: 'link-scope', table: 'reads' })]);
    const { statement: _, ...bare } = everyKind().invariant[0];
    expect((await refusals(withTable(everyKind(), 'invariant', [bare]))).map((p) => p.message)).toEqual(['invariant.statement is required']);
  });

  it('LA-MOD-UC10-R09-T01 Uniqueness is an invariant that a unique key may name and back up, built only by its rule, and only a unique key may name one', async () => {
    // The unique key names the invariant, but the rule's file does not exist: the key builds nothing.
    const keyed = adding(complete(), { table_key: [{ table_id: 'EX-LEND-EN01-TB', position: 2, type: 'unique', columns: ['tool_id'], invariant_id: 'EX-LEND-INV01' }] });
    const [withKey, withRule] = await Promise.all([build(keyed, { missing: ['src/loans.ts'] }).then(loadWorkspace), build(keyed).then(loadWorkspace)]);
    expect(obligation(withKey, 'EX-LEND', 'invariant')).toMatchObject({ total: 1, built: 0 });
    expect(obligation(withRule, 'EX-LEND', 'invariant')).toMatchObject({ total: 1, built: 1 });
    expect(fieldsOf(withKey, 'EX-LEND-EN01-TB', 'table_key')[1]).toMatchObject({ type: 'unique', invariant_id: 'EX-LEND-INV01' });
    // A primary key or an index cannot name an invariant.
    for (const type of ['primary', 'index']) {
      const keys = changing(everyKind(), 'table_key', (k) => k.invariant_id === 'TL-LEND-INV01', { type, condition: undefined });
      expect((await refusals(keys)).map((p) => [p.rule, p.line]), type).toContainEqual(['check', 2]);
    }
  });
});

describe('read models, queries, domain services and terms', () => {
  it('LA-MOD-UC21-R01-T01 LA-MOD-UC02-R07-T01 Read models with their fields and reads, queries of one read model, domain services that commands and queries call, and terms are in the schema', () => {
    expect(parentsOf(schema, 'read_model')).toEqual(['domain.domain_id']);
    expect(schema.tables.read_model_field).toMatchObject({ role: 'part', ownerColumn: 'read_model_id' });
    expect(pairsOf(schema, 'reads')).toContain('read_model>aggregate');
    expect(parentsOf(schema, 'query')).toEqual(['read_model.read_model_id']);
    expect(parentsOf(schema, 'domain_service')).toEqual(['domain.domain_id']);
    expect(pairsOf(schema, 'calls')).toEqual(['command>domain_service', 'query>domain_service', 'read_model>domain_service']);
    expect(parentsOf(schema, 'term')).toEqual(['domain.domain_id']);
    expect(requiredOf(schema, 'term')).toEqual(['domain_id', 'meaning']);
    for (const k of described(reference, ['read_model', 'query', 'domain_service', 'term'], ['read_model_field', 'reads', 'calls'])) expect(k.stage, k.kind).toBe('domain-model');
    expect(good.links).toEqual(expect.arrayContaining([
      { source: 'EX-LEND-RM01', relation: 'reads', target: 'EX-LEND-A2' },
      { source: 'EX-LEND-CMD01', relation: 'calls', target: 'EX-LEND-DS01' },
    ]));
    expect(good.records.find((r) => r.id === 'EX-LEND-QRY01')).toMatchObject({ parent: 'EX-LEND-RM01', domain: 'EX-LEND' });
  });
});
