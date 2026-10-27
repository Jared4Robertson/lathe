import { fireEvent, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { SpecData } from '../../lathe/src/server/contract';
import { textOf } from '../src/specs/data';
import { followingDomains, notApplicableReason, patternsFollowedBy, ruleStatus, settingValue, settingsOf } from '../src/specs/patterns';
import { patternWorkspace } from './fixtures/patterns';
import { openApp, section } from './helpers';
import { addRows, indexOf, removeRows } from './fixtures/load';

// Patterns in the app: the domain page's "Patterns we follow", a pattern's page and a pattern
// rule's page, from a workspace where two domains follow one pattern: DM-SHOP itself and through
// DM-SHOP-UC01 (R01 proved there by a pattern rule test), and DM-PAY through DM-PAY-UC01, which marks
// `retention` not applicable and gives `who` Shopper (R01 there has only a test not automated yet).

function twoDomains(): SpecData {
  const ws = patternWorkspace();
  addRows(ws, 'follows', { source_id: 'DM-PAY-UC01', target_id: 'DM-PAT-AUDIT' });
  addRows(ws, 'setting_value',
    { follower_id: 'DM-PAY-UC01', pattern_id: 'DM-PAT-AUDIT', setting: 'retention', not_applicable: 'Payments keep no records' },
    { follower_id: 'DM-PAY-UC01', pattern_id: 'DM-PAT-AUDIT', setting: 'who', value: 'Shopper' },
  );
  return addRows(ws, 'pattern_rule_test', {
    id: 'DM-PAT-AUDIT-R01-T02', title: 'A payment is recorded', pattern_rule_id: 'DM-PAT-AUDIT-R01', domain_id: 'DM-PAY', level: 'api', state: 'not automated yet',
  });
}

const index = () => indexOf(twoDomains());
const rowOf = (scope: HTMLElement, id: string) => within(scope).getByRole('link', { name: new RegExp(`^${id}(?!-)`) }).closest('.record-row') as HTMLElement;

describe('pattern logic', () => {
  it('LA-TRC-T98 A domain follows the patterns it or its use cases follow, and a pattern lists its following domains', () => {
    const ix = index();
    expect(patternsFollowedBy(ix, 'DM-SHOP').map((f) => [f.pattern.id, f.byDomain, f.useCases.map((u) => u.id)])).toEqual([['DM-PAT-AUDIT', true, ['DM-SHOP-UC01']]]);
    expect(patternsFollowedBy(ix, 'NF-NOTE')).toEqual([]);
    expect(followingDomains(ix, 'DM-PAT-AUDIT').map((d) => d.domain)).toEqual(['DM-PAY', 'DM-SHOP']);
    expect(settingsOf(ix, ix.byId.get('DM-PAT-AUDIT')!)).toEqual(['retention', 'who']);
    // A follower's setting_value rows: a value, or the reason the setting does not apply.
    expect(settingValue(ix, 'DM-SHOP', 'DM-PAT-AUDIT', 'retention')).toEqual({ value: '1 year' });
    expect(notApplicableReason(settingValue(ix, 'DM-PAY-UC01', 'DM-PAT-AUDIT', 'retention'))).toBe('Payments keep no records');
    expect(notApplicableReason({ notApplicable: '  read only ' })).toBe('read only');
    expect(notApplicableReason(settingValue(ix, 'DM-PAY-UC01', 'DM-PAT-AUDIT', 'who'))).toBeNull();
    expect(notApplicableReason(settingValue(ix, 'DM-SHOP-UC01', 'DM-PAT-AUDIT', 'missing'))).toBeNull();
  });

  it('LA-TRC-T99 A rule is proved per domain, by its pattern rule tests that name that domain', () => {
    const ix = index();
    const r01 = ix.byId.get('DM-PAT-AUDIT-R01')!;
    expect(ruleStatus(ix, r01, 'DM-SHOP', patternsFollowedBy(ix, 'DM-SHOP')[0])).toEqual({ applies: true, provedBy: ['DM-PAT-AUDIT-R01-T01'], notAutomatedBy: [] });
    // In DM-PAY only a test not automated yet is meant to prove it.
    expect(ruleStatus(ix, r01, 'DM-PAY', patternsFollowedBy(ix, 'DM-PAY')[0])).toEqual({ applies: true, provedBy: [], notAutomatedBy: ['DM-PAT-AUDIT-R01-T02'] });
  });

  it('LA-TRC-T100 A rule that names a setting every following use case marks Not applicable does not apply in that domain', () => {
    const ix = index();
    const r02 = ix.byId.get('DM-PAT-AUDIT-R02')!;
    expect(ruleStatus(ix, r02, 'DM-PAY', patternsFollowedBy(ix, 'DM-PAY')[0])).toEqual({
      applies: false,
      why: 'not-applicable',
      setting: 'retention',
      reasons: [{ useCase: 'DM-PAY-UC01', reason: 'Payments keep no records' }],
    });
    // DM-SHOP follows it itself, so the rule applies there.
    expect(ruleStatus(ix, r02, 'DM-SHOP', patternsFollowedBy(ix, 'DM-SHOP')[0])).toMatchObject({ applies: true, provedBy: [] });
  });
});

describe('Patterns we follow, on the domain page', () => {
  it('LA-TRC-T101 The domain page lists each pattern it follows, its rules folded under it, with what proves each in the domain', async () => {
    await openApp('/DM-PAY', { data: twoDomains() });
    await screen.findByRole('heading', { level: 1, name: 'Paying' });
    const patterns = section(/^Patterns we follow/);
    expect(within(patterns).getByRole('heading').textContent).toBe('Patterns we follow1');
    const row = rowOf(patterns, 'DM-PAT-AUDIT');
    expect(row).toHaveTextContent('followed by DM-PAY-UC01');
    // One level deep: the rules are folded.
    expect(within(patterns).queryByRole('link', { name: /^DM-PAT-AUDIT-R01/ })).toBeNull();
    expect(within(patterns).getByText('3 rules')).toBeInTheDocument();
    fireEvent.click(within(patterns).getByRole('button', { name: 'Expand DM-PAY:DM-PAT-AUDIT' }));
    const r01 = rowOf(patterns, 'DM-PAT-AUDIT-R01');
    expect(within(r01).getByText('not proved')).toBeInTheDocument();
    expect(within(r01).getByText('not automated yet')).toHaveAttribute('title', expect.stringContaining('DM-PAT-AUDIT-R01-T02'));
    const r02 = rowOf(patterns, 'DM-PAT-AUDIT-R02');
    expect(r02).toHaveTextContent('setting retention');
  });

  it('LA-TRC-T102 A rule the domain marks Not applicable shows so, with the use case and its reason', async () => {
    await openApp('/DM-PAY', { data: twoDomains() });
    await screen.findByRole('heading', { level: 1, name: 'Paying' });
    const patterns = section(/^Patterns we follow/);
    fireEvent.click(within(patterns).getByRole('button', { name: 'Expand DM-PAY:DM-PAT-AUDIT' }));
    const r02 = rowOf(patterns, 'DM-PAT-AUDIT-R02');
    expect(within(r02).getByText('not applicable')).toBeInTheDocument();
    expect(r02).toHaveTextContent('DM-PAY-UC01: Payments keep no records');
    expect(within(r02).getByRole('link', { name: 'DM-PAY-UC01' })).toHaveAttribute('href', '/DM-PAY-UC01');

    await openApp('/DM-SHOP', { data: twoDomains() });
    await screen.findByRole('heading', { level: 1, name: 'Shopping' });
    const shop = section(/^Patterns we follow/);
    fireEvent.click(within(shop).getByRole('button', { name: 'Expand DM-SHOP:DM-PAT-AUDIT' }));
    expect(within(rowOf(shop, 'DM-PAT-AUDIT-R01')).getByText('proved')).toBeInTheDocument();
  });

  it('LA-TRC-T103 Coverage shows the pattern rule line, and its gaps name the rule', async () => {
    await openApp('/DM-SHOP', { data: twoDomains() });
    await screen.findByRole('heading', { level: 1, name: 'Shopping' });
    const coverage = section(/^Coverage/);
    const line = coverage.querySelector('[data-kind="pattern_rule"]') as HTMLElement;
    expect(line).toHaveTextContent('Pattern rules 2');
    expect(within(line).getByRole('img', { name: 'proved: 1 of 2' })).toBeInTheDocument();
    expect(within(coverage).getAllByRole('listitem').map((li) => li.textContent)).toContainEqual(expect.stringMatching(/DM-PAT-AUDIT-R02.*Pattern rule not proved/));
  });

  it('LA-TRC-T111 A pattern the domain itself follows is listed, followed by the whole domain, and every rule applies', async () => {
    const ws = twoDomains();
    // Paying follows the pattern itself, not through a use case.
    removeRows(ws, 'follows', (l) => l.source_id === 'DM-PAY-UC01');
    removeRows(ws, 'setting_value', (v) => v.follower_id === 'DM-PAY-UC01');
    addRows(ws, 'follows', { source_id: 'DM-PAY', target_id: 'DM-PAT-AUDIT' });
    const ix = indexOf(ws);
    expect(patternsFollowedBy(ix, 'DM-PAY').map((f) => [f.pattern.id, f.byDomain, f.useCases.length])).toEqual([['DM-PAT-AUDIT', true, 0]]);
    // A rule with a setting still applies: no use case of the domain can mark it not applicable.
    const ruleWithSetting = ix.workspace.records.find((r) => r.parent === 'DM-PAT-AUDIT' && textOf(r.row, 'setting'))!;
    expect(ruleStatus(ix, ruleWithSetting, 'DM-PAY', patternsFollowedBy(ix, 'DM-PAY')[0])).toMatchObject({ applies: true });
    await openApp('/DM-PAY', { data: ws });
    await screen.findByRole('heading', { level: 1, name: 'Paying' });
    expect(rowOf(section(/^Patterns we follow/), 'DM-PAT-AUDIT')).toHaveTextContent('followed by the whole domain');
  });

  it('LA-TRC-T104 A domain that follows no pattern says so', async () => {
    await openApp('/NF-NOTE', { data: twoDomains() });
    await screen.findByRole('heading', { level: 1, name: 'Notes' });
    expect(within(section(/^Patterns we follow/)).getByText('This domain follows no pattern.')).toBeInTheDocument();
  });
});

describe('pattern pages', () => {
  it('LA-TRC-T105 A pattern page shows its settings table, its rules, and each following domain with its use cases and settings', async () => {
    await openApp('/DM-PAT-AUDIT', { data: twoDomains() });
    await screen.findByRole('heading', { level: 1, name: 'Audited action' });
    const settings = within(section(/^Settings/)).getByRole('table');
    expect(within(settings).getAllByRole('row').map((r) => r.textContent)).toEqual([
      'SettingRules that depend on it',
      'retentionDM-PAT-AUDIT-R02',
      'whoDM-PAT-AUDIT-R03',
    ]);
    expect(within(section(/^Rules/)).getAllByRole('listitem').map((li) => li.textContent)).toEqual([
      'DM-PAT-AUDIT-R01Each change is recorded',
      'DM-PAT-AUDIT-R02Records are kept setting retention',
      'DM-PAT-AUDIT-R03The clerk is named applies when who is clerk',
    ]);
    // No separate Children list repeats the rules.
    expect(within(screen.getByRole('region', { name: 'Wiki pane' })).queryByRole('heading', { name: /^Children/ })).toBeNull();
    const followed = section(/^Followed by/);
    expect(within(followed).getByRole('heading', { level: 2 }).textContent).toBe('Followed by2');
    const pay = within(followed).getByRole('region', { name: 'Followed in DM-PAY' });
    const useCases = within(pay).getAllByRole('table')[0];
    expect(within(useCases).getAllByRole('row').map((r) => r.textContent)).toEqual([
      'Use caseretentionwho',
      'DM-PAY-UC01Pay by cardNot applicable: Payments keep no recordsShopper',
    ]);
    expect(within(pay).getByText('Not applicable: Payments keep no records')).toHaveClass('setting-na');
  });

  it('LA-TRC-T106 A pattern page shows each following domain\'s proof status per rule', async () => {
    await openApp('/DM-PAT-AUDIT', { data: twoDomains() });
    await screen.findByRole('heading', { level: 1, name: 'Audited action' });
    const followed = section(/^Followed by/);
    const statusOf = (domain: string, rule: string) => {
      const tables = within(within(followed).getByRole('region', { name: `Followed in ${domain}` })).getAllByRole('table');
      return within(tables[tables.length - 1]).getByRole('link', { name: new RegExp(`^${rule}`) }).closest('tr') as HTMLElement;
    };
    expect(statusOf('DM-SHOP', 'DM-PAT-AUDIT-R01')).toHaveTextContent('proved');
    expect(statusOf('DM-SHOP', 'DM-PAT-AUDIT-R01')).not.toHaveTextContent('not proved');
    expect(statusOf('DM-PAY', 'DM-PAT-AUDIT-R01')).toHaveTextContent(/not proved\s*not automated yet/);
    expect(statusOf('DM-PAY', 'DM-PAT-AUDIT-R02')).toHaveTextContent('not applicable');
    expect(statusOf('DM-PAY', 'DM-PAT-AUDIT-R03')).toHaveTextContent('Waived here: who is Shopper');
  });

  it('LA-TRC-T107 A pattern rule page lists the domains that owe it, and a pattern nobody follows says so', async () => {
    await openApp('/DM-PAT-AUDIT-R02', { data: twoDomains() });
    await screen.findByRole('heading', { level: 1, name: 'Records are kept' });
    const owed = section(/^Owed by/);
    expect(within(owed).getAllByRole('row').slice(1).map((r) => r.querySelector('th')!.textContent)).toEqual(['DM-PAYPaying', 'DM-SHOPShopping']);

    const ws = twoDomains();
    removeRows(ws, 'setting_value', () => true);
    removeRows(ws, 'follows', () => true);
    removeRows(ws, 'pattern_rule_test', () => true);
    await openApp('/DM-PAT-AUDIT', { data: ws });
    await screen.findByRole('heading', { level: 1, name: 'Audited action' });
    expect(within(section(/^Followed by/)).getByText(/No use case follows this pattern/)).toBeInTheDocument();
  });
});
