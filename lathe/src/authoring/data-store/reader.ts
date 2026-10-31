// The Data store read model's reader (LA-AUT-RM43-RD): the one way the Data store queries reach the read model's
// storage. The query handlers depend only on the DataStoreReader interface; the query runner injects the reader each
// query's definition makes (`reader`), so keeping the read model elsewhere is a new implementation of this interface
// and nothing more. Today's implementation reads the projection's table, kept in memory and built on each read.
import type { ReadView } from '../../platform/data/rules.ts';
import { idShapeOf, type IdShape } from '../../platform/data/id-shape.ts';
import type { SchemaDescription } from '../../platform/data/schema.ts';
import { dataStoreTableFrom, type DataStorePage, type DataStoreSummary, type DataStoreTable } from './read-model.ts';

/** What the Data store queries read, and all they read. */
export interface DataStoreReader {
  /** The kind of the record with this ID, of any kind, or undefined when no record has it. */
  kindOf(id: string): string | undefined;
  /** The page of a data store, or undefined when there is no such data store. */
  page(id: string): DataStorePage | undefined;
  /** A product's data stores (its own and its domains') or a domain's, by ID, or undefined when there is no such record. */
  storesOf(parentId: string): DataStoreSummary[] | undefined;
  /** The highest number in use after the prefix, as in <prefix>07, or 0 when none is. */
  highestAfter(prefix: string): number;
  /** How the IDs of a kind are written, read from the schema: its parents, and the letters and digits its ID ends in. */
  idShape(kind: string): IdShape;
}

/** The reader over the read model's table in memory. */
export class InMemoryDataStoreReader implements DataStoreReader {
  private readonly table: DataStoreTable;
  private readonly schema: SchemaDescription;

  constructor(table: DataStoreTable, schema: SchemaDescription) {
    this.table = table;
    this.schema = schema;
  }

  kindOf(id: string): string | undefined {
    return this.table.kinds.get(id);
  }

  page(id: string): DataStorePage | undefined {
    return this.table.pages.get(id);
  }

  storesOf(parentId: string): DataStoreSummary[] | undefined {
    return this.table.parents.get(parentId);
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

/** The reader the query runner gives each Data store query: today's, over the projection's table built from the data. */
export const dataStoreReader = (view: ReadView): DataStoreReader => new InMemoryDataStoreReader(dataStoreTableFrom(view), view.schema);
