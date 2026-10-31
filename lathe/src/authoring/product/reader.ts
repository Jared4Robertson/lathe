// The Product read model's reader (LA-AUT-RM21-RD): the one way the Product queries reach the read model's storage.
// The query handlers depend only on the ProductReader interface; the query runner injects the reader each query's
// definition makes (`reader`), so keeping the read model elsewhere is a new implementation of this interface and
// nothing more. Today's implementation reads the projection's table, kept in memory and built on each read.
import type { ReadView } from '../../platform/data/rules.ts';
import { idShapeOf, type IdShape } from '../../platform/data/id-shape.ts';
import type { SchemaDescription } from '../../platform/data/schema.ts';
import { productTableFrom, type ProductPage, type ProductSummary, type ProductTable } from './read-model.ts';

/** What the Product queries read, and all they read. */
export interface ProductReader {
  /** The kind of the record with this ID, of any kind, or undefined when no record has it. */
  kindOf(id: string): string | undefined;
  /** The product that holds the record (itself, an open question or an interface in it) or declares the product kind of this name. */
  productHolding(id: string): string | undefined;
  /** The product's page, or undefined when there is no such product. */
  page(product: string): ProductPage | undefined;
  /** Every product, as the nav lists it, by ID. */
  products(): ProductSummary[];
  /** The highest number in use after the prefix, as in <prefix>07, or 0 when none is. */
  highestAfter(prefix: string): number;
  /** How the IDs of a kind are written, read from the schema: its parents, and the letters and digits its ID ends in. */
  idShape(kind: string): IdShape;
}

/** The reader over the read model's table in memory. */
export class InMemoryProductReader implements ProductReader {
  private readonly table: ProductTable;
  private readonly schema: SchemaDescription;

  constructor(table: ProductTable, schema: SchemaDescription) {
    this.table = table;
    this.schema = schema;
  }

  kindOf(id: string): string | undefined {
    return this.table.kinds.get(id);
  }

  productHolding(id: string): string | undefined {
    return this.table.holding.get(id);
  }

  page(product: string): ProductPage | undefined {
    return this.table.pages.get(product);
  }

  products(): ProductSummary[] {
    return this.table.summaries;
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

/** The reader the query runner gives each Product query: today's, over the projection's table built from the data. */
export const productReader = (view: ReadView): ProductReader => new InMemoryProductReader(productTableFrom(view), view.schema);
