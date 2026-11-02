import type { ServedData } from './read-view';
import { chooseAdd } from './add-menu';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import type { WriteAnswer } from '../../lathe/src/server/contract';
import { addRows, setRow } from './fixtures/load';
import { workspace } from './fixtures/workspace';
import { main, openApp } from './helpers';

// The Domain event page and its editor (LA-MOD-A7, LA-V131): a domain event and its event type are read through the
// aggregate's own query, and changed only through the aggregate's own commands, one per change, each refusal shown with
// its reasons; an event shows the fields it carries and what raises and hears it.

const ok: WriteAnswer = { ok: true, tables: [], files: [], changes: [] };
const toolbar = (id: string) => screen.findByRole('toolbar', { name: `Change ${id}` });

/** The demo shop with a policy that hears the basket's event. */
function withPolicy(): ServedData {
  const w = workspace();
  addRows(w, 'policy', { id: 'DM-SHOP-PO01', title: 'Add again when an item is added', command_id: 'DM-SHOP-CMD01', statement: 'Whenever an item is added, it is added again.' });
  addRows(w, 'hears', { source_id: 'DM-SHOP-PO01', target_id: 'DM-SHOP-EV01' });
  return w;
}

describe('LA-V131-R05-T01 the Domain event editor writes only through the aggregate\'s own commands, one per change', () => {
  it('Edit sends Change a domain event with only what changed, and offers no Move', async () => {
    const user = userEvent.setup();
    const changed = () => setRow(withPolicy(), 'domain_event', 'DM-SHOP-EV01', { published: true });
    const { commands } = await openApp('/DM-SHOP-EV01', { data: withPolicy(), command: () => ({ answer: ok, data: changed() }) });
    const actions = await toolbar('DM-SHOP-EV01');
    expect(within(actions).getAllByRole('button').map((b) => b.textContent)).toEqual(['Edit', 'Add event type', 'Remove']);
    await user.click(within(actions).getByRole('button', { name: 'Edit' }));
    const form = screen.getByRole('form', { name: 'Edit DM-SHOP-EV01' });
    await user.click(within(form).getByRole('checkbox', { name: /^published/ }));
    await user.click(within(form).getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(commands).toEqual([{ route: '/api/domain-event/change-domain-event', input: { id: 'DM-SHOP-EV01', published: true } }]));
  });

  it('Add sends Add an event type with the event\'s one event type ID', async () => {
    const user = userEvent.setup();
    const { commands } = await openApp('/DM-SHOP-EV01', { data: withPolicy(), command: () => ({ answer: ok }) });
    await chooseAdd(user, await toolbar('DM-SHOP-EV01'), 'Event type');
    const form = screen.getByRole('form', { name: 'Add an event type' });
    await waitFor(() => expect(within(form).getByRole('textbox', { name: /^ID/ })).toHaveValue('DM-SHOP-EV01-ET'));
    await user.type(within(form).getByRole('textbox', { name: /^title/ }), 'ItemAdded');
    await user.selectOptions(within(form).getByRole('combobox', { name: /^delivery/ }), 'outbox');
    await user.click(within(form).getByRole('button', { name: 'Add event type' }));
    await waitFor(() => expect(commands).toEqual([{ route: '/api/domain-event/add-event-type', input: { domain_event_id: 'DM-SHOP-EV01', id: 'DM-SHOP-EV01-ET', title: 'ItemAdded', delivery: 'outbox' } }]));
  });
});

describe('LA-V131-R03-T01 a refused Domain event command shows every reason, keeps what was entered, and changes nothing', () => {
  it('a refused Change keeps the fields as entered and every reason at its top', async () => {
    const user = userEvent.setup();
    const refusal: WriteAnswer = { ok: false, error: 'refused', problems: [{ rule: 'field-names', table: 'event_field', key: 'DM-SHOP-EV01', message: 'Domain event DM-SHOP-EV01 names the field Basket twice' }] };
    const { commands } = await openApp('/DM-SHOP-EV01', { data: withPolicy(), command: () => ({ answer: refusal }) });
    await user.click(within(await toolbar('DM-SHOP-EV01')).getByRole('button', { name: 'Edit' }));
    const form = screen.getByRole('form', { name: 'Edit DM-SHOP-EV01' });
    await user.click(within(form).getByRole('button', { name: 'Add to Fields' }));
    const second = within(form).getByRole('group', { name: 'Fields: row 2' });
    await user.type(within(second).getByRole('textbox', { name: /^name 2/ }), 'Basket');
    await user.type(within(second).getByRole('textbox', { name: /^meaning 2/ }), 'The basket again.');
    await user.click(within(form).getByRole('button', { name: 'Save' }));
    const alert = await within(form).findByRole('alert');
    expect(alert).toHaveTextContent('The change was refused. Nothing was saved.');
    expect(alert).toHaveTextContent('names the field Basket twice');
    expect(alert).toHaveFocus();
    expect(commands.map((c) => c.route)).toEqual(['/api/domain-event/change-domain-event']);
    expect(within(second).getByRole('textbox', { name: /^name 2/ })).toHaveValue('Basket');
  });
});

describe('LA-V131-R04-T01 a domain event shows its fields, and its Traceability says what raises it and what hears it', () => {
  it('lists Raised by and Heard by in the relations\' own words', async () => {
    await openApp('/DM-SHOP-EV01', { data: withPolicy() });
    const trace = (await within(main()).findByRole('heading', { level: 2, name: 'Traceability' })).closest('section') as HTMLElement;
    expect(within(trace).getByRole('heading', { level: 3, name: /^Raised by/ })).toBeInTheDocument();
    expect(within(trace).getByRole('link', { name: /DM-SHOP-CMD01/ })).toBeInTheDocument();
    expect(within(trace).getByRole('heading', { level: 3, name: /^Heard by/ })).toBeInTheDocument();
    expect(within(trace).getByRole('link', { name: /DM-SHOP-PO01/ })).toBeInTheDocument();
  });
});
