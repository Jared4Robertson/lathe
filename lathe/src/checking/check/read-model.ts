// The Check read model (LA-CHK-RM10): a check as its readers see it, and the checks that run on a product, in run
// order. Its projection builds its table from the rows; it shares no type with the aggregate.
import type { Row } from '../../platform/data/rows.ts';
import type { ReadView } from '../../platform/data/rules.ts';

/** One check, whole. */
export interface CheckPage {
  name: string;
  /** The product it belongs to, or null for one of Lathe's own. */
  product: string | null;
  position: number;
  severity: string;
  summary: string;
  explanation: string;
  query: string;
  kinds: string[];
}

/** A check in the run order. */
export interface CheckSummary {
  name: string;
  product: string | null;
  severity: string;
  summary: string;
}

const pageOf = (c: Row): CheckPage => ({
  name: String(c.name),
  product: c.product_id === undefined ? null : String(c.product_id),
  position: Number(c.position),
  severity: String(c.severity),
  summary: String(c.summary),
  explanation: String(c.explanation),
  query: String(c.query),
  kinds: ((c.kinds as string[] | undefined) ?? []).map(String),
});

/** The read model's table, kept in memory: what the reader reads, and all it reads. */
export interface CheckTable {
  /** Each check whole, by its name: Lathe's, then each product's, each in its run order. */
  checks: Map<string, CheckPage>;
  /** Every product's ID. */
  products: Set<string>;
}

/** The projection: the read model's table, built from the rows on each read (in memory; nothing keeps it). */
export function checkTableFrom(view: ReadView): CheckTable {
  const pages = view.rows('check').map(pageOf).sort((a, b) => Number(a.product !== null) - Number(b.product !== null) || a.position - b.position);
  return { checks: new Map(pages.map((c) => [c.name, c])), products: new Set(view.rows('product').map((p) => String(p.id))) };
}
