// The Business outcome read model (LA-AUT-RM36): what the Business outcome aggregate's queries answer with, shaped for
// their readers (the outcome's page and a list of a product's outcomes) and built from rows by its projection. It
// shares no types with the aggregate's model.
import type { ReadView } from '../../platform/data/rules.ts';
import type { BusinessOutcomeRow } from '../../platform/data/tables.ts';

/** One business outcome's page: its row, the tests and records that measure it, and the capabilities that serve it. */
export interface BusinessOutcomePage {
  outcome: BusinessOutcomeRow;
  /** The tests and records that measure it, sorted. */
  measuredBy: string[];
  /** The capabilities that serve it, sorted. */
  servedBy: string[];
}

/** One line of a list of business outcomes. */
export interface BusinessOutcomeSummary {
  id: string;
  title: string;
}


/** The projection: each business outcome's page, from the rows; only the one given, when given. */
export function businessOutcomePagesFrom(view: ReadView, only?: string): BusinessOutcomePage[] {
  const outcomes = (view.rows('business_outcome') as unknown as BusinessOutcomeRow[]).filter((o) => only === undefined || o.id === only);
  if (!outcomes.length) return [];
  const measures = view.rows('measured_by');
  const serves = view.rows('serves');
  return outcomes.map((outcome) => ({
    outcome,
    measuredBy: measures.filter((m) => m.source_id === outcome.id).map((m) => String(m.target_id)).sort(),
    servedBy: serves.filter((s) => s.target_id === outcome.id).map((s) => String(s.source_id)).sort(),
  }));
}

/** The projection's list: a product's business outcomes, by ID. */
export function businessOutcomeSummariesFrom(view: ReadView, product: string): BusinessOutcomeSummary[] {
  return view
    .rows('business_outcome')
    .filter((o) => o.product_id === product)
    .map((o) => ({ id: String(o.id), title: String(o.title) }))
    .sort((a, b) => a.id.localeCompare(b.id));
}
