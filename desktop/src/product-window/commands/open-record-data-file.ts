// Open a record's data file in the editor (LA-PLT-CMD43): opens the data file that holds a record in the editor the
// Shell settings name, the file the window's engine names for the record's ID alone (LA-PAT-SHELL-ACTIONS-R01).
import { parseRecordId } from '../../records.ts';
import type { ProductWindowRepository } from '../repository.ts';

export interface OpenRecordDataFile {
  folder: string;
  /** What the page sent: exactly { id }. */
  request: unknown;
}

/** `dataFileOf` asks the folder's engine for the record's data file. */
export async function openRecordDataFile(windows: ProductWindowRepository, input: OpenRecordDataFile, dataFileOf: (folder: string, id: string) => Promise<string | null>, openInEditor: (file: string) => void): Promise<void> {
  const id = parseRecordId(input.request);
  const file = id && windows.load().open.has(input.folder) ? await dataFileOf(input.folder, id) : null;
  if (file) openInEditor(file);
}
