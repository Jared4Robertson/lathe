import type { Coverage, TestCounts } from '../../../lathe/src/types';
import type { SpecData } from '../../../lathe/src/server/contract';
import { fixture } from './load';
import { obligationWorkspace } from './obligations';

// The obligation workspace with proof still owed and tests by state (data/owed-proof/). In DM-SHOP the
// domain rule is proved by a manual test and a planned test is meant to prove it as well, so one more
// is planned beside proof.

const plannedAny: Record<string, Record<string, number>> = {
  'DM-SHOP': { domain_rule: 1, requirement: 0, interaction_requirement: 1, security_control: 0 },
  'DM-PAY': { domain_rule: 0, requirement: 0, interaction_requirement: 0, security_control: 0 },
};

const tests: Record<string, TestCounts> = {
  'DM-SHOP': { automated: 1, manual: 1, planned: 1 },
  'DM-PAY': { automated: 2, manual: 0, planned: 0 },
  'NF-NOTE': { automated: 0, manual: 0, planned: 0 },
};

/** The obligation workspace with planned_any above planned where proof is still owed, and tests by state. */
export function owedWorkspace(): SpecData {
  const base = obligationWorkspace();
  return fixture('owed-proof', {
    problems: base.problems,
    coverage: base.coverage.map((c): Coverage => ({
      ...c,
      obligations: c.obligations.map((o) => ({ ...o, planned_any: plannedAny[c.domain]?.[o.kind] ?? o.planned })),
      tests: { ...(tests[c.domain] ?? { automated: 0, manual: 0, planned: 0 }) },
    })),
  });
}
