import type { ServedData } from '../read-view';
import type { Coverage } from '../../../lathe/src/types';
import { fixture } from './load';
import { gap, obligation, workspace } from './workspace';

// The component-test workspace with a product's own kind (data/product-kinds/): DM declares
// `security_control`, an obligation in the interaction design stage that sits under an endpoint, with
// a required `statement`; DM-SHOP-EP01-SC01 is one, not designed or proved yet.

export function productKindWorkspace(): ServedData {
  const base = workspace();
  return fixture('product-kinds', {
    problems: base.problems,
    coverage: base.coverage.map((c): Coverage => (c.domain === 'DM-SHOP'
      ? {
        ...c,
        obligations: [...c.obligations, obligation('security_control', 'Security control', 1, 0, 0, 0)],
        gaps: [
          ...c.gaps,
          gap('DM-SHOP-EP01-SC01', 'security_control', 'designed'),
          gap('DM-SHOP-EP01-SC01', 'security_control', 'proved'),
        ],
      }
      : c)),
  });
}
