// The App server aggregate (LA-PLT-A7): its repository keeps the servers in memory, its commands and policies go
// through it, and its rule refuses a server of the shell's own on 5199.
import { createServer, type Server } from 'node:net';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { startAppServer } from '../src/app-server/commands/start-app-server.ts';
import { stopAppServer } from '../src/app-server/commands/stop-app-server.ts';
import { onWindowClosedStopAppServer, onWindowOpenedStartAppServer } from '../src/app-server/policies.ts';
import { AppServerRepository } from '../src/app-server/repository.ts';
import { appServerProblems } from '../src/app-server/rules.ts';
import { freePort, SHARED_PORT } from '../src/devSource.ts';
import type { OpenWindow } from '../src/product-window/model.ts';
import type { AppServer } from '../src/servers.ts';

const window = (folder: string, extra: Partial<OpenWindow> = {}): OpenWindow =>
  ({ folder, product: path.basename(folder), win: { id: folder } as unknown as OpenWindow['win'], errors: 0, dataFiles: null, launchRun: 0, key: folder, chatSent: null, ...extra });
const server = (url: string, label = 'serve'): AppServer => ({ url, label, stop: vi.fn(async () => {}) });

describe('LA-PLT-INV06-T A server the shell starts never listens on 5199: the App server\'s repository keeps the servers in memory', () => {
  it('starts a folder\'s server once, and stops it, keeping the stop until it settles', async () => {
    const servers = new AppServerRepository();
    const start = vi.fn(async () => ({ server: server('http://127.0.0.1:6001'), lathe: 'bundled Lathe 1.0.0' }));
    const first = await startAppServer(servers, { folder: '/p/a', start });
    expect(await startAppServer(servers, { folder: '/p/a', start })).toBe(first);
    expect(start).toHaveBeenCalledTimes(1);
    const stop = stopAppServer(servers, { folder: '/p/a' }, () => {});
    expect(servers.load().running.size).toBe(0);
    expect(servers.load().stopping.size).toBe(1);
    await stop;
    await Promise.resolve();
    expect(first.server.stop).toHaveBeenCalled();
    expect(servers.load().stopping.size).toBe(0);
  });

  it('refuses a server it started on 5199, and stops it; the shared dev server may be there', async () => {
    const servers = new AppServerRepository();
    const own = server('http://127.0.0.1:5199');
    await expect(startAppServer(servers, { folder: '/p/a', start: async () => ({ server: own, lathe: 'x' }) })).rejects.toThrow('listens on 5199');
    expect(own.stop).toHaveBeenCalled();
    expect(appServerProblems({ running: new Map([['/p/b', { server: server('http://localhost:5199', 'shared dev server'), lathe: 'x' }]]), stopping: new Set() })).toEqual([]);
  });

  it('LA-PLT-PO01-T LA-PLT-PO02-T when a window opens its server starts, and when it closes its server stops', async () => {
    const servers = new AppServerRepository();
    const serveWindow = vi.fn(async () => {});
    await onWindowOpenedStartAppServer({ folder: '/p/a', window: window('/p/a') }, serveWindow);
    expect(serveWindow).toHaveBeenCalledWith('/p/a');
    const running = await startAppServer(servers, { folder: '/p/a', start: async () => ({ server: server('http://127.0.0.1:6002'), lathe: 'x' }) });
    await onWindowClosedStopAppServer({ folder: '/p/a' }, servers, () => {});
    expect(running.server.stop).toHaveBeenCalled();
  });
});

describe('LA-PLT-INV06-T A server of the shell\'s own gets a free port, never 5199', () => {
  it('LA-PLT-INV06-T never picks port 5199 for a server of its own', async () => {
    expect(SHARED_PORT).toBe(5199);
    const port = await freePort();
    expect(port).toBeGreaterThan(0);
    expect(port).not.toBe(5199);
  });

  it('LA-PLT-INV06-T skips a port it is told to avoid', async () => {
    const taken: Server = createServer();
    await new Promise<void>((resolve) => taken.listen(0, '127.0.0.1', resolve));
    const address = taken.address();
    const busy = typeof address === 'object' && address ? address.port : 0;
    const port = await freePort([5199, busy]);
    expect([5199, busy]).not.toContain(port);
    taken.close();
  });
});
