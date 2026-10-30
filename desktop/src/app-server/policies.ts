// The App server's policies: when a window opens, start its server (LA-PLT-PO01); when it closes, stop it (LA-PLT-PO02).
import type { ProductWindowClosed, ProductWindowOpened } from '../product-window/events.ts';
import { stopAppServer } from './commands/stop-app-server.ts';
import type { AppServerRepository } from './repository.ts';

/** Runs Start a window's app server for the window, and loads its page under the launch view (main.ts's serveWindow). */
export function onWindowOpenedStartAppServer(event: ProductWindowOpened, serveWindow: (folder: string) => Promise<void>): Promise<void> {
  return serveWindow(event.folder);
}

export function onWindowClosedStopAppServer(event: ProductWindowClosed, servers: AppServerRepository, log: (line: string) => void): Promise<void> {
  return stopAppServer(servers, { folder: event.folder }, log);
}
