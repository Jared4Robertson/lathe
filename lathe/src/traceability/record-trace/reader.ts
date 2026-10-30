// The Record trace read model's reader (LA-TRC-RM06-RD): the one way the Record trace query reaches the read model's
// storage. The query handler depends only on the RecordTraceReader interface; the query runner injects the reader the
// query's definition makes (`reader`), over the data with the checks' run. Today's implementation reads the
// projection's table, kept in memory and worked out per record on each read.
import type { ReadView } from '../../platform/data/rules.ts';
import { recordTraceTableFrom, type RecordTrace, type RecordTraceTable } from './read-model.ts';

/** What the Record trace query reads, and all it reads. */
export interface RecordTraceReader {
  /** The record's trace, or undefined when there is no such record. */
  traceOf(id: string): RecordTrace | undefined;
}

/** The reader over the read model's table in memory. */
export class InMemoryRecordTraceReader implements RecordTraceReader {
  private readonly table: RecordTraceTable;

  constructor(table: RecordTraceTable) {
    this.table = table;
  }

  traceOf(id: string): RecordTrace | undefined {
    return this.table.traceOf(id);
  }
}

/** The reader the query runner gives the Record trace query: today's, over the projection's table. */
export const recordTraceReader = (view: ReadView): RecordTraceReader => new InMemoryRecordTraceReader(recordTraceTableFrom(view));
