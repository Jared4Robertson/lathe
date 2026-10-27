import type { Coverage, ObligationCoverage } from '../../../lathe/src/types';
import type { SpecData } from '../../../lathe/src/server/contract';
import { fixture } from './load';
import { obligation, workspace } from './workspace';

// The component-test workspace with every obligation kind counted (data/obligations/). DM-SHOP adds:
// - interaction requirements at its view and endpoint (one fulfilling nothing yet),
// - a product's own obligation kind, `security_control`, declared by DM, at the endpoint,
// - a manual test and a planned test.

const coverage: Record<string, ObligationCoverage[]> = {
  'DM-SHOP': [
    obligation('domain_rule', 'Domain rule', 1, 1, 1, 1, 0),
    obligation('requirement', 'UC requirement', 2, 2, 1, 1, 0),
    obligation('interaction_requirement', 'Interaction requirement', 3, 1, 1, 0, 1),
    obligation('security_control', 'Security control', 1, 0, 0, 0, 0),
  ],
  'DM-PAY': [
    obligation('domain_rule', 'Domain rule', 0, 0, 0, 0, 0),
    obligation('requirement', 'UC requirement', 1, 0, 0, 0, 0),
    obligation('interaction_requirement', 'Interaction requirement', 0, 0, 0, 0, 0),
    obligation('security_control', 'Security control', 0, 0, 0, 0, 0),
  ],
};

export function obligationWorkspace(): SpecData {
  const base = workspace();
  return fixture('obligations', {
    problems: base.problems,
    coverage: base.coverage.map((c): Coverage => ({
      ...c,
      obligations: coverage[c.domain] ?? [],
      gaps: c.domain === 'DM-SHOP' ? [
        { id: 'DM-SHOP-UC01-R02', kind: 'requirement', missing: 'proves' },
        { id: 'DM-SHOP-V01-R01', kind: 'interaction_requirement', missing: 'satisfies' },
        { id: 'DM-SHOP-V01-R01', kind: 'interaction_requirement', missing: 'proves' },
        { id: 'DM-SHOP-E01-R01', kind: 'interaction_requirement', missing: 'proves' },
        { id: 'DM-SHOP-E01-R02', kind: 'interaction_requirement', missing: 'satisfies' },
        { id: 'DM-SHOP-E01-R02', kind: 'interaction_requirement', missing: 'proves' },
        { id: 'DM-SHOP-E01-S01', kind: 'security_control', missing: 'satisfies' },
        { id: 'DM-SHOP-E01-S01', kind: 'security_control', missing: 'proves' },
      ] : c.gaps,
    })),
  });
}
