import type { ServedData } from './read-view';
import { addChoices, chooseAdd } from './add-menu';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import type { WriteAnswer } from '../../lathe/src/server/contract';
import { addRows } from './fixtures/load';
import { modelWorkspace } from './fixtures/model';
import { main, openApp, section } from './helpers';

// The Read model page and its editor (LA-AUT-A10, LA-V143): a read model and its queries, projection, reader and query
// handlers are read through the aggregate's own query, and changed only through the aggregate's own commands, one per
// change, each refusal shown with its reasons.

const ok: WriteAnswer = { ok: true, tables: [], files: [], changes: [] };
const toolbar = (id: string) => screen.findByRole('toolbar', { name: `Change ${id}` });
const rows = (table: HTMLTableElement) => [...table.querySelectorAll('tbody tr')].map((tr) => [...tr.querySelectorAll('th, td')].map((c) => c.textContent));

/** The model product with a reader for P-D-RM01. */
function withReader(): ServedData {
  return addRows(modelWorkspace(), 'reader', { id: 'P-D-RM01-RD', title: 'CatalogReader', read_model_id: 'P-D-RM01', file: 'src/catalog.ts', description: 'Reads the catalog view for the query handlers.' });
}

describe('LA-V143-R01-T01 a read model\'s records are read through the Read model aggregate\'s own query, never a generic record read', () => {
  it('reads GET /api/read-model/get-read-model for its reader, and shows its description', async () => {
    const { requests } = await openApp('/P-D-RM01-RD', { data: withReader() });
    expect(await within(main()).findByText('Reads the catalog view for the query handlers.')).toBeInTheDocument();
    expect(requests).toContain('GET /api/read-model/get-read-model?id=P-D-RM01-RD');
  });
});

describe('LA-V143-R04-T01 a read model shows its fields with their types, its queries with each one\'s handler, and its projection and reader', () => {
  it('lays out its fields and queries as tables, lists its reader, and says its projection is not written yet', async () => {
    await openApp('/P-D-RM01', { data: withReader() });
    await within(main()).findByRole('heading', { name: /^Queries/ });
    expect(rows(section(/^Fields/).querySelector('table')!)).toEqual([
      ['Thing', 'The thing.', '→ P-D-A1Thing', 'yes'],
      ['Lent', 'Whether it is out.', 'yes/no', 'yes'],
    ]);
    expect(rows(section(/^Queries/).querySelector('table')!)).toEqual([['P-D-QRY01List things', 'Nothing yet']]);
    expect(section(/^Reader/)).toHaveTextContent('P-D-RM01-RD');
    expect(section(/^Projection/)).toHaveTextContent('Its projection is not written yet.');
  });
});

describe('LA-V143-R02-T01 the Read model editor writes only through the aggregate\'s own commands, one per change', () => {
  it('Edit sends Change a reader with only what changed (a file emptied as null); Add a projection takes its one ID; no Move', async () => {
    const user = userEvent.setup();
    const { commands } = await openApp('/P-D-RM01-RD', { data: withReader(), command: () => ({ answer: ok }) });
    const actions = await toolbar('P-D-RM01-RD');
    expect(within(actions).getAllByRole('button').map((b) => b.textContent)).toEqual(['Edit', 'Remove']);
    await user.click(within(actions).getByRole('button', { name: 'Edit' }));
    const form = screen.getByRole('form', { name: 'Edit P-D-RM01-RD' });
    await user.clear(within(form).getByRole('textbox', { name: /^file/ }));
    await user.click(within(form).getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(commands).toEqual([{ route: '/api/read-model/change-reader', input: { id: 'P-D-RM01-RD', file: null } }]));

    await openApp('/P-D-RM01', { data: withReader(), command: () => ({ answer: ok }) });
    const own = await toolbar('P-D-RM01');
    expect(within(own).getAllByRole('button').map((b) => b.textContent)).toEqual(['Edit', 'Add…', 'Remove']);
    expect(await addChoices(user, own)).toEqual(['Query', 'Projection', 'Storage requirement', 'Table']);
    await chooseAdd(user, own, 'Projection');
    const add = screen.getByRole('form', { name: 'Add a projection' });
    await waitFor(() => expect(within(add).getByRole('textbox', { name: /^ID/ })).toHaveValue('P-D-RM01-PJ'));
  });
});

describe('LA-V143-R03-T01 a refused Read model command shows every reason, keeps what was entered, and changes nothing', () => {
  it('a refused Add keeps the draft and focuses the reasons', async () => {
    const user = userEvent.setup();
    const refusal: WriteAnswer = { ok: false, error: 'refused', problems: [{ rule: 'read-model-fed-by-published', table: 'fed_by', key: 'P-D-RM01', message: 'P-D-RM01 is a read model of domain P-D, so it cannot be fed by P-E-EV01, an event of domain P-E that is not published' }] };
    const { commands } = await openApp('/P-D-RM01', { data: withReader(), command: () => ({ answer: refusal }) });
    await chooseAdd(user, await toolbar('P-D-RM01'), 'Query');
    const add = screen.getByRole('form', { name: 'Add a query' });
    await waitFor(() => expect(within(add).getByRole('textbox', { name: /^ID/ })).toHaveValue('P-D-QRY02'));
    await user.type(within(add).getByRole('textbox', { name: /^title/ }), 'Lent things');
    await user.type(within(add).getByRole('textbox', { name: /^description/ }), 'The things out on loan.');
    await chooseAdd(user, add, 'Query');
    const alert = await within(add).findByRole('alert');
    expect(alert).toHaveTextContent('The change was refused. Nothing was saved.');
    expect(alert).toHaveTextContent('an event of domain P-E that is not published');
    expect(alert).toHaveFocus();
    expect(within(add).getByRole('textbox', { name: /^title/ })).toHaveValue('Lent things');
    expect(commands).toEqual([{ route: '/api/read-model/add-query', input: { read_model_id: 'P-D-RM01', id: 'P-D-QRY02', title: 'Lent things', description: 'The things out on loan.' } }]);
  });
});
