// The Record summaries read model's reader (LA-EXP-RM01-RD): the one way the Record summaries query reaches the read
// model's storage. The query handler depends only on the RecordSummariesReader interface; the query runner injects the
// reader the query's definition makes (`reader`). Today's implementation reads the projection's table, kept in memory
// and built on each read.
import type { ReadView } from '../../platform/data/rules.ts';
import { recordSummariesTableFrom, type RecordSummaries, type RecordSummariesTable } from './read-model.ts';

/** What the Record summaries query reads, and all it reads. */
export interface RecordSummariesReader {
  /** The product's space, or undefined when there is no such product. */
  summariesOf(product: string): RecordSummaries | undefined;
}

/** The reader over the read model's table in memory. */
export class InMemoryRecordSummariesReader implements RecordSummariesReader {
  private readonly table: RecordSummariesTable;

  constructor(table: RecordSummariesTable) {
    this.table = table;
  }

  summariesOf(product: string): RecordSummaries | undefined {
    return this.table.products.get(product);
  }
}

/** The reader the query runner gives the Record summaries query: today's, over the projection's table built from the rows. */
export const recordSummariesReader = (view: ReadView): RecordSummariesReader => new InMemoryRecordSummariesReader(recordSummariesTableFrom(view));
