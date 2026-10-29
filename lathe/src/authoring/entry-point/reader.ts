// The Entry point reader: the interface the Entry point aggregate's query handlers depend on to read the Entry point
// read model (LA-AUT-RM40), and today's implementation over the current data, built by the read model's projection. A
// handler reads through it only, never the aggregate's model or repository.
import type { ReadView } from '../../platform/data/rules.ts';
import { entryPointPagesFrom, entryPointSummariesFrom, type EntryPointPage, type EntryPointSummary } from './read-model.ts';

/** What the Entry point queries read. */
export interface EntryPointReader {
  /** The kind of the record with this ID, or undefined when there is none. */
  kindOf(id: string): string | undefined;
  /** The page of the record with this ID. */
  page(id: string): EntryPointPage;
  /** The records under a domain, by ID. */
  list(domain: string): EntryPointSummary[];
  /** The IDs in use. */
  ids(): string[];
}

/** The reader over the current data. */
export function entryPointReader(view: ReadView): EntryPointReader {
  return {
    kindOf: (id) => view.record(id)?.kind,
    page: (id) => entryPointPagesFrom(view, id)[0],
    list: (domain) => entryPointSummariesFrom(view, domain),
    ids: () => view.rows('entry_point').map((r) => String(r.id)),
  };
}
