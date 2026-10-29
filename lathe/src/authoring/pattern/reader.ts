// The Pattern read model's reader (LA-AUT-RM22-RD): the one way the Pattern queries reach the read model's storage.
// The query handlers depend only on the PatternReader interface; the query runner injects the reader each query's
// definition makes (`reader`), so keeping the read model elsewhere is a new implementation of this interface and
// nothing more. Today's implementation reads the projection's table, kept in memory and built on each read.
import type { ReadView } from '../../platform/data/rules.ts';
import { patternTableFrom, type PatternPage, type PatternSummary, type PatternTable } from './read-model.ts';

/** What the Pattern queries read, and all they read. */
export interface PatternReader {
  /** The kind of the record with this ID, of any kind, or undefined when no record has it. */
  kindOf(id: string): string | undefined;
  /** The page of a record inside a pattern, or undefined when no pattern holds it. */
  page(id: string): PatternPage | undefined;
  /** A product's patterns, by ID, or undefined when there is no such product. */
  patternsOf(productId: string): PatternSummary[] | undefined;
  /** The highest number in use after the prefix, as in <prefix>07, or 0 when none is. */
  highestAfter(prefix: string): number;
}

/** The reader over the read model's table in memory. */
export class InMemoryPatternReader implements PatternReader {
  private readonly table: PatternTable;

  constructor(table: PatternTable) {
    this.table = table;
  }

  kindOf(id: string): string | undefined {
    return this.table.kinds.get(id);
  }

  page(id: string): PatternPage | undefined {
    const holding = this.table.holding.get(id);
    return holding && { record: { id, kind: holding.kind }, ...this.table.patterns.get(holding.root)! };
  }

  patternsOf(productId: string): PatternSummary[] | undefined {
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

/** The reader the query runner gives each Pattern query: today's, over the projection's table built from the data. */
export const patternReader = (view: ReadView): PatternReader => new InMemoryPatternReader(patternTableFrom(view));
