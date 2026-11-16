// The Generated component read model (LA-MOD-RM45): what the Generated component aggregate's queries answer with, shaped for their readers
// (a generated component's page, with the guarantees it makes, and a list of a domain's generated components) and built from rows by its
// projection. It shares no types with the aggregate's model.
import type { ReadView } from '../../platform/data/rules.ts';
import type { GeneratedComponentRow } from '../../platform/data/tables.ts';
import { byRecordId } from '../../platform/data/ids.ts';

/** A guarantee as a generated component's page lists it. */
export interface MadeGuarantee {
  id: string;
  title: string;
}

/** One generated component's page: its row, the business outcomes it serves and the guarantees it makes. */
export interface GeneratedComponentPage {
  generatedComponent: GeneratedComponentRow;
  /** The business outcomes it serves, sorted. */
  serves: string[];
  /** The guarantees it makes, by ID. */
  guarantees: MadeGuarantee[];
}

/** One line of a list of generated components. */
export interface GeneratedComponentSummary {
  id: string;
  title: string;
}

/** The read model's table: each record's page, each domain's list, and every record's kind. */
export interface GeneratedComponentTable {
  pages: Map<string, GeneratedComponentPage>;
  /** Each domain's records, by ID. */
  lists: Map<string, GeneratedComponentSummary[]>;
  /** Every record ID in use, with its kind: what a next ID is one past, and what a refusal names. */
  kinds: Map<string, string>;
}

/**
 * The projection: the read model's table, built from the rows on each read. It is the only code that reads the source
 * rows for the queries.
 */
export function generatedComponentTableFrom(view: ReadView): GeneratedComponentTable {
  const serves = new Map<string, string[]>();
  for (const s of view.rows('serves')) serves.set(String(s.source_id), [...(serves.get(String(s.source_id)) ?? []), String(s.target_id)]);
  const made = new Map<string, MadeGuarantee[]>();
  for (const g of view.rows('guarantee')) {
    const maker = g.generated_component_id;
    if (typeof maker === 'string') made.set(maker, [...(made.get(maker) ?? []), { id: String(g.id), title: String(g.title) }]);
  }
  const pages = new Map<string, GeneratedComponentPage>();
  const lists = new Map<string, GeneratedComponentSummary[]>();
  for (const row of view.rows('generated_component') as unknown as GeneratedComponentRow[]) {
    pages.set(row.id, { generatedComponent: row, serves: [...(serves.get(row.id) ?? [])].sort(), guarantees: [...(made.get(row.id) ?? [])].sort(byRecordId) });
    lists.set(row.domain_id, [...(lists.get(row.domain_id) ?? []), { id: row.id, title: row.title }]);
  }
  for (const list of lists.values()) list.sort(byRecordId);
  const kinds = new Map<string, string>();
  for (const kind of Object.keys(view.schema.kinds)) for (const row of view.rows(kind)) kinds.set(String(row.id), kind);
  return { pages, lists, kinds };
}
