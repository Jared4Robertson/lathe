// The Coverage read model (LA-TRC-RM01), shaped for the product's and the domains' pages: per domain (and for the
// product's records outside every domain) and obligation kind, how many obligations are designed, built, proved and not
// automated yet out of the total; its tests by state; and the gaps (what each obligation lacks, and each record short of
// a minimum). Coverage is the checks' run's, not rows': the projection reads the run the query runner was given
// (`ReadView.checked`). It is the only code that reads it for the query and the only code that writes the table.
import type { ReadView } from '../../platform/data/rules.ts';

/** One obligation kind's figures in one scope. */
export interface ObligationFigures {
  kind: string;
  label: string;
  total: number;
  designed: number;
  built: number;
  proved: number;
  notAutomated: number;
  /** Only proof is asked of it (a pattern rule): designed and built count as its total. */
  proofOnly: boolean;
}

/** One record's gap: an obligation's designed, built or proved, or the minimum (a gap rule) it misses. */
export interface GapFigure {
  id: string;
  kind: string;
  missing: string;
  message: string;
}

/** One domain's coverage, or the product's outside every domain (domain null). */
export interface ScopeCoverage {
  domain: string | null;
  /** Every obligation kind, in kind order. */
  obligations: ObligationFigures[];
  tests: { automated: number; manual: number; notAutomated: number };
  gaps: GapFigure[];
}

/** A product's coverage, scope by scope. */
export interface ProductCoverage {
  product: string;
  /** The product's own scope (domain null) first, then each domain in ID order. */
  scopes: ScopeCoverage[];
}

/** The read model's table, kept in memory: each product's coverage, by product. */
export interface CoverageTable {
  products: Map<string, ProductCoverage>;
}

/** The projection: the read model's table, built from the checks' run on each read (in memory; nothing keeps it). */
export function coverageTableFrom(view: ReadView): CoverageTable {
  const products = new Map<string, ProductCoverage>();
  for (const row of view.rows('product')) products.set(String(row.id), { product: String(row.id), scopes: [] });
  for (const c of view.checked?.coverage ?? []) {
    const product = products.get(c.product);
    if (!product) continue;
    product.scopes.push({
      domain: c.domain,
      obligations: c.obligations.map((o) => ({ kind: o.kind, label: o.label, total: o.total, designed: o.designed, built: o.built, proved: o.proved, notAutomated: o.not_automated, proofOnly: !!o.proof_only })),
      tests: { automated: c.tests.automated, manual: c.tests.manual, notAutomated: c.tests.not_automated },
      gaps: c.gaps.map((g) => ({ id: g.id, kind: g.kind, missing: g.missing, message: g.message })),
    });
  }
  for (const p of products.values()) p.scopes.sort((a, b) => (a.domain === null ? -1 : b.domain === null ? 1 : a.domain.localeCompare(b.domain, 'en', { numeric: true })));
  return { products };
}
