import type { ServedData } from './read-view';
import { chooseAdd } from './add-menu';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import type { WriteAnswer } from '../../lathe/src/server/contract';
import { addRows, setRow } from './fixtures/load';
import { workspace } from './fixtures/workspace';
import { main, openApp } from './helpers';

// The Use case page and its editor (LA-AUT-A11): a record of a use case is read whole through the aggregate's own
// query, and changed only through the aggregate's own commands, one per change, each refusal shown with its reasons.

const ok: WriteAnswer = { ok: true, tables: [], files: [], changes: [] };
const toolbar = (id: string) => screen.getByRole('toolbar', { name: `Change ${id}` });

describe('LA-V101-R01-T01 a use case\'s page reads the use case whole through its own query, never a generic record read', () => {
  it('reads GET /api/use-case/get-use-case for the record, and shows its goal, actors, flows by interface and requirements', async () => {
    const { requests } = await openApp('/DM-SHOP-UC01');
    expect(await within(main()).findByText('A shopper adds an item.')).toBeInTheDocument();
    expect(requests).toContain('GET /api/use-case/get-use-case?id=DM-SHOP-UC01');
    expect(within(main()).getByRole('heading', { name: /Flows by interface/ })).toBeInTheDocument();
    expect(within(main()).getByRole('heading', { name: /^UC requirements/ })).toBeInTheDocument();
  });

  it('reads a requirement through its use case, and lists the steps that fulfill it', async () => {
    const { requests } = await openApp('/DM-SHOP-UC01-R01');
    const fulfilled = (await within(main()).findByRole('heading', { name: /Fulfilled by/ })).closest('section')!;
    expect(within(fulfilled).getByRole('link', { name: /DM-SHOP-UC01-FL01-S01/ })).toBeInTheDocument();
    expect(requests).toContain('GET /api/use-case/get-use-case?id=DM-SHOP-UC01-R01');
  });
});

describe('LA-V101-R02-T01 the Use case editor writes only through the aggregate\'s own commands, one per change', () => {
  it('Edit sends Change a use case with only what changed, and shows it changed', async () => {
    const user = userEvent.setup();
    const changed = (): ServedData => setRow(workspace(), 'use_case', 'DM-SHOP-UC01', { goal: 'A shopper adds an item they found.' });
    const { commands } = await openApp('/DM-SHOP-UC01', { command: () => ({ answer: ok, data: changed() }) });
    await within(main()).findByText('A shopper adds an item.');
    await user.click(within(toolbar('DM-SHOP-UC01')).getByRole('button', { name: 'Edit' }));
    const form = screen.getByRole('form', { name: 'Edit DM-SHOP-UC01' });
    const title = within(form).getByRole('textbox', { name: /^title/ });
    expect(title).toHaveFocus();
    const goal = within(form).getByRole('textbox', { name: /^goal/ });
    expect(goal.tagName).toBe('TEXTAREA');
    await user.clear(goal);
    await user.type(goal, 'A shopper adds an item they found.');
    await user.click(within(form).getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(commands).toEqual([{ route: '/api/use-case/change-use-case', input: { id: 'DM-SHOP-UC01', goal: 'A shopper adds an item they found.' } }]));
    expect(await within(main()).findByText('A shopper adds an item they found.')).toBeInTheDocument();
    await waitFor(() => expect(within(toolbar('DM-SHOP-UC01')).getByRole('button', { name: 'Edit' })).toHaveFocus());
  });

  it('adds a flow step from its flow\'s page, with the next free ID and position, and the requirement it fulfills', async () => {
    const user = userEvent.setup();
    const added = (): ServedData => addRows(workspace(), 'flow_step', { id: 'DM-SHOP-UC01-FL01-S04', title: 'Shop saves the basket', flow_id: 'DM-SHOP-UC01-FL01', path: 'main', position: 3 });
    const { commands } = await openApp('/DM-SHOP-UC01-FL01', { command: () => ({ answer: ok, data: added() }) });
    await within(main()).findByRole('heading', { name: /^Steps/ });
    await chooseAdd(user, toolbar('DM-SHOP-UC01-FL01'), 'Flow step');
    const form = screen.getByRole('form', { name: 'Add a flow step' });
    const id = within(form).getByRole('textbox', { name: /^ID/ });
    await waitFor(() => expect(id).toHaveValue('DM-SHOP-UC01-FL01-S04'));
    expect(within(form).getByRole('spinbutton', { name: /^position/ })).toHaveValue(3);
    await user.type(within(form).getByRole('textbox', { name: /^title/ }), 'Shop saves the basket');
    await user.type(within(form).getByRole('combobox', { name: /Add to Fulfills/ }), 'DM-SHOP-UC01-R01{Enter}');
    await user.click(within(form).getByRole('button', { name: 'Add flow step' }));
    await waitFor(() => expect(commands).toHaveLength(1));
    expect(commands[0]).toEqual({
      route: '/api/use-case/add-flow-step',
      input: { flow_id: 'DM-SHOP-UC01-FL01', id: 'DM-SHOP-UC01-FL01-S04', title: 'Shop saves the basket', path: 'main', position: 3, fulfills: ['DM-SHOP-UC01-R01'] } });
    await waitFor(() => expect(window.location.pathname).toBe('/DM-SHOP-UC01-FL01-S04'));
  });

  it('Move is its own action: it sends Move a use case to the capability chosen', async () => {
    const user = userEvent.setup();
    const { commands } = await openApp('/DM-SHOP-UC01', { command: () => ({ answer: ok }) });
    await within(main()).findByText('A shopper adds an item.');
    await user.click(within(toolbar('DM-SHOP-UC01')).getByRole('button', { name: 'Move' }));
    const form = screen.getByRole('form', { name: 'Move DM-SHOP-UC01' });
    await user.selectOptions(within(form).getByRole('combobox', { name: /^Capability/ }), 'DM-PAY-CAP01');
    await user.click(within(form).getByRole('button', { name: 'Move' }));
    await waitFor(() => expect(commands).toEqual([{ route: '/api/use-case/move-use-case', input: { id: 'DM-SHOP-UC01', capability_id: 'DM-PAY-CAP01' } }]));
  });

  it('offers Move only for a kind the aggregate has a Move command for', async () => {
    await openApp('/DM-SHOP-UC01-FL01');
    const actions = await screen.findByRole('toolbar', { name: 'Change DM-SHOP-UC01-FL01' });
    expect(within(actions).queryByRole('button', { name: 'Move' })).toBeNull();
    expect(within(actions).getAllByRole('button').map((b) => b.textContent)).toEqual(expect.arrayContaining(['Edit', 'Add…', 'Remove']));
  });

  it('adds a use case from its capability\'s page through the aggregate\'s own Add', async () => {
    const user = userEvent.setup();
    const { commands } = await openApp('/DM-SHOP-CAP01', { command: () => ({ answer: ok }) });
    // The capability's page is the Domain aggregate's, read before its actions show.
    const actions = await screen.findByRole('toolbar', { name: 'Change DM-SHOP-CAP01' });
    const add = within(actions).queryByRole('button', { name: 'Add use case' }) ?? within(actions).getByRole('button', { name: 'Add…' });
    await user.click(add);
    if (add.textContent === 'Add…') await user.click(screen.getByRole('button', { name: 'Use case' }));
    const form = screen.getByRole('form', { name: 'Add a use case' });
    await waitFor(() => expect(within(form).getByRole('textbox', { name: /^ID/ })).toHaveValue('DM-SHOP-UC02'));
    await user.type(within(form).getByRole('textbox', { name: /^title/ }), 'Empty the basket');
    await user.type(within(form).getByRole('textbox', { name: /^goal/ }), 'A shopper empties the basket.');
    await user.type(within(form).getByRole('textbox', { name: /^Actors/ }), 'Shopper');
    await user.click(within(form).getByRole('button', { name: 'Add use case' }));
    await waitFor(() => expect(commands).toEqual([{ route: '/api/use-case/add-use-case', input: { capability_id: 'DM-SHOP-CAP01', id: 'DM-SHOP-UC02', title: 'Empty the basket', goal: 'A shopper empties the basket.', actors: ['Shopper'] } }]));
  });
});

describe('LA-V101-R03-T01 a refused Use case command shows every reason in its own words, keeps what was entered, and changes nothing', () => {
  it('shows the rule\'s refusal at the top of the form, takes focus to it, and keeps the draft', async () => {
    const user = userEvent.setup();
    const refusal: WriteAnswer = { ok: false, error: 'refused', problems: [{ rule: 'step-fulfills-own-use-case', table: 'fulfills', key: 'DM-SHOP-UC01-FL01-S02', message: 'DM-SHOP-UC01-FL01-S02 fulfills DM-PAY-UC01-R01, a requirement of another use case' }] };
    const { commands } = await openApp('/DM-SHOP-UC01-FL01-S02', { command: () => ({ answer: refusal }) });
    await screen.findByRole('toolbar', { name: 'Change DM-SHOP-UC01-FL01-S02' });
    await user.click(within(toolbar('DM-SHOP-UC01-FL01-S02')).getByRole('button', { name: 'Edit' }));
    const form = screen.getByRole('form', { name: 'Edit DM-SHOP-UC01-FL01-S02' });
    const title = within(form).getByRole('textbox', { name: /^title/ });
    await user.type(title, ' at once');
    await user.click(within(form).getByRole('button', { name: 'Save' }));
    const alert = await within(form).findByRole('alert');
    expect(alert).toHaveTextContent('The change was refused. Nothing was saved.');
    expect(alert).toHaveTextContent('DM-SHOP-UC01-FL01-S02: DM-SHOP-UC01-FL01-S02 fulfills DM-PAY-UC01-R01, a requirement of another use case');
    expect(alert).toHaveFocus();
    expect(title).toHaveValue('Shop shows the basket at once');
    expect(commands).toEqual([{ route: '/api/use-case/change-flow-step', input: { id: 'DM-SHOP-UC01-FL01-S02', title: 'Shop shows the basket at once' } }]);
  });

  it('Remove names what goes with the record, sends its Remove, and shows the refusal naming what still references it', async () => {
    const user = userEvent.setup();
    const refusal: WriteAnswer = { ok: false, error: 'refused', problems: [{ rule: 'referenced', table: 'flow', key: 'DM-SHOP-UC01-FL01', message: 'Flow DM-SHOP-UC01-FL01 is referenced, so it stays: test DM-SHOP-T01 names it' }] };
    const { commands } = await openApp('/DM-SHOP-UC01-FL01', { command: () => ({ answer: refusal }) });
    await within(main()).findByRole('heading', { name: /^Steps/ });
    await user.click(within(toolbar('DM-SHOP-UC01-FL01')).getByRole('button', { name: 'Remove' }));
    const panel = screen.getByRole('region', { name: 'Remove DM-SHOP-UC01-FL01?' });
    expect(within(panel).getByRole('heading', { name: 'Remove DM-SHOP-UC01-FL01?' })).toHaveFocus();
    expect(panel).toHaveTextContent('with the 3 records under it');
    expect(commands).toEqual([]);
    await user.click(within(panel).getByRole('button', { name: 'Remove DM-SHOP-UC01-FL01' }));
    expect(await within(panel).findByRole('alert')).toHaveTextContent('test DM-SHOP-T01 names it');
    expect(commands).toEqual([{ route: '/api/use-case/remove-flow', input: { id: 'DM-SHOP-UC01-FL01' } }]);
    expect(window.location.pathname).toBe('/DM-SHOP-UC01-FL01');
  });
});
