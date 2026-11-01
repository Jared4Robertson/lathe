// The Record's data file read model's reader (LA-AUT-RM02-RD): the one way its query reaches the read model's storage.
// The query handler depends only on the RecordDataFileReader interface; the query runner injects the reader the query's
// definition makes (`reader`). Today's implementation reads the projection's table, kept in memory.
import type { ReadView } from '../../platform/data/rules.ts';
import { dataFileIn, recordDataFileTableFrom, type RecordDataFile, type RecordDataFileTable } from './read-model.ts';

/** What the Record's data file query reads, and all it reads. */
export interface RecordDataFileReader {
  /** Whether the data was read from one product's data folder. */
  inOneFolder(): boolean;
  /** The record's data file, or undefined when no record has the ID. */
  dataFileOf(id: string): RecordDataFile | undefined;
}

/** The reader over the read model's table in memory. */
export class InMemoryRecordDataFileReader implements RecordDataFileReader {
  private readonly table: RecordDataFileTable;

  constructor(table: RecordDataFileTable) {
    this.table = table;
  }

  inOneFolder(): boolean {
    return this.table.dataDir !== null;
  }

  dataFileOf(id: string): RecordDataFile | undefined {
    return dataFileIn(this.table, id);
  }
}

/** The reader the query runner gives the Record's data file query: today's, over the projection's table built from the rows. */
export const recordDataFileReader = (view: ReadView): RecordDataFileReader => new InMemoryRecordDataFileReader(recordDataFileTableFrom(view));
