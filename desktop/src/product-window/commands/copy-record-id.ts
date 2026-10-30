// Copy a record's ID (LA-PLT-CMD44): puts a record's ID on the clipboard, when the page names one of the window's
// records' IDs in the record ID format (LA-PAT-SHELL-ACTIONS-R01).
import { parseRecordId } from '../../records.ts';
import type { ProductWindowRepository } from '../repository.ts';

export interface CopyRecordId {
  folder: string;
  /** What the page sent: exactly { id }. */
  request: unknown;
}

export function copyRecordId(windows: ProductWindowRepository, input: CopyRecordId, copy: (text: string) => void): void {
  const id = parseRecordId(input.request);
  if (id && windows.load().open.has(input.folder)) copy(id);
}
