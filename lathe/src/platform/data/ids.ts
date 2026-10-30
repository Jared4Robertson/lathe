// ID order: the one way Lathe sorts record IDs, with the numbers inside them compared by value (UC2 before UC10). One
// collator, made once: `localeCompare` with options builds one on every comparison, which costs seconds when a large
// product's records are sorted (LA-PLT-UC03-R05).
const collator = new Intl.Collator('en', { numeric: true });

/** Two IDs (or any texts) in ID order. */
export const compareIds = (a: string, b: string): number => collator.compare(a, b);

/** Two records in the order of their IDs. */
export const byRecordId = (a: { id: string }, b: { id: string }): number => collator.compare(a.id, b.id);

/** The orders worked out last, newest first: a reload changes few IDs, so the next sort usually finds its IDs in one. */
const orders: Map<string, number>[] = [];
const KEPT_ORDERS = 4;

/**
 * Each ID's place in ID order (IDs the collator holds equal share one), for sorting many records by ID by number
 * rather than by comparing their texts again (LA-PLT-UC03-R05). An order worked out for a set holding every one of the
 * IDs is reused: its places keep the IDs in the same order.
 */
export function idOrder(ids: Iterable<string>): ReadonlyMap<string, number> {
  const wanted = [...new Set(ids)];
  const known = orders.findIndex((order) => wanted.every((id) => order.has(id)));
  if (known >= 0) {
    const [order] = orders.splice(known, 1);
    orders.unshift(order);
    return order;
  }
  const sorted = wanted.sort(compareIds);
  const order = new Map<string, number>();
  sorted.forEach((id, at) => order.set(id, at > 0 && compareIds(sorted[at - 1], id) === 0 ? order.get(sorted[at - 1])! : at));
  orders.unshift(order);
  orders.length = Math.min(orders.length, KEPT_ORDERS);
  return order;
}
