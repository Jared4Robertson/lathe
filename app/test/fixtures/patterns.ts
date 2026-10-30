import type { ServedData } from '../read-view';
import type { PatternRuleStanding } from '../../../lathe/src/types';
import { fixture } from './load';
import { gap, obligation, workspace } from './workspace';

// The component-test workspace with a pattern (data/patterns/): DM-PAT-AUDIT, with the settings
// retention and who and three rules, followed by DM-SHOP and its use case DM-SHOP-UC01.
// - R01 holds everywhere and has a pattern rule test in DM-SHOP.
// - R02 names `retention`, which DM-SHOP sets to 1 year.
// - R03 applies when `who` is clerk; DM-SHOP marks `who` not applicable, so R03 is waived there.
// Its hand-written standings and those of each test's variant are held to the engine's (fixtures/engine.ts).

export function patternWorkspace(): ServedData {
  const base = workspace();
  const coverage = base.coverage.map((c) => (c.domain === 'DM-SHOP'
    ? {
      ...c,
      obligations: [...c.obligations, obligation('pattern_rule', 'Pattern rule', 2, 2, 2, 1, 0, true)],
      proved_by: { ...c.proved_by, 'DM-PAT-AUDIT-R01': ['DM-PAT-AUDIT-R01-T01'] },
      pattern_rules: { 'DM-PAT-AUDIT-R01': 'owed', 'DM-PAT-AUDIT-R02': 'owed', 'DM-PAT-AUDIT-R03': 'waived' } as Record<string, PatternRuleStanding>,
      gaps: [...c.gaps, gap('DM-PAT-AUDIT-R02', 'pattern_rule', 'proved')],
    }
    : c));
  return fixture('patterns', {
    problems: [
      ...base.problems,
      { severity: 'warning', check: 'not-proved', record: 'DM-PAT-AUDIT-R02', message: 'DM-PAT-AUDIT-R02 is not proved in DM-SHOP.' },
    ],
    coverage,
  });
}

/** Sets the standings of the pattern rules in a domain, as a test's variant of the workspace has them (rule IDs after DM-PAT-AUDIT-). */
export function withStandings(data: ServedData, domain: string, standings: Record<string, PatternRuleStanding>): ServedData {
  const coverage = data.coverage.find((c) => c.domain === domain);
  if (!coverage) throw new Error(`No coverage of ${domain}.`);
  coverage.pattern_rules = Object.fromEntries(Object.entries(standings).map(([rule, standing]) => [`DM-PAT-AUDIT-${rule}`, standing]));
  return data;
}
