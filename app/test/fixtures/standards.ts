import type { SpecData } from '../../../lathe/src/server/contract';
import { fixture } from './load';
import { patternWorkspace } from './patterns';

// The pattern workspace with a standard beside the pattern (data/standards/): DM-STD-CODE in Shared
// with two rules. R01 is met by the component DM-SHOP-C01 and the test DM-SHOP-T01; R02 is met by
// nothing, so it has the standard-rule-unmet warning.

export function standardWorkspace(): SpecData {
  const base = patternWorkspace();
  return fixture('standards', {
    problems: [...base.problems, { severity: 'warning', check: 'standard-rule-unmet', record: 'DM-STD-CODE-R02', message: 'Nothing meets or cites standard rule DM-STD-CODE-R02 (Amounts are in cents).' }],
    coverage: base.coverage,
  });
}
