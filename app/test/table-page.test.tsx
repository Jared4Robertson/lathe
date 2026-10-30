import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { TABLE_COMMANDS } from '../../lathe/src/authoring/table/commands/index';
import type { TableCommands } from '../src/authoring/table/commands';
import type { WriteAnswer } from '../../lathe/src/server/contract';
import { addRows, setRow } from './fixtures/load';
import { modelWorkspace } from './fixtures/model';
import { main, openApp, section } from './helpers';

// The Table page and its editor (LA-AUT-A18, LA-V140): a table is read through the aggregate's own query, and changed
// only through the aggregate's own commands, one per change (Move among them), each refusal shown with its reasons.

const ok: WriteAnswer = { ok: true, tables: [], files: [], changes: [] };
const toolbar = (id: string) => screen.findByRole('toolbar', { name: `Change ${id}` });
const rows = (table: HTMLTableElement) => [...table.querySelectorAll('tbody tr')].map((tr) => [...tr.querySelectorAll('th, td')].map((c) => c.textContent));

describe('LA-V140-R01-T01 a table\'s page reads it through the Table aggregate\'s own query, never a generic record read', () => {
  it('reads GET /api/table/get-table and shows its keys', async () => {
    const { requests } = await openApp('/P-D-EN03-TB', { data: modelWorkspace() });
    await within(main()).findByRole('heading', { name: /^Keys/ });
    expect(requests).toContain('GET /api/table/get-table?id=P-D-EN03-TB');
  });

  it('holds the app\'s list of the aggregate\'s commands to its definitions, one to one', () => {
    const routes: (keyof TableCommands)[] = ['/api/table/add-table', '/api/table/change-table', '/api/table/move-table', '/api/table/remove-table'];
    expect([...routes].sort()).toEqual(TABLE_COMMANDS.map((c) => c.route).sort());
  });
});

describe('LA-V140-R04-T01 a table lists its keys in order, each with what it enforces, references or holds where', () => {
  it('shows the primary key, a unique key with its invariant and condition, and a foreign key with its target', async () => {
    await openApp('/P-D-EN03-TB', { data: modelWorkspace() });
    const keys = (await within(main()).findByRole('heading', { name: /^Keys/ })).closest('section')!;
    expect(keys.querySelector('h2, h3')).toHaveTextContent(/^Keys\s*3$/);
    expect(rows(keys.querySelector('table')!)).toEqual([
      ['unnamed', 'primary', 'id', ''],
      ['loans_one_open_per_thing', 'unique', 'thing_id', 'enforces P-D-INV01where returned_at IS NULL'],
      ['unnamed', 'foreign', 'member_id', 'references P-D-EN02-TB'],
    ]);
  });
});

describe('LA-V140-R02-T01 the Table editor writes only through the aggregate\'s own commands, one per change', () => {
  it('Edit sends Change a table with only what changed; Move sends Move a table to the read model picked', async () => {
    const user = userEvent.setup();
    const { commands, writes } = await openApp('/P-D-EN03-TB', { data: modelWorkspace(), command: () => ({ answer: ok, data: setRow(modelWorkspace(), 'table', 'P-D-EN03-TB', { name: 'lendings' }) }) });
    const actions = await toolbar('P-D-EN03-TB');
    expect(within(actions).getAllByRole('button').map((b) => b.textContent)).toEqual(['Edit', 'Move', 'Remove']);
    await user.click(within(actions).getByRole('button', { name: 'Edit' }));
    const form = screen.getByRole('form', { name: 'Edit P-D-EN03-TB' });
    await user.clear(within(form).getByRole('textbox', { name: /^name$/ }));
    await user.type(within(form).getByRole('textbox', { name: /^name$/ }), 'lendings');
    await user.click(within(form).getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(commands).toEqual([{ route: '/api/table/change-table', input: { id: 'P-D-EN03-TB', name: 'lendings' } }]));

    await user.click(within(await toolbar('P-D-EN03-TB')).getByRole('button', { name: 'Move' }));
    const move = screen.getByRole('form', { name: 'Move P-D-EN03-TB' });
    await user.selectOptions(within(move).getByRole('combobox', { name: /^Stores/ }), 'P-D-RM01');
    await user.click(within(move).getByRole('button', { name: 'Move' }));
    await waitFor(() => expect(commands[1]).toEqual({ route: '/api/table/move-table', input: { id: 'P-D-EN03-TB', read_model_id: 'P-D-RM01' } }));
    expect(writes).toEqual([]);
  });

  it('Edit shows a two-column key\'s columns one per line, and an unchanged key list sends nothing', async () => {
    const user = userEvent.setup();
    const data = () => addRows(modelWorkspace(), 'table_key', { table_id: 'P-D-EN03-TB', position: 4, type: 'index', columns: ['member_id', 'thing_id'] });
    const { commands } = await openApp('/P-D-EN03-TB', { data: data(), command: () => ({ answer: ok }) });
    await user.click(within(await toolbar('P-D-EN03-TB')).getByRole('button', { name: 'Edit' }));
    const form = screen.getByRole('form', { name: 'Edit P-D-EN03-TB' });
    expect(within(form).getByRole('textbox', { name: /^columns 4/ })).toHaveValue('member_id\nthing_id');
    await user.click(within(form).getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(screen.queryByRole('form', { name: 'Edit P-D-EN03-TB' })).toBeNull());
    expect(commands).toEqual([]);
  });
});

describe('LA-V140-R03-T01 a refused Table command shows every reason, keeps what was entered, and changes nothing', () => {
  it('Remove sends Remove a table and shows the refusal naming what still references it', async () => {
    const user = userEvent.setup();
    const refusal: WriteAnswer = { ok: false, error: 'refused', problems: [{ rule: 'referenced', table: 'table', key: 'P-D-EN02-TB', message: 'Table P-D-EN02-TB is referenced, so it stays: table_key of P-D-EN03-TB (target_table_id)' }] };
    const { commands } = await openApp('/P-D-EN02-TB', { data: modelWorkspace(), command: () => ({ answer: refusal }) });
    await user.click(within(await toolbar('P-D-EN02-TB')).getByRole('button', { name: 'Remove' }));
    const panel = screen.getByRole('region', { name: 'Remove P-D-EN02-TB?' });
    await user.click(within(panel).getByRole('button', { name: 'Remove P-D-EN02-TB' }));
    const alert = await within(panel).findByRole('alert');
    expect(alert).toHaveTextContent('The removal was refused. Nothing was changed.');
    expect(alert).toHaveTextContent('table_key of P-D-EN03-TB');
    expect(alert).toHaveFocus();
    expect(commands).toEqual([{ route: '/api/table/remove-table', input: { id: 'P-D-EN02-TB' } }]);
    expect(window.location.pathname).toBe('/P-D-EN02-TB');
    expect(section(/^Keys/)).toBeInTheDocument();
  });
});
