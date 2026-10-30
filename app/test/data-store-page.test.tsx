import type { ServedData } from './read-view';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { DATA_STORE_COMMANDS } from '../../lathe/src/authoring/data-store/commands/index';
import type { DataStoreCommands } from '../src/authoring/data-store/commands';
import type { WriteAnswer } from '../../lathe/src/server/contract';
import { chooseAdd } from './add-menu';
import { addRows } from './fixtures/load';
import { workspace } from './fixtures/workspace';
import { main, openApp } from './helpers';

// The Data store page and its editor (LA-AUT-A23): a data store is read through the aggregate's own query, and changed
// only through the aggregate's own commands, one per change.

const ok: WriteAnswer = { ok: true, tables: [], files: [], changes: [] };
const toolbar = (id: string) => screen.findByRole('toolbar', { name: `Change ${id}` });

/** The demo shop with a database its product's domains share. */
function withStore(): ServedData {
  const w = workspace();
  addRows(w, 'data_store', { id: 'DM-STORE01', title: 'DATABASE_URL', product_id: 'DM', kind: 'database', description: 'A PostgreSQL database the shop runs.' });
  return w;
}

describe('the Data store page reads it through its own query, and its editor sends only the aggregate\'s commands', () => {
  it('reads GET /api/data-store/get-data-store and shows its description, kind and where it sits', async () => {
    const { requests } = await openApp('/DM-STORE01', { data: withStore() });
    expect(await within(main()).findByText('A PostgreSQL database the shop runs.')).toBeInTheDocument();
    expect(requests).toContain('GET /api/data-store/get-data-store?id=DM-STORE01');
    expect(main()).toHaveTextContent('database');
  });

  it('holds the app\'s list of the aggregate\'s commands to its definitions, one to one', () => {
    const routes: (keyof DataStoreCommands)[] = ['/api/data-store/add-data-store', '/api/data-store/change-data-store', '/api/data-store/remove-data-store'];
    expect([...routes].sort()).toEqual(DATA_STORE_COMMANDS.map((c) => c.route).sort());
  });

  it('adds a data store from its domain\'s page through the aggregate\'s own Add, and Edit sends only what changed', async () => {
    const user = userEvent.setup();
    const { commands } = await openApp('/DM-SHOP', { data: withStore(), command: () => ({ answer: ok }) });
    await chooseAdd(user, await toolbar('DM-SHOP'), 'Data store');
    const form = screen.getByRole('form', { name: 'Add a data store' });
    await waitFor(() => expect(within(form).getByRole('textbox', { name: /^ID/ })).not.toHaveValue(''));
    const id = (within(form).getByRole('textbox', { name: /^ID/ }) as HTMLInputElement).value;
    await user.type(within(form).getByRole('textbox', { name: /^title/ }), 'localStorage');
    await user.selectOptions(within(form).getByRole('combobox', { name: /^kind/ }), 'browser storage');
    await user.type(within(form).getByRole('textbox', { name: /^description/ }), 'The browser keeps the basket between visits.');
    await user.click(within(form).getByRole('button', { name: 'Add data store' }));
    await waitFor(() => expect(commands).toEqual([{ route: '/api/data-store/add-data-store', input: { domain_id: 'DM-SHOP', id, title: 'localStorage', kind: 'browser storage', description: 'The browser keeps the basket between visits.' } }]));

    // The Add opens the new data store's page once the data is read again.
    await waitFor(() => expect(window.location.pathname).toBe(`/${id}`));
    await openApp('/DM-STORE01', { data: withStore(), command: () => ({ answer: ok }) }).then(async ({ commands: changed }) => {
      await user.click(within(await toolbar('DM-STORE01')).getByRole('button', { name: 'Edit' }));
      const edit = screen.getByRole('form', { name: 'Edit DM-STORE01' });
      await user.selectOptions(within(edit).getByRole('combobox', { name: /^kind/ }), 'file');
      await user.click(within(edit).getByRole('button', { name: 'Save' }));
      await waitFor(() => expect(changed).toEqual([{ route: '/api/data-store/change-data-store', input: { id: 'DM-STORE01', kind: 'file' } }]));
    });
  });
});
