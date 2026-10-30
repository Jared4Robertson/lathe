// The Serves read model (LA-TRC-RM12): the business outcomes each record serves, as a record page's Serves line and the
// Trace's branches read them. A record serves an outcome when a use case whose capability serves that outcome reaches
// it (the Serves reach, LA-TRC-DS06, in trace/serves.ts): worked out from the rows on every read, never stored, so
// there is no link to keep in step. A product's list holds each record of its space that serves an outcome, with the
// use cases it serves them through, and the aggregates, read models and obligations of its space no outcome reaches
// (the serves-no-outcome check reports the same). The projection is the only code that reads the rows for the queries
// and the only code that writes the read model's table; the query handlers read it only through the reader.
import type { ReadView } from '../../platform/data/rules.ts';
import { inSpace, placeRecords } from '../../exploring/placement.ts';
import { servesOf } from '../../trace/serves.ts';
import { compareIds } from '../../platform/data/ids.ts';

/** What one record serves. */
export interface RecordServes {
  id: string;
  /** The business outcomes it serves, in ID order: none when no use case whose capability serves one reaches it. */
  outcomes: string[];
  /** The use cases that reach it, through which it serves them, in ID order. */
  useCases: string[];
}

/** A product's records as the Trace's branches read them. */
export interface ProductServes {
  product: string;
  /** Each record of its space that serves an outcome, in ID order. */
  served: RecordServes[];
  /** Its space's aggregates, read models and obligations no outcome reaches, in ID order. */
  unserved: string[];
}

/** The read model's table, kept in memory: each record's outcomes, and each product's list. */
export interface ServesTable {
  records: Map<string, RecordServes>;
  products: Map<string, ProductServes>;
}

/** The projection: the read model's table over the rows (in memory; nothing keeps it). */
export function servesTableFrom(view: ReadView): ServesTable {
  const served = servesOf(view);
  const placed = placeRecords(view);
  const records = new Map<string, RecordServes>();
  for (const id of placed.keys()) {
    const s = served.get(id);
    records.set(id, { id, outcomes: s ? [...s.outcomes] : [], useCases: s ? [...s.useCases] : [] });
  }
  const owes = (kind: string) => !!view.schema.kinds[kind]?.obligation || kind === 'aggregate' || kind === 'read_model';
  const products = new Map<string, ProductServes>();
  for (const product of view.rows('product').map((p) => String(p.id))) {
    const space = [...placed.values()].filter((r) => inSpace(r, product));
    products.set(product, {
      product,
      served: space.filter((r) => served.has(r.id)).map((r) => records.get(r.id)!).sort((a, b) => compareIds(a.id, b.id)),
      unserved: space.filter((r) => owes(r.kind) && !served.has(r.id)).map((r) => r.id).sort(compareIds),
    });
  }
  return { records, products };
}
