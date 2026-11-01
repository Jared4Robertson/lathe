import type { ServedData } from './read-view';
import { chooseAdd } from './add-menu';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import type { WriteAnswer } from '../../lathe/src/server/contract';
import { addRows } from './fixtures/load';
import { modelWorkspace } from './fixtures/model';
import { main, openApp, section } from './helpers';

// The Specification page and its editor (LA-AUT-A5, LA-V141): a specification and its predicate and test are read
// through the aggregate's own query, and changed only through the aggregate's own commands, one per change, each
// refusal shown with its reasons.

const ok: WriteAnswer = { ok: true, tables: [], files: [], changes: [] };
const toolbar = (id: string) => screen.findByRole('toolbar', { name: `Change ${id}` });

/** The model product with a predicate for P-D-SP01. */
function withPredicate(): ServedData {
  const w = modelWorkspace();
  addRows(w, 'predicate', { id: 'P-D-SP01-PR', title: 'isAtLoanLimit', specification_id: 'P-D-SP01', file: 'src/limits.ts' });
  return w;
}

describe('LA-V141-R04-T01 a specification\'s records are read through the Specification aggregate\'s own query, never a generic record read', () => {
  it('reads GET /api/specification/get-specification for its predicate, and its specification\'s statement for the specification', async () => {
    const { requests } = await openApp('/P-D-SP01-PR', { data: withPredicate() });
    await waitFor(() => expect(requests).toContain('GET /api/specification/get-specification?id=P-D-SP01-PR'));
    await openApp('/P-D-SP01', { data: withPredicate() });
    expect(await within(main()).findByText('A member is at the limit with 3 open loans.')).toBeInTheDocument();
  });
});

describe('LA-V141-R04-T01 a specification shows its predicate and its test, or that they are not written yet', () => {
  it('lists its predicate, and says its test is not written yet', async () => {
    await openApp('/P-D-SP01', { data: withPredicate() });
    await within(main()).findByRole('heading', { name: /^Predicate/ });
    expect(section(/^Predicate/)).toHaveTextContent('P-D-SP01-PR');
    expect(section(/^Test/)).toHaveTextContent('Its test is not written yet.');
  });
});

describe('LA-V141-R02-T01 the Specification editor writes only through the aggregate\'s own commands, one per change', () => {
  it('Edit sends Change a specification with only what changed; Add offers only the test it has not got, with its one ID; no Move', async () => {
    const user = userEvent.setup();
    const { commands } = await openApp('/P-D-SP01', { data: withPredicate(), command: () => ({ answer: ok }) });
    const actions = await toolbar('P-D-SP01');
    expect(within(actions).getAllByRole('button').map((b) => b.textContent)).toEqual(['Edit', 'Add specification test', 'Remove']);
    await user.click(within(actions).getByRole('button', { name: 'Edit' }));
    const form = screen.getByRole('form', { name: 'Edit P-D-SP01' });
    await user.type(within(form).getByRole('textbox', { name: /^statement/ }), ' Or more.');
    await user.click(within(form).getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(commands).toEqual([{ route: '/api/specification/change-specification', input: { id: 'P-D-SP01', statement: 'A member is at the limit with 3 open loans. Or more.' } }]));

    await chooseAdd(user, await toolbar('P-D-SP01'), 'Specification test');
    const add = screen.getByRole('form', { name: 'Add a specification test' });
    await waitFor(() => expect(within(add).getByRole('textbox', { name: /^ID/ })).toHaveValue('P-D-SP01-T'));
  });
});

describe('LA-V141-R02-T02 a specification is added from its domain\'s page through the aggregate\'s own Add', () => {
  it('Add specification on the domain\'s page takes the next free ID and sends Add a specification', async () => {
    const user = userEvent.setup();
    const { commands } = await openApp('/P-D', { data: withPredicate(), command: () => ({ answer: ok }) });
    await chooseAdd(user, await toolbar('P-D'), 'Specification');
    const add = screen.getByRole('form', { name: 'Add a specification' });
    await waitFor(() => expect(within(add).getByRole('textbox', { name: /^ID/ })).toHaveValue('P-D-SP02'));
    await user.type(within(add).getByRole('textbox', { name: /^title/ }), 'Thing is lendable');
    await user.type(within(add).getByRole('textbox', { name: /^statement/ }), 'A thing is lendable while no loan of it is open.');
    await chooseAdd(user, add, 'Specification');
    await waitFor(() => expect(commands).toEqual([{ route: '/api/specification/add-specification', input: { id: 'P-D-SP02', title: 'Thing is lendable', statement: 'A thing is lendable while no loan of it is open.' } }]));
  });
});

describe('LA-V141-R03-T01 a refused Specification command shows every reason, keeps what was entered, and changes nothing', () => {
  it('a refused Change keeps the draft and focuses the reasons', async () => {
    const user = userEvent.setup();
    const refusal: WriteAnswer = { ok: false, error: 'refused', problems: [{ rule: 'missing', table: 'reads', key: 'P-D-SP01', message: 'there is no aggregate P-D-A9' }] };
    const { commands } = await openApp('/P-D-SP01', { data: withPredicate(), command: () => ({ answer: refusal }) });
    await user.click(within(await toolbar('P-D-SP01')).getByRole('button', { name: 'Edit' }));
    const form = screen.getByRole('form', { name: 'Edit P-D-SP01' });
    await user.clear(within(form).getByRole('textbox', { name: /^title/ }));
    await user.type(within(form).getByRole('textbox', { name: /^title/ }), 'Member at the limit');
    await user.click(within(form).getByRole('button', { name: 'Save' }));
    const alert = await within(form).findByRole('alert');
    expect(alert).toHaveTextContent('The change was refused. Nothing was saved.');
    expect(alert).toHaveTextContent('there is no aggregate P-D-A9');
    expect(alert).toHaveFocus();
    expect(within(form).getByRole('textbox', { name: /^title/ })).toHaveValue('Member at the limit');
    expect(commands).toHaveLength(1);
  });
});
