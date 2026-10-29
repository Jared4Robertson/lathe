// LA-CHK-TD02 Library limits: product TL beside Lathe's own checks, then its limits set with the Product setting
// aggregate's own command: 20 children, 9 entities.
import { SET_LIMITS } from '../../../src/checking/product-setting/commands/set-limits.ts';
import { runCommand } from '../../../src/platform/commands/run.ts';
import type { Store } from '../../../src/platform/data/store.ts';
import { productBesideLathesChecks } from '../data-set.ts';

/** A store with TL's limits set to 20 children and 9 entities. */
export async function productSettingDataSet(): Promise<Store> {
  const store = await productBesideLathesChecks();
  await runCommand(store, SET_LIMITS, { product_id: 'TL', max_children: 20, max_entities_per_aggregate: 9 });
  return store;
}
