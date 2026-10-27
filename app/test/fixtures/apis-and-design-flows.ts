import type { SpecData } from '../../../lathe/src/server/contract';
import { fixture } from './load';
import { workspace } from './workspace';

// APIs, integrations and technical flows for the app tests (data/apis/): the component-test workspace
// with an API (DM-SHOP-API01) holding the endpoint DM-SHOP-E01 and a shared requirement, an
// integration (DM-SHOP-INT01) with one exchange, and a technical flow (DM-SHOP-DF01) in a Services
// layer that deepens DM-SHOP-F01, with two steps on the main path and one refused.

export function apisWorkspace(): SpecData {
  const base = workspace();
  return fixture('apis', { problems: base.problems, coverage: base.coverage });
}
