import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { ServedData } from './read-view';
import { chooseAdd } from './add-menu';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import type { WriteAnswer } from '../../lathe/src/server/contract';
import { addRows, setRow } from './fixtures/load';
import { workspace } from './fixtures/workspace';
import { main, openApp } from './helpers';

// The Use case page and its editor (LA-UCS-A11): a record of a use case is read whole through the aggregate's own
// query, and changed only through the aggregate's own commands, one per change, each refusal shown with its reasons.

const ok: WriteAnswer = { ok: true, tables: [], files: [], changes: [] };
const toolbar = (id: string) => screen.getByRole('toolbar', { name: `Change ${id}` });

describe('LA-V101-R01-T01 a use case\'s page reads the use case whole through its own query, never a generic record read', () => {
  it('reads GET /api/use-case/get-use-case for the record, and shows its goal, actors, flow and requirements', async () => {
    const { requests } = await openApp('/DM-SHOP-UC01');
    expect(await within(main()).findByText('A shopper adds an item.')).toBeInTheDocument();
    expect(requests).toContain('GET /api/use-case/get-use-case?id=DM-SHOP-UC01');
    expect(within(main()).getByRole('heading', { name: /^Flow\s*1/ })).toBeInTheDocument();
    expect(within(main()).getByRole('heading', { name: /^UC requirements/ })).toBeInTheDocument();
  });

  it('reads a requirement through its use case, and lists the steps that fulfill it', async () => {
    const { requests } = await openApp('/DM-SHOP-UC01-R01');
    const fulfilled = (await within(main()).findByRole('heading', { name: /Fulfilled by/ })).closest('section')!;
    expect(within(fulfilled).getByRole('link', { name: /DM-SHOP-UC01-FL-S01/ })).toBeInTheDocument();
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
    const added = (): ServedData => addRows(workspace(), 'flow_step', { id: 'DM-SHOP-UC01-FL-S04', title: 'Shop saves the basket', flow_id: 'DM-SHOP-UC01-FL', path: 'main', position: 3 });
    const { commands } = await openApp('/DM-SHOP-UC01-FL', { command: () => ({ answer: ok, data: added() }) });
    await within(main()).findByRole('heading', { name: /^Steps/ });
    await chooseAdd(user, toolbar('DM-SHOP-UC01-FL'), 'Flow step');
    const form = screen.getByRole('form', { name: 'Add a flow step' });
    const id = within(form).getByRole('textbox', { name: /^ID/ });
    await waitFor(() => expect(id).toHaveValue('DM-SHOP-UC01-FL-S04'));
    expect(within(form).getByRole('spinbutton', { name: /^position/ })).toHaveValue(3);
    await user.type(within(form).getByRole('textbox', { name: /^title/ }), 'Shop saves the basket');
    await user.type(within(form).getByRole('combobox', { name: /Add to Fulfills/ }), 'DM-SHOP-UC01-R01{Enter}');
    await user.click(within(form).getByRole('button', { name: 'Add flow step' }));
    await waitFor(() => expect(commands).toHaveLength(1));
    expect(commands[0]).toEqual({
      route: '/api/use-case/add-flow-step',
      input: { flow_id: 'DM-SHOP-UC01-FL', id: 'DM-SHOP-UC01-FL-S04', title: 'Shop saves the basket', path: 'main', position: 3, fulfills: ['DM-SHOP-UC01-R01'] } });
    await waitFor(() => expect(window.location.pathname).toBe('/DM-SHOP-UC01-FL-S04'));
  });

  it('Move is its own action: it sends Move a use case to the domain chosen, with a result there, and goes to its new ID', async () => {
    const user = userEvent.setup();
    const data = addRows(workspace(), 'use_case', { id: 'DM-SHOP-UC02', title: 'Empty the basket', domain_id: 'DM-SHOP', goal: 'A shopper empties the basket.', result_id: 'DM-SHOP-CMD01' });
    const { commands } = await openApp('/DM-SHOP-UC02', { data, command: () => ({ answer: ok }) });
    await within(main()).findByText('A shopper empties the basket.');
    await user.click(within(toolbar('DM-SHOP-UC02')).getByRole('button', { name: 'Move' }));
    const form = screen.getByRole('form', { name: 'Move DM-SHOP-UC02' });
    const result = within(form).getByRole('combobox', { name: /^Result/ });
    expect(result).toHaveValue('DM-SHOP-CMD01');
    // Choosing a domain offers its own commands and queries as the result, the old one no longer chosen.
    await user.selectOptions(within(form).getByRole('combobox', { name: /^Domain/ }), 'DM-PAY');
    expect(result).toHaveValue('');
    expect(within(result).getAllByRole('option').map((o) => o.getAttribute('value')).filter(Boolean)).toEqual(['DM-PAY-CMD01']);
    await user.selectOptions(result, 'DM-PAY-CMD01');
    await user.click(within(form).getByRole('button', { name: 'Move' }));
    await waitFor(() => expect(commands).toEqual([{ route: '/api/use-case/move-use-case', input: { id: 'DM-SHOP-UC02', domain_id: 'DM-PAY', result_id: 'DM-PAY-CMD01' } }]));
    await waitFor(() => expect(window.location.pathname).toBe('/DM-PAY-UC02'));
  });

  it('LA-V101-R14-T01 Move sends Move a UC requirement to the use case chosen, and goes to its next free number there', async () => {
    const user = userEvent.setup();
    const { commands } = await openApp('/DM-SHOP-UC01-R01', { command: () => ({ answer: ok }) });
    await user.click(within(await screen.findByRole('toolbar', { name: 'Change DM-SHOP-UC01-R01' })).getByRole('button', { name: 'Move' }));
    const form = screen.getByRole('form', { name: 'Move DM-SHOP-UC01-R01' });
    await user.selectOptions(within(form).getByRole('combobox', { name: /^Use case/ }), 'DM-PAY-UC01');
    await user.click(within(form).getByRole('button', { name: 'Move' }));
    await waitFor(() => expect(commands).toEqual([{ route: '/api/use-case/move-uc-requirement', input: { id: 'DM-SHOP-UC01-R01', use_case_id: 'DM-PAY-UC01' } }]));
    await waitFor(() => expect(window.location.pathname).toBe('/DM-PAY-UC01-R02'));
  });

  it('offers Move only for a kind the aggregate has a Move command for', async () => {
    await openApp('/DM-SHOP-UC01-FL');
    const actions = await screen.findByRole('toolbar', { name: 'Change DM-SHOP-UC01-FL' });
    expect(within(actions).queryByRole('button', { name: 'Move' })).toBeNull();
    expect(within(actions).getAllByRole('button').map((b) => b.textContent)).toEqual(expect.arrayContaining(['Edit', 'Add…', 'Remove']));
  });

  it('adds a use case from its domain\'s page through the aggregate\'s own Add, its result one of the domain\'s', async () => {
    const user = userEvent.setup();
    const { commands } = await openApp('/DM-SHOP', { command: () => ({ answer: ok }) });
    // The domain's page is the Domain aggregate's, read before its actions show.
    const actions = await screen.findByRole('toolbar', { name: 'Change DM-SHOP' });
    const add = within(actions).queryByRole('button', { name: 'Add use case' }) ?? within(actions).getByRole('button', { name: 'Add…' });
    await user.click(add);
    if (add.textContent === 'Add…') await user.click(screen.getByRole('button', { name: 'Use case' }));
    const form = screen.getByRole('form', { name: 'Add a use case' });
    await waitFor(() => expect(within(form).getByRole('textbox', { name: /^ID/ })).toHaveValue('DM-SHOP-UC02'));
    await user.type(within(form).getByRole('textbox', { name: /^title/ }), 'Empty the basket');
    await user.type(within(form).getByRole('textbox', { name: /^goal/ }), 'A shopper empties the basket.');
    const result = within(form).getByRole('combobox', { name: /^Result/ });
    expect(within(result).getAllByRole('option').map((o) => o.getAttribute('value')).filter(Boolean)).toEqual(['DM-SHOP-CMD01', 'DM-SHOP-QRY01']);
    await user.selectOptions(result, 'DM-SHOP-CMD01');
    await user.type(within(form).getByRole('textbox', { name: /^Actors/ }), 'Shopper');
    await user.click(within(form).getByRole('button', { name: 'Add use case' }));
    await waitFor(() => expect(commands).toEqual([{ route: '/api/use-case/add-use-case', input: { domain_id: 'DM-SHOP', id: 'DM-SHOP-UC02', title: 'Empty the basket', goal: 'A shopper empties the basket.', result_id: 'DM-SHOP-CMD01', actors: ['Shopper'] } }]));
  });

  it('Edit offers its domain\'s commands and queries as Result (LA-PAT-FIELD-INPUTS), and sends a new one as result_id', async () => {
    const user = userEvent.setup();
    const { commands } = await openApp('/DM-SHOP-UC01', { command: () => ({ answer: ok }) });
    await within(main()).findByText('A shopper adds an item.');
    await user.click(within(toolbar('DM-SHOP-UC01')).getByRole('button', { name: 'Edit' }));
    const form = screen.getByRole('form', { name: 'Edit DM-SHOP-UC01' });
    const picker = within(form).getByRole('combobox', { name: /^Result/ });
    expect(picker).toHaveValue('DM-SHOP-CMD01');
    expect(within(picker).getAllByRole('option').map((o) => o.getAttribute('value')).filter(Boolean)).toEqual(['DM-SHOP-CMD01', 'DM-SHOP-QRY01']);
    await user.selectOptions(picker, 'DM-SHOP-QRY01');
    await user.click(within(form).getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(commands).toEqual([{ route: '/api/use-case/change-use-case', input: { id: 'DM-SHOP-UC01', result_id: 'DM-SHOP-QRY01' } }]));
  });
});

describe('LA-V101-R15-T01 a use case\'s page shows its result, and whether it is a command use case or a query use case', () => {
  /** The value of the page's Result fact, under its goal (the Links out name the same link apart). */
  const result = async () => (await within(main()).findByText('Result', { selector: '.use-case-facts dt' })).nextElementSibling as HTMLElement;

  it('links a command use case\'s command, and a query use case\'s query, with the kind beside it', async () => {
    await openApp('/DM-SHOP-UC01');
    const command = await result();
    expect(within(command).getByRole('link', { name: /DM-SHOP-CMD01/ })).toBeInTheDocument();
    expect(command).toHaveTextContent('Command use case');
    // The kind is its own line under the result, its words kept together, on a phone as on a desktop.
    const kind = within(command).getByText('Command use case');
    expect(kind).toHaveClass('use-case-kind');
    expect(readFileSync(resolve(process.cwd(), 'src/styles.css'), 'utf8')).toMatch(/\.use-case-kind \{ display: block; white-space: nowrap; \}/);
  });

  /** The demo shop with a query use case: its result the Basket summary's query. */
  const withQueryUseCase = () => addRows(workspace(), 'use_case', { id: 'DM-SHOP-UC02', title: 'See the basket', domain_id: 'DM-SHOP', goal: 'A shopper sees the basket.', result_id: 'DM-SHOP-QRY01' });
  /** The value of one of the page's facts by its label. */
  const fact = async (label: string) => (await within(main()).findByText(label, { selector: '.use-case-facts dt' })).nextElementSibling as HTMLElement;

  it('says Query use case for a use case whose result is a query', async () => {
    await openApp('/DM-SHOP-UC02', { data: withQueryUseCase() });
    const query = await result();
    expect(within(query).getByRole('link', { name: /DM-SHOP-QRY01/ })).toBeInTheDocument();
    expect(query).toHaveTextContent('Query use case');
  });

  it('names its domain, and beside its result the aggregate or read model it sits with, by its kind', async () => {
    await openApp('/DM-SHOP-UC01');
    expect(within(await fact('Domain')).getByRole('link', { name: /DM-SHOP\s*Shopping/ })).toHaveAttribute('href', '/DM-SHOP');
    expect(within(await fact('Aggregate')).getByRole('link', { name: /DM-SHOP-A1\s*Basket/ })).toHaveAttribute('href', '/DM-SHOP-A1');
    await openApp('/DM-SHOP-UC02', { data: withQueryUseCase() });
    expect(within(await fact('Read model')).getByRole('link', { name: /DM-SHOP-RM01\s*Basket summary/ })).toHaveAttribute('href', '/DM-SHOP-RM01');
    expect(within(main()).queryByText('Aggregate', { selector: '.use-case-facts dt' })).toBeNull();
  });

  it('names the use case under Result of in its command\'s Links in', async () => {
    await openApp('/DM-SHOP-CMD01');
    const term = await screen.findByText('Result of', { selector: 'dt' });
    expect(within(term.nextElementSibling as HTMLElement).getByRole('link', { name: /DM-SHOP-UC01/ })).toBeInTheDocument();
  });
});

describe('LA-V101-R03-T01 a refused Use case command shows every reason in its own words, keeps what was entered, and changes nothing', () => {
  it('shows the rule\'s refusal at the top of the form, takes focus to it, and keeps the draft', async () => {
    const user = userEvent.setup();
    const refusal: WriteAnswer = { ok: false, error: 'refused', problems: [{ rule: 'step-fulfills-own-use-case', table: 'fulfills', key: 'DM-SHOP-UC01-FL-S02', message: 'DM-SHOP-UC01-FL-S02 fulfills DM-PAY-UC01-R01, a requirement of another use case' }] };
    const { commands } = await openApp('/DM-SHOP-UC01-FL-S02', { command: () => ({ answer: refusal }) });
    await screen.findByRole('toolbar', { name: 'Change DM-SHOP-UC01-FL-S02' });
    await user.click(within(toolbar('DM-SHOP-UC01-FL-S02')).getByRole('button', { name: 'Edit' }));
    const form = screen.getByRole('form', { name: 'Edit DM-SHOP-UC01-FL-S02' });
    const title = within(form).getByRole('textbox', { name: /^title/ });
    await user.type(title, ' at once');
    await user.click(within(form).getByRole('button', { name: 'Save' }));
    const alert = await within(form).findByRole('alert');
    expect(alert).toHaveTextContent('The change was refused. Nothing was saved.');
    expect(alert).toHaveTextContent('DM-SHOP-UC01-FL-S02: DM-SHOP-UC01-FL-S02 fulfills DM-PAY-UC01-R01, a requirement of another use case');
    expect(alert).toHaveFocus();
    expect(title).toHaveValue('Shop shows the basket at once');
    expect(commands).toEqual([{ route: '/api/use-case/change-flow-step', input: { id: 'DM-SHOP-UC01-FL-S02', title: 'Shop shows the basket at once' } }]);
  });

  it('Remove names what goes with the record, sends its Remove, and shows the refusal naming what still references it', async () => {
    const user = userEvent.setup();
    const refusal: WriteAnswer = { ok: false, error: 'refused', problems: [{ rule: 'referenced', table: 'flow', key: 'DM-SHOP-UC01-FL', message: 'Flow DM-SHOP-UC01-FL is referenced, so it stays: test DM-SHOP-T01 names it' }] };
    const { commands } = await openApp('/DM-SHOP-UC01-FL', { command: () => ({ answer: refusal }) });
    await within(main()).findByRole('heading', { name: /^Steps/ });
    await user.click(within(toolbar('DM-SHOP-UC01-FL')).getByRole('button', { name: 'Remove' }));
    const panel = screen.getByRole('region', { name: 'Remove DM-SHOP-UC01-FL?' });
    expect(within(panel).getByRole('heading', { name: 'Remove DM-SHOP-UC01-FL?' })).toHaveFocus();
    expect(panel).toHaveTextContent('with the 3 records under it');
    expect(commands).toEqual([]);
    await user.click(within(panel).getByRole('button', { name: 'Remove DM-SHOP-UC01-FL' }));
    expect(await within(panel).findByRole('alert')).toHaveTextContent('test DM-SHOP-T01 names it');
    expect(commands).toEqual([{ route: '/api/use-case/remove-flow', input: { id: 'DM-SHOP-UC01-FL' } }]);
    expect(window.location.pathname).toBe('/DM-SHOP-UC01-FL');
  });
});
