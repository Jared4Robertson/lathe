// The Record changes read model's reader (LA-EXP-RM07-RD): the one way the Record changes query reaches the read
// model's storage. The query handler depends only on the RecordChangesReader interface; the query runner injects the
// reader the query's definition makes (`reader`), over the data now with the baseline read for the query's `since`.
// Today's implementation reads the projection's table, kept in memory and built on each read.
import type { ReadView } from '../../platform/data/rules.ts';
import { recordChangesTableFrom, type BaselineView, type ProductChanges, type RecordChangesTable } from './read-model.ts';

/** What the Record changes query reads, and all it reads. */
export interface RecordChangesReader {
  /** The product's changes, or undefined when there is no such product. */
  changesOf(product: string): ProductChanges | undefined;
}

/** The reader over the read model's table in memory. */
export class InMemoryRecordChangesReader implements RecordChangesReader {
  private readonly table: RecordChangesTable;

  constructor(table: RecordChangesTable) {
    this.table = table;
  }

  changesOf(product: string): ProductChanges | undefined {
    return this.table.products.get(product);
  }
}

/** The reader the query runner gives the Record changes query: today's, over the projection's table. */
export const recordChangesReader = (view: ReadView): RecordChangesReader => new InMemoryRecordChangesReader(recordChangesTableFrom(view as BaselineView));
