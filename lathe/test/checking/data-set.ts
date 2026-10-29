// What the Checking aggregates' data sets start from: product TL written as its one row in a fresh folder, opened
// beside Lathe's own checks (lathe/data/check.jsonl), which load read-only. Each aggregate's own records are then added
// with its own commands.
import { openStore, type Store } from '../../src/platform/data/store.ts';
import { writeData } from '../helpers.ts';

const open: Store[] = [];

/** A store on product TL, beside Lathe's own checks, closed by closeCheckingStores. */
export async function productBesideLathesChecks(): Promise<Store> {
  const store = await openStore(writeData({ product: [{ id: 'TL', title: 'Tool Library', description: 'A neighborhood tool library.' }] }));
  open.push(store);
  return store;
}

/** Closes every store productBesideLathesChecks opened. */
export async function closeCheckingStores(): Promise<void> {
  for (const store of open.splice(0)) await store.close();
}
