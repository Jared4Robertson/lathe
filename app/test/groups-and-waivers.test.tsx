import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { SpecRecord, Workspace } from '../../lathe/src/types';
import { indexWorkspace } from '../src/specs/data';
import { groupRecords } from '../src/specs/groups';
import { appliesWhenOf, followingDomains, patternsFollowedBy, ruleStatus } from '../src/specs/patterns';
import { owingDomains } from '../src/specs/trace';
import { patternWorkspace } from './fixtures/patterns';
import { standardWorkspace } from './fixtures/standards';
import { main, openApp, openSideBar, section, sideBar } from './helpers';

// Groups (FORMAT.md section 21) and waivers by setting value (section 11) in the app, on the pattern
// workspace: DM-SHOP-UC01 gives record Basket, DM-PAY-UC01 gives record Payment.

const rule = (id: string, title: string, fields: Record<string, string>): SpecRecord =>
  ({ id, kind: 'pattern_rule', title, parent: 'DM-PAT-CHECKOUT', product: 'DM', domain: null, fields, body: 'It MUST hold.', path: `specs/dm/${id}.md`, mentions: [] });

/** The pattern workspace with R03 (applies when record is basket), R04 (record is not basket), a malformed R05, and groups. */
function waiverWorkspace(): Workspace {
  const ws = patternWorkspace();
  ws.records.push(
    rule('DM-PAT-CHECKOUT-R03', 'The basket keeps its items', { applies_when: 'record is  BASKET ', group: 'Keeping' }),
    rule('DM-PAT-CHECKOUT-R04', 'The payment is receipted', { applies_when: 'record is not basket', group: 'keeping' }),
    rule('DM-PAT-CHECKOUT-R05', 'A malformed condition', { applies_when: 'record basket' }),
  );
  return ws;
}

/** The pattern workspace with DM-SHOP-UC01's requirements in groups, after an ungrouped one. */
function groupedWorkspace(): Workspace {
  const ws = waiverWorkspace();
  const shop = ws.records.find((r) => r.id === 'DM-SHOP-UC01-R02')!;
  shop.fields = { ...shop.fields, group: 'Limits' };
  ws.records.push(
    { ...shop, id: 'DM-SHOP-UC01-R03', title: 'A sold-out item is refused', path: 'specs/dm/DM-SHOP-UC01-R03.md', fields: { group: 'Stock' } },
    { ...shop, id: 'DM-SHOP-UC01-R04', title: 'A basket holds at most fifty items', path: 'specs/dm/DM-SHOP-UC01-R04.md', fields: { group: ' limits' } },
  );
  return ws;
}

describe('waivers by setting value', () => {
  it('LA-TRC-T120 A rule no follower meets shows as Waived here, with the value given, and the gaps leave it out', async () => {
    const ix = indexWorkspace(waiverWorkspace());
    const r03 = ix.byId.get('DM-PAT-CHECKOUT-R03')!;
    const r04 = ix.byId.get('DM-PAT-CHECKOUT-R04')!;
    expect(appliesWhenOf(ix, r03)).toEqual({ setting: 'record', not: false, value: 'BASKET' });
    expect(appliesWhenOf(ix, ix.byId.get('DM-PAT-CHECKOUT-R05')!)).toBeNull();
    const shop = patternsFollowedBy(ix, 'DM-SHOP')[0];
    const pay = patternsFollowedBy(ix, 'DM-PAY')[0];
    // Values are compared trimmed and in any letter case.
    expect(ruleStatus(ix, r03, 'DM-SHOP', shop)).toMatchObject({ applies: true });
    expect(ruleStatus(ix, r03, 'DM-PAY', pay)).toEqual({ applies: false, why: 'waived', condition: { setting: 'record', not: false, value: 'BASKET' }, given: ['Payment'] });
    expect(ruleStatus(ix, r04, 'DM-SHOP', shop)).toMatchObject({ applies: false, why: 'waived', given: ['Basket'] });
    expect(ruleStatus(ix, r04, 'DM-PAY', pay)).toMatchObject({ applies: true });
    // The Traceability gaps judge only the domains that owe it.
    expect(owingDomains(ix, r03)).toEqual(['DM-SHOP']);
    // A domain that follows the pattern itself meets it only through the settings it gives.
    const ws = waiverWorkspace();
    ws.links.push({ source: 'DM-PAY', relation: 'follows', target: 'DM-PAT-CHECKOUT' });
    ws.records = ws.records.map((r) => (r.id === 'DM-PAY' ? { ...r, fields: { ...r.fields, record: 'basket' } } : r));
    const itself = indexWorkspace(ws);
    const followed = followingDomains(itself, 'DM-PAT-CHECKOUT').find((d) => d.domain === 'DM-PAY')!;
    expect(followed.byDomain).toBe(true);
    expect(ruleStatus(itself, itself.byId.get('DM-PAT-CHECKOUT-R03')!, 'DM-PAY', followed)).toMatchObject({ applies: true });

    await openApp('/DM-PAY', { workspace: waiverWorkspace() });
    await screen.findByRole('heading', { level: 1, name: 'Paying' });
    const patterns = section(/^Patterns we follow/);
    fireEvent.click(within(patterns).getByRole('button', { name: 'Expand DM-PAY:DM-PAT-CHECKOUT' }));
    const row = within(patterns).getByRole('link', { name: /^DM-PAT-CHECKOUT-R03/ }).closest('.record-row') as HTMLElement;
    expect(row).toHaveTextContent('applies when record is BASKET');
    expect(within(row).getByText('Waived here: record is Payment')).toHaveAttribute('title', expect.stringContaining('applies only when record is BASKET'));
    expect(within(row).queryByText('not proved')).toBeNull();

    await openApp('/DM-PAT-CHECKOUT-R03', { workspace: waiverWorkspace() });
    await screen.findByRole('heading', { level: 1, name: 'The basket keeps its items' });
    const owed = section(/^Owed by/);
    expect(within(owed).getByText('Waived here: record is Payment')).toBeInTheDocument();
    const gaps = within(main()).getByRole('list', { name: 'DM-PAT-CHECKOUT-R03 by domain' });
    expect(within(gaps).getAllByRole('listitem').map((li) => within(li).getAllByRole('link')[0].textContent)).toEqual([expect.stringMatching(/^DM-SHOP/)]);
  });
});

describe('groups', () => {
  it('LA-EXP-T195 Requirements, pattern rules and standard rules read under their group headings, the ungrouped first, and the Outline lists the groups', async () => {
    const ix = indexWorkspace(groupedWorkspace());
    const reqs = ix.children.get('DM-SHOP-UC01') ?? [];
    expect(groupRecords(reqs).map((g) => [g.heading, g.records.map((r) => r.id)])).toEqual([
      [null, ['DM-SHOP-UC01-R01']],
      ['Limits', ['DM-SHOP-UC01-R02', 'DM-SHOP-UC01-R04']],
      ['Stock', ['DM-SHOP-UC01-R03']],
    ]);

    openSideBar('outline');
    await openApp('/DM-SHOP-UC01', { workspace: groupedWorkspace() });
    await screen.findByRole('heading', { level: 1, name: 'Add an item to the basket' });
    // The Children section: the ungrouped requirement first, then each group under its heading.
    const children = section(/^UC requirements/);
    expect(within(children).getAllByRole('heading').map((h) => h.textContent)).toEqual(['UC requirements4', 'Limits2', 'Stock1']);
    expect(within(section(/^Limits/)).getAllByRole('link').map((a) => a.textContent)).toEqual([
      expect.stringMatching(/^DM-SHOP-UC01-R02/), expect.stringMatching(/^DM-SHOP-UC01-R04/),
    ]);
    // The Traceability table: one body per group, headed by its name.
    const table = within(main()).getByRole('table', { name: /How each requirement of DM-SHOP-UC01/ });
    expect(within(table).getAllByRole('rowheader').filter((h) => h.getAttribute('scope') === 'rowgroup').map((h) => h.textContent)).toEqual(['Limits', 'Stock']);
    // The Outline lists the groups.
    const outline = await waitFor(() => within(sideBar()).getByRole('list', { name: 'Sections' }));
    expect(within(outline).getAllByRole('button').map((b) => b.textContent)).toEqual(expect.arrayContaining(['Limits', 'Stock']));

    // A pattern's rules: the ungrouped first, then Keeping (written Keeping and keeping).
    await openApp('/DM-PAT-CHECKOUT', { workspace: waiverWorkspace() });
    await screen.findByRole('heading', { level: 1, name: 'Checkout step' });
    const rules = section(/^Rules/);
    expect(within(rules).getAllByRole('heading').map((h) => h.textContent)).toEqual(['Rules5', 'Keeping2']);
    expect(within(section(/^Keeping/)).getAllByRole('link').map((a) => a.textContent)).toEqual([
      expect.stringMatching(/^DM-PAT-CHECKOUT-R03/), expect.stringMatching(/^DM-PAT-CHECKOUT-R04/),
    ]);

    // A standard's rule table heads each group's rows with its name.
    const std = standardWorkspace();
    for (const r of std.records) if (r.id.startsWith('DM-STD-CODE-R')) r.fields = { ...r.fields, group: 'Data' };
    await openApp('/DM-STD-CODE', { workspace: std });
    await screen.findByRole('heading', { level: 1, name: 'Shop code' });
    const stdTable = within(section(/^Rules/)).getByRole('table');
    expect(within(stdTable).getAllByRole('rowheader').filter((h) => h.getAttribute('scope') === 'rowgroup').map((h) => h.textContent)).toEqual(['Data']);
  });
});
