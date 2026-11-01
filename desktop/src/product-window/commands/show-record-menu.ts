// Show a record's menu (LA-PLT-CMD45): the native menu of a record (open in a new tab, reveal and open its data file
// when it has one, copy its ID), from the record's ID alone (LA-PAT-SHELL-ACTIONS-R01).
import { parseRecordId } from '../../records.ts';
import type { OpenWindow } from '../model.ts';
import type { ProductWindowRepository } from '../repository.ts';

export interface ShowRecordMenu {
  folder: string;
  /** What the page sent: exactly { id }. */
  request: unknown;
}

/** Shows the menu over the window: `popup` gets the record's ID and its data file, if the folder's engine names one (`dataFileOf`). */
export async function showRecordMenu(windows: ProductWindowRepository, input: ShowRecordMenu, dataFileOf: (folder: string, id: string) => Promise<string | null>, popup: (window: OpenWindow, id: string, file: string | null) => void): Promise<void> {
  const id = parseRecordId(input.request);
  if (!id || !windows.load().open.has(input.folder)) return;
  const file = await dataFileOf(input.folder, id);
  // The window may have closed while the engine answered.
  const window = windows.load().open.get(input.folder);
  if (window) popup(window, id, file);
}
