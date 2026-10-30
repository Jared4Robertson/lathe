import type { ServedData } from './read-view';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { STORAGE_REQUIREMENT_COMMANDS } from '../../lathe/src/authoring/storage-requirement/commands/index';
import type { StorageRequirementCommands } from '../src/authoring/storage-requirement/commands';
import type { WriteAnswer } from '../../lathe/src/server/contract';
import { chooseAdd } from './add-menu';
import { addRows } from './fixtures/load';
import { workspace } from './fixtures/workspace';
import { main, openApp } from './helpers';

// The Storage requirement page and its editor (LA-AUT-A22): a storage requirement is read through the aggregate's own
// query, and changed only through the aggregate's own commands, one per change.

const ok: WriteAnswer = { ok: true, tables: [], files: [], changes: [] };
const toolbar = (id: string) => screen.findByRole('toolbar', { name: `Change ${id}` });

/** The demo shop with a storage requirement on its Basket aggregate, proved by one test. */
function withRequirement(): ServedData {
  const w = workspace();
  addRows(w, 'storage_requirement', { id: 'DM-SHOP-A1-SR01', title: 'A basket is kept whole', aggregate_id: 'DM-SHOP-A1', statement: 'A basket MUST be saved whole, with its lines.' });
  addRows(w, 'storage_requirement_test', { id: 'DM-SHOP-A1-SR01-T01', title: 'A basket survives a restart', storage_requirement_id: 'DM-SHOP-A1-SR01', level: 'integration', state: 'not automated yet', when: 'The store restarts.', then: 'The basket is there whole.' });
  return w;
}

describe('the Storage requirement page reads it through its own query, and its editor sends only the aggregate\'s commands', () => {
  it('LA-V154-R01-T01 reads GET /api/storage-requirement/get-storage-requirement and shows its statement, what it is about and its tests', async () => {
    const { requests } = await openApp('/DM-SHOP-A1-SR01', { data: withRequirement() });
    expect(await within(main()).findByText('A basket MUST be saved whole, with its lines.')).toBeInTheDocument();
    expect(requests).toContain('GET /api/storage-requirement/get-storage-requirement?id=DM-SHOP-A1-SR01');
    expect(within(main()).getByRole('link', { name: /DM-SHOP-A1-SR01-T01/ })).toHaveAttribute('href', '/DM-SHOP-A1-SR01-T01');
  });

  it('LA-V154-R01-T01 holds the app\'s list of the aggregate\'s commands to its definitions, one to one', () => {
    const routes: (keyof StorageRequirementCommands)[] = [
      '/api/storage-requirement/add-storage-requirement', '/api/storage-requirement/change-storage-requirement', '/api/storage-requirement/remove-storage-requirement',
      '/api/storage-requirement/add-storage-requirement-test', '/api/storage-requirement/change-storage-requirement-test', '/api/storage-requirement/remove-storage-requirement-test',
    ];
    expect([...routes].sort()).toEqual(STORAGE_REQUIREMENT_COMMANDS.map((c) => c.route).sort());
  });

  it('LA-V154-R02-T01 adds a storage requirement from its aggregate\'s page through the aggregate\'s own Add', async () => {
    const user = userEvent.setup();
    const { commands } = await openApp('/DM-SHOP-A1', { data: withRequirement(), command: () => ({ answer: ok }) });
    await chooseAdd(user, await toolbar('DM-SHOP-A1'), 'Storage requirement');
    const form = screen.getByRole('form', { name: 'Add a storage requirement' });
    await waitFor(() => expect(within(form).getByRole('textbox', { name: /^ID/ })).toHaveValue('DM-SHOP-A1-SR02'));
    await user.type(within(form).getByRole('textbox', { name: /^title/ }), 'A basket line is never half saved');
    await user.type(within(form).getByRole('textbox', { name: /^statement/ }), 'A basket line MUST be saved whole or not at all.');
    await user.click(within(form).getByRole('button', { name: 'Add storage requirement' }));
    await waitFor(() => expect(commands).toEqual([{ route: '/api/storage-requirement/add-storage-requirement', input: { aggregate_id: 'DM-SHOP-A1', id: 'DM-SHOP-A1-SR02', title: 'A basket line is never half saved', statement: 'A basket line MUST be saved whole or not at all.' } }]));
  });

  it('LA-V154-R02-T01 Edit sends Change a storage requirement with only what changed, and Remove says its tests go with it', async () => {
    const user = userEvent.setup();
    const { commands } = await openApp('/DM-SHOP-A1-SR01', { data: withRequirement(), command: () => ({ answer: ok }) });
    const actions = await toolbar('DM-SHOP-A1-SR01');
    expect(within(actions).getAllByRole('button').map((b) => b.textContent)).toEqual(['Edit', 'Add storage requirement test', 'Remove']);
    await user.click(within(actions).getByRole('button', { name: 'Edit' }));
    const form = screen.getByRole('form', { name: 'Edit DM-SHOP-A1-SR01' });
    await user.clear(within(form).getByRole('textbox', { name: /^title/ }));
    await user.type(within(form).getByRole('textbox', { name: /^title/ }), 'A basket is saved whole');
    await user.click(within(form).getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(commands).toEqual([{ route: '/api/storage-requirement/change-storage-requirement', input: { id: 'DM-SHOP-A1-SR01', title: 'A basket is saved whole' } }]));
    await user.click(within(await toolbar('DM-SHOP-A1-SR01')).getByRole('button', { name: 'Remove' }));
    expect(within(screen.getByRole('list', { name: 'What goes with DM-SHOP-A1-SR01' })).getByRole('link', { name: /DM-SHOP-A1-SR01-T01/ })).toBeInTheDocument();
  });
});
