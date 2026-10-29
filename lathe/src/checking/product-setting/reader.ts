// The Product setting read model's reader (LA-CHK-RM11-RD): the one way the Product setting query reaches the read
// model's storage. The query handler depends only on the LimitsReader interface; the query runner injects the reader
// the query's definition makes (`reader`), so keeping the read model elsewhere is a new implementation of this
// interface and nothing more. Today's implementation reads the projection's table, kept in memory and built on each read.
import type { ReadView } from '../../platform/data/rules.ts';
import { limitsTableFrom, type Limits, type LimitsTable } from './read-model.ts';

/** What the Product setting query reads, and all it reads. */
export interface LimitsReader {
  /** The product's limits, or undefined when there is no such product. */
  limitsOf(product: string): Limits | undefined;
}

/** The reader over the read model's table in memory. */
export class InMemoryLimitsReader implements LimitsReader {
  private readonly table: LimitsTable;

  constructor(table: LimitsTable) {
    this.table = table;
  }

  limitsOf(product: string): Limits | undefined {
    return this.table.limits.get(product);
  }
}

/** The reader the query runner gives the Product setting query: today's, over the projection's table built from the data. */
export const limitsReader = (view: ReadView): LimitsReader => new InMemoryLimitsReader(limitsTableFrom(view));
