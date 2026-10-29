// The Tooling read model (LA-AUT-RM41): what the Tooling aggregate's queries answer with, shaped for their
// readers (the tooling record's page and a list of a domain's tooling) and built from rows by its projection. It
// shares no types with the aggregate's model.
import type { ReadView } from '../../platform/data/rules.ts';
import type { ToolingRow } from '../../platform/data/tables.ts';

/** One tooling record's page: its row, the packages it uses and the standard rules it meets. */
export interface ToolingPage {
  tooling: ToolingRow;
  /** The packages it uses, sorted. */
  packages: string[];
  /** The standard rules it meets, sorted. */
  meets: string[];
}

/** One line of a list of tooling records. */
export interface ToolingSummary {
  id: string;
  title: string;
}

// Each record's page, from the rows.
function toolingPagesFrom(view: ReadView): ToolingPage[] {
  const found = (view.rows('tooling') as unknown as ToolingRow[]);
  const packages = view.rows('package_use');
  const meets = view.rows('meets');
  return found.map((tooling) => ({
    tooling,
    packages: packages.filter((p) => p.record_id === tooling.id).map((p) => String(p.package)).sort(),
    meets: meets.filter((m) => m.source_id === tooling.id).map((m) => String(m.target_id)).sort(),
  }));
}

/** The read model's table: each record's page, each domain's list, and every record's kind. */
export interface ToolingTable {
  pages: Map<string, ToolingPage>;
  /** Each domain's records, by ID. */
  lists: Map<string, ToolingSummary[]>;
  /** Every record ID in use, with its kind: what a next ID is one past, and what a refusal names. */
  kinds: Map<string, string>;
}

/**
 * The projection: the read model's table, built from the rows on each read. It is the only code that reads the source
 * rows for the queries.
 */
export function toolingTableFrom(view: ReadView): ToolingTable {
  const pages = new Map<string, ToolingPage>();
  const lists = new Map<string, ToolingSummary[]>();
  for (const page of toolingPagesFrom(view)) {
    const row = page.tooling;
    pages.set(row.id, page);
    lists.set(row.domain_id, [...(lists.get(row.domain_id) ?? []), { id: row.id, title: row.title }]);
  }
  for (const list of lists.values()) list.sort((a, b) => a.id.localeCompare(b.id));
  const kinds = new Map<string, string>();
  for (const kind of Object.keys(view.schema.kinds)) for (const row of view.rows(kind)) kinds.set(String(row.id), kind);
  return { pages, lists, kinds };
}
