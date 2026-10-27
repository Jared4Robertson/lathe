import type { Coverage, ObligationCoverage } from '../../../lathe/src/types';
import type { SpecData } from '../../../lathe/src/server/contract';
import { fixture } from './load';

// A small workspace for the component tests (data/workspace/). Two products:
// - DM (Demo shop): a value object and a view at product level; DM-SHOP with an aggregate, its
//   entities, invariant, event and command, a specification, a read model and query, a use case with
//   its flow, an endpoint, a handler, a table and two tests; DM-PAY with a use case; questions; problems.
// - NF (Notebook): one domain.

/** One obligation kind's coverage line; planned_any is planned unless given. */
export const obligation = (kind: string, label: string, total: number, designed: number, built: number, proved: number, planned = 0, plannedAny = planned): ObligationCoverage =>
  ({ kind, label, total, designed, built, proved, planned, planned_any: plannedAny });

const shopCoverage = (): Coverage => ({
  domain: 'DM-SHOP',
  obligations: [
    obligation('invariant', 'Invariant', 1, 1, 0, 0, 1),
    obligation('uc_requirement', 'UC requirement', 2, 2, 1, 1),
  ],
  tests: { automated: 1, manual: 0, planned: 1 },
  gaps: [
    { id: 'DM-SHOP-UC01-R02', kind: 'uc_requirement', missing: 'proves' },
    { id: 'DM-SHOP-INV01', kind: 'invariant', missing: 'proves' },
  ],
});

const payCoverage = (): Coverage => ({
  domain: 'DM-PAY',
  obligations: [
    obligation('invariant', 'Invariant', 0, 0, 0, 0),
    obligation('uc_requirement', 'UC requirement', 1, 0, 0, 0),
  ],
  tests: { automated: 0, manual: 0, planned: 0 },
  gaps: [
    { id: 'DM-PAY-UC01-R01', kind: 'uc_requirement', missing: 'satisfies' },
    { id: 'DM-PAY-UC01-R01', kind: 'uc_requirement', missing: 'proves' },
  ],
});

const noteCoverage = (): Coverage => ({
  domain: 'NF-NOTE',
  obligations: [
    obligation('invariant', 'Invariant', 0, 0, 0, 0),
    obligation('uc_requirement', 'UC requirement', 0, 0, 0, 0),
  ],
  tests: { automated: 0, manual: 0, planned: 0 },
  gaps: [],
});

export function workspace(): SpecData {
  return fixture('workspace', {
    problems: [
      { severity: 'warning', check: 'unproved', record: 'DM-SHOP-INV01', message: 'No test proves invariant DM-SHOP-INV01.' },
      { severity: 'warning', check: 'unproved', record: 'DM-SHOP-UC01-R02', message: 'No test proves UC requirement DM-SHOP-UC01-R02.' },
      { severity: 'error', check: 'test-file-missing', record: 'DM-SHOP-UC01-R01-T01', message: 'Test DM-SHOP-UC01-R01-T01 is run by test/basket.test.ts, which does not exist.' },
      { severity: 'warning', check: 'undesigned', record: 'DM-PAY-UC01-R01', message: 'No step fulfills UC requirement DM-PAY-UC01-R01.' },
      { severity: 'error', check: 'lone-domain', record: 'NF-NOTE', message: 'NF-NOTE has no use cases yet.' },
      { severity: 'error', check: 'engine', record: null, message: 'The checks could not read a file.' },
    ],
    coverage: [shopCoverage(), payCoverage(), noteCoverage()],
  });
}
