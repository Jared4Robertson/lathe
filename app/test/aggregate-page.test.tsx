import type { ServedData } from './read-view';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { AGGREGATE_COMMANDS } from '../../lathe/src/authoring/aggregate/commands/index';
import type { WriteAnswer } from '../../lathe/src/server/contract';
import type { AggregateCommands } from '../src/authoring/aggregate/commands';
import { addressOf } from '../src/views/address';
import { addRows, setRow } from './fixtures/load';
import { modelWorkspace } from './fixtures/model';
import { workspace } from './fixtures/workspace';
import { main, openApp, section } from './helpers';

// The Aggregate page and its editor (LA-AUT-A6, LA-V130): an aggregate and every record in it are read through the
// aggregate's own query, and changed only through the aggregate's own commands, one per change, each refusal shown with
// its reasons; the aggregate lists the domain events that happen to it with what raises and hears them.

const ok: WriteAnswer = { ok: true, tables: [], files: [], changes: [] };
const toolbar = (id: string) => screen.findByRole('toolbar', { name: `Change ${id}` });

/** The demo shop with a data model for the basket. */
function withModel(): ServedData {
  const w = workspace();
  addRows(w, 'data_model', { id: 'DM-SHOP-EN01-DM', title: 'Basket', entity_id: 'DM-SHOP-EN01', file: 'src/basket.ts' });
  return w;
}

describe('LA-V130-R01-T01 an aggregate\'s records are read through the Aggregate aggregate\'s own query, never a generic record read', () => {
  it('reads GET /api/aggregate/get-aggregate for the aggregate, and shows its identity, entities, invariants and events', async () => {
    const { requests } = await openApp('/DM-SHOP-A1', { data: withModel() });
    expect(await within(main()).findByText('Basket ID')).toBeInTheDocument();
    expect(requests).toContain('GET /api/aggregate/get-aggregate?id=DM-SHOP-A1');
    const entities = section(/^Entities/);
    expect([...entities.querySelectorAll('a.row-link')].map((a) => a.getAttribute('href'))).toEqual(['/DM-SHOP-EN01', '/DM-SHOP-EN02']);
    expect([...section(/^Invariants/).querySelectorAll('a.row-link')].map((a) => a.getAttribute('href'))).toEqual(['/DM-SHOP-INV01']);
  });

  it('shows an entity\'s fields with their types, its data model and the commands that change it', async () => {
    const { requests } = await openApp('/DM-SHOP-EN01', { data: withModel() });
    expect(await within(main()).findByText('The basket\'s number.')).toBeInTheDocument();
    expect(requests).toContain('GET /api/aggregate/get-aggregate?id=DM-SHOP-EN01');
    expect(within(section(/^Data model/)).getByRole('link', { name: /DM-SHOP-EN01-DM/ })).toBeInTheDocument();
    expect(within(section(/^Commands/)).getByRole('link', { name: /DM-SHOP-CMD01/ })).toBeInTheDocument();
  });

  it('holds the app\'s list of the aggregate\'s commands to its definitions, one to one', () => {
    const routes: (keyof AggregateCommands)[] = [
      '/api/aggregate/add-aggregate', '/api/aggregate/add-data-model', '/api/aggregate/add-entity', '/api/aggregate/add-invariant', '/api/aggregate/add-invariant-test', '/api/aggregate/add-rule',
      '/api/aggregate/change-aggregate', '/api/aggregate/change-data-model', '/api/aggregate/change-entity', '/api/aggregate/change-invariant', '/api/aggregate/change-invariant-test', '/api/aggregate/change-rule',
      '/api/aggregate/remove-aggregate', '/api/aggregate/remove-data-model', '/api/aggregate/remove-entity', '/api/aggregate/remove-invariant', '/api/aggregate/remove-invariant-test', '/api/aggregate/remove-rule',
    ];
    expect([...routes].sort()).toEqual(AGGREGATE_COMMANDS.map((c) => c.route).sort());
  });
});

describe('LA-V130-R02-T01 the Aggregate editor writes only through the aggregate\'s own commands, one per change', () => {
  it('Edit sends Change an invariant with only what changed, and offers no Move', async () => {
    const user = userEvent.setup();
    const changed = () => setRow(withModel(), 'invariant', 'DM-SHOP-INV01', { statement: 'A basket MUST NOT hold more than 40 items.' });
    const { commands, writes } = await openApp('/DM-SHOP-INV01', { data: withModel(), command: () => ({ answer: ok, data: changed() }) });
    const actions = await toolbar('DM-SHOP-INV01');
    // It has its test, so only its rule can be added under it.
    expect(within(actions).getAllByRole('button').map((b) => b.textContent)).toEqual(['Edit', 'Add rule', 'Remove']);
    await user.click(within(actions).getByRole('button', { name: 'Edit' }));
    const form = screen.getByRole('form', { name: 'Edit DM-SHOP-INV01' });
    const statement = within(form).getByRole('textbox', { name: /^statement/ });
    await user.clear(statement);
    await user.type(statement, 'A basket MUST NOT hold more than 40 items.');
    await user.click(within(form).getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(commands).toEqual([{ route: '/api/aggregate/change-invariant', input: { id: 'DM-SHOP-INV01', statement: 'A basket MUST NOT hold more than 40 items.' } }]));
    expect(writes).toEqual([]);
    expect(await within(main()).findByText('A basket MUST NOT hold more than 40 items.')).toBeInTheDocument();
  });

  it('Edit sends Change an entity with its fields as one list, a field renamed', async () => {
    const user = userEvent.setup();
    const { commands } = await openApp('/DM-SHOP-EN02', { data: withModel(), command: () => ({ answer: ok }) });
    await user.click(within(await toolbar('DM-SHOP-EN02')).getByRole('button', { name: 'Edit' }));
    const form = screen.getByRole('form', { name: 'Edit DM-SHOP-EN02' });
    const second = within(form).getByRole('group', { name: 'Fields: row 2' });
    const name = within(second).getByRole('textbox', { name: /^name 2/ });
    expect(name).toHaveValue('Quantity');
    await user.clear(name);
    await user.type(name, 'Count');
    await user.click(within(form).getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(commands).toEqual([{ route: '/api/aggregate/change-entity', input: { id: 'DM-SHOP-EN02', fields: [
      { name: 'Item', meaning: 'What is in the basket.', type: 'text', required: true },
      { name: 'Count', meaning: 'How many.', type_value_object_id: 'DM-VO01', required: true },
    ] } }]));
  });

  it('the aggregate\'s page offers Add for its own kinds and for a domain event, through the aggregates\' own Adds', async () => {
    const user = userEvent.setup();
    const { commands, writes } = await openApp('/DM-SHOP-A1', { data: withModel(), command: () => ({ answer: ok }) });
    const actions = await toolbar('DM-SHOP-A1');
    expect(within(actions).getAllByRole('button').map((b) => b.textContent)).toEqual(['Edit', 'Add entity', 'Add invariant', 'Add domain event', 'Remove']);
    await user.click(within(actions).getByRole('button', { name: 'Add invariant' }));
    const form = screen.getByRole('form', { name: 'Add an invariant' });
    await waitFor(() => expect(within(form).getByRole('textbox', { name: /^ID/ })).toHaveValue('DM-SHOP-INV02'));
    await user.type(within(form).getByRole('textbox', { name: /^title/ }), 'A line holds at least one item');
    await user.type(within(form).getByRole('textbox', { name: /^statement/ }), 'A basket line MUST hold at least one item.');
    await user.click(within(form).getByRole('button', { name: 'Add invariant' }));
    await waitFor(() => expect(commands).toEqual([{ route: '/api/aggregate/add-invariant', input: { aggregate_id: 'DM-SHOP-A1', id: 'DM-SHOP-INV02', title: 'A line holds at least one item', statement: 'A basket line MUST hold at least one item.' } }]));
    expect(writes).toEqual([]);
  });

  it('adds a domain event from the aggregate\'s page through the Domain event aggregate\'s own Add', async () => {
    const user = userEvent.setup();
    const { commands } = await openApp('/DM-SHOP-A1', { data: withModel(), command: () => ({ answer: ok }) });
    await user.click(within(await toolbar('DM-SHOP-A1')).getByRole('button', { name: 'Add domain event' }));
    const form = screen.getByRole('form', { name: 'Add a domain event' });
    await waitFor(() => expect(within(form).getByRole('textbox', { name: /^ID/ })).toHaveValue('DM-SHOP-EV02'));
    await user.type(within(form).getByRole('textbox', { name: /^title/ }), 'Item removed');
    await user.type(within(form).getByRole('textbox', { name: /^description/ }), 'An item left the basket.');
    await user.click(within(form).getByRole('button', { name: 'Add domain event' }));
    await waitFor(() => expect(commands).toEqual([{ route: '/api/domain-event/add-domain-event', input: { aggregate_id: 'DM-SHOP-A1', id: 'DM-SHOP-EV02', title: 'Item removed', published: false, description: 'An item left the basket.' } }]));
  });

  it('adds an aggregate from its domain\'s page through the aggregate\'s own Add', async () => {
    const user = userEvent.setup();
    const { commands } = await openApp('/DM-SHOP', { data: withModel(), command: () => ({ answer: ok }) });
    await user.click(within(await toolbar('DM-SHOP')).getByRole('button', { name: 'Add aggregate' }));
    const form = screen.getByRole('form', { name: 'Add an aggregate' });
    await waitFor(() => expect(within(form).getByRole('textbox', { name: /^ID/ })).toHaveValue('DM-SHOP-A2'));
    await user.type(within(form).getByRole('textbox', { name: /^title/ }), 'Wish list');
    await user.type(within(form).getByRole('textbox', { name: /^description/ }), 'The goods a person means to buy later.');
    await user.type(within(form).getByRole('textbox', { name: /^identity/ }), 'Wish list ID');
    await user.click(within(form).getByRole('button', { name: 'Add aggregate' }));
    await waitFor(() => expect(commands).toEqual([{ route: '/api/aggregate/add-aggregate', input: { domain_id: 'DM-SHOP', id: 'DM-SHOP-A2', title: 'Wish list', description: 'The goods a person means to buy later.', identity: 'Wish list ID' } }]));
  });

  it('Add sends Add a rule with the invariant\'s RL ID', async () => {
    const user = userEvent.setup();
    const { commands } = await openApp('/DM-SHOP-INV01', { data: withModel(), command: () => ({ answer: ok }) });
    await user.click(within(await toolbar('DM-SHOP-INV01')).getByRole('button', { name: 'Add rule' }));
    const form = screen.getByRole('form', { name: 'Add a rule' });
    await waitFor(() => expect(within(form).getByRole('textbox', { name: /^ID/ })).toHaveValue('DM-SHOP-INV01-RL'));
    await user.type(within(form).getByRole('textbox', { name: /^title/ }), 'basket-limit');
    await user.type(within(form).getByRole('textbox', { name: /^file/ }), 'src/basket/rules.ts');
    await user.click(within(form).getByRole('button', { name: 'Add rule' }));
    await waitFor(() => expect(commands).toEqual([{ route: '/api/aggregate/add-rule', input: { invariant_id: 'DM-SHOP-INV01', id: 'DM-SHOP-INV01-RL', title: 'basket-limit', file: 'src/basket/rules.ts' } }]));
  });
});

describe('LA-V130-R03-T01 a refused Aggregate command shows every reason, keeps what was entered, and changes nothing', () => {
  it('Remove sends Remove an entity and shows the refusal naming what still references it', async () => {
    const user = userEvent.setup();
    const refusal: WriteAnswer = { ok: false, error: 'refused', problems: [{ rule: 'referenced', table: 'entity', key: 'DM-SHOP-EN01', message: 'Entity DM-SHOP-EN01 is referenced, so it stays: command DM-SHOP-CMD01 sits under it' }] };
    const { commands } = await openApp('/DM-SHOP-EN01', { data: withModel(), command: () => ({ answer: refusal }) });
    await user.click(within(await toolbar('DM-SHOP-EN01')).getByRole('button', { name: 'Remove' }));
    const panel = screen.getByRole('region', { name: 'Remove DM-SHOP-EN01?' });
    expect(within(panel).getByRole('list', { name: 'What goes with DM-SHOP-EN01' })).toHaveTextContent('DM-SHOP-EN01-DM');
    await user.click(within(panel).getByRole('button', { name: 'Remove DM-SHOP-EN01' }));
    const alert = await within(panel).findByRole('alert');
    expect(alert).toHaveTextContent('The removal was refused. Nothing was changed.');
    expect(alert).toHaveTextContent('command DM-SHOP-CMD01 sits under it');
    expect(alert).toHaveFocus();
    expect(commands).toEqual([{ route: '/api/aggregate/remove-entity', input: { id: 'DM-SHOP-EN01' } }]);
    expect(window.location.pathname).toBe('/DM-SHOP-EN01');
  });

  it('a refused Change keeps the form open with what was entered and every reason at its top', async () => {
    const user = userEvent.setup();
    const refusal: WriteAnswer = { ok: false, error: 'refused', problems: [{ rule: 'one-root', table: 'entity', key: 'DM-SHOP-EN02', message: 'Aggregate DM-SHOP-A1 has two root entities: DM-SHOP-EN01 and DM-SHOP-EN02' }] };
    const { commands } = await openApp('/DM-SHOP-EN02', { data: withModel(), command: () => ({ answer: refusal }) });
    await user.click(within(await toolbar('DM-SHOP-EN02')).getByRole('button', { name: 'Edit' }));
    const form = screen.getByRole('form', { name: 'Edit DM-SHOP-EN02' });
    await user.selectOptions(within(form).getByRole('combobox', { name: /^role/ }), 'root');
    await user.click(within(form).getByRole('button', { name: 'Save' }));
    const alert = await within(form).findByRole('alert');
    expect(alert).toHaveTextContent('The change was refused. Nothing was saved.');
    expect(alert).toHaveTextContent('Aggregate DM-SHOP-A1 has two root entities');
    expect(alert).toHaveFocus();
    expect(commands).toEqual([{ route: '/api/aggregate/change-entity', input: { id: 'DM-SHOP-EN02', role: 'root' } }]);
    expect(within(form).getByRole('combobox', { name: /^role/ })).toHaveValue('root');
  });
});

describe('LA-V130-R04-T01 an aggregate lists its domain events, each saying what raises it and how many policies hear it', () => {
  it('lists them titled "Domain events", each row a whole link to its event in the relations\' own words', async () => {
    await openApp(`${addressOf('P-D-A3')}?stage=graph`, { data: modelWorkspace() });
    await screen.findByRole('heading', { level: 1, name: 'Loan' });
    const list = within(section(/^Domain events/)).getByRole('list', { name: 'Domain events of P-D-A3' });
    const rows = within(list).getAllByRole('listitem');
    expect(rows.map((r) => r.textContent)).toEqual([
      'P-D-EV01Loan openedRaised by Open loanHeard by 1',
      'P-D-EV02Thing returnedRaised by Return thing',
    ]);
    // Each row is one link to its event (LA-PAT-APP-UX-R05).
    expect(within(rows[0]).getAllByRole('link')).toHaveLength(1);
    expect(within(rows[0]).getByRole('link')).toHaveAttribute('href', addressOf('P-D-EV01'));

    await openApp(`${addressOf('P-D-A2')}?stage=graph`, { data: modelWorkspace() });
    await screen.findByRole('heading', { level: 1, name: 'Member' });
    const member = within(within(section(/^Domain events/)).getByRole('list', { name: 'Domain events of P-D-A2' })).getAllByRole('listitem');
    expect(member.map((r) => r.textContent)).toEqual(['P-D-EV03Member joinedpublishedRaised by Register member']);
  });
});
