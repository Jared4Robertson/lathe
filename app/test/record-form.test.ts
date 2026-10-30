import { describe, expect, it } from 'vitest';
import {
  addableKinds,
  commandsFor,
  draftOf,
  draftProblems,
  fieldValue,
  formFields,
  linkForms,
  linkTargets,
  newDraft,
  parentChoices,
  parentValues,
  partForms,
  recordChoices,
  referrersOf,
  removedWith,
  suggestId } from '../src/edit/form';
import { indexOf } from './fixtures/load';
import { workspace } from './fixtures/workspace';
import { modelWorkspace } from './fixtures/model';
import { patternWorkspace } from './fixtures/patterns';

// The record form, generated from the schema description.

describe('form generation from the schema', () => {
  const index = recordIndexOf(workspace());
  const { schema } = index.workspace;

  it('LA-V92-R30-T02 gives every column but the ID and the parent columns an input, in the table\'s order', () => {
    expect(formFields(schema, 'uc_requirement').map((f) => [f.name, f.input, f.required])).toEqual([
      ['title', 'line', true],
      ['statement', 'text', true],
      ['group_name', 'line', false],
    ]);
    expect(formFields(schema, 'use_case_test').map((f) => f.name)).not.toContain('uc_requirement_id');
  });

  it('LA-V92-R30-T02 gives each input the type of its column', () => {
    const test = formFields(schema, 'use_case_test');
    // An enum is a choice of its values; a text field holding prose is a text area.
    expect(test.find((f) => f.name === 'state')).toMatchObject({ input: 'choice', values: ['automated', 'manual', 'not automated yet'], required: true });
    expect(test.find((f) => f.name === 'then')).toMatchObject({ input: 'text', required: true });
    expect(test.find((f) => f.name === 'notes')).toMatchObject({ input: 'text', required: false });
    // A whole number, an optional true/false (a choice, so it can be left out), each with the column's meaning.
    expect(formFields(schema, 'capability').find((f) => f.name === 'position')).toMatchObject({ input: 'integer', type: 'integer' });
    expect(formFields(schema, 'pattern_rule').find((f) => f.name === 'applies_when_negated')).toMatchObject({ input: 'choice', type: 'boolean', values: ['true', 'false'] });
    expect(formFields(schema, 'uc_requirement')[1].description).toMatch(/MUST/);
    // A column naming a record of one kind is a choice among those records: a pattern rule test's domain.
    expect(formFields(schema, 'pattern_rule_test').find((f) => f.name === 'domain_id')).toMatchObject({ input: 'record', references: 'domain', required: true });
  });

  it('LA-V92-R30-T02 turns the text of each input into the value its column takes', () => {
    const fields = Object.fromEntries([...formFields(schema, 'capability'), ...formFields(schema, 'pattern_rule'), ...formFields(schema, 'check')].map((f) => [f.name, f]));
    expect(fieldValue(fields.position, ' 3 ')).toBe(3);
    expect(fieldValue(fields.applies_when_negated, 'true')).toBe(true);
    expect(fieldValue(fields.applies_when_negated, '')).toBeNull();
    expect(fieldValue(fields.kinds, 'command\n\n query ')).toEqual(['command', 'query']);
    expect(fieldValue(fields.title, '  Spaced  ')).toBe('Spaced');
  });

  it('LA-V92-R30-T02 lists the part tables a kind owns, without the owner or the position the form keeps, their references as record choices', () => {
    expect(partForms(schema, 'use_case').map((p) => p.table)).toEqual(['setting_value', 'use_case_actor']);
    const fields = partForms(schema, 'entity').find((p) => p.table === 'entity_field')!;
    expect(fields.position).toBe('position');
    expect(fields.fields.map((f) => [f.name, f.input])).toEqual([
      ['name', 'line'], ['meaning', 'text'], ['type', 'choice'], ['type_value_object_id', 'record'], ['type_aggregate_id', 'record'],
      ['required', 'boolean'], ['column_name', 'line'], ['example', 'line'],
    ]);
    // A table's keys name the invariant a unique key enforces and the table a foreign key points at.
    const keys = partForms(schema, 'table').find((p) => p.table === 'table_key')!;
    expect(keys.fields.filter((f) => f.input === 'record').map((f) => [f.name, f.references])).toEqual([['invariant_id', 'invariant'], ['target_table_id', 'table']]);
    // A command's recorded exceptions name another aggregate and why.
    expect(partForms(schema, 'command').map((p) => [p.table, p.fields.map((f) => f.name)])).toEqual([['command_change', ['aggregate_id', 'reason']]]);
  });

  it('LA-V92-R30-T03 offers a field naming a record the records of its kind in the same product', () => {
    const model = recordIndexOf(modelWorkspace());
    const field = partForms(model.workspace.schema, 'entity').find((p) => p.table === 'entity_field')!.fields.find((f) => f.name === 'type_aggregate_id')!;
    expect(recordChoices(model, field, 'P').map((r) => r.id)).toEqual(['P-D-A1', 'P-D-A2', 'P-D-A3', 'P-D-A4', 'P-E-A1']);
    expect(recordChoices(index, field, 'NF').map((r) => r.id)).toEqual(['NF-NOTE-A1']);
  });

  it('LA-V92-R30-T03 offers as parents only records of the allowed parent kinds in the same product, and never the record\'s own subtree', () => {
    const groups = parentChoices(index, 'use_case', 'DM');
    expect(groups.map((g) => g.kind)).toEqual(['capability']);
    expect(groups[0].records.map((r) => r.id)).toEqual(['DM-PAY-CAP01', 'DM-SHOP-CAP01']);
    expect(parentChoices(index, 'domain', 'DM', 'DM-SHOP')[0].records.map((r) => r.id)).toEqual(['DM']);
    // Where a record may sit under either of two kinds, both are offered: an endpoint under a command or a query.
    expect(parentChoices(index, 'endpoint', 'DM').map((g) => [g.kind, g.records.map((r) => r.id)])).toEqual([
      ['command', ['DM-SHOP-CMD01']],
      ['query', ['DM-SHOP-QRY01']],
    ]);
    // A kind with no owner has no parent to choose.
    expect(parentChoices(index, 'view', 'DM')).toEqual([]);
  });

  it('LA-V92-R30-T03 offers the links a kind may start, each limited to its valid targets in the same product', () => {
    const links = linkForms(index, 'flow_step');
    expect(links.map((l) => l.relation)).toEqual(['exchanges_with', 'fulfills', 'happens_in', 'invokes']);
    const invokes = links.find((l) => l.relation === 'invokes')!;
    expect(invokes.targets).toEqual(['command', 'query']);
    expect(linkTargets(index, invokes, 'DM', 'DM-SHOP-UC01-FL01-S01').map((r) => r.id)).toEqual(['DM-SHOP-CMD01', 'DM-SHOP-QRY01']);
    // A question may be about any record of its product.
    const about = linkForms(index, 'question').find((l) => l.relation === 'about')!;
    expect(about.targets).toEqual(['*']);
    expect(linkTargets(index, about, 'NF', null).map((r) => r.id)).toEqual(['NF', 'NF-NOTE', 'NF-NOTE-A1']);
  });

  it('LA-V92-R31-T03 lists the kinds that may be added from a page: what may sit under it, and on a product or domain the kinds with no owner of its scope', () => {
    expect(addableKinds(schema, 'use_case')).toEqual(['uc_requirement', 'flow']);
    expect(addableKinds(schema, 'uc_requirement')).toEqual(['use_case_test']);
    expect(addableKinds(schema, 'command')).toEqual(['policy', 'endpoint', 'command_handler']);
    expect(addableKinds(schema, 'product')).toEqual(['business_outcome', 'domain', 'value_object', 'pattern', 'interface', 'view', 'integration', 'data_store', 'ui_component', 'standard', 'question']);
    expect(addableKinds(schema, 'domain')).toEqual(expect.arrayContaining(['aggregate', 'specification', 'read_model', 'capability', 'question']));
    expect(addableKinds(schema, 'domain')).not.toContain('value_object');
  });
});

describe('IDs for new records', () => {
  it('LA-V92-R31-T03 suggests the next free number in the kind\'s convention, or the start of a named ID', () => {
    const index = recordIndexOf(workspace());
    expect(suggestId(index, 'uc_requirement', 'DM-SHOP-UC01')).toBe('DM-SHOP-UC01-R03');
    expect(suggestId(index, 'use_case', 'DM-SHOP-CAP01')).toBe('DM-SHOP-UC02');
    expect(suggestId(index, 'aggregate', 'DM-SHOP')).toBe('DM-SHOP-A2');
    // A flow's ID ends in the number of the first interface its use case has no flow through, or is left to finish.
    expect(suggestId(index, 'flow', 'DM-PAY-UC01')).toBe('DM-PAY-UC01-FL');
    expect(suggestId(index, 'use_case_test', 'DM-SHOP-UC01-R01')).toBe('DM-SHOP-UC01-R01-T02');
    expect(suggestId(index, 'invariant_test', 'DM-SHOP-INV01')).toBe('DM-SHOP-INV01-T');
    // An endpoint takes its domain's scope from its command or query.
    expect(suggestId(index, 'endpoint', 'DM-SHOP-QRY01')).toBe('DM-SHOP-EP02');
    // Of two alternatives, the one that says most: a domain's question, or the product's.
    expect(suggestId(index, 'question', 'DM-SHOP')).toBe('DM-SHOP-Q02');
    expect(suggestId(index, 'question', 'DM')).toBe('DM-Q02');
    // A kind with no owner takes its scope from the page it is added from.
    expect(suggestId(index, 'value_object', 'DM')).toBe('DM-VO02');
    expect(suggestId(index, 'view', 'DM')).toBe('DM-V02');
    expect(suggestId(index, 'specification', 'DM-SHOP')).toBe('DM-SHOP-SP02');
    expect(suggestId(index, 'pattern', 'DM')).toBe('DM-PAT-');
    expect(suggestId(index, 'domain', 'DM')).toBe('DM-');
  });
});

describe('parent columns of a new record', () => {
  it('LA-V92-R31-T03 fills the one column naming the parent\'s kind', () => {
    const index = recordIndexOf(workspace());
    expect(parentValues(index, 'endpoint', 'DM-SHOP-QRY01')).toEqual({ query_id: 'DM-SHOP-QRY01' });
    expect(parentValues(index, 'endpoint', 'DM-SHOP-CMD01')).toEqual({ command_id: 'DM-SHOP-CMD01' });
    expect(parentValues(index, 'question', 'DM-SHOP')).toEqual({ domain_id: 'DM-SHOP' });
    expect(parentValues(index, 'question', 'DM')).toEqual({ product_id: 'DM' });
  });
});

describe('commands from a draft', () => {
  it('LA-V92-R08-T02 adds a new record with its parent column, parts and links in one write', () => {
    const index = recordIndexOf(workspace());
    const draft = newDraft(index, 'use_case', 'DM-SHOP-CAP01');
    expect(draft.id).toBe('DM-SHOP-UC02');
    draft.values.title = 'Empty the basket';
    draft.values.goal = 'A shopper empties the basket.';
    draft.parts.use_case_actor = [{ role_name: 'Shopper' }, { role_name: 'Clerk' }];
    const { commands, places } = commandsFor(index, 'use_case', draft, null);
    expect(commands).toEqual([
      { op: 'add', table: 'use_case', row: { id: 'DM-SHOP-UC02', capability_id: 'DM-SHOP-CAP01', title: 'Empty the basket', goal: 'A shopper empties the basket.' } },
      { op: 'add', table: 'use_case_actor', row: { use_case_id: 'DM-SHOP-UC02', position: 1, role_name: 'Shopper' } },
      { op: 'add', table: 'use_case_actor', row: { use_case_id: 'DM-SHOP-UC02', position: 2, role_name: 'Clerk' } },
    ]);
    expect(places).toEqual(['fields', 'parts:use_case_actor', 'parts:use_case_actor']);
  });

  it('LA-V92-R31-T03 adds a kind with no owner without a parent column: its ID gives its product', () => {
    const index = recordIndexOf(workspace());
    const draft = newDraft(index, 'view', 'DM');
    expect(draft).toMatchObject({ id: 'DM-V02', parent: '' });
    draft.values.title = 'Checkout';
    expect(draftProblems(index, 'view', draft, true).has('parent')).toBe(false);
    expect(commandsFor(index, 'view', draft, null).commands).toEqual([{ op: 'add', table: 'view', row: { id: 'DM-V02', title: 'Checkout' } }]);
  });

  it('LA-V92-R08-T02 a form opened and left as it was sends no write', () => {
    const index = recordIndexOf(workspace());
    const record = index.byId.get('DM-SHOP-UC01-FL01-S01')!;
    const draft = draftOf(index, record);
    expect(draftProblems(index, 'flow_step', draft, false).size).toBe(0);
    expect(commandsFor(index, 'flow_step', draft, record).commands).toEqual([]);
  });

  it('LA-V92-R29-T02 changes only what changed: the columns set or cleared, a move, links taken and added, and a part table written again', () => {
    const index = recordIndexOf(workspace());
    const record = index.byId.get('DM-SHOP-UC01-FL01-S01')!;
    const draft = draftOf(index, record);
    expect(draft.parent).toBe('DM-SHOP-UC01-FL01');
    expect(draft.links.invokes).toEqual(['DM-SHOP-CMD01']);

    draft.values.title = 'Shopper adds it';
    draft.links.invokes = ['DM-SHOP-QRY01'];
    expect(commandsFor(index, 'flow_step', draft, record).commands).toEqual([
      { op: 'set', table: 'flow_step', key: 'DM-SHOP-UC01-FL01-S01', changes: { title: 'Shopper adds it' } },
      { op: 'unlink', relation: 'invokes', source: 'DM-SHOP-UC01-FL01-S01', target: 'DM-SHOP-CMD01' },
      { op: 'link', relation: 'invokes', source: 'DM-SHOP-UC01-FL01-S01', target: 'DM-SHOP-QRY01' },
    ]);

    // A column cleared is set to null: a view's route.
    const view = index.byId.get('DM-V01')!;
    const cleared = draftOf(index, view);
    cleared.values.route = '';
    expect(commandsFor(index, 'view', cleared, view).commands).toEqual([{ op: 'set', table: 'view', key: 'DM-V01', changes: { route: null } }]);

    // An endpoint moves between its two kinds of parent.
    const endpoint = index.byId.get('DM-SHOP-EP01')!;
    const moved = draftOf(index, endpoint);
    moved.parent = 'DM-SHOP-QRY01';
    expect(commandsFor(index, 'endpoint', moved, endpoint).commands).toEqual([{ op: 'move', id: 'DM-SHOP-EP01', parent: 'DM-SHOP-QRY01' }]);

    // A part table changed is written again: an entity's fields.
    const entity = index.byId.get('DM-SHOP-EN02')!;
    const fields = draftOf(index, entity);
    fields.parts.entity_field = [fields.parts.entity_field[1]];
    expect(commandsFor(index, 'entity', fields, entity).commands).toEqual([
      { op: 'remove', table: 'entity_field', key: { entity_id: 'DM-SHOP-EN02', position: 1 } },
      { op: 'remove', table: 'entity_field', key: { entity_id: 'DM-SHOP-EN02', position: 2 } },
      { op: 'add', table: 'entity_field', row: { entity_id: 'DM-SHOP-EN02', position: 1, name: 'Quantity', meaning: 'How many.', type_value_object_id: 'DM-VO01', required: true } },
    ]);
  });

  it('LA-V92-R30-T02 finds what the form can see before it writes: a missing or taken ID, a required field, a bad number, no parent', () => {
    const index = recordIndexOf(patternWorkspace());
    const draft = newDraft(index, 'capability', null);
    draft.id = 'DM-SHOP-UC01';
    draft.values.position = 'two';
    const problems = draftProblems(index, 'capability', draft, true);
    expect(problems.get('id')).toBe('DM-SHOP-UC01 is already a record.');
    expect(problems.get('field:title')).toBe('Title is required.');
    expect(problems.get('field:position')).toBe('Give a whole number.');
    expect(problems.get('parent')).toBe('Choose where it sits.');
  });
});

describe('before a removal', () => {
  it('LA-V92-R32-T03 names what still references the record, and what goes with it', () => {
    const index = recordIndexOf(patternWorkspace());
    const referrers = referrersOf(index, 'DM-SHOP-UC01').map((r) => `${r.id} ${r.how}`);
    expect(referrers).toEqual(['DM-SHOP-UC01-FL01 sits under it', 'DM-SHOP-UC01-R01 sits under it', 'DM-SHOP-UC01-R02 sits under it']);
    expect(referrersOf(index, 'DM-PAT-AUDIT').map((r) => r.how)).toEqual(expect.arrayContaining(['links to it (follows)', 'names it in a setting value row']));
    // A value object is named by the fields typed by it.
    expect(referrersOf(index, 'DM-VO01').map((r) => `${r.id} ${r.how}`)).toEqual(['DM-VO01-C01 sits under it', 'DM-SHOP-EN02 names it in a entity field row', 'DM-PAY-EV01 names it in a event field row']);
    expect(removedWith(index, 'DM-SHOP-UC01')).toEqual({ parts: 1, links: 1 });
  });
});
