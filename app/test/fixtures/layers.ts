import type { SpecData } from '../../../lathe/src/server/contract';
import { fixture } from './load';
import { workspace } from './workspace';

// The component-test workspace with layers (data/layers/) and a test proving each kind of obligation.
// DM-SHOP's Technical specification has three layers, whose order is not their ID order:
//   Models (LAY02, order 1): DM-SHOP-C02, DM-SHOP-C03 · Services (LAY03, order 2): DM-SHOP-C04 ·
//   Web app (LAY01, order 3): DM-SHOP-C05 · and DM-SHOP-C01 outside any layer.
// Its Test plan, by family and what each test proves (capabilities Browsing, order 1, and Filling the basket, order 2):
//   Acceptance tests: Browsing › Look at an item: T03 · Filling the basket: T09 (under it, proving
//     nothing) › Empty the basket: T02, T04 · Use cases outside any capability › Add an item to the basket: T01
//   Domain rule tests: T05 · Pattern tests › Saving: T06 · Interaction tests: T13 (an endpoint's) ·
//   UI tests: T07 (a view's interaction requirement), T10 (test_type ui) ·
//   Design checks: T11 (test_type design), T12 (only supports links) · Engineering checks: T08.
// DM-PAY has no layers and only an engineering check.

/** The demo workspace with DM-SHOP's components in layers and its tests proving every kind. */
export function layerWorkspace(): SpecData {
  const base = workspace();
  return fixture('layers', { problems: base.problems, coverage: base.coverage });
}
