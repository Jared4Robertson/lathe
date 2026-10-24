import type { Coverage, TestCounts, Workspace } from '../../../lathe/src/types';
import { obligationWorkspace } from './obligations';

// The obligation workspace as the pass-6 engine reports it: each obligation kind has planned_any, and
// each domain counts its tests by state. In DM-SHOP the domain rule is proved by a manual test and a
// planned test is meant to prove it as well, so one more is planned beside proof.

const plannedAny: Record<string, Record<string, number>> = {
  'DM-SHOP': { domain_rule: 1, requirement: 0, interaction_requirement: 1, security_control: 0 },
  'DM-PAY': { domain_rule: 0, requirement: 0, interaction_requirement: 0, security_control: 0 },
};

const tests: Record<string, TestCounts> = {
  'DM-SHOP': { automated: 1, manual: 1, planned: 1 },
  'DM-PAY': { automated: 2, manual: 0, planned: 0 },
  'NF-NOTE': { automated: 0, manual: 0, planned: 0 },
};

/** Every domain reports planned_any and tests; pass domains to leave their tests out, as an older engine does. */
export function owedWorkspace({ withoutTests = [] as string[] } = {}): Workspace {
  const ws = obligationWorkspace();
  ws.coverage = ws.coverage.map((c): Coverage => {
    const next: Coverage = {
      ...c,
      obligations: c.obligations.map((o) => ({ ...o, planned_any: plannedAny[c.domain]?.[o.kind] ?? o.planned })),
      tests: { ...(tests[c.domain] ?? { automated: 0, manual: 0, planned: 0 }) },
    };
    if (withoutTests.includes(c.domain)) delete (next as Partial<Coverage>).tests;
    return next;
  });
  return ws;
}
