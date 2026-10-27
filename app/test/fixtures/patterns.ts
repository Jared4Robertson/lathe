import type { ObligationCoverage } from '../../../lathe/src/types';
import type { SpecData } from '../../../lathe/src/server/contract';
import { fixture } from './load';
import { obligation, workspace } from './workspace';

// The component-test workspace with a pattern (data/patterns/): DM-PAT-CHECKOUT, with two rules and
// the settings record and audit, followed by a use case in each of DM's domains, and records whose
// text names other records.
// - DM-SHOP follows it and marks `audit` not applicable, so R02 (which names `audit`) does not
//   apply there; R01 is designed, built and proved there.
// - DM-PAY follows it with a real `audit`, so it owes both rules: R01 is designed by a component
//   whose file is missing (so not built) and only a planned test proves it; R02 is open.
// - Text: DM-SHOP-UC01's goal names a domain rule, the pattern, an ID in code and an ID that is no
//   record; DM-PAY-UC01's names DM-SHOP-UC01 next to a requirement ID.

const patternRuleLine = (total: number, designed: number, built: number, proved: number, planned: number): ObligationCoverage =>
  obligation('pattern_rule', 'Pattern rule', total, designed, built, proved, planned);

export function patternWorkspace(): SpecData {
  const base = workspace();
  const coverage = base.coverage.map((c) => {
    if (c.domain === 'DM-SHOP') return { ...c, obligations: [...c.obligations, patternRuleLine(1, 1, 1, 1, 0)] };
    if (c.domain === 'DM-PAY') {
      return {
        ...c,
        obligations: [...c.obligations, patternRuleLine(2, 1, 0, 0, 1)],
        gaps: [
          ...c.gaps,
          { id: 'DM-PAT-CHECKOUT-R01', kind: 'pattern_rule', missing: 'proves' as const },
          { id: 'DM-PAT-CHECKOUT-R02', kind: 'pattern_rule', missing: 'proves' as const },
        ],
      };
    }
    return c;
  });
  return fixture('patterns', {
    problems: [
      ...base.problems,
      { severity: 'warning', check: 'component-file-missing', record: 'DM-PAY-C01', message: 'Component DM-PAY-C01 names src/pay.tsx, which does not exist.' },
      { severity: 'warning', check: 'unproved', record: 'DM-PAT-CHECKOUT-R01', message: 'DM-PAT-CHECKOUT-R01 is not proved in DM-PAY.' },
      { severity: 'warning', check: 'unsatisfied', record: 'DM-PAT-CHECKOUT-R02', message: 'DM-PAT-CHECKOUT-R02 is not satisfied in DM-PAY.' },
    ],
    coverage,
  });
}
