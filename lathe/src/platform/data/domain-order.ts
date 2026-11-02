// The order domains are listed in: by the position the Owner gives each among its product's domains, never by ID. One
// way to order them, read by every list of domains (the nav, the product page, the graph, the reports).
import { compareIds } from './ids.ts';
import type { Row } from './rows.ts';

/** Each domain's place in the order, from 0: a product's domains by position, the products by ID. */
export function domainOrder(domains: readonly Row[]): ReadonlyMap<string, number> {
  const sorted = [...domains].sort((a, b) => compareIds(String(a.product_id), String(b.product_id)) || Number(a.position) - Number(b.position) || compareIds(String(a.id), String(b.id)));
  return new Map(sorted.map((d, at) => [String(d.id), at]));
}
