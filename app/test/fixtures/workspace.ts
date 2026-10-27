import type { Coverage, ObligationCoverage } from '../../../lathe/src/types';
import type { SpecData } from '../../../lathe/src/server/contract';
import { fixture } from './load';

// A small workspace for the component tests (data/workspace/). Two products:
// - DM (Demo shop): two domains, questions and problems.
// - NF (Notebook): one domain.

/** One obligation kind's coverage line; planned_any is planned unless given. */
export const obligation = (kind: string, label: string, total: number, designed: number, built: number, proved: number, planned = 0, plannedAny = planned): ObligationCoverage =>
  ({ kind, label, total, designed, built, proved, planned, planned_any: plannedAny });

const shopCoverage = (): Coverage => ({
  domain: 'DM-SHOP',
  obligations: [
    obligation('domain_rule', 'Domain rule', 1, 1, 1, 0),
    obligation('requirement', 'UC requirement', 2, 2, 1, 1),
  ],
  tests: { automated: 1, manual: 0, planned: 0 },
  gaps: [
    { id: 'DM-SHOP-UC01-R02', kind: 'requirement', missing: 'proves' },
    { id: 'DM-SHOP-DR01', kind: 'domain_rule', missing: 'proves' },
  ],
});

const payCoverage = (): Coverage => ({
  domain: 'DM-PAY',
  obligations: [
    obligation('domain_rule', 'Domain rule', 0, 0, 0, 0),
    obligation('requirement', 'UC requirement', 1, 0, 0, 0),
  ],
  tests: { automated: 0, manual: 0, planned: 0 },
  gaps: [
    { id: 'DM-PAY-UC01-R01', kind: 'requirement', missing: 'satisfies' },
    { id: 'DM-PAY-UC01-R01', kind: 'requirement', missing: 'proves' },
  ],
});

const noteCoverage = (): Coverage => ({
  domain: 'NF-NOTE',
  obligations: [
    obligation('domain_rule', 'Domain rule', 0, 0, 0, 0),
    obligation('requirement', 'UC requirement', 0, 0, 0, 0),
  ],
  tests: { automated: 0, manual: 0, planned: 0 },
  gaps: [],
});

export function workspace(): SpecData {
  return fixture('workspace', {
    problems: [
      { severity: 'warning', check: 'unproved', record: 'DM-SHOP-DR01', message: 'No test proves domain rule DM-SHOP-DR01.' },
      { severity: 'warning', check: 'unproved', record: 'DM-SHOP-UC01-R02', message: 'No test proves requirement DM-SHOP-UC01-R02.' },
      { severity: 'error', check: 'test-file-missing', record: 'DM-SHOP-T01', message: 'Test DM-SHOP-T01 is run by test/basket.test.ts, which does not exist.' },
      { severity: 'warning', check: 'unsatisfied', record: 'DM-PAY-UC01-R01', message: 'No component satisfies requirement DM-PAY-UC01-R01.' },
      { severity: 'error', check: 'lone-domain', record: 'NF-NOTE', message: 'NF-NOTE has no use cases yet.' },
      { severity: 'error', check: 'engine', record: null, message: 'The checks could not read a file.' },
    ],
    coverage: [shopCoverage(), payCoverage(), noteCoverage()],
  });
}
