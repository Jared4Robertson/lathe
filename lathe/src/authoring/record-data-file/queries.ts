// The Record's data file read (LA-AUT-RM02): the data file that holds a record's row, answered from the read model
// through its reader (reader.ts), so the desktop app finds a record's file by asking the engine that loaded it. Its
// handler never sees the data and changes nothing. This slice holds only the read, so it names its read model where an
// aggregate's slice names its aggregate.
import { id, type AnyQuery, type QueryDefinition } from '../../platform/commands/definition.ts';
import { FIND_RECORD_DATA_FILE_IDENTITY } from './queries.generated.ts';
import { StoreError } from '../../platform/data/problems.ts';
import type { RecordDataFile } from './read-model.ts';
import { recordDataFileReader, type RecordDataFileReader } from './reader.ts';

/** The data file that holds the record's row, as a full path; refused when no record has the ID. */
export function findRecordDataFile(reader: RecordDataFileReader, input: { id: string }): RecordDataFile {
  if (!reader.inOneFolder()) throw new StoreError([{ rule: 'data-folder', message: `${input.id} is read from no one product's data folder` }]);
  const found = reader.dataFileOf(input.id);
  if (!found) throw new StoreError([{ rule: 'missing', message: `no record has the ID ${input.id}` }]);
  return found;
}

export const FIND_RECORD_DATA_FILE: QueryDefinition<{ id: string }, RecordDataFile, RecordDataFileReader> = {
  ...FIND_RECORD_DATA_FILE_IDENTITY,
  input: { id: id('The record.', 'required') },
  reader: recordDataFileReader,
  run: findRecordDataFile,
  text: (found) => found.file,
};

/** The Record's data file read's queries, as the CLI and the MCP server register them. */
export const RECORD_DATA_FILE_QUERIES: readonly AnyQuery[] = [FIND_RECORD_DATA_FILE];
