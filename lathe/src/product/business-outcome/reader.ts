// The Business outcome read model's reader (LA-PRD-RM36-RD): the one way the Business outcome queries reach the read model's storage.
// The query handlers depend only on the BusinessOutcomeReader interface; the query runner injects the reader each query's
// definition makes (`reader`), so keeping the read model elsewhere is a new implementation of this interface and
// nothing more. Today's implementation reads the projection's table, kept in memory and built on each read.
import type { ReadView } from '../../platform/data/rules.ts';
import { idShapeOf, type IdShape } from '../../platform/data/id-shape.ts';
import type { SchemaDescription } from '../../platform/data/schema.ts';
import { businessOutcomeTableFrom, type BusinessOutcomePage, type BusinessOutcomeSummary, type BusinessOutcomeTable } from './read-model.ts';

/** What the Business outcome queries read, and all they read. */
export interface BusinessOutcomeReader {
  /** The kind of the record with this ID, of any kind, or undefined when no record has it. */
  kindOf(id: string): string | undefined;
  /** The page of the record with this ID, or undefined when there is none. */
  page(id: string): BusinessOutcomePage | undefined;
  /** The records under the product, by ID. */
  list(product: string): BusinessOutcomeSummary[];
  /** The highest number in use after the prefix, as in <prefix>07, or 0 when none is. */
  highestAfter(prefix: string): number;
  /** How the IDs of a kind are written, read from the schema: its parents, and the letters and digits its ID ends in. */
  idShape(kind: string): IdShape;
}

/** The reader over the read model's table in memory. */
export class InMemoryBusinessOutcomeReader implements BusinessOutcomeReader {
  private readonly table: BusinessOutcomeTable;
  private readonly schema: SchemaDescription;

  constructor(table: BusinessOutcomeTable, schema: SchemaDescription) {
    this.table = table;
    this.schema = schema;
  }

  kindOf(id: string): string | undefined {
    return this.table.kinds.get(id);
  }

  page(id: string): BusinessOutcomePage | undefined {
    return this.table.pages.get(id);
  }

  list(product: string): BusinessOutcomeSummary[] {
    return this.table.lists.get(product) ?? [];
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

/** The reader the query runner gives each Business outcome query: today's, over the projection's table built from the data. */
export const businessOutcomeReader = (view: ReadView): BusinessOutcomeReader => new InMemoryBusinessOutcomeReader(businessOutcomeTableFrom(view), view.schema);
