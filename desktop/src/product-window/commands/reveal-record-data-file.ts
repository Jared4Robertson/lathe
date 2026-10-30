// Reveal a record's data file (LA-PLT-CMD42): shows the data file that holds a record in the system's file
// manager, found by the shell among the window's data files from the record's ID alone (LA-PAT-SHELL-ACTIONS-R01).
import { parseRecordId } from '../../records.ts';
import type { ProductWindowRepository } from '../repository.ts';

export interface RevealRecordDataFile {
  folder: string;
  /** What the page sent: exactly { id }. */
  request: unknown;
}

export function revealRecordDataFile(windows: ProductWindowRepository, input: RevealRecordDataFile, reveal: (file: string) => void): void {
  const id = parseRecordId(input.request);
  const file = id ? windows.load().open.get(input.folder)?.dataFiles?.find(id) : null;
  if (file) reveal(file);
}
