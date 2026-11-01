import type { ServedData } from './read-view';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import type { WriteAnswer } from '../../lathe/src/server/contract';
import { chooseAdd } from './add-menu';
import { addRows } from './fixtures/load';
import { workspace } from './fixtures/workspace';
import { main, openApp, section } from './helpers';

// The Data store page and its editor (LA-AUT-A23): a data store is read through the aggregate's own query, and changed
// only through the aggregate's own commands, one per change.

const ok: WriteAnswer = { ok: true, tables: [], files: [], changes: [] };
const toolbar = (id: string) => screen.findByRole('toolbar', { name: `Change ${id}` });
/** The value of the fact with this label in the page's body (the Facts beside it name links too). */
const fact = (label: string) => within(main().querySelector<HTMLElement>('.record-main')!).getByText(label, { selector: 'dt' }).nextElementSibling as HTMLElement;

/** The demo shop with a database its product's domains share. */
function withStore(): ServedData {
  const w = workspace();
  addRows(w, 'data_store', { id: 'DM-STORE01', title: 'DATABASE_URL', product_id: 'DM', kind: 'database', description: 'A PostgreSQL database the shop runs.' });
  return w;
}

/** The database, provided by a hosting service, with the basket repository stored in it. */
function withStored(): ServedData {
  const w = withStore();
  addRows(w, 'integration', { id: 'DM-INT01', title: 'Hosted Postgres', description: 'The service that runs the database.' });
  addRows(w, 'provided_by', { source_id: 'DM-STORE01', target_id: 'DM-INT01' });
  addRows(w, 'repository', { id: 'DM-SHOP-REPO01', title: 'BasketRepository', domain_id: 'DM-SHOP', file: 'src/baskets.ts', description: 'Loads and saves baskets.' });
  addRows(w, 'stored_in', { source_id: 'DM-SHOP-REPO01', target_id: 'DM-STORE01' });
  return w;
}

describe('the Data store page reads it through its own query, and its editor sends only the aggregate\'s commands', () => {
  it('LA-V155-R01-T01 reads GET /api/data-store/get-data-store and shows its description, kind and where it sits', async () => {
    const { requests } = await openApp('/DM-STORE01', { data: withStore() });
    expect(await within(main()).findByText('A PostgreSQL database the shop runs.')).toBeInTheDocument();
    expect(requests).toContain('GET /api/data-store/get-data-store?id=DM-STORE01');
    expect(main()).toHaveTextContent('database');
  });

  it('LA-V155-R02-T01 adds a data store from its domain\'s page through the aggregate\'s own Add, and Edit sends only what changed', async () => {
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

describe('LA-V155-R03-T01 a refused Data store command shows every reason, keeps what was entered, and changes nothing', () => {
  it('Remove sends Remove a data store and shows the refusal naming what is stored in it, on the page where it was', async () => {
    const user = userEvent.setup();
    const refusal: WriteAnswer = { ok: false, error: 'refused', problems: [{ rule: 'referenced', table: 'data_store', key: 'DM-STORE01', message: 'Data store DM-STORE01 is referenced, so it stays: repository DM-SHOP-REPO01 is stored in it' }] };
    const { commands } = await openApp('/DM-STORE01', { data: withStored(), command: () => ({ answer: refusal }) });
    await user.click(within(await toolbar('DM-STORE01')).getByRole('button', { name: 'Remove' }));
    const panel = screen.getByRole('region', { name: 'Remove DM-STORE01?' });
    await user.click(within(panel).getByRole('button', { name: 'Remove DM-STORE01' }));
    const alert = await within(panel).findByRole('alert');
    expect(alert).toHaveTextContent('The removal was refused. Nothing was changed.');
    expect(alert).toHaveTextContent('repository DM-SHOP-REPO01 is stored in it');
    expect(alert).toHaveFocus();
    expect(commands).toEqual([{ route: '/api/data-store/remove-data-store', input: { id: 'DM-STORE01' } }]);
    expect(window.location.pathname).toBe('/DM-STORE01');
  });

  it('a refused Change keeps the description as entered and every reason at its top', async () => {
    const user = userEvent.setup();
    const refusal: WriteAnswer = { ok: false, error: 'refused', problems: [{ rule: 'required', table: 'data_store', key: 'DM-STORE01', message: 'data_store: description is required' }] };
    const { commands } = await openApp('/DM-STORE01', { data: withStore(), command: () => ({ answer: refusal }) });
    await user.click(within(await toolbar('DM-STORE01')).getByRole('button', { name: 'Edit' }));
    const form = screen.getByRole('form', { name: 'Edit DM-STORE01' });
    await user.clear(within(form).getByRole('textbox', { name: /^description/ }));
    await user.type(within(form).getByRole('textbox', { name: /^description/ }), 'Kept');
    await user.click(within(form).getByRole('button', { name: 'Save' }));
    const alert = await within(form).findByRole('alert');
    expect(alert).toHaveTextContent('The change was refused. Nothing was saved.');
    expect(alert).toHaveTextContent('description is required');
    expect(alert).toHaveFocus();
    expect(within(form).getByRole('textbox', { name: /^description/ })).toHaveValue('Kept');
    expect(commands).toEqual([{ route: '/api/data-store/change-data-store', input: { id: 'DM-STORE01', description: 'Kept' } }]);
  });
});

describe('LA-V155-R04-T01 a data store\'s page lists what is stored in it, with its count, and names the integration that provides it', () => {
  it('shows a Stores section with its count and each repository, reader and table stored in it, and the integration among its facts', async () => {
    await openApp('/DM-STORE01', { data: withStored() });
    await within(main()).findByText('A PostgreSQL database the shop runs.');
    const stores = await waitFor(() => section(/^Stores/));
    expect(within(main()).getByRole('heading', { name: /^Stores/ })).toHaveTextContent('Stores1');
    expect(within(stores).getByRole('link', { name: /DM-SHOP-REPO01/ })).toHaveAttribute('href', '/DM-SHOP-REPO01');
    expect(within(fact('Provided by')).getByRole('link', { name: /DM-INT01/ })).toHaveAttribute('href', '/DM-INT01');
    // Each is listed once: the Traceability leaves out what the page draws from its own read.
    expect(within(main()).getAllByRole('heading', { name: /^(Stores|Provided by)/ }).map((h) => h.textContent)).toEqual(['Stores1']);
  });

  it('says nothing is stored in it yet, and names no provider, when nothing is', async () => {
    await openApp('/DM-STORE01', { data: withStore() });
    await within(main()).findByText('A PostgreSQL database the shop runs.');
    expect(section(/^Stores/)).toHaveTextContent('Nothing is stored in it yet.');
    expect(within(main().querySelector<HTMLElement>('.record-main')!).queryByText('Provided by', { selector: 'dt' })).toBeNull();
  });
});
