import type { ServedData } from './read-view';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { TEST_DATA_SET_COMMANDS } from '../../lathe/src/authoring/test-data-set/commands/index';
import type { TestDataSetCommands } from '../src/authoring/test-data-set/commands';
import type { WriteAnswer } from '../../lathe/src/server/contract';
import { addRows, setRow } from './fixtures/load';
import { workspace } from './fixtures/workspace';
import { main, openApp } from './helpers';

// The Test data set page and its editor (LA-AUT-A17, LA-V121): a test data set is read through the aggregate's own
// query, and changed only through the aggregate's own commands, one per change, each refusal shown with its reasons.

const ok: WriteAnswer = { ok: true, tables: [], files: [], changes: [] };
const toolbar = (id: string) => screen.findByRole('toolbar', { name: `Change ${id}` });

/** The demo shop with a data set its use case test starts from. */
function withDataSet(): ServedData {
  const w = workspace();
  addRows(w, 'test_data_set', {
    id: 'DM-SHOP-TD01', title: 'A basket with two items', domain_id: 'DM-SHOP', environment: 'A fresh in-memory store.', records: 'One shopper and a basket of two items.',
    prepare: 'Run the basket seed.', reset: 'Drop the store.', file: 'test/basket-seed.ts', description: 'A shopper part-way through shopping.',
  });
  addRows(w, 'starts_from', { source_id: 'DM-SHOP-UC01-R01-T01', target_id: 'DM-SHOP-TD01' });
  return w;
}

describe('LA-V121-R01-T01 a test data set\'s page reads it through its own query, never a generic record read', () => {
  it('reads GET /api/test-data-set/get-test-data-set and shows its description first', async () => {
    const { requests } = await openApp('/DM-SHOP-TD01', { data: withDataSet() });
    expect(await within(main()).findByText('A shopper part-way through shopping.')).toBeInTheDocument();
    expect(requests).toContain('GET /api/test-data-set/get-test-data-set?id=DM-SHOP-TD01');
  });

  it('holds the app\'s list of the aggregate\'s commands to its definitions, one to one', () => {
    const routes: (keyof TestDataSetCommands)[] = ['/api/test-data-set/add-test-data-set', '/api/test-data-set/change-test-data-set', '/api/test-data-set/remove-test-data-set'];
    expect([...routes].sort()).toEqual(TEST_DATA_SET_COMMANDS.map((c) => c.route).sort());
  });
});

describe('LA-V121-R02-T01 the Test data set editor writes only through the aggregate\'s own commands, one per change', () => {
  it('Edit sends Change a test data set with only what changed; an emptied optional field is cleared with null', async () => {
    const user = userEvent.setup();
    const changed = () => setRow(withDataSet(), 'test_data_set', 'DM-SHOP-TD01', { reset: 'Drop and seed again.' });
    const { commands, writes } = await openApp('/DM-SHOP-TD01', { data: withDataSet(), command: () => ({ answer: ok, data: changed() }) });
    const actions = await toolbar('DM-SHOP-TD01');
    expect(within(actions).getAllByRole('button').map((b) => b.textContent)).toEqual(['Edit', 'Remove']);
    await user.click(within(actions).getByRole('button', { name: 'Edit' }));
    const form = screen.getByRole('form', { name: 'Edit DM-SHOP-TD01' });
    const reset = within(form).getByRole('textbox', { name: /^reset/ });
    await user.clear(reset);
    await user.type(reset, 'Drop and seed again.');
    await user.clear(within(form).getByRole('textbox', { name: /^file/ }));
    await user.click(within(form).getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(commands).toEqual([{ route: '/api/test-data-set/change-test-data-set', input: { id: 'DM-SHOP-TD01', reset: 'Drop and seed again.', file: null } }]));
    expect(writes).toEqual([]);
    expect(await within(main()).findByText('Drop and seed again.')).toBeInTheDocument();
  });
});

describe('LA-V121-R03-T01 a refused Test data set command shows every reason, keeps what was entered, and changes nothing', () => {
  it('Remove sends Remove a test data set and shows the refusal naming the test that starts from it', async () => {
    const user = userEvent.setup();
    const refusal: WriteAnswer = { ok: false, error: 'refused', problems: [{ rule: 'referenced', table: 'test_data_set', key: 'DM-SHOP-TD01', message: 'Test data set DM-SHOP-TD01 is referenced, so it stays: use case test DM-SHOP-UC01-R01-T01 starts from it' }] };
    const { commands } = await openApp('/DM-SHOP-TD01', { data: withDataSet(), command: () => ({ answer: refusal }) });
    await user.click(within(await toolbar('DM-SHOP-TD01')).getByRole('button', { name: 'Remove' }));
    const panel = screen.getByRole('region', { name: 'Remove DM-SHOP-TD01?' });
    await user.click(within(panel).getByRole('button', { name: 'Remove DM-SHOP-TD01' }));
    const alert = await within(panel).findByRole('alert');
    expect(alert).toHaveTextContent('The removal was refused. Nothing was changed.');
    expect(alert).toHaveTextContent('DM-SHOP-UC01-R01-T01 starts from it');
    expect(alert).toHaveFocus();
    expect(commands).toEqual([{ route: '/api/test-data-set/remove-test-data-set', input: { id: 'DM-SHOP-TD01' } }]);
  });
});

describe('LA-V121-R04-T01 a test data set shows its setup and the tests that start from it', () => {
  it('shows where it runs, its starting records, how to prepare and reset it, and lists what starts from it in its Traceability', async () => {
    await openApp('/DM-SHOP-TD01', { data: withDataSet() });
    await within(main()).findByText('A shopper part-way through shopping.');
    for (const [title, text] of [['Environment', 'A fresh in-memory store.'], ['Starting records', 'One shopper and a basket of two items.'], ['Prepare', 'Run the basket seed.'], ['Reset', 'Drop the store.']]) {
      expect(within(main()).getByRole('heading', { name: title }).closest('section')).toHaveTextContent(text);
    }
    const trace = within(main()).getByRole('heading', { level: 2, name: 'Traceability' }).closest('section') as HTMLElement;
    expect(within(trace).getByRole('heading', { level: 3, name: /^Starting point of/ })).toBeInTheDocument();
    expect(within(trace).getByRole('link', { name: /DM-SHOP-UC01-R01-T01/ })).toBeInTheDocument();
  });
});
