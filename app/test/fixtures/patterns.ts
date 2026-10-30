import type { ServedData } from '../read-view';
import { fixture } from './load';
import { gap, obligation, workspace } from './workspace';

// The component-test workspace with a pattern (data/patterns/): DM-PAT-AUDIT, with the settings
// retention and who and three rules, followed by DM-SHOP and its use case DM-SHOP-UC01.
// - R01 holds everywhere and has a pattern rule test in DM-SHOP.
// - R02 and R03 are owed there too, unproved; DM-SHOP sets `retention` to 1 year.
// Every rule of a pattern a domain follows is owed there. Its hand-written owed rules and those of each test's variant
// are held to the engine's (fixtures/engine.ts).

export function patternWorkspace(): ServedData {
  const base = workspace();
  const coverage = base.coverage.map((c) => (c.domain === 'DM-SHOP'
    ? {
      ...c,
      obligations: [...c.obligations, obligation('pattern_rule', 'Pattern rule', 2, 2, 2, 1, 0, true)],
      proved_by: { ...c.proved_by, 'DM-PAT-AUDIT-R01': ['DM-PAT-AUDIT-R01-T01'] },
      pattern_rules: ['DM-PAT-AUDIT-R01', 'DM-PAT-AUDIT-R02', 'DM-PAT-AUDIT-R03'],
      gaps: [...c.gaps, gap('DM-PAT-AUDIT-R02', 'pattern_rule', 'proved')] }
    : c));
  return fixture('patterns', {
    problems: [
      ...base.problems,
      { severity: 'warning', check: 'not-proved', record: 'DM-PAT-AUDIT-R02', message: 'DM-PAT-AUDIT-R02 is not proved in DM-SHOP.' },
    ],
    coverage });
}

/** Sets the pattern rules a domain owes, as a test's variant of the workspace has them (rule IDs after DM-PAT-AUDIT-). */
export function withOwedRules(data: ServedData, domain: string, rules: string[]): ServedData {
  const coverage = data.coverage.find((c) => c.domain === domain);
  if (!coverage) throw new Error(`No coverage of ${domain}.`);
  coverage.pattern_rules = rules.map((rule) => `DM-PAT-AUDIT-${rule}`);
  return data;
}
