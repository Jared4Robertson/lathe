// The Authoring invariants each aggregate's own rules.ts enforces (LA-AUT-INV15–19, INV22–25, INV40, INV180–185):
// the command that would break one is refused with the rule's name and its own message, before the schema's keys and
// checks underneath are reached, and nothing changes. A rule no command can break (the schema's shape already stops
// it at the command layer) is run on its own, over data that breaks it.
import { afterEach, describe, expect, it } from 'vitest';
import { CHANGE_ENTITY } from '../../src/authoring/aggregate/commands/change-entity.ts';
import { CHANGE_VALUE_OBJECT } from '../../src/authoring/value-object/commands/change-value-object.ts';
import { CHANGE_DOMAIN_EVENT } from '../../src/authoring/domain-event/commands/change-domain-event.ts';
import { CHANGE_READ_MODEL } from '../../src/authoring/read-model/commands/change-read-model.ts';
import { ADD_CAPABILITY } from '../../src/authoring/domain/commands/add-capability.ts';
import { ADD_FLOW_STEP } from '../../src/authoring/use-case/commands/add-flow-step.ts';
import { DECLARE_PRODUCT_KIND } from '../../src/authoring/product/commands/declare-product-kind.ts';
import { DECLARE_PRODUCT_RELATION } from '../../src/authoring/product/commands/declare-product-relation.ts';
import { productProblems } from '../../src/authoring/product/rules.ts';
import { productsFrom } from '../../src/authoring/product/model.ts';
import { repositoryPersistsOne } from '../../src/authoring/domain/rules.ts';
import type { AnyCommand } from '../../src/platform/commands/definition.ts';
import { runCommand } from '../../src/platform/commands/run.ts';
import { StoreError } from '../../src/platform/data/problems.ts';
import { openStore, type Store } from '../../src/platform/data/store.ts';
import { adding, complete, refusals, withTable, writeData, type Data } from '../helpers.ts';
import { everyKind } from '../store/fixture.ts';

const open: Store[] = [];
afterEach(async () => {
  for (const store of open.splice(0)) await store.close();
});

/** A store on the fixture, which has one record of every kind. */
async function store(): Promise<Store> {
  const opened = await openStore(writeData(everyKind()), { latheDataDir: null });
  open.push(opened);
  return opened;
}

/** The rules and messages a command is refused with, after checking the table it would write is unchanged. */
async function refused(on: Store, definition: AnyCommand, input: unknown, table: string): Promise<{ rule: string; message: string }[]> {
  const before = JSON.stringify(on.rows(table));
  try {
    await runCommand(on, definition, input);
  } catch (error) {
    if (!(error instanceof StoreError)) throw error;
    expect(JSON.stringify(on.rows(table))).toBe(before);
    return error.problems.map((p) => ({ rule: p.rule, message: p.message }));
  }
  throw new Error(`${definition.id} was not refused`);
}

const typed = { meaning: 'Something.', required: true };

/**
 * The problems loading the fixture brings, with the first field of a field table typed by two types, then by none: the
 * schema's check under the rule refuses each before any rule runs.
 */
async function typedOnLoad(table: string): Promise<unknown[]> {
  const data = everyKind();
  const { type: _t, type_value_object_id: _v, type_aggregate_id: _a, ...bare } = data[table][0];
  return [await refusals(withTable(data, table, [{ ...bare, type: 'text', type_aggregate_id: 'TL-LEND-A2' }])), await refusals(withTable(data, table, [bare]))];
}

/** The problems loading the fixture brings, with a second field of a field table named like its first but for spacing or case. */
async function namedOnLoad(table: string, name: string): Promise<unknown[]> {
  const [first] = everyKind()[table];
  return refusals(withTable(everyKind(), table, [first, { ...first, position: 2, name }]));
}
const refusedOn = (table: string, rule: string) => [expect.objectContaining({ rule, table })];

describe('LA-AUT-INV15-T an entity field with two types, or none, is refused by entity-field-one-type', () => {
  it('refuses each', async () => {
    const on = await store();
    expect(await refused(on, CHANGE_ENTITY, { id: 'TL-LEND-EN01', fields: [{ name: 'Loan ID', type: 'text', type_aggregate_id: 'TL-LEND-A2', ...typed }] }, 'entity_field')).toEqual([
      { rule: 'entity-field-one-type', message: 'field Loan ID of entity TL-LEND-EN01 is typed by text and TL-LEND-A2: a field has exactly one of a basic type, a value object or an aggregate' },
    ]);
    expect(await refused(on, CHANGE_ENTITY, { id: 'TL-LEND-EN01', fields: [{ name: 'Loan ID', ...typed }] }, 'entity_field')).toEqual([
      { rule: 'entity-field-one-type', message: 'field Loan ID of entity TL-LEND-EN01 is typed by nothing: a field has exactly one of a basic type, a value object or an aggregate' },
    ]);
  });

  it('is refused on load by the schema check under it', async () => {
    expect(await typedOnLoad('entity_field')).toEqual([refusedOn('entity_field', 'check'), refusedOn('entity_field', 'check')]);
  });
});

describe('LA-AUT-INV16-T an entity field named like another of its entity but for spacing or case is refused by entity-field-name', () => {
  it('refuses it, and keeps two names that differ in more', async () => {
    const on = await store();
    expect(await refused(on, CHANGE_ENTITY, { id: 'TL-LEND-EN01', fields: [{ name: 'Loan ID', type: 'text', ...typed }, { name: ' loan id ', type: 'text', ...typed }] }, 'entity_field')).toEqual([
      { rule: 'entity-field-name', message: "entity TL-LEND-EN01 already has a field named Loan ID, so its field 2 cannot be named  loan id : a field's name is its own in its entity, trimmed and in any letter case" },
    ]);
    await runCommand(on, CHANGE_ENTITY, { id: 'TL-LEND-EN01', fields: [{ name: 'Loan ID', type: 'text', ...typed }, { name: 'Loan IDs', type: 'text', ...typed }] });
    expect(on.rows('entity_field').filter((f) => f.entity_id === 'TL-LEND-EN01').map((f) => f.name)).toEqual(['Loan ID', 'Loan IDs']);
  });

  it('is refused on load by the unique key under it, naming the file and line; the same name in two entities loads', async () => {
    expect(await namedOnLoad('entity_field', ' loan id ')).toEqual([expect.objectContaining({ table: 'entity_field', file: expect.stringContaining('entity_field.jsonl'), line: 2 })]);
    const [loanId] = everyKind().entity_field;
    expect(await refusals(withTable(everyKind(), 'entity_field', [loanId, { ...loanId, position: 2, name: 'Loan IDs' }, { ...loanId, entity_id: 'TL-LEND-EN02', name: 'loan id' }]))).toEqual([]);
  });
});

describe('LA-AUT-INV180-T a value object field with two types, none, or its own value object, is refused by value-object-field-one-type', () => {
  it('refuses each', async () => {
    const on = await store();
    expect(await refused(on, CHANGE_VALUE_OBJECT, { id: 'TL-VO01', fields: [{ name: 'Address', type: 'text', type_aggregate_id: 'TL-LEND-A1', ...typed }] }, 'value_object_field')).toEqual([
      { rule: 'value-object-field-one-type', message: 'field Address of value object TL-VO01 is typed by text and TL-LEND-A1: a field has exactly one of a basic type, a value object or an aggregate' },
    ]);
    expect(await refused(on, CHANGE_VALUE_OBJECT, { id: 'TL-VO01', fields: [{ name: 'Address', ...typed }] }, 'value_object_field')).toEqual([
      { rule: 'value-object-field-one-type', message: 'field Address of value object TL-VO01 is typed by nothing: a field has exactly one of a basic type, a value object or an aggregate' },
    ]);
    expect(await refused(on, CHANGE_VALUE_OBJECT, { id: 'TL-VO01', fields: [{ name: 'Address', type_value_object_id: 'TL-VO01', ...typed }] }, 'value_object_field')).toEqual([
      { rule: 'value-object-field-one-type', message: 'field Address of value object TL-VO01 cannot be typed by its own value object' },
    ]);
  });

  it('is refused on load by the schema check under it', async () => {
    expect(await typedOnLoad('value_object_field')).toEqual([refusedOn('value_object_field', 'check'), refusedOn('value_object_field', 'check')]);
  });
});

describe('LA-AUT-INV181-T a value object field named like another of its value object but for case is refused by value-object-field-name', () => {
  it('refuses it', async () => {
    const on = await store();
    expect(await refused(on, CHANGE_VALUE_OBJECT, { id: 'TL-VO01', fields: [{ name: 'Address', type: 'text', ...typed }, { name: 'ADDRESS', type: 'text', ...typed }] }, 'value_object_field')).toEqual([
      { rule: 'value-object-field-name', message: "value object TL-VO01 already has a field named Address, so its field 2 cannot be named ADDRESS: a field's name is its own in its value object, trimmed and in any letter case" },
    ]);
  });

  it('is refused on load by the unique key under it', async () => {
    expect(await namedOnLoad('value_object_field', 'ADDRESS')).toEqual([expect.objectContaining({ table: 'value_object_field', line: 2 })]);
  });
});

describe('LA-AUT-INV182-T a domain event field with two types, or none, is refused by event-field-one-type', () => {
  it('refuses each', async () => {
    const on = await store();
    expect(await refused(on, CHANGE_DOMAIN_EVENT, { id: 'TL-LEND-EV01', fields: [{ name: 'Loan ID', type: 'text', type_aggregate_id: 'TL-LEND-A1', ...typed }] }, 'event_field')).toEqual([
      { rule: 'event-field-one-type', message: 'field Loan ID of domain event TL-LEND-EV01 is typed by text and TL-LEND-A1: a field has exactly one of a basic type, a value object or an aggregate' },
    ]);
    expect(await refused(on, CHANGE_DOMAIN_EVENT, { id: 'TL-LEND-EV01', fields: [{ name: 'Loan ID', ...typed }] }, 'event_field')).toEqual([
      { rule: 'event-field-one-type', message: 'field Loan ID of domain event TL-LEND-EV01 is typed by nothing: a field has exactly one of a basic type, a value object or an aggregate' },
    ]);
  });

  it('is refused on load by the schema check under it', async () => {
    expect(await typedOnLoad('event_field')).toEqual([refusedOn('event_field', 'check'), refusedOn('event_field', 'check')]);
  });
});

describe('LA-AUT-INV183-T a domain event field named like another of its event but for case is refused by event-field-name', () => {
  it('refuses it', async () => {
    const on = await store();
    expect(await refused(on, CHANGE_DOMAIN_EVENT, { id: 'TL-LEND-EV01', fields: [{ name: 'Loan ID', type: 'text', ...typed }, { name: 'LOAN ID', type: 'text', ...typed }] }, 'event_field')).toEqual([
      { rule: 'event-field-name', message: "domain event TL-LEND-EV01 already has a field named Loan ID, so its field 2 cannot be named LOAN ID: a field's name is its own in its event, trimmed and in any letter case" },
    ]);
  });

  it('is refused on load by the unique key under it', async () => {
    expect(await namedOnLoad('event_field', 'LOAN ID')).toEqual([expect.objectContaining({ table: 'event_field', line: 2 })]);
  });
});

describe('LA-AUT-INV184-T a read model field with two types, or none, is refused by read-model-field-one-type', () => {
  it('refuses each', async () => {
    const on = await store();
    expect(await refused(on, CHANGE_READ_MODEL, { id: 'TL-LEND-RM01', fields: [{ name: 'Days overdue', type: 'whole number', type_value_object_id: 'TL-VO01', ...typed }] }, 'read_model_field')).toEqual([
      { rule: 'read-model-field-one-type', message: 'field Days overdue of read model TL-LEND-RM01 is typed by whole number and TL-VO01: a field has exactly one of a basic type, a value object or an aggregate' },
    ]);
    expect(await refused(on, CHANGE_READ_MODEL, { id: 'TL-LEND-RM01', fields: [{ name: 'Days overdue', ...typed }] }, 'read_model_field')).toEqual([
      { rule: 'read-model-field-one-type', message: 'field Days overdue of read model TL-LEND-RM01 is typed by nothing: a field has exactly one of a basic type, a value object or an aggregate' },
    ]);
  });

  it('is refused on load by the schema check under it', async () => {
    expect(await typedOnLoad('read_model_field')).toEqual([refusedOn('read_model_field', 'check'), refusedOn('read_model_field', 'check')]);
  });
});

describe('LA-AUT-INV185-T a read model field named like another of its read model but for case is refused by read-model-field-name', () => {
  it('refuses it', async () => {
    const on = await store();
    expect(await refused(on, CHANGE_READ_MODEL, { id: 'TL-LEND-RM01', fields: [{ name: 'Days overdue', type: 'text', ...typed }, { name: 'days overdue', type: 'text', ...typed }] }, 'read_model_field')).toEqual([
      { rule: 'read-model-field-name', message: "read model TL-LEND-RM01 already has a field named Days overdue, so its field 2 cannot be named days overdue: a field's name is its own in its read model, trimmed and in any letter case" },
    ]);
  });

  it('is refused on load by the unique key under it', async () => {
    expect(await namedOnLoad('read_model_field', 'days overdue')).toEqual([expect.objectContaining({ table: 'read_model_field', line: 2 })]);
  });
});

describe('LA-AUT-INV17-T a second capability at a position of its domain is refused by capability-position; another domain may use it', () => {
  it('refuses it, and adds one at the next position', async () => {
    const on = await store();
    const capability = { id: 'TL-LEND-CAP02', title: 'Returns', domain_id: 'TL-LEND', position: 1, description: 'Taking tools back.' };
    expect(await refused(on, ADD_CAPABILITY, capability, 'capability')).toEqual([
      { rule: 'capability-position', message: 'capability TL-LEND-CAP01 is at position 1 of domain TL-LEND, so TL-LEND-CAP02 cannot be too: each capability of a domain has its own position' },
    ]);
    await runCommand(on, ADD_CAPABILITY, { ...capability, position: 2 });
    expect(on.rows('capability').map((c) => `${c.id} ${c.position}`)).toContain('TL-LEND-CAP02 2');
  });

  it('is refused on load by the unique key under it; another domain may use the position', async () => {
    const second = { id: 'TL-LEND-CAP02', title: 'Returns', domain_id: 'TL-LEND', position: 1, description: 'Taking tools back.' };
    const problems = await refusals(adding(everyKind(), { capability: [second] }));
    expect(problems).toEqual([expect.objectContaining({ rule: 'unique', table: 'capability', key: 'TL-LEND-CAP02', file: 'data/capability.jsonl', line: 2 })]);
    expect(problems[0].message).toBe('capability TL-LEND-CAP02 has the same domain_id, position as capability TL-LEND-CAP01: TL-LEND, 1');
    const catalog = { domain: [{ id: 'TL-CAT', title: 'Catalog', product_id: 'TL', subdomain_type: 'supporting', description: 'The tools the library holds.' }] };
    expect(await refusals(adding(everyKind(), {
      ...catalog,
      capability: [{ id: 'TL-CAT-CAP01', title: 'Listing', domain_id: 'TL-CAT', position: 1, description: 'Listing the tools on the shelf.' }, { ...second, position: 2 }],
    }))).toEqual([]);
  });
});

describe('LA-AUT-INV18-T a second step at a position of a path, compared trimmed and in any letter case, is refused by step-position; another path may use it', () => {
  it('refuses it, and adds the step on another path', async () => {
    const on = await store();
    const step = { id: 'TL-LEND-UC01-FL01-S02', title: 'Pick another tool', flow_id: 'TL-LEND-UC01-FL01', path: ' Main', position: 1 };
    expect(await refused(on, ADD_FLOW_STEP, step, 'flow_step')).toEqual([
      { rule: 'step-position', message: 'step TL-LEND-UC01-FL01-S01 is at position 1 of path main of TL-LEND-UC01-FL01, so TL-LEND-UC01-FL01-S02 cannot be too: each step on a path has its own position' },
    ]);
    await runCommand(on, ADD_FLOW_STEP, { ...step, path: 'refused' });
    expect(on.rows('flow_step')).toHaveLength(2);
  });
});

describe("LA-AUT-INV22-T a product kind declared twice, named like a Lathe table, or under no kind is refused by product-kind-declared", () => {
  it('refuses each', async () => {
    const on = await store();
    const kind = { product_id: 'TL', name: 'domain_note', label: 'Domain note', description: 'A note on a domain.', parent_kind: 'domain', obligation: false };
    expect(await refused(on, DECLARE_PRODUCT_KIND, { ...kind, name: 'aggregate' }, 'product_kind')).toEqual([
      { rule: 'product-kind-declared', message: 'The product kind aggregate has the name of a table Lathe already has; give it another name.' },
    ]);
    expect(await refused(on, DECLARE_PRODUCT_KIND, { ...kind, name: 'record_id' }, 'product_kind')).toEqual([
      { rule: 'product-kind-declared', message: 'The product kind record_id has the name of a table Lathe already has; give it another name.' },
    ]);
    expect(await refused(on, DECLARE_PRODUCT_KIND, { ...kind, parent_kind: 'gadget' }, 'product_kind')).toEqual([
      { rule: 'product-kind-declared', message: 'The product kind domain_note sits under gadget, which is not a kind.' },
    ]);
  });

  it("is refused on load before the schema is built; a kind of its own loads and leaves Lathe's kinds as they are", async () => {
    const rule = { name: 'domain_note', product_id: 'TL', label: 'Domain note', description: 'A note on a domain.', parent_kind: 'domain', obligation: false };
    const own = await openStore(writeData(adding(everyKind(), { product_kind: [rule], domain_note: [{ id: 'TL-LEND-NOTE01', title: 'Lending hours', domain_id: 'TL-LEND' }] })), { latheDataDir: null });
    open.push(own);
    const [scope] = await own.query<{ domain_id: string }>("SELECT domain_id FROM record_scope WHERE id = 'TL-LEND-NOTE01'");
    expect(scope.domain_id).toBe('TL-LEND');
    expect(own.schema.kinds.domain_note.parents).toEqual([{ kind: 'domain', column: 'domain_id' }]);
    const bare = await openStore(writeData({ product: [{ id: 'TL', title: 'Tool Library', description: 'A neighborhood tool library.' }] }), { latheDataDir: null });
    open.push(bare);
    for (const kind of ['domain', 'aggregate', 'command']) {
      expect(own.schema.kinds[kind].parents, kind).toEqual(bare.schema.kinds[kind].parents);
      const required = (s: typeof bare.schema) => s.tables[kind].columns.filter((c) => c.required).map((c) => c.name);
      expect(required(own.schema), kind).toEqual(required(bare.schema));
    }
    const declaring = (more: Data) => refusals(adding(everyKind(), more));
    expect(await declaring({ product_kind: [everyKind().product_kind[0]] })).toEqual([expect.objectContaining({ rule: 'primary-key', table: 'product_kind', file: 'data/product_kind.jsonl', line: 2 })]);
    for (const name of ['aggregate', 'record_id']) {
      expect(await declaring({ product_kind: [{ ...rule, name }] }), name).toEqual([
        expect.objectContaining({ rule: 'product-kind', table: 'product_kind', line: 2, message: `The product kind ${name} has the name of a table Lathe already has; give it another name.` }),
      ]);
    }
    expect(await declaring({ product_kind: [{ ...rule, parent_kind: 'gadget' }] })).toEqual([
      expect.objectContaining({ rule: 'product-kind', table: 'product_kind', message: 'The product kind domain_note sits under gadget, which is not a kind.' }),
    ]);
    expect(await declaring({ product_kind_field: [{ kind: 'aggregate', position: 1, name: 'owner', type: 'text', required: true, description: 'Who owns it.' }] })).toEqual([
      expect.objectContaining({ rule: 'product-kind', table: 'product_kind_field', file: 'data/product_kind_field.jsonl', line: 2, message: 'The field owner is of aggregate, which is not a product kind.' }),
    ]);
  });
});

describe("LA-AUT-INV23-T a pair Lathe's relation's ends do not accept, a pair naming no kind, or a new relation's pairs with different labels are refused by product-relation-own", () => {
  it('refuses each', async () => {
    const on = await store();
    const pair = { product_id: 'TL', name: 'documents', source_kind: 'cli_command', target_kind: 'endpoint', forward_label: 'Documents', reverse_label: 'Documented by', description: 'The CLI command is documented by the endpoint.' };
    expect(await refused(on, DECLARE_PRODUCT_RELATION, { ...pair, forward_label: 'Explains' }, 'product_relation')).toEqual([
      { rule: 'product-relation-own', message: 'The pairs of the relation documents give it different roles or labels; give every pair the same.' },
    ]);
    expect(await refused(on, DECLARE_PRODUCT_RELATION, { ...pair, target_kind: 'gadget' }, 'product_relation')).toEqual([
      { rule: 'product-relation-own', message: 'The relation documents links cli_command to gadget, and one of them is not a kind.' },
    ]);
    expect(await refused(on, DECLARE_PRODUCT_RELATION, { ...pair, name: 'reads', forward_label: 'Reads', reverse_label: 'Read by' }, 'product_relation')).toEqual([
      expect.objectContaining({ rule: 'product-relation-own', message: expect.stringMatching(/^Lathe's relation reads links .* so it cannot link cli_command to endpoint; give the relation a name of its own\.$/) }),
    ]);
  });

  it('is refused on load without both labels', async () => {
    const [documents] = everyKind().product_relation;
    const { reverse_label: _r, ...noReverse } = documents;
    expect(await refusals(withTable(everyKind(), 'product_relation', [noReverse]))).toEqual([expect.objectContaining({ rule: 'required', message: expect.stringContaining('reverse_label') })]);
    expect(await refusals(withTable(everyKind(), 'product_relation', [{ ...documents, forward_label: '  ' }]))).toEqual([expect.objectContaining({ table: 'product_relation' })]);
  });
});

describe("LA-AUT-INV24-T a product kind, kind field or relation without a description is refused by product-declaration-described", () => {
  it('refuses each blank description', async () => {
    const on = await store();
    const data = everyKind();
    const blank: Data = { ...data, product_kind: [{ ...data.product_kind[0], description: ' ' }], product_kind_field: [{ ...data.product_kind_field[0], description: '' }], product_relation: [{ ...data.product_relation[0], description: ' ' }] };
    const [product] = productsFrom((table) => (blank[table] ?? []) as never, () => undefined, 'TL');
    expect(productProblems(product, on).filter((p) => p.rule === 'product-declaration-described').map((p) => p.message)).toEqual([
      'The product kind cli_command of TL has no description; describe it, so the reference never shows a blank',
      'The field usage of cli_command of TL has no description; describe it, so the reference never shows a blank',
      'The relation documents from cli_command to view of TL has no description; describe it, so the reference never shows a blank',
    ]);
  });

  it('is refused on load without a description', async () => {
    const data = everyKind();
    expect(await refusals(withTable(data, 'product_kind', [{ ...data.product_kind[0], description: ' ' }]))).toEqual([expect.objectContaining({ table: 'product_kind' })]);
    const { description: _d, ...bare } = data.product_relation[0];
    expect(await refusals(withTable(data, 'product_relation', [bare]))).toEqual([expect.objectContaining({ rule: 'required', table: 'product_relation' })]);
  });
});

describe('LA-AUT-INV25-T has_one or has_many to an entity of another aggregate is refused by has-crosses-aggregate', () => {
  it('refuses the link, naming the other aggregate', async () => {
    expect(await refusals(adding(complete(), { has_many: [{ source_id: 'EX-LEND-EN01', target_id: 'EX-LEND-EN03' }] }))).toEqual([
      expect.objectContaining({
        rule: 'has-crosses-aggregate',
        table: 'has_many',
        message: 'EX-LEND-EN01 is an entity of aggregate EX-LEND-A1, so it cannot has_many EX-LEND-EN03, an entity of aggregate EX-LEND-A2: parts stay inside their aggregate; type a field by the other aggregate instead, or move the part into this one',
      }),
    ]);
  });
});

describe('LA-AUT-INV40-T a repository with a second persists link is refused by repository-persists-one', () => {
  it('refuses each link after the first of its repository', () => {
    expect(repositoryPersistsOne([
      { source_id: 'TL-LEND-REPO01', target_id: 'TL-LEND-A1' },
      { source_id: 'TL-LEND-REPO01', target_id: 'TL-LEND-A2' },
      { source_id: 'TL-LEND-REPO02', target_id: 'TL-LEND-A3' },
    ]).map((p) => [p.rule, p.message])).toEqual([
      ['repository-persists-one', 'repository TL-LEND-REPO01 already persists TL-LEND-A1, so it cannot also persist TL-LEND-A2: a repository persists one aggregate'],
    ]);
  });
});
