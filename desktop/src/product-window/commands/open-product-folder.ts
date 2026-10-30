// Open a product folder (LA-PLT-CMD10): a folder that checks opens in a window of its own, one per folder, and the
// command raises Product window opened (LA-PLT-EV04) once the window is open.
import { raiseProductWindowOpened, type WindowOpenedReactions } from '../events.ts';
import type { OpenWindow } from '../model.ts';
import type { ProductWindowRepository } from '../repository.ts';
import { holdToRules } from '../rules.ts';

export interface OpenProductFolder {
  /** The window just made for the folder (main.ts makes the BrowserWindow). */
  window: OpenWindow;
}

export async function openProductFolder(windows: ProductWindowRepository, input: OpenProductFolder, reactions: WindowOpenedReactions): Promise<void> {
  const now = windows.load();
  const { folder } = input.window;
  if (now.open.has(folder)) throw new Error(`${folder} already has a window.`);
  const next = { ...now, open: new Map(now.open).set(folder, input.window) };
  holdToRules(next);
  windows.save(next);
  await raiseProductWindowOpened({ folder, window: input.window }, reactions);
}
