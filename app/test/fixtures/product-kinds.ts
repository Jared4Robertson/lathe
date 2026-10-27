import type { Coverage } from '../../../lathe/src/types';
import type { SpecData } from '../../../lathe/src/server/contract';
import { fixture } from './load';
import { obligation, workspace } from './workspace';

// The component-test workspace with a product's own kind (data/product-kinds/): DM declares
// `security_control`, an obligation in the interaction design stage that sits under an endpoint, with
// a required `statement`; DM-SHOP-EP01-SC01 is one, not designed or proved yet.

export function productKindWorkspace(): SpecData {
  const base = workspace();
  return fixture('product-kinds', {
    problems: base.problems,
    coverage: base.coverage.map((c): Coverage => (c.domain === 'DM-SHOP'
      ? {
        ...c,
        obligations: [...c.obligations, obligation('security_control', 'Security control', 1, 0, 0, 0)],
        gaps: [
          ...c.gaps,
          { id: 'DM-SHOP-EP01-SC01', kind: 'security_control', missing: 'satisfies' },
          { id: 'DM-SHOP-EP01-SC01', kind: 'security_control', missing: 'proves' },
        ],
      }
      : c)),
  });
}
