import type { SpecData } from '../../../lathe/src/server/contract';
import { fixture } from './load';
import { workspace } from './workspace';

// Flow steps for the app tests (data/flow-steps/): the component-test workspace with three steps under
// DM-SHOP-F01, written out of order (positions 10, 1 and 2).

export function stepsWorkspace(): SpecData {
  const base = workspace();
  return fixture('flow-steps', {
    problems: [...base.problems, { severity: 'warning', check: 'flow-step-fulfills-outside-flow', record: 'DM-SHOP-F01-S03', message: 'Flow step DM-SHOP-F01-S03 fulfills DM-SHOP-DR01, which its flow DM-SHOP-F01 does not carry out.' }],
    coverage: base.coverage,
  });
}
