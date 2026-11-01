// The Record's data file read model (LA-AUT-RM02): where each record's row is kept, the data file of its product's data
// folder that holds it (<kind>.jsonl), as the desktop app reveals or opens it. The projection is the only code that
// reads the source rows for the query and the only code that writes the read model's table.
import path from 'node:path';
import type { ReadView } from '../../platform/data/rules.ts';

/** A record's data file: the file that holds its row, as a full path. */
export interface RecordDataFile {
  id: string;
  file: string;
}

/** The read model's table, kept in memory: the data folder the rows were read from, and each record's kind by its ID. */
export interface RecordDataFileTable {
  /** The product's data folder; null for data no one folder holds (every product's read as one, a baseline). */
  dataDir: string | null;
  kinds: Map<string, string>;
}

/** The projection: the read model's table, built from the rows on each read (in memory; nothing keeps it). */
export function recordDataFileTableFrom(view: ReadView): RecordDataFileTable {
  const kinds = new Map<string, string>();
  for (const kind of Object.keys(view.schema.kinds)) for (const row of view.rows(kind)) kinds.set(String(row.id), kind);
  return { dataDir: view.dataDir ?? null, kinds };
}

/** A record's data file in the table, or undefined when no record has the ID; the data folder is there when the kind is. */
export function dataFileIn(table: RecordDataFileTable, id: string): RecordDataFile | undefined {
  const kind = table.kinds.get(id);
  return kind === undefined || table.dataDir === null ? undefined : { id, file: path.join(table.dataDir, `${kind}.jsonl`) };
}
