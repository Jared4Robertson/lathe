// Stop a window's app server (LA-PLT-CMD16): stops the server the shell started for a folder, keeping the stop until
// it settles, so quitting can wait for it.
import type { AppServerRepository } from '../repository.ts';

export interface StopAppServer {
  folder: string;
}

export function stopAppServer(servers: AppServerRepository, input: StopAppServer, log: (line: string) => void): Promise<void> {
  const now = servers.load();
  const running = now.running.get(input.folder);
  if (!running) return Promise.resolve();
  const stop = running.server.stop().catch((error: unknown) => log(`Lathe: a server did not stop cleanly: ${String(error)}`));
  const left = new Map(now.running);
  left.delete(input.folder);
  servers.save({ running: left, stopping: new Set(now.stopping).add(stop) });
  void stop.finally(() => {
    const after = servers.load();
    const stopping = new Set(after.stopping);
    stopping.delete(stop);
    servers.save({ ...after, stopping });
  });
  return stop;
}
