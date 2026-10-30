// Start a window's app server (LA-PLT-CMD15): starts the server a folder's window loads Lathe from, when it has none,
// on the port it listened on last time when that is free, and keeps the port it got for the next launch.
import { isOwnPort, portOf, type RunningServer } from '../model.ts';
import type { AppServerRepository } from '../repository.ts';
import { holdToRules } from '../rules.ts';

export interface StartAppServer {
  folder: string;
  /** Starts it: serve() on the product's own or the bundled Lathe, or in development a dev server (servers.ts), on the port given when it is free. */
  start: (port: number | undefined) => Promise<RunningServer>;
}

/** The folder's server: the one it has, or one just started. */
export async function startAppServer(servers: AppServerRepository, input: StartAppServer): Promise<RunningServer> {
  const had = servers.load().running.get(input.folder);
  if (had) return had;
  const started = await input.start(servers.load().ports[input.folder]);
  const now = servers.load();
  const port = portOf(started.server.url);
  const ports = started.server.label === 'serve' && isOwnPort(port) ? { ...now.ports, [input.folder]: port } : now.ports;
  const next = { ...now, running: new Map(now.running).set(input.folder, started), ports };
  try {
    holdToRules(next);
  } catch (error) {
    await started.server.stop();
    throw error;
  }
  servers.save(next);
  return started;
}
