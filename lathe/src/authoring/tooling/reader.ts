// The Tooling reader: the interface the Tooling aggregate's query handlers depend on to read the Tooling
// read model (LA-AUT-RM41), and today's implementation over the current data, built by the read model's projection. A
// handler reads through it only, never the aggregate's model or repository.
import type { ReadView } from '../../platform/data/rules.ts';
import { toolingPagesFrom, toolingSummariesFrom, type ToolingPage, type ToolingSummary } from './read-model.ts';

/** What the Tooling queries read. */
export interface ToolingReader {
  /** The kind of the record with this ID, or undefined when there is none. */
  kindOf(id: string): string | undefined;
  /** The page of the record with this ID. */
  page(id: string): ToolingPage;
  /** The records under a domain, by ID. */
  list(domain: string): ToolingSummary[];
  /** The IDs in use. */
  ids(): string[];
}

/** The reader over the current data. */
export function toolingReader(view: ReadView): ToolingReader {
  return {
    kindOf: (id) => view.record(id)?.kind,
    page: (id) => toolingPagesFrom(view, id)[0],
    list: (domain) => toolingSummariesFrom(view, domain),
    ids: () => view.rows('tooling').map((r) => String(r.id)),
  };
}
