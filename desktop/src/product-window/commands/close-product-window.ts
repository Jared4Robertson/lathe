// Close a product window (LA-PLT-CMD11): a closed window leaves the open windows, and the command raises Product
// window closed (LA-PLT-EV05).
import { raiseProductWindowClosed, type WindowClosedReactions } from '../events.ts';
import type { ProductWindowRepository } from '../repository.ts';
import { holdToRules } from '../rules.ts';

export interface CloseProductWindow {
  folder: string;
}

export function closeProductWindow(windows: ProductWindowRepository, input: CloseProductWindow, reactions: WindowClosedReactions): Promise<void> {
  const now = windows.load();
  const open = new Map(now.open);
  open.delete(input.folder);
  const next = { ...now, open };
  holdToRules(next);
  windows.save(next);
  return raiseProductWindowClosed({ folder: input.folder }, reactions);
}
