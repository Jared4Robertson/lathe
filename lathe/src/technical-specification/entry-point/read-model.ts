// The Entry point read model (LA-TEC-RM40): what the Entry point aggregate's queries answer with, shaped for their
// readers (the entry point's page and a list of a domain's entry points) and built from rows by its projection. It
// shares no types with the aggregate's model.
import type { ReadView } from '../../platform/data/rules.ts';
import type { EntryPointRow } from '../../platform/data/tables.ts';

/** One entry point's page: its row, the packages it uses and the standard rules it meets. */
export interface EntryPointPage {
  entryPoint: EntryPointRow;
  /** The packages it uses, sorted. */
  packages: string[];
  /** The standard rules it meets, sorted. */
  meets: string[];
}

/** One line of a list of entry points. */
export interface EntryPointSummary {
  id: string;
  title: string;
}

// Each record's page, from the rows.
function entryPointPagesFrom(view: ReadView): EntryPointPage[] {
  const found = (view.rows('entry_point') as unknown as EntryPointRow[]);
  const packages = view.rows('package_use');
  const meets = view.rows('meets');
  return found.map((entryPoint) => ({
    entryPoint,
    packages: packages.filter((p) => p.record_id === entryPoint.id).map((p) => String(p.package)).sort(),
    meets: meets.filter((m) => m.source_id === entryPoint.id).map((m) => String(m.target_id)).sort(),
  }));
}

/** The read model's table: each record's page, each domain's list, and every record's kind. */
export interface EntryPointTable {
  pages: Map<string, EntryPointPage>;
  /** Each domain's records, by ID. */
  lists: Map<string, EntryPointSummary[]>;
  /** Every record ID in use, with its kind: what a next ID is one past, and what a refusal names. */
  kinds: Map<string, string>;
}

/**
 * The projection: the read model's table, built from the rows on each read. It is the only code that reads the source
 * rows for the queries.
 */
export function entryPointTableFrom(view: ReadView): EntryPointTable {
  const pages = new Map<string, EntryPointPage>();
  const lists = new Map<string, EntryPointSummary[]>();
  for (const page of entryPointPagesFrom(view)) {
    const row = page.entryPoint;
    pages.set(row.id, page);
    lists.set(row.domain_id, [...(lists.get(row.domain_id) ?? []), { id: row.id, title: row.title }]);
  }
  for (const list of lists.values()) list.sort((a, b) => a.id.localeCompare(b.id));
  const kinds = new Map<string, string>();
  for (const kind of Object.keys(view.schema.kinds)) for (const row of view.rows(kind)) kinds.set(String(row.id), kind);
  return { pages, lists, kinds };
}
