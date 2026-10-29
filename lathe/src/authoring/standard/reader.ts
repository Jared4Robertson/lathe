// The Standard read model's reader (LA-AUT-RM23-RD): the one way the Standard queries reach the read model's storage.
// The query handlers depend only on the StandardReader interface; the query runner injects the reader each query's
// definition makes (`reader`), so keeping the read model elsewhere is a new implementation of this interface and
// nothing more. Today's implementation reads the projection's table, kept in memory and built on each read.
import type { ReadView } from '../../platform/data/rules.ts';
import { standardTableFrom, type StandardPage, type StandardSummary, type StandardTable } from './read-model.ts';

/** What the Standard queries read, and all they read. */
export interface StandardReader {
  /** The kind of the record with this ID, of any kind, or undefined when no record has it. */
  kindOf(id: string): string | undefined;
  /** The page of a record inside a standard, or undefined when no standard holds it. */
  page(id: string): StandardPage | undefined;
  /** A product's standards, by ID, or undefined when there is no such product. */
  standardsOf(productId: string): StandardSummary[] | undefined;
  /** The highest number in use after the prefix, as in <prefix>07, or 0 when none is. */
  highestAfter(prefix: string): number;
}

/** The reader over the read model's table in memory. */
export class InMemoryStandardReader implements StandardReader {
  private readonly table: StandardTable;

  constructor(table: StandardTable) {
    this.table = table;
  }

  kindOf(id: string): string | undefined {
    return this.table.kinds.get(id);
  }

  page(id: string): StandardPage | undefined {
    const holding = this.table.holding.get(id);
    return holding && { record: { id, kind: holding.kind }, ...this.table.standards.get(holding.root)! };
  }

  standardsOf(productId: string): StandardSummary[] | undefined {
    return this.table.products.get(productId);
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

/** The reader the query runner gives each Standard query: today's, over the projection's table built from the data. */
export const standardReader = (view: ReadView): StandardReader => new InMemoryStandardReader(standardTableFrom(view));
