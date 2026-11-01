// The Stored record facts read model's reader (LA-TRC-RM07-RD): the one way the Stored record facts query reaches the
// read model's storage. The query handler depends only on the StoredRecordFactsReader interface; the query runner
// injects the reader the query's definition makes (`reader`), over the data with the checks' run. Today's
// implementation reads the projection's table, kept in memory and built on each read.
import type { ReadView } from '../../platform/data/rules.ts';
import { storedRecordFactsTableFrom, type StoredRecordFactsTable, type UndefinedPart } from './read-model.ts';

/** What the Stored record facts query reads, and all it reads. */
export interface StoredRecordFactsReader {
  /** The product's parts not defined, by record as the check orders them, or undefined when there is no such product. */
  undefinedOf(product: string): UndefinedPart[] | undefined;
}

/** The reader over the read model's table in memory. */
export class InMemoryStoredRecordFactsReader implements StoredRecordFactsReader {
  private readonly table: StoredRecordFactsTable;

  constructor(table: StoredRecordFactsTable) {
    this.table = table;
  }

  undefinedOf(product: string): UndefinedPart[] | undefined {
    return this.table.products.get(product);
  }
}

/** The reader the query runner gives the Stored record facts query: today's, over the projection's table built from the checks' run. */
export const storedRecordFactsReader = (view: ReadView): StoredRecordFactsReader => new InMemoryStoredRecordFactsReader(storedRecordFactsTableFrom(view));
