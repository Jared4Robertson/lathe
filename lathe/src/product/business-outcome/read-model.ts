// The Business outcome read model (LA-PRD-RM36): what the Business outcome aggregate's queries answer with, shaped for
// their readers (the outcome's page and a list of a product's outcomes) and built from rows by its projection. It
// shares no types with the aggregate's model.
import { byRecordId } from '../../platform/data/ids.ts';
import type { ReadView } from '../../platform/data/rules.ts';
import type { BusinessOutcomeRow } from '../../platform/data/tables.ts';

/** One business outcome's page: its row, the tests and records that measure it, and the capabilities and journeys that serve it. */
export interface BusinessOutcomePage {
  outcome: BusinessOutcomeRow;
  /** The tests and records that measure it, sorted. */
  measuredBy: string[];
  /** The capabilities that serve it, sorted. */
  servedBy: string[];
  /** The journeys that serve it, by ID, with their titles. */
  journeys: { id: string; title: string }[];
}

/** One line of a list of business outcomes. */
export interface BusinessOutcomeSummary {
  id: string;
  title: string;
}


// Each record's page, from the rows.
function businessOutcomePagesFrom(view: ReadView): BusinessOutcomePage[] {
  const outcomes = (view.rows('business_outcome') as unknown as BusinessOutcomeRow[]);
  const measures = view.rows('measured_by');
  const serves = view.rows('serves');
  const journeys = new Map((view.rows('journey') as unknown as { id: string; title: string }[]).map((j) => [j.id, j.title]));
  return outcomes.map((outcome) => ({
    outcome,
    measuredBy: measures.filter((m) => m.source_id === outcome.id).map((m) => String(m.target_id)).sort(),
    servedBy: serves.filter((s) => s.target_id === outcome.id && !journeys.has(String(s.source_id))).map((s) => String(s.source_id)).sort(),
    journeys: serves.filter((s) => s.target_id === outcome.id && journeys.has(String(s.source_id))).map((s) => ({ id: String(s.source_id), title: journeys.get(String(s.source_id))! })).sort(byRecordId),
  }));
}

/** The read model's table: each record's page, each product's list, and every record's kind. */
export interface BusinessOutcomeTable {
  pages: Map<string, BusinessOutcomePage>;
  /** Each product's records, by ID. */
  lists: Map<string, BusinessOutcomeSummary[]>;
  /** Every record ID in use, with its kind: what a next ID is one past, and what a refusal names. */
  kinds: Map<string, string>;
}

/**
 * The projection: the read model's table, built from the rows on each read. It is the only code that reads the source
 * rows for the queries.
 */
export function businessOutcomeTableFrom(view: ReadView): BusinessOutcomeTable {
  const pages = new Map<string, BusinessOutcomePage>();
  const lists = new Map<string, BusinessOutcomeSummary[]>();
  for (const page of businessOutcomePagesFrom(view)) {
    const row = page.outcome;
    pages.set(row.id, page);
    lists.set(row.product_id, [...(lists.get(row.product_id) ?? []), { id: row.id, title: row.title }]);
  }
  for (const list of lists.values()) list.sort((a, b) => a.id.localeCompare(b.id));
  const kinds = new Map<string, string>();
  for (const kind of Object.keys(view.schema.kinds)) for (const row of view.rows(kind)) kinds.set(String(row.id), kind);
  return { pages, lists, kinds };
}
