import type { ServedData } from './read-view';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { CHECK_COMMANDS } from '../../lathe/src/checking/check/commands/index';
import type { CheckCommands } from '../src/checking/check/commands';
import type { WriteAnswer } from '../../lathe/src/server/contract';
import { addRows } from './fixtures/load';
import { workspace } from './fixtures/workspace';
import { openApp } from './helpers';

// The Check page and its editor (LA-CHK-A1, LA-V03): a check is read through the aggregate's own query, a product's
// own check is changed only through the aggregate's own commands, one per change, Lathe's are read-only, and each
// refusal is shown with its reasons. What the page shows of a check is in format-pages.test.tsx (LA-V03-R01).

const ok: WriteAnswer = { ok: true, tables: [], files: [], changes: [] };
const card = () => screen.getByRole('region', { name: 'Wiki card' });

/** The component-test workspace with a check of the product's own. */
function ownCheck(): ServedData {
  return addRows(workspace(), 'check', {
    name: 'domain-without-owner', product_id: 'DM', domain_id: 'LA-CHK', position: 1, severity: 'warning', summary: 'Every domain names its owner.',
    explanation: 'Name the role that owns the domain.', query: "SELECT 'warning' AS severity, 'domain-without-owner' AS \"check\", id AS record, 'x' AS message FROM domain WHERE false", kinds: ['domain'] });
}

describe('LA-V03-R02-T01 a check is read through the Check aggregate\'s own query, never from the generic index', () => {
  it('reads GET /api/check/get-check for a check, and shows its summary, where it comes from and where it runs', async () => {
    const { requests } = await openApp('/DM?page=format/checks/domain-without-owner', { data: ownCheck() });
    expect(await within(card()).findByText('Every domain names its owner.')).toBeInTheDocument();
    expect(requests).toContain('GET /api/check/get-check?name=domain-without-owner');
    expect(within(card()).getByText("This product's own checks")).toBeInTheDocument();
    expect(within(card()).getByText("1st of the product's own, after Lathe's")).toBeInTheDocument();
  });

  it('holds the app\'s list of the aggregate\'s commands to its definitions, one to one', () => {
    const routes: (keyof CheckCommands)[] = ['/api/check/add-check', '/api/check/change-check', '/api/check/remove-check'];
    expect([...routes].sort()).toEqual(CHECK_COMMANDS.map((c) => c.route).sort());
  });
});

describe('LA-V03-R03-T01 the Check editor writes only through the aggregate\'s own commands, one per change, and Lathe\'s checks are read-only', () => {
  it('Edit sends Change a check with only what changed; emptied kinds are cleared with null; no Move', async () => {
    const user = userEvent.setup();
    const { commands } = await openApp('/DM?page=format/checks/domain-without-owner', { data: ownCheck(), command: () => ({ answer: ok }) });
    const actions = await within(card()).findByRole('toolbar', { name: 'Change domain-without-owner' });
    expect(within(actions).getAllByRole('button').map((b) => b.textContent)).toEqual(['Edit', 'Remove']);
    await user.click(within(actions).getByRole('button', { name: 'Edit' }));
    const form = screen.getByRole('form', { name: 'Edit domain-without-owner' });
    await user.selectOptions(within(form).getByRole('combobox', { name: /^severity/ }), 'error');
    await user.clear(within(form).getByRole('textbox', { name: /^kinds/ }));
    await user.click(within(form).getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(commands).toEqual([{ route: '/api/check/change-check', input: { name: 'domain-without-owner', severity: 'error', kinds: null } }]));
  });

  it('Remove sends Remove a check and opens the format page', async () => {
    const user = userEvent.setup();
    const { commands } = await openApp('/DM?page=format/checks/domain-without-owner', { data: ownCheck(), command: () => ({ answer: ok }) });
    await user.click(within(await within(card()).findByRole('toolbar', { name: 'Change domain-without-owner' })).getByRole('button', { name: 'Remove' }));
    await user.click(within(screen.getByRole('region', { name: 'Remove domain-without-owner?' })).getByRole('button', { name: 'Remove domain-without-owner' }));
    await waitFor(() => expect(commands).toEqual([{ route: '/api/check/remove-check', input: { name: 'domain-without-owner' } }]));
    await waitFor(() => expect(window.location.search).toBe('?page=format'));
  });

  it('shows no actions on one of Lathe\'s own checks', async () => {
    await openApp('/DM?page=format/checks/not-proved', { data: ownCheck() });
    expect(await within(card()).findByText('Every obligation is proved by a test.')).toBeInTheDocument();
    expect(within(card()).queryByRole('toolbar', { name: 'Change not-proved' })).toBeNull();
  });

  it('adds a product\'s own check from the format page\'s Checks, through Add a check', async () => {
    const user = userEvent.setup();
    const { commands } = await openApp('/DM?page=format', { data: ownCheck(), command: () => ({ answer: ok }) });
    await user.click(within(await within(card()).findByRole('toolbar', { name: 'Change the checks of DM' })).getByRole('button', { name: 'Add check' }));
    const form = screen.getByRole('form', { name: 'Add a check' });
    await user.type(within(form).getByRole('textbox', { name: /^name/ }), 'use-case-without-goal');
    await user.type(within(form).getByRole('textbox', { name: /^domain/ }), 'DM-SHOP');
    await user.type(within(form).getByRole('spinbutton', { name: /^position/ }), '2');
    await user.selectOptions(within(form).getByRole('combobox', { name: /^severity/ }), 'warning');
    await user.type(within(form).getByRole('textbox', { name: /^summary/ }), 'Every use case has a goal.');
    await user.type(within(form).getByRole('textbox', { name: /^explanation/ }), 'Write its goal.');
    await user.type(within(form).getByRole('textbox', { name: /^query/ }), 'SELECT 1');
    await user.click(within(form).getByRole('button', { name: 'Add check' }));
    await waitFor(() => expect(commands).toEqual([{
      route: '/api/check/add-check',
      input: { product_id: 'DM', domain_id: 'DM-SHOP', name: 'use-case-without-goal', position: 2, severity: 'warning', summary: 'Every use case has a goal.', explanation: 'Write its goal.', query: 'SELECT 1' } }]));
    await waitFor(() => expect(window.location.search).toBe('?page=format/checks/use-case-without-goal'));
  });
});

describe('LA-V03-R04-T01 a refused Check command shows every reason, keeps what was entered, and changes nothing', () => {
  it('a refused change keeps the form open with the reasons at its top, focused', async () => {
    const user = userEvent.setup();
    const refusal: WriteAnswer = { ok: false, error: 'refused', problems: [{ rule: 'check', table: 'check', key: 'domain-without-owner', message: 'a check of the product runs after Lathe\'s: its position counts from 1' }] };
    const { commands } = await openApp('/DM?page=format/checks/domain-without-owner', { data: ownCheck(), command: () => ({ answer: refusal }) });
    await user.click(within(await within(card()).findByRole('toolbar', { name: 'Change domain-without-owner' })).getByRole('button', { name: 'Edit' }));
    const form = screen.getByRole('form', { name: 'Edit domain-without-owner' });
    const position = within(form).getByRole('spinbutton', { name: /^position/ });
    await user.clear(position);
    await user.type(position, '0');
    await user.click(within(form).getByRole('button', { name: 'Save' }));
    const alert = await within(form).findByRole('alert');
    expect(alert).toHaveTextContent('The change was refused. Nothing was saved.');
    expect(alert).toHaveTextContent('its position counts from 1');
    expect(alert).toHaveFocus();
    expect(position).toHaveValue(0);
    expect(commands).toEqual([{ route: '/api/check/change-check', input: { name: 'domain-without-owner', position: 0 } }]);
  });
});
