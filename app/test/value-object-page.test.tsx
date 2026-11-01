import { chooseAdd } from './add-menu';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import type { WriteAnswer } from '../../lathe/src/server/contract';
import { modelWorkspace } from './fixtures/model';
import { main, openApp, section } from './helpers';

// The Value object page and its editor (LA-AUT-A9, LA-V142): a value object and its constraints, value type and tests
// are read through the aggregate's own query, and changed only through the aggregate's own commands, one per change,
// each refusal shown with its reasons.

const ok: WriteAnswer = { ok: true, tables: [], files: [], changes: [] };
const toolbar = (id: string) => screen.findByRole('toolbar', { name: `Change ${id}` });
const rows = (table: HTMLTableElement) => [...table.querySelectorAll('tbody tr')].map((tr) => [...tr.querySelectorAll('th, td')].map((c) => c.textContent));

describe('LA-V142-R01-T01 a value object\'s records are read through the Value object aggregate\'s own query, never a generic record read', () => {
  it('reads GET /api/value-object/get-value-object for a constraint test, and shows what it accepts and refuses', async () => {
    const { requests } = await openApp('/P-VO01-C01-T', { data: modelWorkspace() });
    await waitFor(() => expect(main().querySelector('[data-field="refuses"]')).toHaveTextContent('(blank)'));
    expect(main().querySelector('[data-field="accepts"]')).toHaveTextContent('Ada');
    expect(requests).toContain('GET /api/value-object/get-value-object?id=P-VO01-C01-T');
  });
});

describe('LA-V142-R04-T01 a value object shows its fields with their types, its constraints with the test that proves each, and its value type', () => {
  it('lays out its fields and constraints as tables, and lists its value type', async () => {
    await openApp('/P-VO01', { data: modelWorkspace() });
    await within(main()).findByRole('heading', { name: /^Constraints/ });
    expect(rows(section(/^Fields/).querySelector('table')!)).toEqual([['Text', 'The name itself.', 'text', 'yes']]);
    expect(rows(section(/^Constraints/).querySelector('table')!)).toEqual([['P-VO01-C01A name is not blank', 'P-VO01-C01-T']]);
    expect(section(/^Value type/)).toHaveTextContent('P-VO01-VT');
  });
});

describe('LA-V142-R02-T01 the Value object editor writes only through the aggregate\'s own commands, one per change', () => {
  it('Edit sends Change a value object with only what changed; Add a constraint takes the next free ID; no Move', async () => {
    const user = userEvent.setup();
    const { commands } = await openApp('/P-VO01', { data: modelWorkspace(), command: () => ({ answer: ok }) });
    const actions = await toolbar('P-VO01');
    expect(within(actions).getAllByRole('button').map((b) => b.textContent)).toEqual(['Edit', 'Add constraint', 'Remove']);
    await user.click(within(actions).getByRole('button', { name: 'Edit' }));
    const form = screen.getByRole('form', { name: 'Edit P-VO01' });
    await user.type(within(form).getByRole('textbox', { name: /^description/ }), ' Never blank.');
    await user.click(within(form).getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(commands).toEqual([{ route: '/api/value-object/change-value-object', input: { id: 'P-VO01', description: 'What a thing or member is called. Never blank.' } }]));

    await chooseAdd(user, await toolbar('P-VO01'), 'Constraint');
    const add = screen.getByRole('form', { name: 'Add a constraint' });
    await waitFor(() => expect(within(add).getByRole('textbox', { name: /^ID/ })).toHaveValue('P-VO01-C02'));
    await user.type(within(add).getByRole('textbox', { name: /^title/ }), 'A name is short');
    await user.type(within(add).getByRole('textbox', { name: /^statement/ }), 'A name MUST be 80 characters at most.');
    await chooseAdd(user, add, 'Constraint');
    await waitFor(() => expect(commands[1]).toEqual({ route: '/api/value-object/add-constraint', input: { value_object_id: 'P-VO01', id: 'P-VO01-C02', title: 'A name is short', statement: 'A name MUST be 80 characters at most.' } }));
  });
});

describe('LA-V142-R03-T01 a refused Value object command shows every reason, keeps what was entered, and changes nothing', () => {
  it('Remove sends Remove a value object, says what goes with it, and shows the refusal naming the fields typed by it', async () => {
    const user = userEvent.setup();
    const refusal: WriteAnswer = { ok: false, error: 'refused', problems: [{ rule: 'referenced', table: 'value_object', key: 'P-VO01', message: 'Value object P-VO01 is referenced, so it stays: entity_field of P-D-EN02 (type_value_object_id)' }] };
    const { commands } = await openApp('/P-VO01', { data: modelWorkspace(), command: () => ({ answer: refusal }) });
    await user.click(within(await toolbar('P-VO01')).getByRole('button', { name: 'Remove' }));
    const panel = screen.getByRole('region', { name: 'Remove P-VO01?' });
    expect(within(panel).getByRole('list', { name: 'What goes with P-VO01' })).toHaveTextContent('P-VO01-C01-T');
    await user.click(within(panel).getByRole('button', { name: 'Remove P-VO01' }));
    const alert = await within(panel).findByRole('alert');
    expect(alert).toHaveTextContent('The removal was refused. Nothing was changed.');
    expect(alert).toHaveTextContent('entity_field of P-D-EN02');
    expect(alert).toHaveFocus();
    expect(commands).toEqual([{ route: '/api/value-object/remove-value-object', input: { id: 'P-VO01' } }]);
    expect(window.location.pathname).toBe('/P-VO01');
  });
});
