import type { ServedData } from './read-view';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { UI_COMPONENT_COMMANDS } from '../../lathe/src/authoring/ui-component/commands/index';
import type { UiComponentCommands } from '../src/authoring/ui-component/commands';
import type { WriteAnswer } from '../../lathe/src/server/contract';
import { addRows } from './fixtures/load';
import { modelWorkspace } from './fixtures/model';
import { findSection, main, openApp, section } from './helpers';

// The UI component page and its editor (LA-AUT-A15, LA-V151): a UI component is read through the aggregate's own
// query, and changed only through the aggregate's own commands, one per change, each refusal shown with its reasons.

const ok: WriteAnswer = { ok: true, tables: [], files: [], changes: [] };
const toolbar = (id: string) => screen.findByRole('toolbar', { name: `Change ${id}` });

/** The model fixture with its UI component using a package. */
const withPackage = (): ServedData => addRows(modelWorkspace(), 'package_use', { record_id: 'P-UI01', package: 'react' });

describe('LA-V151-R01-T01 a UI component is read through the UI component aggregate\'s own query, never a generic record read', () => {
  it('reads GET /api/ui-component/get-ui-component, and shows its description and its packages, the views it renders in its Traceability', async () => {
    const { requests } = await openApp('/P-UI01', { data: withPackage() });
    expect(await within(main()).findByText('The fixture\'s ui component Loan table.')).toBeInTheDocument();
    expect(requests).toContain('GET /api/ui-component/get-ui-component?id=P-UI01');
    expect(within(await findSection('Traceability')).getByRole('link', { name: /^P-V01Loan desk/ })).toBeInTheDocument();
    expect(within(section(/^Packages/)).getByText('react')).toBeInTheDocument();
  });

  it('holds the app\'s list of the aggregate\'s commands to its definitions, one to one', () => {
    const routes: (keyof UiComponentCommands)[] = ['/api/ui-component/add-ui-component', '/api/ui-component/change-ui-component', '/api/ui-component/remove-ui-component'];
    expect([...routes].sort()).toEqual(UI_COMPONENT_COMMANDS.map((c) => c.route).sort());
  });
});

describe('LA-V151-R02-T01 the UI component editor writes only through the aggregate\'s own commands, one per change', () => {
  it('Edit sends Change a UI component with only what changed: an emptied file is cleared with null, the packages whole; no Move', async () => {
    const user = userEvent.setup();
    const { commands } = await openApp('/P-UI01', { data: withPackage(), command: () => ({ answer: ok }) });
    const actions = await toolbar('P-UI01');
    expect(within(actions).getAllByRole('button').map((b) => b.textContent)).toEqual(['Edit', 'Remove']);
    await user.click(within(actions).getByRole('button', { name: 'Edit' }));
    const form = screen.getByRole('form', { name: 'Edit P-UI01' });
    await user.clear(within(form).getByRole('textbox', { name: /^file/ }));
    await user.type(within(form).getByRole('textbox', { name: /^Packages/ }), '{enter}react-dom');
    await user.click(within(form).getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(commands).toEqual([{ route: '/api/ui-component/change-ui-component', input: { id: 'P-UI01', file: null, packages: ['react', 'react-dom'] } }]));
  });

  it('adds a UI component from its product\'s page through the aggregate\'s own Add, with the next free ID', async () => {
    const user = userEvent.setup();
    const { commands } = await openApp('/P', { data: withPackage(), command: () => ({ answer: ok }) });
    const actions = await toolbar('P');
    await user.click(within(actions).getByRole('button', { name: 'Add…' }));
    await user.click(within(within(actions).getByRole('group', { name: 'Kinds to add under P' })).getByRole('button', { name: 'UI component' }));
    const form = screen.getByRole('form', { name: 'Add a UI component' });
    await waitFor(() => expect(within(form).getByRole('textbox', { name: /^ID/ })).toHaveValue('P-UI02'));
    await user.type(within(form).getByRole('textbox', { name: /^title/ }), 'LoanForm');
    await user.type(within(form).getByRole('textbox', { name: /^description/ }), 'Renders the form a loan is made with.');
    await user.click(within(form).getByRole('button', { name: 'Add UI component' }));
    await waitFor(() => expect(commands).toEqual([{ route: '/api/ui-component/add-ui-component', input: { id: 'P-UI02', title: 'LoanForm', description: 'Renders the form a loan is made with.' } }]));
  });
});

describe('LA-V151-R03-T01 a refused UI component command shows every reason, keeps what was entered, and changes nothing', () => {
  it('a refused Change keeps the form with what was entered and focuses the reasons', async () => {
    const user = userEvent.setup();
    const refusal: WriteAnswer = { ok: false, error: 'refused', problems: [{ rule: 'ui-component-renders-view', table: 'ui_component', key: 'P-UI01', message: 'UI component P-UI01 renders no view; it must render at least one' }] };
    const { commands } = await openApp('/P-UI01', { data: withPackage(), command: () => ({ answer: refusal }) });
    await user.click(within(await toolbar('P-UI01')).getByRole('button', { name: 'Edit' }));
    const form = screen.getByRole('form', { name: 'Edit P-UI01' });
    await user.type(within(form).getByRole('textbox', { name: /^title/ }), 's');
    await user.click(within(form).getByRole('button', { name: 'Save' }));
    const alert = await within(form).findByRole('alert');
    expect(alert).toHaveTextContent('The change was refused');
    expect(alert).toHaveTextContent('renders no view');
    expect(alert).toHaveFocus();
    expect(within(form).getByRole('textbox', { name: /^title/ })).toHaveValue('Loan tables');
    expect(commands).toEqual([{ route: '/api/ui-component/change-ui-component', input: { id: 'P-UI01', title: 'Loan tables' } }]);
  });

  it('Remove sends Remove a UI component and shows the refusal in the question', async () => {
    const user = userEvent.setup();
    const refusal: WriteAnswer = { ok: false, error: 'refused', problems: [{ rule: 'referenced', table: 'ui_component', key: 'P-UI01', message: 'UI component P-UI01 is referenced, so it stays: P-D-UC01-FL01-S01 names it' }] };
    const { commands } = await openApp('/P-UI01', { data: withPackage(), command: () => ({ answer: refusal }) });
    await user.click(within(await toolbar('P-UI01')).getByRole('button', { name: 'Remove' }));
    const panel = screen.getByRole('region', { name: 'Remove P-UI01?' });
    await user.click(within(panel).getByRole('button', { name: 'Remove P-UI01' }));
    const alert = await within(panel).findByRole('alert');
    expect(alert).toHaveTextContent('The removal was refused. Nothing was changed.');
    expect(alert).toHaveFocus();
    expect(commands).toEqual([{ route: '/api/ui-component/remove-ui-component', input: { id: 'P-UI01' } }]);
    expect(window.location.pathname).toBe('/P-UI01');
  });
});
