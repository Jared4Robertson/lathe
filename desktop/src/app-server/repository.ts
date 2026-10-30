// The App server's repository (LA-PLT-REPO05): in memory, as a server lives only while the shell runs. Each load
// gives a copy of the whole, and each save replaces it.
import type { AppServers, RunningServer } from './model.ts';

export class AppServerRepository {
  private running = new Map<string, RunningServer>();
  private stopping = new Set<Promise<void>>();

  load(): AppServers {
    return { running: new Map(this.running), stopping: new Set(this.stopping) };
  }

  save(servers: AppServers): void {
    this.running = new Map(servers.running);
    this.stopping = new Set(servers.stopping);
  }
}
