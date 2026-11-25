// The Library read model's reader (LA-MOD-RM46-RD): the one way the Library queries reach the read model's storage.
// The query handlers depend only on the LibraryReader interface; the query runner injects the reader each query's
// definition makes (`reader`), so keeping the read model elsewhere is a new implementation of this interface and
// nothing more. Today's implementation reads the projection's table, kept in memory and built on each read.
import type { ReadView } from '../../platform/data/rules.ts';
import { idShapeOf, type IdShape } from '../../platform/data/id-shape.ts';
import type { SchemaDescription } from '../../platform/data/schema.ts';
import { libraryTableFrom, type LibraryPage, type LibrarySummary, type LibraryTable } from './read-model.ts';

/** What the Library queries read, and all they read. */
export interface LibraryReader {
  /** The kind of the record with this ID, of any kind, or undefined when no record has it. */
  kindOf(id: string): string | undefined;
  /** The page of the record with this ID, or undefined when there is none. */
  page(id: string): LibraryPage | undefined;
  /** The records under the domain, by ID. */
  list(domain: string): LibrarySummary[];
  /** The highest number in use after the prefix, as in <prefix>07, or 0 when none is. */
  highestAfter(prefix: string): number;
  /** How the IDs of a kind are written, read from the schema: its parents, and the letters and digits its ID ends in. */
  idShape(kind: string): IdShape;
}

/** The reader over the read model's table in memory. */
export class InMemoryLibraryReader implements LibraryReader {
  private readonly table: LibraryTable;
  private readonly schema: SchemaDescription;

  constructor(table: LibraryTable, schema: SchemaDescription) {
    this.table = table;
    this.schema = schema;
  }

  kindOf(id: string): string | undefined {
    return this.table.kinds.get(id);
  }

  page(id: string): LibraryPage | undefined {
    return this.table.pages.get(id);
  }

  list(domain: string): LibrarySummary[] {
    return this.table.lists.get(domain) ?? [];
  }

  idShape(kind: string): IdShape {
    return idShapeOf(this.schema, kind);
  }

  highestAfter(prefix: string): number {
    const shape = new RegExp(`^${prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\d+)$`);
    let highest = 0;
    for (const id of this.table.kinds.keys()) {
      const m = shape.exec(id);
      if (m) highest = Math.max(highest, Number(m[1]));
    }
    return highest;
  }
}

/** The reader the query runner gives each Library query: today's, over the projection's table built from the data. */
export const libraryReader = (view: ReadView): LibraryReader => new InMemoryLibraryReader(libraryTableFrom(view), view.schema);
