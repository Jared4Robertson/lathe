// Open a record's data file in the editor (LA-PLT-CMD43): opens the data file that holds a record in the editor the
// Shell settings name, found by the shell from the record's ID alone (LA-PAT-SHELL-ACTIONS-R01).
import { parseRecordId } from '../../records.ts';
import type { ProductWindowRepository } from '../repository.ts';

export interface OpenRecordDataFile {
  folder: string;
  /** What the page sent: exactly { id }. */
  request: unknown;
}

export function openRecordDataFile(windows: ProductWindowRepository, input: OpenRecordDataFile, openInEditor: (file: string) => void): void {
  const id = parseRecordId(input.request);
  const file = id ? windows.load().open.get(input.folder)?.dataFiles?.find(id) : null;
  if (file) openInEditor(file);
}
