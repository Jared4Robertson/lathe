// What a window loads: Lathe's own server (`serve()` from the built package) for the opened folder,
// or in development the app's Vite dev server (devSource.ts). Each window owns its server and
// stops it when it closes.
import { existsSync } from 'node:fs';
import type { Server } from 'node:http';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { chooseDevSource, httpProbe, SHARED_PORT, startOwnDevServer } from './devSource.ts';

export interface AppServer {
  url: string;
  /** How the window got its app: "serve", "own dev server" or "shared dev server". */
  label: string;
  /** Stops it; resolves once it has stopped, and the process may exit (LA-PLT-UC11-R07). */
  stop: () => Promise<void>;
}

type Serve = (options: { root: string; port: number; host?: string }) => { server: Server; stop: () => Promise<void> };

/** Where the built Lathe package's serve() is: inside the packed app, or in this repo's lathe/dist. */
export function serveModulePath(repoRoot: string, packaged: { resourcesPath: string } | null) {
  const base = packaged ? path.join(packaged.resourcesPath, 'node_modules', '@jaredrob', 'lathe') : path.join(repoRoot, 'lathe');
  return path.join(base, 'dist', 'src', 'server', 'serve.js');
}

/** Starts `serve()` in this process on a free local port (never 5199) for the folder. */
export async function startServe(modulePath: string, folder: string): Promise<AppServer> {
  if (!existsSync(modulePath)) throw new Error(`Lathe is not built (${modulePath} is missing). In the Lathe repo, run: npm --prefix lathe run build`);
  const { serve } = (await import(pathToFileURL(modulePath).href)) as { serve: Serve };
  for (let tries = 0; tries < 5; tries++) {
    const { server, stop } = serve({ root: folder, port: 0 });
    await new Promise<void>((resolve, reject) => {
      server.once('listening', resolve);
      server.once('error', reject);
    });
    const address = server.address();
    const port = typeof address === 'object' && address ? address.port : 0;
    if (port && port !== SHARED_PORT) return { url: `http://127.0.0.1:${port}`, label: 'serve', stop };
    await stop();
  }
  throw new Error('Could not start Lathe on a free local port.');
}

/** In development: the owner's 5199 server when it serves this folder, else a dev server of the shell's own. */
export async function startDev(repoRoot: string, folder: string, log: (line: string) => void): Promise<AppServer> {
  const source = await chooseDevSource(folder, repoRoot, httpProbe);
  if (source.kind === 'shared') return { url: source.url, label: 'shared dev server', stop: async () => {} };
  const own = await startOwnDevServer(repoRoot, folder, log);
  return { ...own, label: 'own dev server' };
}

/**
 * Waits until every stop has settled, or the timeout has passed, so a server that hangs cannot keep the app from
 * quitting. Resolves to whether every stop finished in time.
 */
export async function settleWithin(stops: Promise<unknown>[], timeout: number): Promise<boolean> {
  let timer: NodeJS.Timeout | undefined;
  const late = new Promise<false>((resolve) => (timer = setTimeout(() => resolve(false), timeout)));
  try {
    return await Promise.race([Promise.allSettled(stops).then(() => true), late]);
  } finally {
    clearTimeout(timer);
  }
}
