// The Value object read model's reader (LA-MOD-RM29-RD): the one way the Value object queries reach the read model's
// storage. The query handlers depend only on the ValueObjectReader interface; the query runner injects the reader each
// query's definition makes (`reader`), so keeping the read model elsewhere is a new implementation of this interface
// and nothing more. Today's implementation reads the projection's table, kept in memory and built on each read.
import type { ReadView } from '../../platform/data/rules.ts';
import { idShapeOf, type IdShape } from '../../platform/data/id-shape.ts';
import type { SchemaDescription } from '../../platform/data/schema.ts';
import { valueObjectTableFrom, type ValueObjectPage, type ValueObjectSummary, type ValueObjectTable } from './read-model.ts';

/** What the Value object queries read, and all they read. */
export interface ValueObjectReader {
  /** The kind of the record with this ID, of any kind, or undefined when no record has it. */
  kindOf(id: string): string | undefined;
  /** The page of a record inside a value object, or undefined when no value object holds it. */
  page(id: string): ValueObjectPage | undefined;
  /** A product's value objects, by ID, or undefined when there is no such product. */
  valueObjectsOf(productId: string): ValueObjectSummary[] | undefined;
  /** The highest number in use after the prefix, as in <prefix>07, or 0 when none is. */
  highestAfter(prefix: string): number;
  /** How the IDs of a kind are written, read from the schema: its parents, and the letters and digits its ID ends in. */
  idShape(kind: string): IdShape;
}

/** The reader over the read model's table in memory. */
export class InMemoryValueObjectReader implements ValueObjectReader {
  private readonly table: ValueObjectTable;
  private readonly schema: SchemaDescription;

  constructor(table: ValueObjectTable, schema: SchemaDescription) {
    this.table = table;
    this.schema = schema;
  }

  kindOf(id: string): string | undefined {
    return this.table.kinds.get(id);
  }

  page(id: string): ValueObjectPage | undefined {
    const holding = this.table.holding.get(id);
    return holding && { record: { id, kind: holding.kind }, ...this.table.valueObjects.get(holding.root)! };
  }

  valueObjectsOf(productId: string): ValueObjectSummary[] | undefined {
    return this.table.products.get(productId);
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

/** The reader the query runner gives each Value object query: today's, over the projection's table built from the data. */
export const valueObjectReader = (view: ReadView): ValueObjectReader => new InMemoryValueObjectReader(valueObjectTableFrom(view), view.schema);
