import type { ServedData } from './read-view';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { answerQuery } from '../../lathe/src/platform/commands/run';
import { LIST_FOLLOWERS } from '../../lathe/src/traceability/pattern-following/queries';
import type { PatternFollowers } from '../../lathe/src/traceability/pattern-following/read-model';
import { GET_RECORD_TRACE } from '../../lathe/src/traceability/record-trace/queries';
import type { RecordTrace } from '../../lathe/src/traceability/record-trace/read-model';
import { patternsFollowedBy, ruleStatus, rulesOf } from '../src/specs/patterns';
import { readViewOf } from './read-view';
import { expectOwedRulesAsEngine, servedByEngine } from './fixtures/engine';
import { patternWorkspace, withOwedRules } from './fixtures/patterns';
import { main, openApp, section } from './helpers';
import { addRows, removeRows } from './fixtures/load';
import { recordIndexOf } from './read-view';

// Patterns in the app: the domain page's "Patterns we follow", a pattern's page and a pattern
// rule's page, from a workspace where two domains follow one pattern: DM-SHOP itself and through
// DM-SHOP-UC01 (R01 proved there by a pattern rule test), and DM-PAY through DM-PAY-UC01, which gives `retention` 30
// days and `who` Shopper (R01 there has only a test not automated yet). Every rule of a followed pattern is owed.

function twoDomains(): ServedData {
  const ws = patternWorkspace();
  addRows(ws, 'follows', { source_id: 'DM-PAY-UC01', target_id: 'DM-PAT-AUDIT' });
  addRows(ws, 'setting_value',
    { follower_id: 'DM-PAY-UC01', pattern_id: 'DM-PAT-AUDIT', setting: 'retention', value: '30 days' },
    { follower_id: 'DM-PAY-UC01', pattern_id: 'DM-PAT-AUDIT', setting: 'who', value: 'Shopper' },
  );
  addRows(ws, 'pattern_rule_test', {
    id: 'DM-PAT-AUDIT-R01-T02', title: 'A payment is recorded', pattern_rule_id: 'DM-PAT-AUDIT-R01', domain_id: 'DM-PAY', level: 'service', state: 'not automated yet',
    when: 'A shopper pays for the basket by card.', then: 'The payment is in the audit record.' });
  return withOwedRules(ws, 'DM-PAY', ['R01', 'R02', 'R03']);
}

/** Paying follows the pattern itself, not through a use case. */
function payItself(): ServedData {
  const ws = twoDomains();
  removeRows(ws, 'follows', (l) => l.source_id === 'DM-PAY-UC01');
  removeRows(ws, 'setting_value', (v) => v.follower_id === 'DM-PAY-UC01');
  addRows(ws, 'follows', { source_id: 'DM-PAY', target_id: 'DM-PAT-AUDIT' });
  return withOwedRules(ws, 'DM-PAY', ['R01', 'R02', 'R03']);
}

const index = () => recordIndexOf(twoDomains());

/** A rule's standing in a domain, from its trace, as the rule's mark reads it, over the data. */
function standingOf(data: ServedData, rule: string, domain: string) {
  return ruleStatus(answerQuery(readViewOf(data), GET_RECORD_TRACE, { id: rule }) as RecordTrace, domain);
}
const rowOf = (scope: HTMLElement, id: string) => within(scope).getByRole('link', { name: new RegExp(`^${id}(?!-)`) }).closest('.record-row') as HTMLElement;

/** A row's text without its actions' toolbar: the follower and the values it gives. */
const rowText = (row: HTMLElement) => [...row.childNodes].map((c) => { const copy = c.cloneNode(true) as HTMLElement; copy.querySelectorAll?.('[role="toolbar"]').forEach((t) => t.remove()); return copy.textContent; }).join('');

describe('pattern logic', () => {
  it('LA-V91-R54-T01 A domain follows the patterns it or its use cases follow, and a pattern lists its following domains', async () => {
    // The hand-written owed rules of these workspaces are the engine's.
    for (const ws of [patternWorkspace(), twoDomains(), payItself()]) await expectOwedRulesAsEngine(ws);
    const ix = index();
    expect(patternsFollowedBy(ix, 'DM-SHOP').map((f) => [f.pattern.id, f.byDomain, f.useCases.map((u) => u.id)])).toEqual([['DM-PAT-AUDIT', true, ['DM-SHOP-UC01']]]);
    expect(patternsFollowedBy(ix, 'NF-NOTE')).toEqual([]);
    const followers = answerQuery(readViewOf(twoDomains()), LIST_FOLLOWERS, { pattern_id: 'DM-PAT-AUDIT' }) as PatternFollowers;
    expect(followers.domains.map((d) => d.domain)).toEqual(['DM-PAY', 'DM-SHOP']);
    // A follower's settings: the value it gives each.
    const settingsOf = (domain: string, follower: string) => {
      const d = followers.domains.find((x) => x.domain === domain)!;
      return [...(d.itself ? [d.itself] : []), ...d.useCases].find((f) => f.follower === follower)!.settings;
    };
    expect(settingsOf('DM-SHOP', 'DM-SHOP').find((v) => v.setting === 'retention')).toEqual({ setting: 'retention', value: '1 year' });
    expect(settingsOf('DM-PAY', 'DM-PAY-UC01').find((v) => v.setting === 'retention')).toEqual({ setting: 'retention', value: '30 days' });
    expect(settingsOf('DM-PAY', 'DM-PAY-UC01').find((v) => v.setting === 'who')).toEqual({ setting: 'who', value: 'Shopper' });
  });

  it('LA-V91-R54-T02 A rule is proved per domain, by its pattern rule tests that name that domain', () => {
    expect(standingOf(twoDomains(), 'DM-PAT-AUDIT-R01', 'DM-SHOP')).toEqual({ provedBy: ['DM-PAT-AUDIT-R01-T01'], notAutomatedBy: [] });
    // In DM-PAY only a test not automated yet is meant to prove it.
    expect(standingOf(twoDomains(), 'DM-PAT-AUDIT-R01', 'DM-PAY')).toEqual({ provedBy: [], notAutomatedBy: ['DM-PAT-AUDIT-R01-T02'] });
  });
});

describe('Patterns we follow, on the domain page', () => {
  it('LA-V91-R54-T03 The domain page lists each pattern it follows, its rules folded under it, with what proves each in the domain', async () => {
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
    expect(await within(r01).findByText('not proved')).toBeInTheDocument();
    expect(within(r01).getByText('not automated yet')).toHaveAttribute('title', expect.stringContaining('DM-PAT-AUDIT-R01-T02'));
    expect(await within(rowOf(patterns, 'DM-PAT-AUDIT-R02')).findByText('not proved')).toBeInTheDocument();
  });

  it('LA-V91-R51-T02 Coverage shows the pattern rule line, and its gaps name the rule', async () => {
    await openApp('/DM-SHOP', { data: twoDomains() });
    await screen.findByRole('heading', { level: 1, name: 'Shopping' });
    const coverage = section(/^Coverage/);
    const line = coverage.querySelector('[data-kind="pattern_rule"]') as HTMLElement;
    expect(line).toHaveTextContent('Pattern rules 2');
    expect(within(line).getByRole('img', { name: 'proved: 1 of 2' })).toBeInTheDocument();
    expect(within(coverage).getAllByRole('listitem').map((li) => li.textContent)).toContainEqual(expect.stringMatching(/DM-PAT-AUDIT-R02.*Pattern rule not proved/));
  });

  it('LA-V91-R54-T05 A pattern the domain itself follows is listed, followed by the whole domain, and every rule applies', async () => {
    const ws = payItself();
    const ix = recordIndexOf(ws);
    expect(patternsFollowedBy(ix, 'DM-PAY').map((f) => [f.pattern.id, f.byDomain, f.useCases.length])).toEqual([['DM-PAT-AUDIT', true, 0]]);
    expect(standingOf(ws, 'DM-PAT-AUDIT-R02', 'DM-PAY')).toEqual({ provedBy: [], notAutomatedBy: [] });
    await openApp('/DM-PAY', { data: ws });
    await screen.findByRole('heading', { level: 1, name: 'Paying' });
    expect(rowOf(section(/^Patterns we follow/), 'DM-PAT-AUDIT')).toHaveTextContent('followed by the whole domain');
  });

  it('LA-V91-R54-T06 A rule whose pattern rule test names a file that does not exist is not proved, as coverage says', async () => {
    // The patterns workspace through the real engine, in a product folder with no code files: DM-PAT-AUDIT-R01-T01 is
    // automated and run by test/audit.test.ts, which does not exist there, so it proves nothing.
    const rule = async (data: ServedData) => {
      await openApp('/DM-SHOP', { data });
      await screen.findByRole('heading', { level: 1, name: 'Shopping' });
      const patterns = section(/^Patterns we follow/);
      // The tree keeps the pattern open from the first look.
      const expand = within(patterns).queryByRole('button', { name: 'Expand DM-SHOP:DM-PAT-AUDIT' });
      if (expand) fireEvent.click(expand);
      return within(rowOf(patterns, 'DM-PAT-AUDIT-R01')).findByText(/proved$/);
    };
    const missing = await servedByEngine(patternWorkspace());
    const shop = missing.coverage.find((c) => c.domain === 'DM-SHOP')!;
    expect(shop.proved_by['DM-PAT-AUDIT-R01']).toBeUndefined();
    expect(shop.gaps).toContainEqual(expect.objectContaining({ id: 'DM-PAT-AUDIT-R01', missing: 'proved' }));
    expect(await rule(missing)).toHaveTextContent('not proved');
    expect(within(section(/^Coverage/).querySelector('[data-kind="pattern_rule"]') as HTMLElement).getByRole('img', { name: /^proved: 0 of / })).toBeInTheDocument();

    // Once the file exists and names the test, coverage and the list both say proved.
    const backed = await servedByEngine(patternWorkspace(), { 'test/audit.test.ts': "it('DM-PAT-AUDIT-R01-T01 Adding an item is recorded', () => {});\n" });
    expect(backed.coverage.find((c) => c.domain === 'DM-SHOP')!.proved_by['DM-PAT-AUDIT-R01']).toEqual(['DM-PAT-AUDIT-R01-T01']);
    expect(await rule(backed)).toHaveTextContent(/^proved$/);
  });

  it('LA-V91-R54-T07 Every rule of a pattern a domain follows is owed there, as the engine says, on every page that shows it', async () => {
    // Each workspace through the real engine: a domain following through a use case, and one following the pattern itself.
    for (const ws of [twoDomains(), payItself()]) {
      const data = await servedByEngine(ws);
      const ix = recordIndexOf(data);
      for (const followed of ['DM-PAY', 'DM-SHOP'].flatMap((domain) => patternsFollowedBy(ix, domain).filter((f) => f.pattern.id === 'DM-PAT-AUDIT').map((f) => ({ ...f, domain })))) {
        const owed = data.coverage.find((c) => c.domain === followed.domain)!.pattern_rules;
        await openApp(`/${followed.domain}`, { data });
        await screen.findByRole('heading', { level: 1, name: ix.byId.get(followed.domain)!.title });
        const patterns = section(/^Patterns we follow/);
        const expand = within(patterns).queryByRole('button', { name: `Expand ${followed.domain}:DM-PAT-AUDIT` });
        if (expand) fireEvent.click(expand);
        for (const rule of rulesOf(ix, 'DM-PAT-AUDIT')) {
          expect(owed, `${rule.id} in ${followed.domain}`).toContain(rule.id);
          expect((await within(rowOf(patterns, rule.id)).findAllByText(/proved$/)).length).toBeGreaterThan(0);
        }
      }
    }
  });

  it('LA-V91-R54-T04 A domain that follows no pattern says so', async () => {
    await openApp('/NF-NOTE', { data: twoDomains() });
    await screen.findByRole('heading', { level: 1, name: 'Notes' });
    expect(within(section(/^Patterns we follow/)).getByText('This domain follows no pattern.')).toBeInTheDocument();
  });
});

describe('pattern pages (the Pattern page, LA-V122)', () => {
  it('LA-V122-R04-T01 A pattern page shows its settings table, its rules, and each following domain with its use cases and settings', async () => {
    await openApp('/DM-PAT-AUDIT', { data: twoDomains() });
    await screen.findByRole('heading', { level: 1, name: 'Audited action' });
    await within(main()).findByRole('heading', { name: /^(Followed|Owed) by\d/ });
    const settings = within(section(/^Settings/)).getByRole('table');
    expect(within(settings).getAllByRole('row').map((r) => r.textContent)).toEqual([
      'SettingMeaning',
      'retentionHow long records are kept.',
      'whoWho is recorded.',
    ]);
    expect(within(section(/^Rules/)).getAllByRole('listitem').map((li) => li.textContent)).toEqual([
      'DM-PAT-AUDIT-R01Each change is recorded',
      'DM-PAT-AUDIT-R02Records are kept',
      'DM-PAT-AUDIT-R03The clerk is named',
    ]);
    // No separate Children list repeats the rules.
    expect(within(screen.getByRole('region', { name: 'Wiki card' })).queryByRole('heading', { name: /^Children/ })).toBeNull();
    const followed = section(/^Followed by/);
    expect(within(followed).getByRole('heading', { level: 2 }).textContent).toBe('Followed by2');
    const pay = within(followed).getByRole('region', { name: 'Followed in DM-PAY' });
    const useCases = within(pay).getAllByRole('table')[0];
    expect(within(useCases).getAllByRole('row').map(rowText)).toEqual([
      'Use caseretentionwho',
      'DM-PAY-UC01Pay by card30 daysShopper',
    ]);
  });

  it('LA-V122-R04-T02 A pattern page shows each following domain\'s proof status per rule', async () => {
    await openApp('/DM-PAT-AUDIT', { data: twoDomains() });
    await screen.findByRole('heading', { level: 1, name: 'Audited action' });
    await within(main()).findByRole('heading', { name: /^(Followed|Owed) by\d/ });
    const followed = section(/^Followed by/);
    const statusOf = (domain: string, rule: string) => {
      const tables = within(within(followed).getByRole('region', { name: `Followed in ${domain}` })).getAllByRole('table');
      return within(tables[tables.length - 1]).getByRole('link', { name: new RegExp(`^${rule}`) }).closest('tr') as HTMLElement;
    };
    await waitFor(() => expect(statusOf('DM-PAY', 'DM-PAT-AUDIT-R03')).toHaveTextContent('not proved'));
    expect(statusOf('DM-SHOP', 'DM-PAT-AUDIT-R01')).toHaveTextContent('proved');
    expect(statusOf('DM-SHOP', 'DM-PAT-AUDIT-R01')).not.toHaveTextContent('not proved');
    expect(statusOf('DM-PAY', 'DM-PAT-AUDIT-R01')).toHaveTextContent(/not proved\s*not automated yet/);
    expect(statusOf('DM-PAY', 'DM-PAT-AUDIT-R02')).toHaveTextContent('not proved');
  });

  it('LA-V122-R05-T01 A pattern rule page lists the domains that owe it, and a pattern nobody follows says so', async () => {
    await openApp('/DM-PAT-AUDIT-R02', { data: twoDomains() });
    await screen.findByRole('heading', { level: 1, name: 'Records are kept' });
    await within(main()).findByRole('heading', { name: /^(Followed|Owed) by\d/ });
    const owed = section(/^Owed by/);
    expect(within(owed).getAllByRole('row').slice(1).map((r) => r.querySelector('th')!.textContent)).toEqual(['DM-PAYPaying', 'DM-SHOPShopping']);

    const ws = twoDomains();
    removeRows(ws, 'setting_value', () => true);
    removeRows(ws, 'follows', () => true);
    removeRows(ws, 'pattern_rule_test', () => true);
    await openApp('/DM-PAT-AUDIT', { data: ws });
    await screen.findByRole('heading', { level: 1, name: 'Audited action' });
    expect(await within(section(/^Followed by/)).findByText(/No use case follows this pattern/)).toBeInTheDocument();
  });
});
