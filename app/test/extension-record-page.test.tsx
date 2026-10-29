import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { EXTENSION_RECORD_COMMANDS } from '../../lathe/src/authoring/extension-record/commands/index';
import type { ExtensionRecordCommands } from '../src/authoring/extension-record/commands';
import type { WriteAnswer } from '../../lathe/src/server/contract';
import { setRow } from './fixtures/load';
import { productKindWorkspace } from './fixtures/product-kinds';
import { main, openApp } from './helpers';

// The Extension record page and its editor (LA-AUT-A19): a record of a product's own kind (the fixture's security
// control, DM-SHOP-EP01-SC01) is read through the aggregate's own query, its fields its kind's declaration, and changed
// only through the aggregate's own commands, one per change, each refusal shown with its reasons.

const ok: WriteAnswer = { ok: true, tables: [], files: [], changes: [] };
const toolbar = (id: string) => screen.getByRole('toolbar', { name: `Change ${id}` });
const ID = 'DM-SHOP-EP01-SC01';

describe('LA-V111-R01-T01 a record of a product\'s own kind reads it through its own query, never a generic record read', () => {
  it('reads GET /api/extension-record/get-extension-record and leads with its declared statement', async () => {
    const { requests } = await openApp(`/${ID}`, { data: productKindWorkspace() });
    const lead = await within(main()).findByText('Only the shopper owning the basket MAY add to it.');
    expect(lead.closest('[data-field]')).toHaveAttribute('data-field', 'statement');
    expect(requests).toContain(`GET /api/extension-record/get-extension-record?id=${ID}`);
  });

  it('holds the app\'s list of the aggregate\'s commands to its definitions, one to one', () => {
    const routes: (keyof ExtensionRecordCommands)[] = ['/api/extension-record/add-extension-record', '/api/extension-record/change-extension-record', '/api/extension-record/remove-extension-record'];
    expect([...routes].sort()).toEqual(EXTENSION_RECORD_COMMANDS.map((c) => c.route).sort());
  });
});

describe('LA-V111-R02-T01 the Extension record editor writes only through the aggregate\'s own commands, one per change', () => {
  it('Edit sends Change an extension record with only the declared values that changed, and offers no Move', async () => {
    const user = userEvent.setup();
    const changed = () => setRow(productKindWorkspace(), 'security_control', ID, { statement: 'Only the basket\'s shopper MAY add to it.' });
    const { commands, writes } = await openApp(`/${ID}`, { data: productKindWorkspace(), command: () => ({ answer: ok, data: changed() }) });
    await within(main()).findByText('Only the shopper owning the basket MAY add to it.');
    expect(within(toolbar(ID)).getAllByRole('button').map((b) => b.textContent)).toEqual(['Edit', 'Remove']);
    await user.click(within(toolbar(ID)).getByRole('button', { name: 'Edit' }));
    const form = screen.getByRole('form', { name: `Edit ${ID}` });
    expect(within(form).queryByRole('textbox', { name: /^ID/ })).toBeNull();
    const statement = within(form).getByRole('textbox', { name: /^statement/ });
    await user.clear(statement);
    await user.type(statement, 'Only the basket\'s shopper MAY add to it.');
    await user.click(within(form).getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(commands).toEqual([{ route: '/api/extension-record/change-extension-record', input: { id: ID, values: { statement: 'Only the basket\'s shopper MAY add to it.' } } }]));
    expect(writes).toEqual([]);
    expect(await within(main()).findByText('Only the basket\'s shopper MAY add to it.')).toBeInTheDocument();
  });
});

describe('LA-V111-R03-T01 a refused Extension record command shows every reason, keeps what was entered, and changes nothing', () => {
  it('Remove sends Remove an extension record and shows the refusal in the command\'s words', async () => {
    const user = userEvent.setup();
    const refusal: WriteAnswer = { ok: false, error: 'refused', problems: [{ rule: 'referenced', table: 'security_control', key: ID, message: `Security control ${ID} is referenced, so it stays: test DM-SHOP-T01 names it` }] };
    const { commands } = await openApp(`/${ID}`, { data: productKindWorkspace(), command: () => ({ answer: refusal }) });
    await within(main()).findByText('Only the shopper owning the basket MAY add to it.');
    await user.click(within(toolbar(ID)).getByRole('button', { name: 'Remove' }));
    const panel = screen.getByRole('region', { name: `Remove ${ID}?` });
    expect(panel).toHaveTextContent('This removes the security control');
    await user.click(within(panel).getByRole('button', { name: `Remove ${ID}` }));
    const alert = await within(panel).findByRole('alert');
    expect(alert).toHaveTextContent('The removal was refused. Nothing was changed.');
    expect(alert).toHaveTextContent('test DM-SHOP-T01 names it');
    expect(alert).toHaveFocus();
    expect(commands).toEqual([{ route: '/api/extension-record/remove-extension-record', input: { id: ID } }]);
  });
});
