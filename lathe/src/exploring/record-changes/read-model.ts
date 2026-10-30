// The Record changes read model (LA-EXP-RM07), shaped for the Changes lens, the Changes panel and the wiki card's
// Changes section: what changed in a product's records between a baseline and the data now, by record (lathe/src/
// changes.ts, the one record diff Lathe has): each record added, removed or changed, with the columns of its own row
// that changed, its part rows and the links it starts. The baseline is the data at a commit (the last one, where the
// branch left the default branch, or a commit the app noted when the Reader last looked), which only git holds, so
// the projection reads it from the view the query runner was given (`ReadView.baseline`, read for the query's
// `since` before it runs), and the data now from the view's rows. A record of another product in the same folder is
// left out; a removed record is the product's by its ID. The projection is the only code that reads the rows for the
// query and the only code that writes the read model's table.
import { recordChanges, type RecordChange, type Tables } from '../../changes.ts';
import type { ReadView } from '../../platform/data/rules.ts';
import { inSpace, placeRecords } from '../placement.ts';

export type { RecordChange };

/** What the changes are measured from. */
export type ChangesBaseline =
  | { state: 'ok'; commit: string; short: string; subject: string; date: string; base: string | null }
  | { state: 'none'; message: string };

/** A product's changes since a baseline. */
export interface ProductChanges {
  product: string;
  baseline: ChangesBaseline;
  /** Each record that differs, in ID order; none when there is no baseline. */
  changes: RecordChange[];
}

/** The read model's table, kept in memory: each product's changes, by product. */
export interface RecordChangesTable {
  products: Map<string, ProductChanges>;
}

/** The projection: the read model's table, from the rows now and the baseline (in memory; nothing keeps it). */
export function recordChangesTableFrom(view: ReadView): RecordChangesTable {
  const { schema } = view;
  const answer = view.baseline;
  const baseline: ChangesBaseline = !answer
    ? { state: 'none', message: 'No baseline was read for this product.' }
    : answer.state === 'ok'
      ? { state: 'ok', commit: answer.commit, short: answer.short, subject: answer.subject, date: answer.date, base: answer.base }
      : { state: 'none', message: answer.message };
  const placed = placeRecords(view);
  const now: Tables = Object.fromEntries(Object.values(schema.tables).filter((t) => t.stored).map((t) => [t.name, view.rows(t.name)]));
  const all = answer?.state === 'ok' ? recordChanges(schema, answer.tables, now) : [];
  const products = new Map<string, ProductChanges>();
  for (const p of view.rows('product')) {
    const product = String(p.id);
    const own = (c: RecordChange) => {
      const at = placed.get(c.id);
      return at ? inSpace(at, product) : c.id === product || c.id.startsWith(`${product}-`);
    };
    products.set(product, { product, baseline, changes: all.filter(own) });
  }
  return { products };
}
