// The Table read model's reader (LA-AUT-RM38-RD): the one way the Table queries reach the read model's storage. The
// query handlers depend only on the TableReader interface; the query runner injects the reader each query's definition
// makes (`reader`), so keeping the read model elsewhere is a new implementation of this interface and nothing more.
// Today's implementation reads the projection's table, kept in memory and built on each read.
import type { ReadView } from '../../platform/data/rules.ts';
import { idShapeOf, type IdShape } from '../../platform/data/id-shape.ts';
import type { SchemaDescription } from '../../platform/data/schema.ts';
import { tableTableFrom, type TablePage, type TableSummary, type TableTable } from './read-model.ts';

/** What the Table queries read, and all they read. */
export interface TableReader {
  /** The kind of the record with this ID, of any kind, or undefined when no record has it. */
  kindOf(id: string): string | undefined;
  /** The page of a table, or undefined when no table has the ID. */
  page(id: string): TablePage | undefined;
  /** The tables under an entity, a read model or a domain, by ID; none when it has none. */
  tablesUnder(parent: string): TableSummary[];
  /** The highest number in use after the prefix, as in <prefix>07, or 0 when none is. */
  highestAfter(prefix: string): number;
  /** How the IDs of a kind are written, read from the schema: its parents, and the letters and digits its ID ends in. */
  idShape(kind: string): IdShape;
}

/** The reader over the read model's table in memory. */
export class InMemoryTableReader implements TableReader {
  private readonly table: TableTable;
  private readonly schema: SchemaDescription;

  constructor(table: TableTable, schema: SchemaDescription) {
    this.table = table;
    this.schema = schema;
  }

  kindOf(id: string): string | undefined {
    return this.table.kinds.get(id);
  }

  page(id: string): TablePage | undefined {
    const tree = this.table.tables.get(id);
    return tree && { record: { id, kind: 'table' }, ...tree };
  }

  tablesUnder(parent: string): TableSummary[] {
    return this.table.under.get(parent) ?? [];
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

/** The reader the query runner gives each Table query: today's, over the projection's table built from the data. */
export const tableReader = (view: ReadView): TableReader => new InMemoryTableReader(tableTableFrom(view), view.schema);
