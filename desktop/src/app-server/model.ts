// App server (LA-PLT-A7): what each window loads Lathe from, by folder, while the shell runs (servers.ts starts
// them), the stops in progress, closed windows' too, which quitting waits for, and the port each folder's server last
// listened on, kept across launches: the page's origin is http://127.0.0.1:<port>, and the browser keeps a page's local
// storage (the person's theme, key bindings, panels, scroll to zoom) by origin, so the same port keeps them.
import { SHARED_PORT } from '../devSource.ts';
import type { AppServer } from '../servers.ts';

/** A window's server, and which Lathe it runs, as About says it: the product's own, the bundled copy, or the source. */
export interface RunningServer {
  server: AppServer;
  lathe: string;
}

export interface AppServers {
  /** The running servers, by folder. */
  running: ReadonlyMap<string, RunningServer>;
  /** The stops not yet settled. */
  stopping: ReadonlySet<Promise<void>>;
  /** The port each folder's server last listened on, by folder, so it listens there again on the next launch. */
  ports: Readonly<Record<string, number>>;
}

/** A usable port of the shell's own: a whole number from 1024 to 65535, never the shared dev server's 5199. */
export const isOwnPort = (port: unknown): port is number => typeof port === 'number' && Number.isInteger(port) && port >= 1024 && port <= 65535 && port !== SHARED_PORT;

/** Reads the kept ports, dropping anything that is not a folder's usable port. */
export function parsePorts(raw: unknown): Record<string, number> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  return Object.fromEntries(Object.entries(raw as Record<string, unknown>).filter((e): e is [string, number] => isOwnPort(e[1])));
}

/** The port a server listens on, from its URL; none when the URL names none. */
export const portOf = (url: string): number | undefined => {
  const port = Number(new URL(url).port);
  return port > 0 ? port : undefined;
};
