import type { ServedData } from '../read-view';
import type { Coverage, CoverageGap, ObligationCoverage } from '../../../lathe/src/types';
import { fixture } from './load';

// A small workspace for the component tests (data/workspace/). Two products:
// - DM (Demo shop): a value object and a view both domains use, so DM shares them; DM-SHOP with an
//   aggregate, its entities, invariant, event and command, a specification, a read model and query, a
//   use case with its flow, an endpoint, a handler, a table and two tests; DM-PAY with a use case, its
//   flow's one step in the view, and an event with a field typed by the value object; questions; problems.
// - NF (Notebook): one domain.

/** One obligation kind's coverage line. */
export const obligation = (kind: string, label: string, total: number, designed: number, built: number, proved: number, notAutomated = 0, proofOnly = false): ObligationCoverage =>
  ({ kind, label, total, designed, built, proved, not_automated: notAutomated, proof_only: proofOnly });

/** One coverage gap, with the engine's message. */
export const gap = (id: string, kind: string, missing: string): CoverageGap =>
  ({ id, kind, missing, message: `${id} is not ${missing} yet.` });

const shopCoverage = (): Coverage => ({
  product: 'DM',
  domain: 'DM-SHOP',
  obligations: [
    obligation('invariant', 'Invariant', 1, 1, 0, 0, 1),
    obligation('uc_requirement', 'UC requirement', 2, 2, 1, 1),
  ],
  tests: { automated: 1, manual: 0, not_automated: 1 },
  proved_by: { 'DM-SHOP-UC01-R01': ['DM-SHOP-UC01-R01-T01'] },
  pattern_rules: {},
  gaps: [
    gap('DM-SHOP-INV01', 'invariant', 'built'),
    gap('DM-SHOP-INV01', 'invariant', 'proved'),
    gap('DM-SHOP-UC01-R02', 'uc_requirement', 'built'),
    gap('DM-SHOP-UC01-R02', 'uc_requirement', 'proved'),
  ],
});

const payCoverage = (): Coverage => ({
  product: 'DM',
  domain: 'DM-PAY',
  obligations: [
    obligation('invariant', 'Invariant', 0, 0, 0, 0),
    obligation('uc_requirement', 'UC requirement', 1, 0, 0, 0),
  ],
  tests: { automated: 0, manual: 0, not_automated: 0 },
  proved_by: {},
  pattern_rules: {},
  gaps: [
    gap('DM-PAY-UC01-R01', 'uc_requirement', 'designed'),
    gap('DM-PAY-UC01-R01', 'uc_requirement', 'proved'),
  ],
});

/** What DM shares: its value object's constraint and its view's requirement. */
const dmCoverage = (): Coverage => ({
  product: 'DM',
  domain: null,
  obligations: [
    obligation('constraint', 'Constraint', 1, 0, 0, 0),
    obligation('view_requirement', 'View requirement', 1, 0, 0, 0),
  ],
  tests: { automated: 0, manual: 0, not_automated: 0 },
  proved_by: {},
  pattern_rules: {},
  gaps: [
    gap('DM-VO01-C01', 'constraint', 'designed'),
    gap('DM-VO01-C01', 'constraint', 'proved'),
    gap('DM-V01-R01', 'view_requirement', 'designed'),
    gap('DM-V01-R01', 'view_requirement', 'proved'),
  ],
});

const noteCoverage = (): Coverage => ({
  product: 'NF',
  domain: 'NF-NOTE',
  obligations: [
    obligation('invariant', 'Invariant', 0, 0, 0, 0),
    obligation('uc_requirement', 'UC requirement', 0, 0, 0, 0),
  ],
  tests: { automated: 0, manual: 0, not_automated: 0 },
  proved_by: {},
  pattern_rules: {},
  gaps: [],
});

export function workspace(): ServedData {
  return fixture('workspace', {
    problems: [
      { severity: 'warning', check: 'not-proved', record: 'DM-SHOP-INV01', message: 'No test proves invariant DM-SHOP-INV01.' },
      { severity: 'warning', check: 'not-proved', record: 'DM-SHOP-UC01-R02', message: 'No test proves UC requirement DM-SHOP-UC01-R02.' },
      { severity: 'error', check: 'test-file-missing', record: 'DM-SHOP-UC01-R01-T01', message: 'Test DM-SHOP-UC01-R01-T01 is run by test/basket.test.ts, which does not exist.' },
      { severity: 'warning', check: 'not-designed', record: 'DM-PAY-UC01-R01', message: 'No step fulfills UC requirement DM-PAY-UC01-R01.' },
      { severity: 'error', check: 'lone-domain', record: 'NF-NOTE', message: 'NF-NOTE has no use cases yet.' },
      { severity: 'error', check: 'engine', record: null, message: 'The checks could not read a file.' },
    ],
    coverage: [shopCoverage(), payCoverage(), dmCoverage(), noteCoverage()],
  });
}
