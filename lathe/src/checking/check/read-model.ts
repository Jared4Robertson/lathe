// The Check read model (LA-CHK-RM10): a check as its readers see it, and the checks that run on a product, in run
// order. Its projection builds them from the rows; it shares no type with the aggregate.
import type { Row } from '../../platform/data/rows.ts';

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

/** The page of the check with the name, from the rows (the projection, LA-CHK-RM10-PJ); undefined when there is none. */
export function checkPageFrom(rows: (table: string) => Row[], name: string): CheckPage | undefined {
  const check = rows('check').find((c) => c.name === name);
  return check ? pageOf(check) : undefined;
}

/** The checks that run on the product: Lathe's, then the product's own, each in its run order. */
export function checkSummariesFrom(rows: (table: string) => Row[], productId: string): CheckSummary[] {
  return rows('check')
    .map(pageOf)
    .filter((c) => c.product === null || c.product === productId)
    .sort((a, b) => Number(a.product !== null) - Number(b.product !== null) || a.position - b.position)
    .map((c) => ({ name: c.name, product: c.product, severity: c.severity, summary: c.summary }));
}
