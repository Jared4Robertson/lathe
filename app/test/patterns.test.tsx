import { fireEvent, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { indexWorkspace } from '../src/specs/data';
import { followingDomains, notApplicableReason, patternsFollowedBy, ruleStatus, settingsOf } from '../src/specs/patterns';
import { patternWorkspace } from './fixtures/patterns';
import { openApp, section } from './helpers';

// Patterns in the app: the domain page's "Patterns we follow", a pattern's page and a pattern
// rule's page, from a workspace where two domains follow one pattern.

const index = () => indexWorkspace(patternWorkspace());
const rowOf = (scope: HTMLElement, id: string) => within(scope).getByRole('link', { name: new RegExp(`^${id}(?!-)`) }).closest('.record-row') as HTMLElement;

describe('pattern logic', () => {
  it('LA-TRC-T98 A domain follows the patterns its use cases follow, and a pattern lists its following domains', () => {
    const ix = index();
    expect(patternsFollowedBy(ix, 'DM-SHOP').map((f) => [f.pattern.id, f.useCases.map((u) => u.id)])).toEqual([['DM-PAT-CHECKOUT', ['DM-SHOP-UC01']]]);
    expect(patternsFollowedBy(ix, 'NF-NOTE')).toEqual([]);
    expect(followingDomains(ix, 'DM-PAT-CHECKOUT').map((d) => d.domain)).toEqual(['DM-PAY', 'DM-SHOP']);
    expect(settingsOf(ix.byId.get('DM-PAT-CHECKOUT')!)).toEqual(['record', 'audit']);
    expect(notApplicableReason('Not applicable: nothing changes')).toBe('nothing changes');
    expect(notApplicableReason('NOT APPLICABLE:  read only ')).toBe('read only');
    expect(notApplicableReason('The payments log')).toBeNull();
    expect(notApplicableReason(undefined)).toBeNull();
  });

  it('LA-TRC-T99 A rule is designed, built and proved per domain, by records in that domain only', () => {
    const ix = index();
    const r01 = ix.byId.get('DM-PAT-CHECKOUT-R01')!;
    const shop = ruleStatus(ix, r01, 'DM-SHOP', patternsFollowedBy(ix, 'DM-SHOP')[0]);
    expect(shop).toEqual({ applies: true, designedBy: ['DM-SHOP-C01'], builtBy: ['DM-SHOP-C01'], provedBy: ['DM-SHOP-T01'], plannedBy: [] });
    // In DM-PAY the component's file is missing (not built) and only a planned test proves it.
    const pay = ruleStatus(ix, r01, 'DM-PAY', patternsFollowedBy(ix, 'DM-PAY')[0]);
    expect(pay).toEqual({ applies: true, designedBy: ['DM-PAY-C01'], builtBy: [], provedBy: [], plannedBy: ['DM-PAY-T01'] });
  });

  it('LA-TRC-T100 A rule that names a setting every following use case marks Not applicable does not apply in that domain', () => {
    const ix = index();
    const r02 = ix.byId.get('DM-PAT-CHECKOUT-R02')!;
    expect(ruleStatus(ix, r02, 'DM-SHOP', patternsFollowedBy(ix, 'DM-SHOP')[0])).toEqual({
      applies: false,
      why: 'not-applicable',
      setting: 'audit',
      reasons: [{ useCase: 'DM-SHOP-UC01', reason: 'adding to a basket changes nothing worth auditing' }],
    });
    expect(ruleStatus(ix, r02, 'DM-PAY', patternsFollowedBy(ix, 'DM-PAY')[0])).toMatchObject({ applies: true, designedBy: [] });
  });
});

describe('Patterns we follow, on the domain page', () => {
  it('LA-TRC-T101 The domain page lists each pattern it follows, its rules folded under it, with what the domain designs, builds and proves', async () => {
    await openApp('/DM-PAY', { workspace: patternWorkspace() });
    await screen.findByRole('heading', { level: 1, name: 'Paying' });
    const patterns = section(/^Patterns we follow/);
    expect(within(patterns).getByRole('heading').textContent).toBe('Patterns we follow1');
    const row = rowOf(patterns, 'DM-PAT-CHECKOUT');
    expect(row).toHaveTextContent('followed by DM-PAY-UC01');
    // One level deep: the rules are folded.
    expect(within(patterns).queryByRole('link', { name: /^DM-PAT-CHECKOUT-R01/ })).toBeNull();
    expect(within(patterns).getByText('2 rules')).toBeInTheDocument();
    fireEvent.click(within(patterns).getByRole('button', { name: 'Expand DM-PAY:DM-PAT-CHECKOUT' }));
    const r01 = rowOf(patterns, 'DM-PAT-CHECKOUT-R01');
    expect(within(r01).getByText('designed')).toHaveAttribute('title', 'designed by DM-PAY-C01');
    expect(within(r01).getByText('not built')).toBeInTheDocument();
    expect(within(r01).getByText('not proved')).toBeInTheDocument();
    expect(within(r01).getByText('planned')).toHaveAttribute('title', expect.stringContaining('DM-PAY-T01'));
    const r02 = rowOf(patterns, 'DM-PAT-CHECKOUT-R02');
    expect(r02).toHaveTextContent('setting audit');
    expect(within(r02).getByText('not designed')).toBeInTheDocument();
  });

  it('LA-TRC-T102 A rule the domain marks Not applicable shows so, with the use case and its reason', async () => {
    await openApp('/DM-SHOP', { workspace: patternWorkspace() });
    await screen.findByRole('heading', { level: 1, name: 'Shopping' });
    const patterns = section(/^Patterns we follow/);
    fireEvent.click(within(patterns).getByRole('button', { name: 'Expand DM-SHOP:DM-PAT-CHECKOUT' }));
    const r02 = rowOf(patterns, 'DM-PAT-CHECKOUT-R02');
    expect(within(r02).getByText('not applicable')).toBeInTheDocument();
    expect(r02).toHaveTextContent('DM-SHOP-UC01: adding to a basket changes nothing worth auditing');
    expect(within(r02).getByRole('link', { name: 'DM-SHOP-UC01' })).toHaveAttribute('href', '/DM-SHOP-UC01');
    const r01 = rowOf(patterns, 'DM-PAT-CHECKOUT-R01');
    for (const mark of ['designed', 'built', 'proved']) expect(within(r01).getByText(mark)).toBeInTheDocument();
  });

  it('LA-TRC-T103 Coverage shows the pattern rule line, and its gaps name the rule', async () => {
    await openApp('/DM-PAY', { workspace: patternWorkspace() });
    await screen.findByRole('heading', { level: 1, name: 'Paying' });
    const coverage = section(/^Coverage/);
    const line = coverage.querySelector('[data-kind="pattern_rule"]') as HTMLElement;
    expect(line).toHaveTextContent('Pattern rules 2');
    expect(within(line).getByRole('img', { name: 'designed: 1 of 2' })).toBeInTheDocument();
    expect(within(line).getByRole('img', { name: 'planned: 1 of 2' })).toBeInTheDocument();
    expect(within(coverage).getAllByRole('listitem').map((li) => li.textContent)).toContainEqual(expect.stringMatching(/DM-PAT-CHECKOUT-R02.*Pattern rule with nothing that satisfies it/));
  });

  it('LA-TRC-T111 A pattern the domain itself follows is listed, followed by the whole domain, and every rule applies', async () => {
    const ws = patternWorkspace();
    // Paying follows the pattern itself, not through a use case (a pattern of its own product: a link stays in its product).
    ws.links = ws.links.filter((l) => !(l.relation === 'follows' && ws.records.find((r) => r.id === l.source)?.domain === 'DM-PAY'));
    ws.links.push({ source: 'DM-PAY', relation: 'follows', target: 'DM-PAT-CHECKOUT' } as (typeof ws.links)[number]);
    const ix = indexWorkspace(ws);
    expect(patternsFollowedBy(ix, 'DM-PAY').map((f) => [f.pattern.id, f.byDomain, f.useCases.length])).toEqual([['DM-PAT-CHECKOUT', true, 0]]);
    // A rule with a setting still applies: no use case of the domain can mark it not applicable.
    const ruleWithSetting = ix.workspace.records.find((r) => r.parent === 'DM-PAT-CHECKOUT' && r.fields.setting)!;
    expect(ruleStatus(ix, ruleWithSetting, 'DM-PAY', patternsFollowedBy(ix, 'DM-PAY')[0])).toMatchObject({ applies: true });
    await openApp('/DM-PAY', { workspace: ws });
    await screen.findByRole('heading', { level: 1, name: 'Paying' });
    expect(rowOf(section(/^Patterns we follow/), 'DM-PAT-CHECKOUT')).toHaveTextContent('followed by the whole domain');
  });

  it('LA-TRC-T104 A domain that follows no pattern says so', async () => {
    await openApp('/NF-NOTE', { workspace: patternWorkspace() });
    await screen.findByRole('heading', { level: 1, name: 'Notes' });
    expect(within(section(/^Patterns we follow/)).getByText('This domain follows no pattern.')).toBeInTheDocument();
  });
});

describe('pattern pages', () => {
  it('LA-TRC-T105 A pattern page shows its settings table, its rules, and each following domain with its use cases and settings', async () => {
    await openApp('/DM-PAT-CHECKOUT', { workspace: patternWorkspace() });
    await screen.findByRole('heading', { level: 1, name: 'Checkout step' });
    const settings = within(section(/^Settings/)).getByRole('table');
    expect(within(settings).getAllByRole('row').map((r) => r.textContent)).toEqual([
      'SettingRules that depend on it',
      'recordNone',
      'auditDM-PAT-CHECKOUT-R02',
    ]);
    expect(within(section(/^Rules/)).getAllByRole('listitem').map((li) => li.textContent)).toEqual([
      'DM-PAT-CHECKOUT-R01The step shows what it saved',
      'DM-PAT-CHECKOUT-R02The step writes an audit line setting audit',
    ]);
    // No separate Children list repeats the rules.
    expect(within(screen.getByRole('region', { name: 'Wiki pane' })).queryByRole('heading', { name: /^Children/ })).toBeNull();
    const followed = section(/^Followed by/);
    expect(within(followed).getByRole('heading', { level: 2 }).textContent).toBe('Followed by2');
    const pay = within(followed).getByRole('region', { name: 'Followed in DM-PAY' });
    const useCases = within(pay).getAllByRole('table')[0];
    expect(within(useCases).getAllByRole('row').map((r) => r.textContent)).toEqual([
      'Use caserecordaudit',
      'DM-PAY-UC01Pay by cardPaymentThe payments log',
    ]);
    const shop = within(followed).getByRole('region', { name: 'Followed in DM-SHOP' });
    expect(within(shop).getByText('Not applicable: adding to a basket changes nothing worth auditing')).toHaveClass('setting-na');
  });

  it('LA-TRC-T106 A pattern page shows each following domain\'s proof status per rule', async () => {
    await openApp('/DM-PAT-CHECKOUT', { workspace: patternWorkspace() });
    await screen.findByRole('heading', { level: 1, name: 'Checkout step' });
    const followed = section(/^Followed by/);
    const statusOf = (domain: string, rule: string) => {
      const table = within(within(followed).getByRole('region', { name: `Followed in ${domain}` })).getAllByRole('table')[1];
      return within(table).getByRole('link', { name: new RegExp(`^${rule}`) }).closest('tr') as HTMLElement;
    };
    expect(statusOf('DM-SHOP', 'DM-PAT-CHECKOUT-R01')).toHaveTextContent(/designed\s*built\s*proved/);
    expect(statusOf('DM-SHOP', 'DM-PAT-CHECKOUT-R02')).toHaveTextContent('not applicable');
    expect(statusOf('DM-PAY', 'DM-PAT-CHECKOUT-R01')).toHaveTextContent(/designed\s*not built\s*not proved\s*planned/);
    expect(statusOf('DM-PAY', 'DM-PAT-CHECKOUT-R02')).toHaveTextContent(/not designed\s*not built\s*not proved/);
  });

  it('LA-TRC-T107 A pattern rule page lists the domains that owe it, and a pattern nobody follows says so', async () => {
    await openApp('/DM-PAT-CHECKOUT-R02', { workspace: patternWorkspace() });
    await screen.findByRole('heading', { level: 1, name: 'The step writes an audit line' });
    const owed = section(/^Owed by/);
    expect(within(owed).getAllByRole('row').slice(1).map((r) => r.querySelector('th')!.textContent)).toEqual(['DM-PAYPaying', 'DM-SHOPShopping']);

    const ws = patternWorkspace();
    ws.links = ws.links.filter((l) => l.relation !== 'follows');
    await openApp('/DM-PAT-CHECKOUT', { workspace: ws });
    await screen.findByRole('heading', { level: 1, name: 'Checkout step' });
    expect(within(section(/^Followed by/)).getByText(/No use case follows this pattern/)).toBeInTheDocument();
  });
});
