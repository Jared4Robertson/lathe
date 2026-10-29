import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { TOOLING_COMMANDS } from '../../lathe/src/authoring/tooling/commands/index';
import type { ToolingCommands } from '../src/authoring/tooling/commands';
import type { SpecData, WriteAnswer } from '../../lathe/src/server/contract';
import { addRows, setRow } from './fixtures/load';
import { workspace } from './fixtures/workspace';
import { main, openApp } from './helpers';

// The Tooling page and its editor (LA-AUT-A21): a tooling record is read through the aggregate's own query, and changed
// only through the aggregate's own commands, one per change, each refusal shown with its reasons.

const ok: WriteAnswer = { ok: true, tables: [], files: [], changes: [] };
const toolbar = (id: string) => screen.getByRole('toolbar', { name: `Change ${id}` });

/** The demo shop with a tooling record of its Shopping domain that uses one package. */
function withTooling(): SpecData {
  const w = workspace();
  addRows(w, 'tooling', { id: 'DM-SHOP-TOOL01', title: 'vitest.config.ts', domain_id: 'DM-SHOP', file: 'vitest.config.ts' });
  addRows(w, 'package_use', { record_id: 'DM-SHOP-TOOL01', package: 'vitest' });
  return w;
}

describe('LA-V113-R01-T01 a tooling record\'s page reads it through its own query, never a generic record read', () => {
  it('reads GET /api/tooling/get-tooling and shows its file and its packages', async () => {
    const { requests } = await openApp('/DM-SHOP-TOOL01', { data: withTooling() });
    const packages = (await within(main()).findByRole('heading', { name: /^Packages/ })).closest('section')!;
    expect(packages).toHaveTextContent('vitest');
    expect(requests).toContain('GET /api/tooling/get-tooling?id=DM-SHOP-TOOL01');
    expect(main().querySelector('[data-field="file"]')).toHaveTextContent('vitest.config.ts');
  });

  it('holds the app\'s list of the aggregate\'s commands to its definitions, one to one', () => {
    const routes: (keyof ToolingCommands)[] = ['/api/tooling/add-tooling', '/api/tooling/change-tooling', '/api/tooling/remove-tooling'];
    expect([...routes].sort()).toEqual(TOOLING_COMMANDS.map((c) => c.route).sort());
  });
});

describe('LA-V113-R02-T01 the Tooling editor writes only through the aggregate\'s own commands, one per change', () => {
  it('Edit sends Change a tooling record with only what changed, an emptied file cleared, and offers no Move', async () => {
    const user = userEvent.setup();
    const changed = () => setRow(withTooling(), 'tooling', 'DM-SHOP-TOOL01', { file: null });
    const { commands, writes } = await openApp('/DM-SHOP-TOOL01', { data: withTooling(), command: () => ({ answer: ok, data: changed() }) });
    await within(main()).findByRole('heading', { name: /^Packages/ });
    expect(within(toolbar('DM-SHOP-TOOL01')).getAllByRole('button').map((b) => b.textContent)).toEqual(['Edit', 'Remove']);
    await user.click(within(toolbar('DM-SHOP-TOOL01')).getByRole('button', { name: 'Edit' }));
    const form = screen.getByRole('form', { name: 'Edit DM-SHOP-TOOL01' });
    await user.clear(within(form).getByRole('textbox', { name: /^file/ }));
    await user.click(within(form).getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(commands).toEqual([{ route: '/api/tooling/change-tooling', input: { id: 'DM-SHOP-TOOL01', file: null } }]));
    expect(writes).toEqual([]);
  });
});

describe('LA-V113-R03-T01 a refused Tooling command shows every reason, keeps what was entered, and changes nothing', () => {
  it('a refused Change shows the reasons at the top of the form, takes focus, and keeps the draft', async () => {
    const user = userEvent.setup();
    const refusal: WriteAnswer = { ok: false, error: 'refused', problems: [{ rule: 'missing', table: 'meets', key: 'DM-SHOP-TOOL01', message: 'there is no standard rule DM-STD-R09' }] };
    const { commands } = await openApp('/DM-SHOP-TOOL01', { data: withTooling(), command: () => ({ answer: refusal }) });
    await within(main()).findByRole('heading', { name: /^Packages/ });
    await user.click(within(toolbar('DM-SHOP-TOOL01')).getByRole('button', { name: 'Edit' }));
    const form = screen.getByRole('form', { name: 'Edit DM-SHOP-TOOL01' });
    const title = within(form).getByRole('textbox', { name: /^title/ });
    await user.type(title, 'x');
    await user.click(within(form).getByRole('button', { name: 'Save' }));
    const alert = await within(form).findByRole('alert');
    expect(alert).toHaveTextContent('The change was refused. Nothing was saved.');
    expect(alert).toHaveTextContent('there is no standard rule DM-STD-R09');
    expect(alert).toHaveFocus();
    expect(title).toHaveValue('vitest.config.tsx');
    expect(commands).toEqual([{ route: '/api/tooling/change-tooling', input: { id: 'DM-SHOP-TOOL01', title: 'vitest.config.tsx' } }]);
  });
});
