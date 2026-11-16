// The Library aggregate (LA-MOD-A26): code the product ships for code outside the repo to import, a runtime included, with the business outcomes it serves. It is the maker of the
// guarantees it makes to the outside consumers they name; the guarantees are the Guarantee aggregate's. One instance is
// one library, whole: its row and the serves links it starts, and nothing of another aggregate.
import type { AggregateShape } from '../../platform/data/repository.ts';
import { bySource, groupOf } from '../../platform/data/grouped.ts';
import type { Row } from '../../platform/data/rows.ts';
import type { LibraryRow } from '../../platform/data/tables.ts';

/** One library, whole. */
export interface Library {
  /** The library's ID: the aggregate's root. */
  readonly root: string;
  library: LibraryRow;
  /** The business outcomes it serves, sorted. */
  serves: string[];
}

/** The tables the aggregate keeps its rows in: its kind and the links it starts. */
export const LIBRARY_TABLES = ['library', 'serves'] as const;

/** How each of the aggregate's kinds sits in an instance, the root first: its repository and pattern commands' handlers are generated from it. @public (read by `npm run generate`) */
export const LIBRARY_SHAPE = {
  library: { at: 'library', lists: { serves: 'serves' } },
} as const satisfies AggregateShape;

/** The libraries in the data, each whole; only the one given, when given. */
export function librariesFrom(rows: (table: string) => Row[], only?: string): Library[] {
  const found = rows('library').filter((r) => only === undefined || r.id === only) as unknown as LibraryRow[];
  if (!found.length) return [];
  const ids = new Set(found.map((r) => r.id));
  const serves = bySource(rows('serves').filter((s) => ids.has(String(s.source_id))));
  return found.map((row) => ({ root: row.id, library: row, serves: groupOf(serves, row.id) }));
}

/** The instance's rows, by table: only rows it owns, so another record's links stay as they are. */
export function libraryRows(record: Library): Map<string, Row[]> {
  return new Map<string, Row[]>([
    ['library', [record.library as unknown as Row]],
    ['serves', record.serves.map((target) => ({ source_id: record.root, target_id: target }))],
  ]);
}
