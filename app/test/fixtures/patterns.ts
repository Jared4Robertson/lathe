import type { SpecData } from '../../../lathe/src/server/contract';
import { fixture } from './load';
import { gap, obligation, workspace } from './workspace';

// The component-test workspace with a pattern (data/patterns/): DM-PAT-AUDIT, with the settings
// retention and who and three rules, followed by DM-SHOP and its use case DM-SHOP-UC01.
// - R01 holds everywhere and has a pattern rule test in DM-SHOP.
// - R02 names `retention`, which DM-SHOP sets to 1 year.
// - R03 applies when `who` is clerk; DM-SHOP marks `who` not applicable, so R03 does not apply there.

export function patternWorkspace(): SpecData {
  const base = workspace();
  const coverage = base.coverage.map((c) => (c.domain === 'DM-SHOP'
    ? {
      ...c,
      obligations: [...c.obligations, obligation('pattern_rule', 'Pattern rule', 2, 2, 2, 1, 0, true)],
      proved_by: { ...c.proved_by, 'DM-PAT-AUDIT-R01': ['DM-PAT-AUDIT-R01-T01'] },
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
