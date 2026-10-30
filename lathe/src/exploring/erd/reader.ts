// The ERD read model's reader (LA-EXP-RM04-RD): the one way the ERD query reaches the read model's
// storage. The query handler depends only on the ErdReader interface; the query runner injects the reader the
// query's definition makes (`reader`). Today's implementation reads the projection's table, kept in memory and built
// on each read.
import type { ReadView } from '../../platform/data/rules.ts';
import { erdTableFrom, type ErdMap, type ErdTable } from './read-model.ts';

/** What the ERD query reads, and all it reads. */
export interface ErdReader {
  /** The product's map, or undefined when there is no such product. */
  mapOf(product: string): ErdMap | undefined;
}

/** The reader over the read model's table in memory. */
export class InMemoryErdReader implements ErdReader {
  private readonly table: ErdTable;

  constructor(table: ErdTable) {
    this.table = table;
  }

  mapOf(product: string): ErdMap | undefined {
    return this.table.products.get(product);
  }
}

/** The reader the query runner gives the ERD query: today's, over the projection's table built from the rows. */
export const erdReader = (view: ReadView): ErdReader => new InMemoryErdReader(erdTableFrom(view));
