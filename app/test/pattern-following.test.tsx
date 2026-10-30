import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { PATTERN_FOLLOWING_COMMANDS } from '../../lathe/src/traceability/pattern-following/commands/index';
import type { PatternFollowingCommands } from '../src/traceability/pattern-following/commands';
import type { WriteAnswer } from '../../lathe/src/server/contract';
import { patternWorkspace } from './fixtures/patterns';
import { main, openApp, section } from './helpers';

// A pattern's followers and the following's editor (LA-TRC-A3, LA-V122): the Pattern page's Followed by and a rule's
// Owed by read the followers through the Pattern following aggregate's own query, and each follower's row changes its
// following only through the aggregate's own commands, one per change, each refusal shown with its reasons. What the
// sections show is in patterns.test.tsx (LA-V122-R04, R05). In the fixture, DM-SHOP follows DM-PAT-AUDIT itself
// (retention 1 year, who not applicable) and so does its use case DM-SHOP-UC01, giving no values.

const ok: WriteAnswer = { ok: true, tables: [], files: [], changes: [] };

/** The Followed by section once it has read the pattern's followers. */
async function followedBy() {
  await screen.findByRole('heading', { level: 1, name: 'Audited action' });
  return within(main()).findByRole('heading', { name: /^Followed by\d/ }).then(() => section(/^Followed by/));
}

/** A row's text without its actions' toolbar: the follower and the values it gives. */
const rowText = (row: HTMLElement) => [...row.childNodes].map((c) => { const copy = c.cloneNode(true) as HTMLElement; copy.querySelectorAll?.('[role="toolbar"]').forEach((t) => t.remove()); return copy.textContent; }).join('');

describe('LA-V122-R06-T01 a pattern\'s followers are read through the Pattern following aggregate\'s own query', () => {
  it('reads GET /api/pattern-following/list-followers for the pattern, and shows each domain with who follows it there', async () => {
    const { requests } = await openApp('/DM-PAT-AUDIT', { data: patternWorkspace() });
    const followed = await followedBy();
    expect(requests).toContain('GET /api/pattern-following/list-followers?pattern_id=DM-PAT-AUDIT');
    const shop = within(followed).getByRole('region', { name: 'Followed in DM-SHOP' });
    expect(within(within(shop).getAllByRole('table')[0]).getAllByRole('row').map(rowText)).toEqual([
      'Use caseretentionwho',
      'The whole domain1 yearnot given',
      'DM-SHOP-UC01Add an item to the basketnot givennot given',
    ]);
  });

  it('reads the same query for a rule\'s Owed by', async () => {
    const { requests } = await openApp('/DM-PAT-AUDIT-R01', { data: patternWorkspace() });
    expect(await within(main()).findByRole('heading', { name: /^Owed by1/ })).toBeInTheDocument();
    expect(requests).toContain('GET /api/pattern-following/list-followers?pattern_id=DM-PAT-AUDIT');
  });

  it('holds the app\'s list of the aggregate\'s commands to its definitions, one to one', () => {
    const routes: (keyof PatternFollowingCommands)[] = [
      '/api/pattern-following/follow-pattern', '/api/pattern-following/change-setting-values', '/api/pattern-following/stop-following-pattern',
    ];
    expect([...routes].sort()).toEqual(PATTERN_FOLLOWING_COMMANDS.map((c) => c.route).sort());
  });
});

describe('LA-V122-R07-T01 the following\'s editor writes only through the Pattern following aggregate\'s own commands, one per change', () => {
  it('Change values sends Change the setting values with the whole list', async () => {
    const user = userEvent.setup();
    const { commands } = await openApp('/DM-PAT-AUDIT', { data: patternWorkspace(), command: () => ({ answer: ok }) });
    await user.click(within(within(await followedBy()).getByRole('toolbar', { name: 'Change the following of DM-SHOP' })).getByRole('button', { name: 'Change values' }));
    const form = screen.getByRole('form', { name: 'Change the values DM-SHOP gives' });
    const retention = within(form).getByRole('textbox', { name: 'value 1' });
    expect(retention).toHaveValue('1 year');
    await user.clear(retention);
    await user.type(retention, '2 years');
    await user.click(within(form).getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(commands).toEqual([{
      route: '/api/pattern-following/change-setting-values',
      input: { follower_id: 'DM-SHOP', pattern_id: 'DM-PAT-AUDIT', setting_values: [{ setting: 'retention', value: '2 years' }] } }]));
  });

  it('Stop following asks first, then sends Stop following a pattern', async () => {
    const user = userEvent.setup();
    const { commands } = await openApp('/DM-PAT-AUDIT', { data: patternWorkspace(), command: () => ({ answer: ok }) });
    await user.click(within(within(await followedBy()).getByRole('toolbar', { name: 'Change the following of DM-SHOP-UC01' })).getByRole('button', { name: 'Stop following' }));
    const form = screen.getByRole('form', { name: 'Stop DM-SHOP-UC01 following DM-PAT-AUDIT' });
    expect(commands).toEqual([]);
    await user.click(within(form).getByRole('button', { name: 'Stop following' }));
    await waitFor(() => expect(commands).toEqual([{ route: '/api/pattern-following/stop-following-pattern', input: { follower_id: 'DM-SHOP-UC01', pattern_id: 'DM-PAT-AUDIT' } }]));
  });

  it('Follow offers the product\'s domains and use cases that do not follow it yet, and sends Follow a pattern with a row per setting', async () => {
    const user = userEvent.setup();
    const { commands } = await openApp('/DM-PAT-AUDIT', { data: patternWorkspace(), command: () => ({ answer: ok }) });
    await user.click(within(await followedBy()).getByRole('button', { name: 'Follow' }));
    const form = screen.getByRole('form', { name: 'Follow DM-PAT-AUDIT' });
    const follower = within(form).getByRole('combobox', { name: /^Follower/ });
    const offered = within(follower).getAllByRole('option').map((o) => (o as HTMLOptionElement).value);
    expect(offered).toContain('DM-PAY');
    expect(offered).not.toContain('DM-SHOP');
    expect(offered).not.toContain('DM-SHOP-UC01');
    expect(offered).not.toContain('NF-NOTE');
    await user.selectOptions(follower, 'DM-PAY');
    await user.type(within(form).getByRole('textbox', { name: 'value 1' }), '30 days');
    await user.type(within(form).getByRole('textbox', { name: 'not applicable 2' }), 'Payments are anonymous.');
    await user.click(within(form).getByRole('button', { name: 'Follow' }));
    await waitFor(() => expect(commands).toEqual([{
      route: '/api/pattern-following/follow-pattern',
      input: { pattern_id: 'DM-PAT-AUDIT', follower_id: 'DM-PAY', setting_values: [{ setting: 'retention', value: '30 days' }, { setting: 'who', not_applicable: 'Payments are anonymous.' }] } }]));
  });
});

describe('LA-V122-R08-T01 a refused Pattern following command shows every reason, keeps what was entered, and changes nothing', () => {
  it('a refused Change values keeps the form open with the reasons at its top, focused', async () => {
    const user = userEvent.setup();
    const refusal: WriteAnswer = { ok: false, error: 'refused', problems: [{ rule: 'check', table: 'setting_value', key: 'DM-SHOP', message: 'setting colour is not one of DM-PAT-AUDIT\'s settings' }] };
    const { commands } = await openApp('/DM-PAT-AUDIT', { data: patternWorkspace(), command: () => ({ answer: refusal }) });
    await user.click(within(within(await followedBy()).getByRole('toolbar', { name: 'Change the following of DM-SHOP' })).getByRole('button', { name: 'Change values' }));
    const form = screen.getByRole('form', { name: 'Change the values DM-SHOP gives' });
    const setting = within(form).getByRole('textbox', { name: 'setting 1' });
    await user.clear(setting);
    await user.type(setting, 'colour');
    await user.click(within(form).getByRole('button', { name: 'Save' }));
    const alert = await within(form).findByRole('alert');
    expect(alert).toHaveTextContent('The change was refused. Nothing was saved.');
    expect(alert).toHaveTextContent('setting colour is not one of');
    expect(alert).toHaveFocus();
    expect(setting).toHaveValue('colour');
    expect(commands).toHaveLength(1);
    expect(within(section(/^Followed by/)).getByRole('region', { name: 'Followed in DM-SHOP' })).toBeInTheDocument();
  });
});
