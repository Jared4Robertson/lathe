import { chooseAdd } from './add-menu';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import type { WriteAnswer } from '../../lathe/src/server/contract';
import { setRow } from './fixtures/load';
import { workspace } from './fixtures/workspace';
import { main, openApp } from './helpers';

// The Product page and its editor (LA-AUT-A1): a product, an open question or an interface is read through the
// aggregate's own query, and changed only through the aggregate's own commands, one per change, each refusal shown
// with its reasons; the nav lists the products through the aggregate's own list.

const ok: WriteAnswer = { ok: true, tables: [], files: [], changes: [] };
const toolbar = (id: string) => screen.getByRole('toolbar', { name: `Change ${id}` });

describe('LA-V51-R06-T01 the product\'s page and the nav read the products through the Product aggregate\'s own queries', () => {
  it('reads GET /api/product/get-product for the product, an open question and an interface, and the nav reads list-products', async () => {
    const { requests } = await openApp('/DM');
    await screen.findByRole('toolbar', { name: 'Change DM' });
    expect(requests).toContain('GET /api/product/get-product?id=DM');
    expect(requests).toContain('GET /api/product/list-products');
    expect(within(main()).getByRole('heading', { name: /^Roles/ })).toBeInTheDocument();
    expect(within(main()).getByRole('heading', { level: 2, name: /^Interfaces/ })).toBeInTheDocument();
    const nav = await openApp('/DM-Q01');
    expect(await within(main()).findByText('Undecided.')).toBeInTheDocument();
    expect(nav.requests).toContain('GET /api/product/get-product?id=DM-Q01');
  });
});

describe('LA-V51-R07-T01 the Product editor writes only through the aggregate\'s own commands, one per change', () => {
  it('Edit sends Change a product with only what changed, and the product offers no Move or Remove', async () => {
    const user = userEvent.setup();
    const changed = () => setRow(workspace(), 'product', 'DM', { notes: 'Ships within the country.' });
    const { commands } = await openApp('/DM', { command: () => ({ answer: ok, data: changed() }) });
    await screen.findByRole('toolbar', { name: 'Change DM' });
    const buttons = within(toolbar('DM')).getAllByRole('button').map((b) => b.textContent);
    expect(buttons).not.toContain('Move');
    expect(buttons).not.toContain('Remove');
    await user.click(within(toolbar('DM')).getByRole('button', { name: 'Edit' }));
    const form = screen.getByRole('form', { name: 'Edit DM' });
    await user.type(within(form).getByRole('textbox', { name: /^notes/ }), 'Ships within the country.');
    await user.click(within(form).getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(commands).toEqual([{ route: '/api/product/change-product', input: { id: 'DM', notes: 'Ships within the country.' } }]));
  });

  it('adds an open question from the product\'s page with the next free ID, and moves it to a domain as its own command', async () => {
    const user = userEvent.setup();
    const { commands } = await openApp('/DM', { command: () => ({ answer: ok }) });
    await screen.findByRole('toolbar', { name: 'Change DM' });
    await user.click(within(toolbar('DM')).getByRole('button', { name: 'Add…' }));
    await user.click(within(toolbar('DM')).getByRole('button', { name: 'Open question' }));
    const form = screen.getByRole('form', { name: 'Add an open question' });
    await waitFor(() => expect(within(form).getByRole('textbox', { name: /^ID/ })).toHaveValue('DM-Q02'));
    await user.type(within(form).getByRole('textbox', { name: /^title/ }), 'Who answers the phone?');
    await user.type(within(form).getByRole('textbox', { name: /^owner/ }), 'Clerk');
    await user.type(within(form).getByRole('textbox', { name: /^description/ }), 'The desk or the owner.');
    await user.click(within(form).getByRole('button', { name: 'Add open question' }));
    await waitFor(() => expect(commands).toEqual([{ route: '/api/product/add-question', input: { product_id: 'DM', id: 'DM-Q02', title: 'Who answers the phone?', owner: 'Clerk', description: 'The desk or the owner.' } }]));

    // The Add opens the new question's page once the data is read again.
    await waitFor(() => expect(window.location.pathname).toBe('/DM-Q02'));
    await openApp('/DM-Q01', { command: () => ({ answer: ok }) }).then(async ({ commands: moved }) => {
      await screen.findByRole('toolbar', { name: 'Change DM-Q01' });
      await user.click(within(toolbar('DM-Q01')).getByRole('button', { name: 'Move' }));
      const move = screen.getByRole('form', { name: 'Move DM-Q01' });
      await user.selectOptions(within(move).getByRole('combobox', { name: /^Under/ }), 'DM-SHOP');
      await user.click(within(move).getByRole('button', { name: 'Move' }));
      await waitFor(() => expect(moved).toEqual([{ route: '/api/product/move-question', input: { id: 'DM-Q01', domain_id: 'DM-SHOP' } }]));
    });
  });

  it('adds an open question from a domain\'s page through the Product aggregate\'s own Add, under the domain', async () => {
    const user = userEvent.setup();
    const { commands } = await openApp('/DM-SHOP', { command: () => ({ answer: ok }) });
    await chooseAdd(user, await screen.findByRole('toolbar', { name: 'Change DM-SHOP' }), 'Open question');
    const form = screen.getByRole('form', { name: 'Add an open question' });
    await waitFor(() => expect(within(form).getByRole('textbox', { name: /^ID/ })).toHaveValue('DM-SHOP-Q02'));
    await user.type(within(form).getByRole('textbox', { name: /^title/ }), 'Who restocks?');
    await user.type(within(form).getByRole('textbox', { name: /^owner/ }), 'Clerk');
    await user.type(within(form).getByRole('textbox', { name: /^description/ }), 'The clerk or a supplier.');
    await user.click(within(form).getByRole('button', { name: 'Add open question' }));
    await waitFor(() => expect(commands).toEqual([{ route: '/api/product/add-question', input: { domain_id: 'DM-SHOP', id: 'DM-SHOP-Q02', title: 'Who restocks?', owner: 'Clerk', description: 'The clerk or a supplier.' } }]));
  });

  it('declares a product kind with its fields, as Declare a product kind', async () => {
    const user = userEvent.setup();
    const { commands } = await openApp('/DM', { command: () => ({ answer: ok }) });
    await screen.findByRole('toolbar', { name: 'Change DM' });
    await user.click(within(toolbar('DM')).getByRole('button', { name: 'Declare…' }));
    await user.click(within(toolbar('DM')).getByRole('button', { name: 'Product kind' }));
    const form = screen.getByRole('form', { name: 'Declare a product kind' });
    await user.type(within(form).getByRole('textbox', { name: /^name/ }), 'report');
    await user.type(within(form).getByRole('textbox', { name: /^label/ }), 'Report');
    await user.type(within(form).getByRole('textbox', { name: /^description/ }), 'A script that counts.');
    await user.type(within(form).getByRole('textbox', { name: /^parent kind/ }), 'domain');
    await user.selectOptions(within(form).getByRole('combobox', { name: /^complexity/ }), 'essential');
    await user.click(within(form).getByRole('button', { name: 'Add to Fields' }));
    const field = within(form).getByRole('group', { name: 'Fields: row 1' });
    await user.type(within(field).getByRole('textbox', { name: /^name 1/ }), 'file');
    await user.selectOptions(within(field).getByRole('combobox', { name: /^type 1/ }), 'text');
    await user.click(within(field).getByRole('checkbox', { name: /^required 1/ }));
    await user.type(within(field).getByRole('textbox', { name: /^description 1/ }), 'The script.');
    await user.click(within(form).getByRole('button', { name: 'Declare product kind' }));
    await waitFor(() => expect(commands).toHaveLength(1));
    expect(commands[0]).toEqual({
      route: '/api/product/declare-product-kind',
      input: { product_id: 'DM', name: 'report', label: 'Report', description: 'A script that counts.', parent_kind: 'domain', obligation: false, complexity: 'essential', fields: [{ name: 'file', type: 'text', required: true, description: 'The script.' }] } });
  });
});

describe('LA-V51-R08-T01 a refused Product command shows every reason, keeps what was entered, and changes nothing', () => {
  it('shows the rule\'s refusal at the top of the form, takes focus to it, and keeps the draft', async () => {
    const user = userEvent.setup();
    const refusal: WriteAnswer = { ok: false, error: 'refused', problems: [{ rule: 'question-owner-role', table: 'question', key: 'DM-Q01', message: 'DM-Q01 is owned by Nobody, which is not a role of DM; its roles are Clerk' }] };
    const { commands } = await openApp('/DM-Q01', { command: () => ({ answer: refusal }) });
    await screen.findByRole('toolbar', { name: 'Change DM-Q01' });
    await user.click(within(toolbar('DM-Q01')).getByRole('button', { name: 'Edit' }));
    const form = screen.getByRole('form', { name: 'Edit DM-Q01' });
    const owner = within(form).getByRole('textbox', { name: /^owner/ });
    await user.clear(owner);
    await user.type(owner, 'Nobody');
    await user.click(within(form).getByRole('button', { name: 'Save' }));
    const alert = await within(form).findByRole('alert');
    expect(alert).toHaveTextContent('The change was refused. Nothing was saved.');
    expect(alert).toHaveTextContent('DM-Q01: DM-Q01 is owned by Nobody, which is not a role of DM; its roles are Clerk');
    expect(alert).toHaveFocus();
    expect(owner).toHaveValue('Nobody');
    expect(commands).toEqual([{ route: '/api/product/change-question', input: { id: 'DM-Q01', owner: 'Nobody' } }]);
  });

  it('Remove sends Remove an interface and shows the refusal naming what still references it', async () => {
    const user = userEvent.setup();
    const refusal: WriteAnswer = { ok: false, error: 'refused', problems: [{ rule: 'referenced', table: 'interface', key: 'DM-IF01', message: 'Interface DM-IF01 is referenced, so it stays: flow DM-SHOP-UC01-FL goes through it' }] };
    const { commands } = await openApp('/DM-IF01', { command: () => ({ answer: refusal }) });
    await screen.findByRole('toolbar', { name: 'Change DM-IF01' });
    expect(within(toolbar('DM-IF01')).queryByRole('button', { name: 'Move' })).toBeNull();
    await user.click(within(toolbar('DM-IF01')).getByRole('button', { name: 'Remove' }));
    const panel = screen.getByRole('region', { name: 'Remove DM-IF01?' });
    await user.click(within(panel).getByRole('button', { name: 'Remove DM-IF01' }));
    expect(await within(panel).findByRole('alert')).toHaveTextContent('flow DM-SHOP-UC01-FL goes through it');
    expect(commands).toEqual([{ route: '/api/interface/remove-interface', input: { id: 'DM-IF01' } }]);
    expect(window.location.pathname).toBe('/DM-IF01');
  });
});
