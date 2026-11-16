// The Library read model (LA-MOD-RM46): what the Library aggregate's queries answer with, shaped for their readers
// (a library's page, with the guarantees it makes, and a list of a domain's libraries) and built from rows by its
// projection. It shares no types with the aggregate's model.
import type { ReadView } from '../../platform/data/rules.ts';
import type { LibraryRow } from '../../platform/data/tables.ts';
import { byRecordId } from '../../platform/data/ids.ts';

/** A guarantee as a library's page lists it. */
export interface MadeGuarantee {
  id: string;
  title: string;
}

/** One library's page: its row, the business outcomes it serves and the guarantees it makes. */
export interface LibraryPage {
  library: LibraryRow;
  /** The business outcomes it serves, sorted. */
  serves: string[];
  /** The guarantees it makes, by ID. */
  guarantees: MadeGuarantee[];
}

/** One line of a list of libraries. */
export interface LibrarySummary {
  id: string;
  title: string;
}

/** The read model's table: each record's page, each domain's list, and every record's kind. */
export interface LibraryTable {
  pages: Map<string, LibraryPage>;
  /** Each domain's records, by ID. */
  lists: Map<string, LibrarySummary[]>;
  /** Every record ID in use, with its kind: what a next ID is one past, and what a refusal names. */
  kinds: Map<string, string>;
}

/**
 * The projection: the read model's table, built from the rows on each read. It is the only code that reads the source
 * rows for the queries.
 */
export function libraryTableFrom(view: ReadView): LibraryTable {
  const serves = new Map<string, string[]>();
  for (const s of view.rows('serves')) serves.set(String(s.source_id), [...(serves.get(String(s.source_id)) ?? []), String(s.target_id)]);
  const made = new Map<string, MadeGuarantee[]>();
  for (const g of view.rows('guarantee')) {
    const maker = g.library_id;
    if (typeof maker === 'string') made.set(maker, [...(made.get(maker) ?? []), { id: String(g.id), title: String(g.title) }]);
  }
  const pages = new Map<string, LibraryPage>();
  const lists = new Map<string, LibrarySummary[]>();
  for (const row of view.rows('library') as unknown as LibraryRow[]) {
    pages.set(row.id, { library: row, serves: [...(serves.get(row.id) ?? [])].sort(), guarantees: [...(made.get(row.id) ?? [])].sort(byRecordId) });
    lists.set(row.domain_id, [...(lists.get(row.domain_id) ?? []), { id: row.id, title: row.title }]);
  }
  for (const list of lists.values()) list.sort(byRecordId);
  const kinds = new Map<string, string>();
  for (const kind of Object.keys(view.schema.kinds)) for (const row of view.rows(kind)) kinds.set(String(row.id), kind);
  return { pages, lists, kinds };
}
