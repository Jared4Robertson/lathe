// The Tests by state read model (LA-TRC-RM03), shaped for its read: each product's tests by state, scope by scope, its
// own scope first then each domain in ID order. The counts are worked out once, on the load, from the coverage_tests
// view (coverage.ts) onto each scope's Coverage.tests in the checks' run; the projection reads them from the run the
// query runner was given (`ReadView.checked`) and counts nothing of its own. It is the only code that reads the run for
// the query and the only code that writes the table.
import type { ReadView } from '../../platform/data/rules.ts';
import { compareIds } from '../../platform/data/ids.ts';

/** One scope's tests by state. */
export interface ScopeTestCounts {
  /** The domain, or null for the product's own records outside every domain. */
  domain: string | null;
  automated: number;
  manual: number;
  notAutomated: number;
}

/** The read model's table, kept in memory: each product's scopes, by product. */
export interface TestsByStateTable {
  products: Map<string, ScopeTestCounts[]>;
}

/** The projection: the read model's table, built from the checks' run on each read (in memory; nothing keeps it). */
export function testsByStateTableFrom(view: ReadView): TestsByStateTable {
  const products = new Map<string, ScopeTestCounts[]>(view.rows('product').map((p) => [String(p.id), []]));
  for (const c of view.checked?.coverage ?? []) products.get(c.product)?.push({ domain: c.domain, automated: c.tests.automated, manual: c.tests.manual, notAutomated: c.tests.not_automated });
  for (const scopes of products.values()) scopes.sort((a, b) => (a.domain === null ? -1 : b.domain === null ? 1 : compareIds(a.domain, b.domain)));
  return { products };
}
