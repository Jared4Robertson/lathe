// Reveal a record's data file (LA-PLT-CMD42): shows the data file that holds a record in the system's file
// manager, the file the window's engine names for the record's ID alone (LA-PAT-SHELL-ACTIONS-R01).
import { parseRecordId } from '../../records.ts';
import type { ProductWindowRepository } from '../repository.ts';

export interface RevealRecordDataFile {
  folder: string;
  /** What the page sent: exactly { id }. */
  request: unknown;
}

/** `dataFileOf` asks the folder's engine for the record's data file. */
export async function revealRecordDataFile(windows: ProductWindowRepository, input: RevealRecordDataFile, dataFileOf: (folder: string, id: string) => Promise<string | null>, reveal: (file: string) => void): Promise<void> {
  const id = parseRecordId(input.request);
  const file = id && windows.load().open.has(input.folder) ? await dataFileOf(input.folder, id) : null;
  if (file) reveal(file);
}
