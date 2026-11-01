// The Stored record facts read model (LA-TRC-RM07), shaped for its read: each product's stored kinds' parts their files
// do not define. The facts are gathered once, on the load (trace/tables.ts), and the table-schema-mismatch check words
// each part a file does not define; the projection reads those warnings from the checks' run the query runner was given
// (`ReadView.checked`), placing each in its record's product, and compares nothing itself. It is the only code that
// reads the run for the query and the only code that writes the table.
import type { ReadView } from '../../platform/data/rules.ts';
import { inSpace, placementOf } from '../../exploring/placement.ts';

/** The check that a stored kind's file defines it as the spec says. */
const STORED_KIND_CHECK = 'table-schema-mismatch';

/** A part of a stored kind its file does not define, as the check words it. */
export interface UndefinedPart {
  record: string;
  message: string;
}

/** The read model's table, kept in memory: each product's parts not defined, by product. */
export interface StoredRecordFactsTable {
  products: Map<string, UndefinedPart[]>;
}

/** The projection: the read model's table, built from the checks' run on each read (in memory; nothing keeps it). */
export function storedRecordFactsTableFrom(view: ReadView): StoredRecordFactsTable {
  const placed = placementOf(view);
  const problems = (view.checked?.problems ?? []).filter((p) => p.check === STORED_KIND_CHECK && p.record !== null);
  const products = new Map<string, UndefinedPart[]>();
  for (const row of view.rows('product')) {
    const product = String(row.id);
    products.set(product, problems.filter((p) => { const at = placed.get(p.record!); return !!at && inSpace(at, product); }).map((p) => ({ record: p.record!, message: p.message })));
  }
  return { products };
}
