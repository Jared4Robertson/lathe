import type { ServedData } from './read-view';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { ENTRY_POINT_COMMANDS } from '../../lathe/src/authoring/entry-point/commands/index';
import type { EntryPointCommands } from '../src/authoring/entry-point/commands';
import type { WriteAnswer } from '../../lathe/src/server/contract';
import { addRows, setRow } from './fixtures/load';
import { workspace } from './fixtures/workspace';
import { main, openApp } from './helpers';

// The Entry point page and its editor (LA-AUT-A20): an entry point is read through the aggregate's own query, and
// changed only through the aggregate's own commands, one per change, each refusal shown with its reasons.

const ok: WriteAnswer = { ok: true, tables: [], files: [], changes: [] };
const toolbar = (id: string) => screen.getByRole('toolbar', { name: `Change ${id}` });

/** The demo shop with an entry point of its Shopping domain that uses one package. */
function withEntryPoint(): ServedData {
  const w = workspace();
  addRows(w, 'entry_point', { id: 'DM-SHOP-ENTRY01', title: 'server.ts', domain_id: 'DM-SHOP', file: 'src/server.ts', description: 'Opens the store and serves the shop.' });
  addRows(w, 'package_use', { record_id: 'DM-SHOP-ENTRY01', package: 'express' });
  return w;
}

describe('LA-V112-R01-T01 an entry point\'s page reads it through its own query, never a generic record read', () => {
  it('reads GET /api/entry-point/get-entry-point and shows what it does, its file and its packages', async () => {
    const { requests } = await openApp('/DM-SHOP-ENTRY01', { data: withEntryPoint() });
    expect(await within(main()).findByText('Opens the store and serves the shop.')).toBeInTheDocument();
    expect(requests).toContain('GET /api/entry-point/get-entry-point?id=DM-SHOP-ENTRY01');
    expect(main().querySelector('[data-field="file"]')).toHaveTextContent('src/server.ts');
    expect(within(main()).getByRole('heading', { name: /^Packages/ }).closest('section')).toHaveTextContent('express');
  });

  it('holds the app\'s list of the aggregate\'s commands to its definitions, one to one', () => {
    const routes: (keyof EntryPointCommands)[] = ['/api/entry-point/add-entry-point', '/api/entry-point/change-entry-point', '/api/entry-point/remove-entry-point'];
    expect([...routes].sort()).toEqual(ENTRY_POINT_COMMANDS.map((c) => c.route).sort());
  });
});

describe('LA-V112-R02-T01 the Entry point editor writes only through the aggregate\'s own commands, one per change', () => {
  it('Edit sends Change an entry point with only what changed, and offers no Move', async () => {
    const user = userEvent.setup();
    const changed = () => setRow(withEntryPoint(), 'entry_point', 'DM-SHOP-ENTRY01', { description: 'Opens the store, then serves the shop.' });
    const { commands, writes } = await openApp('/DM-SHOP-ENTRY01', { data: withEntryPoint(), command: () => ({ answer: ok, data: changed() }) });
    await within(main()).findByText('Opens the store and serves the shop.');
    expect(within(toolbar('DM-SHOP-ENTRY01')).getAllByRole('button').map((b) => b.textContent)).toEqual(['Edit', 'Remove']);
    await user.click(within(toolbar('DM-SHOP-ENTRY01')).getByRole('button', { name: 'Edit' }));
    const form = screen.getByRole('form', { name: 'Edit DM-SHOP-ENTRY01' });
    const description = within(form).getByRole('textbox', { name: /^description/ });
    await user.clear(description);
    await user.type(description, 'Opens the store, then serves the shop.');
    await user.type(within(form).getByRole('textbox', { name: /^packages/ }), '{Enter}zod');
    await user.click(within(form).getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(commands).toEqual([{ route: '/api/entry-point/change-entry-point', input: { id: 'DM-SHOP-ENTRY01', description: 'Opens the store, then serves the shop.', packages: ['express', 'zod'] } }]));
    expect(writes).toEqual([]);
    expect(await within(main()).findByText('Opens the store, then serves the shop.')).toBeInTheDocument();
  });
});

describe('LA-V112-R03-T01 a refused Entry point command shows every reason, keeps what was entered, and changes nothing', () => {
  it('Remove sends Remove an entry point and shows the refusal in the command\'s words', async () => {
    const user = userEvent.setup();
    const refusal: WriteAnswer = { ok: false, error: 'refused', problems: [{ rule: 'referenced', table: 'entry_point', key: 'DM-SHOP-ENTRY01', message: 'Entry point DM-SHOP-ENTRY01 is referenced, so it stays: test DM-SHOP-T01 names it' }] };
    const { commands } = await openApp('/DM-SHOP-ENTRY01', { data: withEntryPoint(), command: () => ({ answer: refusal }) });
    await within(main()).findByText('Opens the store and serves the shop.');
    await user.click(within(toolbar('DM-SHOP-ENTRY01')).getByRole('button', { name: 'Remove' }));
    const panel = screen.getByRole('region', { name: 'Remove DM-SHOP-ENTRY01?' });
    await user.click(within(panel).getByRole('button', { name: 'Remove DM-SHOP-ENTRY01' }));
    const alert = await within(panel).findByRole('alert');
    expect(alert).toHaveTextContent('The removal was refused. Nothing was changed.');
    expect(alert).toHaveTextContent('test DM-SHOP-T01 names it');
    expect(alert).toHaveFocus();
    expect(commands).toEqual([{ route: '/api/entry-point/remove-entry-point', input: { id: 'DM-SHOP-ENTRY01' } }]);
    expect(window.location.pathname).toBe('/DM-SHOP-ENTRY01');
  });
});
