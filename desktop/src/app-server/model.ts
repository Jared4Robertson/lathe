// App server (LA-PLT-A7): what each window loads Lathe from, by folder, while the shell runs (servers.ts starts
// them), and the stops in progress, closed windows' too, which quitting waits for.
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
}
