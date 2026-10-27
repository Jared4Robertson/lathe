import { describe, expect, it } from 'vitest';
import {
  childKinds,
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
  referrersOf,
  removedWith,
  suggestId,
} from '../src/edit/form';
import { addRows, indexOf } from './fixtures/load';
import { workspace } from './fixtures/workspace';
import { entityWorkspace } from './fixtures/entities';
import { patternWorkspace } from './fixtures/patterns';
import { apisWorkspace } from './fixtures/apis-and-design-flows';

// The record form, generated from the schema description.

describe('form generation from the schema', () => {
  const index = indexOf(workspace());
  const { schema } = index.workspace;

  it('gives every column but the ID and the parent columns a typed input, in the table\'s order', () => {
    expect(formFields(schema, 'requirement').map((f) => [f.name, f.input, f.required])).toEqual([
      ['title', 'line', true],
      ['statement', 'text', true],
      ['group_name', 'line', false],
    ]);
    const test = formFields(schema, 'test');
    expect(test.map((f) => f.name)).not.toContain('domain_id');
    expect(test.map((f) => f.name)).not.toContain('capability_id');
    // An enum is a choice of its values; a text field holding prose is a text area.
    expect(test.find((f) => f.name === 'state')).toMatchObject({ input: 'choice', values: ['automated', 'manual', 'planned'], required: true });
    expect(test.find((f) => f.name === 'then')).toMatchObject({ input: 'text', required: false });
    // A whole number, an optional true/false (a choice, so it can be left out), each with the column's meaning.
    expect(formFields(schema, 'capability').find((f) => f.name === 'position')).toMatchObject({ input: 'integer', type: 'integer' });
    expect(formFields(schema, 'pattern_rule').find((f) => f.name === 'applies_when_negated')).toMatchObject({ input: 'choice', type: 'boolean', values: ['true', 'false'] });
    expect(formFields(schema, 'requirement')[1].description).toMatch(/MUST/);
  });

  it('turns the text of each input into the value its column takes', () => {
    const fields = Object.fromEntries([...formFields(schema, 'capability'), ...formFields(schema, 'pattern_rule'), ...formFields(schema, 'check')].map((f) => [f.name, f]));
    expect(fieldValue(fields.position, ' 3 ')).toBe(3);
    expect(fieldValue(fields.applies_when_negated, 'true')).toBe(true);
    expect(fieldValue(fields.applies_when_negated, '')).toBeNull();
    expect(fieldValue(fields.kinds, 'test\n\n use_case ')).toEqual(['test', 'use_case']);
    expect(fieldValue(fields.title, '  Spaced  ')).toBe('Spaced');
  });

  it('lists the part tables a kind owns, without the owner or the position the form keeps', () => {
    const parts = partForms(schema, 'use_case');
    expect(parts.map((p) => p.table)).toEqual(['setting_value', 'use_case_actor', 'use_case_step']);
    const steps = parts.find((p) => p.table === 'use_case_step')!;
    expect(steps.position).toBe('position');
    expect(steps.fields.map((f) => f.name)).toEqual(['description']);
    expect(partForms(schema, 'entity')[0].fields.map((f) => f.name)).toEqual(['name', 'meaning', 'type', 'example']);
  });

  it('offers as parents only records of the allowed parent kinds in the same product, and never the record\'s own subtree', () => {
    const groups = parentChoices(index, 'use_case', 'DM');
    expect(groups.map((g) => g.kind)).toEqual(['domain']);
    expect(groups[0].records.map((r) => r.id)).toEqual(['DM-PAY', 'DM-SHOP']);
    expect(parentChoices(index, 'domain', 'DM', 'DM-SHOP')[0].records.map((r) => r.id)).toEqual(['DM']);
    // A use case cannot move under its own requirement's subtree; the requirement offers use cases only.
    expect(parentChoices(index, 'requirement', 'DM', 'DM-SHOP-UC01-R01')[0].records.map((r) => r.id)).toEqual(['DM-PAY-UC01', 'DM-SHOP-UC01']);
  });

  it('offers the links a kind may start, each limited to its valid targets in the same product', () => {
    const links = linkForms(index, 'component');
    expect(links.map((l) => l.relation)).toEqual(['depends_on', 'implements', 'meets', 'reacts_to', 'satisfies']);
    const satisfies = links.find((l) => l.relation === 'satisfies')!;
    expect(satisfies.targets).toEqual(['domain_rule', 'requirement', 'pattern_rule', 'interaction_requirement']);
    const targets = linkTargets(index, satisfies, 'DM', 'DM-SHOP-C01').map((r) => r.id);
    expect(targets).toEqual(['DM-PAY-UC01-R01', 'DM-SHOP-DR01', 'DM-SHOP-UC01-R01', 'DM-SHOP-UC01-R02']);
    // A question may be about any record of its product.
    const about = linkForms(index, 'question').find((l) => l.relation === 'about')!;
    expect(about.targets).toEqual(['*']);
    expect(linkTargets(index, about, 'NF', null).map((r) => r.id)).toEqual(['NF', 'NF-NOTE']);
  });

  it('lists the kinds that may sit under a kind', () => {
    expect(childKinds(schema, 'use_case')).toEqual(['requirement', 'question']);
    expect(childKinds(schema, 'requirement')).toEqual([]);
  });
});

describe('IDs for new records', () => {
  it('suggests the next free number in the kind\'s convention, or the start of a named ID', () => {
    const index = indexOf(workspace());
    expect(suggestId(index, 'requirement', 'DM-SHOP-UC01')).toBe('DM-SHOP-UC01-R03');
    expect(suggestId(index, 'use_case', 'DM-SHOP')).toBe('DM-SHOP-UC02');
    expect(suggestId(index, 'question', 'DM-SHOP')).toBe('DM-SHOP-Q02');
    expect(suggestId(index, 'question', 'DM')).toBe('DM-Q02');
    expect(suggestId(index, 'interaction_requirement', 'DM-SHOP-V01')).toBe('DM-SHOP-V01-R01');
    expect(suggestId(index, 'interaction_requirement', 'DM-SHOP')).toBe('DM-SHOP-IR01');
    expect(suggestId(index, 'pattern', 'DM')).toBe('DM-PAT-');
    expect(suggestId(index, 'domain', 'DM')).toBe('DM-');
  });
});

describe('parent columns of a new record', () => {
  it('fills the columns that are required or share a key with the parent\'s, from its ancestry', () => {
    const index = indexOf(entityWorkspace());
    expect(parentValues(index, 'domain_rule', 'P-D-EN03')).toEqual({ entity_id: 'P-D-EN03', aggregate_id: 'P-D-A3', domain_id: 'P-D' });
    const apis = indexOf(apisWorkspace());
    // Under an endpoint inside an API: the endpoint and the domain, not the API (one container only).
    expect(parentValues(apis, 'interaction_requirement', 'DM-SHOP-E01')).toEqual({ endpoint_id: 'DM-SHOP-E01', domain_id: 'DM-SHOP' });
    expect(parentValues(apis, 'question', 'DM-SHOP-UC01')).toEqual({ use_case_id: 'DM-SHOP-UC01', domain_id: 'DM-SHOP', product_id: 'DM' });
  });
});

describe('commands from a draft', () => {
  it('adds a new record with its parent columns, parts and links in one write', () => {
    const index = indexOf(workspace());
    const draft = newDraft(index, 'use_case', 'DM-SHOP');
    expect(draft.id).toBe('DM-SHOP-UC02');
    draft.values.title = 'Empty the basket';
    draft.values.goal = 'A shopper empties the basket.';
    draft.parts.use_case_actor = [{ role_name: 'Shopper' }];
    draft.parts.use_case_step = [{ description: 'The shopper asks.' }, { description: 'The basket empties.' }];
    draft.links.applies = ['DM-SHOP-DR01'];
    const { commands, places } = commandsFor(index, 'use_case', draft, null);
    expect(commands).toEqual([
      { op: 'add', table: 'use_case', row: { id: 'DM-SHOP-UC02', domain_id: 'DM-SHOP', title: 'Empty the basket', goal: 'A shopper empties the basket.' } },
      { op: 'link', relation: 'applies', source: 'DM-SHOP-UC02', target: 'DM-SHOP-DR01' },
      { op: 'add', table: 'use_case_actor', row: { use_case_id: 'DM-SHOP-UC02', position: 1, role_name: 'Shopper' } },
      { op: 'add', table: 'use_case_step', row: { use_case_id: 'DM-SHOP-UC02', position: 1, description: 'The shopper asks.' } },
      { op: 'add', table: 'use_case_step', row: { use_case_id: 'DM-SHOP-UC02', position: 2, description: 'The basket empties.' } },
    ]);
    expect(places).toEqual(['fields', 'links:applies', 'parts:use_case_actor', 'parts:use_case_step', 'parts:use_case_step']);
  });

  it('changes only what changed: the columns set or cleared, a move, links taken and added, and a part table written again', () => {
    const data = workspace();
    addRows(data, 'use_case_step', { use_case_id: 'DM-SHOP-UC01', position: 1, description: 'Pick.' });
    const index = indexOf(data);
    const record = index.byId.get('DM-SHOP-UC01')!;
    const draft = draftOf(index, record);
    expect(draft.parent).toBe('DM-SHOP');
    expect(draft.links.applies).toEqual(['DM-SHOP-DR01']);
    expect(draftProblems(index, 'use_case', draft, false).size).toBe(0);
    // Nothing changed: no commands.
    expect(commandsFor(index, 'use_case', draft, record).commands).toEqual([]);

    draft.values.title = 'Add an item';
    draft.values.goal = '';
    draft.parent = 'DM-PAY';
    draft.links.applies = [];
    draft.parts.use_case_step = [{ description: 'Pick.' }, { description: 'Add.' }];
    expect(commandsFor(index, 'use_case', draft, record).commands).toEqual([
      { op: 'set', table: 'use_case', key: 'DM-SHOP-UC01', changes: { title: 'Add an item', goal: null } },
      { op: 'move', id: 'DM-SHOP-UC01', parent: 'DM-PAY' },
      { op: 'unlink', relation: 'applies', source: 'DM-SHOP-UC01', target: 'DM-SHOP-DR01' },
      { op: 'remove', table: 'use_case_step', key: { use_case_id: 'DM-SHOP-UC01', position: 1 } },
      { op: 'add', table: 'use_case_step', row: { use_case_id: 'DM-SHOP-UC01', position: 1, description: 'Pick.' } },
      { op: 'add', table: 'use_case_step', row: { use_case_id: 'DM-SHOP-UC01', position: 2, description: 'Add.' } },
    ]);
  });

  it('finds what the form can see before it writes: a missing or taken ID, a required field, a bad number, no parent', () => {
    const index = indexOf(patternWorkspace());
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
  it('names what still references the record, and what goes with it', () => {
    const index = indexOf(patternWorkspace());
    const referrers = referrersOf(index, 'DM-SHOP-UC01').map((r) => `${r.id} ${r.how}`);
    expect(referrers).toEqual(['DM-SHOP-UC01-R01 sits under it', 'DM-SHOP-UC01-R02 sits under it']);
    expect(referrersOf(index, 'DM-PAT-CHECKOUT').map((r) => r.how)).toEqual(expect.arrayContaining(['links to it (follows)', 'names it in a setting value row']));
    expect(removedWith(index, 'DM-SHOP-UC01')).toEqual({ parts: 3, links: 2 });
  });
});
