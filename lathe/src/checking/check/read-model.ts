// The Check read model (LA-CHK-RM10), shaped for its readers: the Check page reads a check whole by its name (its
// product, domain, place in the run order, severity, summary, explanation, query and kinds), and a product's list reads the
// checks that run on it, Lathe's first and then its own, in run order. The projection (checkTableFrom) is the only code
// that reads the source rows and the only code that writes the read model's table; the query handlers read that table
// only through the reader (reader.ts). Nothing here is the aggregate's own instance type.
import type { ReadView } from '../../platform/data/rules.ts';
import type { CheckRow } from '../../platform/data/tables.ts';

/** One check, whole, as its page shows it. */
export interface CheckPage {
  name: string;
  /** The product it belongs to, or null for one of Lathe's own. */
  product: string | null;
  /** The domain whose rules it reports. */
  domain: string;
  position: number;
  severity: CheckRow['severity'];
  summary: string;
  explanation: string;
  query: string;
  kinds: string[];
}

/** A check in a product's run order, as its list shows it. */
export interface CheckSummary {
  name: string;
  product: string | null;
  severity: CheckRow['severity'];
  summary: string;
}

/** The read model's table, kept in memory: what the reader reads, and all it reads. */
export interface CheckTable {
  /** Each check whole, by its name. */
  checks: Map<string, CheckPage>;
  /** The checks that run on each product, Lathe's first and then its own, each in its run order. */
  products: Map<string, CheckSummary[]>;
}

const pageOf = (c: CheckRow): CheckPage => ({
  name: c.name,
  product: c.product_id ?? null,
  domain: c.domain_id,
  position: c.position,
  severity: c.severity,
  summary: c.summary,
  explanation: c.explanation,
  query: c.query,
  kinds: [...(c.kinds ?? [])],
});

const summaryOf = (c: CheckPage): CheckSummary => ({ name: c.name, product: c.product, severity: c.severity, summary: c.summary });

/** The projection: the read model's table, built from the rows on each read (in memory; nothing keeps it). */
export function checkTableFrom(view: ReadView): CheckTable {
  const pages = (view.rows('check') as unknown as CheckRow[]).map(pageOf).sort((a, b) => a.position - b.position);
  const lathes = pages.filter((c) => c.product === null).map(summaryOf);
  const products = new Map<string, CheckSummary[]>(view.rows('product').map((p) => [String(p.id), [...lathes]]));
  for (const c of pages) if (c.product !== null) products.get(c.product)?.push(summaryOf(c));
  return { checks: new Map(pages.map((c) => [c.name, c])), products };
}
