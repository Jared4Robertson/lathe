// The Coverage gaps read model (LA-TRC-RM02), shaped for its reads: each product's gaps, its own scope's first then
// each domain's in ID order. The gaps are worked out once, on the load, from the coverage_gap table (coverage.ts) onto
// each scope's Coverage.gaps in the checks' run; the projection reads them from the run the query runner was given
// (`ReadView.checked`) and works out nothing of its own. It is the only code that reads the run for the queries and the
// only code that writes the table.
import type { ReadView } from '../../platform/data/rules.ts';
import { compareIds } from '../../platform/data/ids.ts';

/** One gap: an obligation's designed, built or proved, or the minimum (a gap rule) a record misses, in its scope. */
export interface CoverageGapRow {
  /** The domain whose scope holds it, or null for the product's own records outside every domain. */
  domain: string | null;
  id: string;
  kind: string;
  missing: string;
  message: string;
}

/** The read model's table, kept in memory: each product's gaps, by product. */
export interface CoverageGapsTable {
  products: Map<string, CoverageGapRow[]>;
}

/** The projection: the read model's table, built from the checks' run on each read (in memory; nothing keeps it). */
export function coverageGapsTableFrom(view: ReadView): CoverageGapsTable {
  const products = new Map<string, CoverageGapRow[]>(view.rows('product').map((p) => [String(p.id), []]));
  const scopes = [...(view.checked?.coverage ?? [])].sort((a, b) => (a.domain === null ? -1 : b.domain === null ? 1 : compareIds(a.domain, b.domain)));
  for (const c of scopes) products.get(c.product)?.push(...c.gaps.map((g) => ({ domain: c.domain, id: g.id, kind: g.kind, missing: g.missing, message: g.message })));
  return { products };
}
