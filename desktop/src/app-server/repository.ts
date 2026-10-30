// The App server's repository (LA-PLT-REPO05): the running servers and the stops in memory, as a server lives only
// while the shell runs, and each folder's port in app-server-ports.json in the shell's user data folder, read on the
// first load and rewritten when a save changes it. Each load gives a copy of the whole, and each save replaces it.
import { readJson, writeJson } from '../store.ts';
import { parsePorts, type AppServers, type RunningServer } from './model.ts';

export class AppServerRepository {
  private readonly portsFile: () => string;
  private running = new Map<string, RunningServer>();
  private stopping = new Set<Promise<void>>();
  private ports: Record<string, number> | null = null;
  constructor(files: { ports: () => string }) {
    this.portsFile = files.ports;
  }

  load(): AppServers {
    this.ports ??= parsePorts(readJson(this.portsFile()));
    return { running: new Map(this.running), stopping: new Set(this.stopping), ports: { ...this.ports } };
  }

  save(servers: AppServers): void {
    const was = this.ports;
    this.running = new Map(servers.running);
    this.stopping = new Set(servers.stopping);
    this.ports = { ...servers.ports };
    if (JSON.stringify(was) !== JSON.stringify(this.ports)) writeJson(this.portsFile(), this.ports);
  }
}
