// Product window events: what its commands raise, and the reactions (policies) that hear them, called in a fixed
// order at the point the event happens. No event bus: the command calls raise…, which calls each reaction by name.
import type { OpenWindow } from './model.ts';

/** Product window opened (LA-PLT-EV04): the reader opened a product folder, and it opened in a window of its own. */
export interface ProductWindowOpened {
  folder: string;
  window: OpenWindow;
}

/** Product window closed (LA-PLT-EV05): a product window closed, with its place saved for the next time. */
export interface ProductWindowClosed {
  folder: string;
}

/** The reactions to a window opened, in the order they run: its folder first in the recent folders, then its server. */
export interface WindowOpenedReactions {
  onWindowOpenedAddRecentFolder: (event: ProductWindowOpened) => void;
  onWindowOpenedStartAppServer: (event: ProductWindowOpened) => Promise<void>;
}

/** The reactions to a window closed. */
export interface WindowClosedReactions {
  onWindowClosedStopAppServer: (event: ProductWindowClosed) => Promise<void>;
}

export async function raiseProductWindowOpened(event: ProductWindowOpened, reactions: WindowOpenedReactions): Promise<void> {
  reactions.onWindowOpenedAddRecentFolder(event);
  await reactions.onWindowOpenedStartAppServer(event);
}

export function raiseProductWindowClosed(event: ProductWindowClosed, reactions: WindowClosedReactions): Promise<void> {
  return reactions.onWindowClosedStopAppServer(event);
}
