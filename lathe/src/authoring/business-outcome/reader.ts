// The Business outcome reader: the interface the Business outcome aggregate's query handlers depend on to read the Business outcome
// read model (LA-AUT-RM36), and today's implementation over the current data, built by the read model's projection. A
// handler reads through it only, never the aggregate's model or repository.
import type { ReadView } from '../../platform/data/rules.ts';
import { businessOutcomePagesFrom, businessOutcomeSummariesFrom, type BusinessOutcomePage, type BusinessOutcomeSummary } from './read-model.ts';

/** What the Business outcome queries read. */
export interface BusinessOutcomeReader {
  /** The kind of the record with this ID, or undefined when there is none. */
  kindOf(id: string): string | undefined;
  /** The page of the record with this ID. */
  page(id: string): BusinessOutcomePage;
  /** The records under a product, by ID. */
  list(product: string): BusinessOutcomeSummary[];
  /** The IDs in use. */
  ids(): string[];
}

/** The reader over the current data. */
export function businessOutcomeReader(view: ReadView): BusinessOutcomeReader {
  return {
    kindOf: (id) => view.record(id)?.kind,
    page: (id) => businessOutcomePagesFrom(view, id)[0],
    list: (product) => businessOutcomeSummariesFrom(view, product),
    ids: () => view.rows('business_outcome').map((r) => String(r.id)),
  };
}
