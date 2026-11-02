// The Read model read model's reader (LA-MOD-RM30-RD): the one way the Read model queries reach the read model's
// storage. The query handlers depend only on the ReadModelReader interface; the query runner injects the reader each
// query's definition makes (`reader`), so keeping the read model elsewhere is a new implementation of this interface
// and nothing more. Today's implementation reads the projection's table, kept in memory and built on each read.
import type { ReadView } from '../../platform/data/rules.ts';
import { idShapeOf, type IdShape } from '../../platform/data/id-shape.ts';
import type { SchemaDescription } from '../../platform/data/schema.ts';
import { readModelTableFrom, type ReadModelPage, type ReadModelSummary, type ReadModelTable } from './read-model.ts';

/** What the Read model queries read, and all they read. */
export interface ReadModelReader {
  /** The kind of the record with this ID, of any kind, or undefined when no record has it. */
  kindOf(id: string): string | undefined;
  /** The page of a record inside a read model, or undefined when no read model holds it. */
  page(id: string): ReadModelPage | undefined;
  /** A domain's read models, by ID, or undefined when there is no such domain. */
  readModelsOf(domainId: string): ReadModelSummary[] | undefined;
  /** The highest number in use after the prefix, as in <prefix>07, or 0 when none is. */
  highestAfter(prefix: string): number;
  /** How the IDs of a kind are written, read from the schema: its parents, and the letters and digits its ID ends in. */
  idShape(kind: string): IdShape;
}

/** The reader over the read model's table in memory. */
export class InMemoryReadModelReader implements ReadModelReader {
  private readonly table: ReadModelTable;
  private readonly schema: SchemaDescription;

  constructor(table: ReadModelTable, schema: SchemaDescription) {
    this.table = table;
    this.schema = schema;
  }

  kindOf(id: string): string | undefined {
    return this.table.kinds.get(id);
  }

  page(id: string): ReadModelPage | undefined {
    const holding = this.table.holding.get(id);
    return holding && { record: { id, kind: holding.kind }, ...this.table.readModels.get(holding.root)! };
  }

  readModelsOf(domainId: string): ReadModelSummary[] | undefined {
    return this.table.domains.get(domainId);
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

/** The reader the query runner gives each Read model query: today's, over the projection's table built from the data. */
export const readModelReader = (view: ReadView): ReadModelReader => new InMemoryReadModelReader(readModelTableFrom(view), view.schema);
