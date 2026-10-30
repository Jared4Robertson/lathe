import type { ServedData } from './read-view';
import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { groupRecords } from '../src/specs/groups';
import { patternWorkspace, withStandings } from './fixtures/patterns';
import { standardWorkspace } from './fixtures/standards';
import { main, openApp, section } from './helpers';
import { addRows, setRow } from './fixtures/load';
import { recordIndexOf } from './read-view';

// Groups (group_name) in the app, on the pattern workspace, with DM-PAY following through DM-PAY-UC01 too.

/** The pattern workspace with DM-PAY-UC01 following too, R04 (who is not clerk), and R03 and R04 grouped. */
function waiverWorkspace(): ServedData {
  const ws = patternWorkspace();
  addRows(ws, 'follows', { source_id: 'DM-PAY-UC01', target_id: 'DM-PAT-AUDIT' });
  addRows(ws, 'setting_value',
    { follower_id: 'DM-SHOP-UC01', pattern_id: 'DM-PAT-AUDIT', setting: 'who', value: 'CLERK ' },
    { follower_id: 'DM-PAY-UC01', pattern_id: 'DM-PAT-AUDIT', setting: 'who', value: 'Shopper' },
  );
  setRow(ws, 'pattern_rule', 'DM-PAT-AUDIT-R03', { group_name: 'Keeping' });
  addRows(ws, 'pattern_rule', {
    id: 'DM-PAT-AUDIT-R04', title: 'The shopper is named', pattern_id: 'DM-PAT-AUDIT', statement: 'It MUST hold.',
    group_name: 'keeping', applies_when_setting: 'who', applies_when_negated: true, applies_when_value: 'clerk' });
  withStandings(ws, 'DM-SHOP', { R01: 'owed', R02: 'owed', R03: 'owed', R04: 'waived' });
  return withStandings(ws, 'DM-PAY', { R01: 'owed', R02: 'owed', R03: 'waived', R04: 'owed' });
}

/** The pattern workspace with DM-SHOP-UC01's UC requirements in groups, after an ungrouped one. */
function groupedWorkspace(): ServedData {
  const ws = setRow(waiverWorkspace(), 'uc_requirement', 'DM-SHOP-UC01-R02', { group_name: 'Limits' });
  return addRows(ws, 'uc_requirement',
    { id: 'DM-SHOP-UC01-R03', title: 'A sold-out item is refused', use_case_id: 'DM-SHOP-UC01', statement: 'A sold-out item MUST be refused.', group_name: 'Stock' },
    { id: 'DM-SHOP-UC01-R04', title: 'A basket holds at most fifty items', use_case_id: 'DM-SHOP-UC01', statement: 'A basket MUST hold at most fifty items.', group_name: ' limits' },
  );
}

describe('groups', () => {
  it('LA-V92-R22-T01 UC requirements, pattern rules and standard rules read under their group headings, the ungrouped first', async () => {
    const ix = recordIndexOf(groupedWorkspace());
    const reqs = (ix.children.get('DM-SHOP-UC01') ?? []).filter((r) => r.kind === 'uc_requirement');
    expect(groupRecords(reqs).map((g) => [g.heading, g.records.map((r) => r.id)])).toEqual([
      [null, ['DM-SHOP-UC01-R01']],
      ['Limits', ['DM-SHOP-UC01-R02', 'DM-SHOP-UC01-R04']],
      ['Stock', ['DM-SHOP-UC01-R03']],
    ]);

    await openApp('/DM-SHOP-UC01', { data: groupedWorkspace() });
    await screen.findByRole('heading', { level: 1, name: 'Add an item to the basket' });
    // The UC requirements: the ungrouped one first, then each group under its heading (the flow is listed by interface).
    const children = section(/^UC requirements/);
    expect(within(children).getAllByRole('heading').map((h) => h.textContent)).toEqual(['UC requirements4', 'Limits2', 'Stock1']);
    expect(within(section(/^Limits/)).getAllByRole('link').map((a) => a.textContent)).toEqual([
      expect.stringMatching(/^DM-SHOP-UC01-R02/), expect.stringMatching(/^DM-SHOP-UC01-R04/),
    ]);
    // The Traceability table: one body per group, headed by its name.
    const table = within(main()).getByRole('table', { name: /How each UC requirement of DM-SHOP-UC01/ });
    expect(within(table).getAllByRole('rowheader').filter((h) => h.getAttribute('scope') === 'rowgroup').map((h) => h.textContent)).toEqual(['Limits', 'Stock']);

    // A pattern's rules: the ungrouped first, then Keeping (written Keeping and keeping).
    await openApp('/DM-PAT-AUDIT', { data: waiverWorkspace() });
    await screen.findByRole('heading', { level: 1, name: 'Audited action' });
    const rules = section(/^Rules/);
    expect(within(rules).getAllByRole('heading').map((h) => h.textContent)).toEqual(['Rules4', 'Keeping2']);
    expect(within(section(/^Keeping/)).getAllByRole('link').map((a) => a.textContent)).toEqual([
      expect.stringMatching(/^DM-PAT-AUDIT-R03/), expect.stringMatching(/^DM-PAT-AUDIT-R04/),
    ]);

    // A standard's rule table heads each group's rows with its name.
    const std = standardWorkspace();
    for (const r of std.sources[0].tables.standard_rule) r.group_name = 'Data';
    await openApp('/DM-STD-CODE', { data: std });
    await screen.findByRole('heading', { level: 1, name: 'Code standard' });
    const stdTable = within(section(/^Rules/)).getByRole('table');
    expect(within(stdTable).getAllByRole('rowheader').filter((h) => h.getAttribute('scope') === 'rowgroup').map((h) => h.textContent)).toEqual(['Data']);
  });
});
