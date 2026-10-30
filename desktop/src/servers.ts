// What a window loads: Lathe's own server (`serve()` from the built package) for the opened folder, from the
// product's own installed Lathe when it has one and the app's bundled copy otherwise, or in development the app's
// Vite dev server (devSource.ts). The App server aggregate (app-server/) keeps each window's server, and stops it
// when the window closes.
import { existsSync, readFileSync } from 'node:fs';
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

/** The Lathe a product opens with: its serve() module, whether it is the product's own or the app's, and its version. */
export interface LatheChoice {
  modulePath: string;
  source: 'product' | 'bundled';
  version: string | null;
}

/** The version in the package.json of the Lathe package whose serve() module this is, or null. */
export function packageVersion(modulePath: string): string | null {
  try {
    const pkg = JSON.parse(readFileSync(path.resolve(path.dirname(modulePath), '..', '..', '..', 'package.json'), 'utf8')) as { version?: unknown };
    return typeof pkg.version === 'string' ? pkg.version : null;
  } catch {
    return null;
  }
}

/**
 * The Lathe a product folder opens with: the product's own installed Lathe (node_modules/@jaredrob/lathe, built) when
 * it has one, so the app reads its data with the Lathe it was written for; else the app's bundled copy.
 */
export function latheFor(folder: string, bundled: string): LatheChoice {
  const own = path.join(folder, 'node_modules', '@jaredrob', 'lathe', 'dist', 'src', 'server', 'serve.js');
  const modulePath = existsSync(own) ? own : bundled;
  return { modulePath, source: modulePath === own ? 'product' : 'bundled', version: packageVersion(modulePath) };
}

/** Which Lathe a window runs, as its About window says it: "its own Lathe 1.2.0" or "bundled Lathe 1.0.0". */
export function latheLabel(choice: LatheChoice): string {
  const version = choice.version ? ` ${choice.version}` : '';
  return choice.source === 'product' ? `its own Lathe${version}` : `bundled Lathe${version}`;
}

/**
 * Starts `serve()` in this process for the folder on a local port, never 5199: the port it had last time when that is
 * free (`port`, so the page keeps its origin and with it its local storage), else a free one.
 */
export async function startServe(modulePath: string, folder: string, port?: number): Promise<AppServer> {
  if (!existsSync(modulePath)) throw new Error(`Lathe is not built (${modulePath} is missing). In the Lathe repo, run: npm --prefix lathe run build`);
  const { serve } = (await import(pathToFileURL(modulePath).href)) as { serve: Serve };
  for (let tries = 0; tries < 5; tries++) {
    const wanted = tries === 0 && port && port !== SHARED_PORT ? port : 0;
    const { server, stop } = serve({ root: folder, port: wanted });
    const listening = await new Promise<boolean>((resolve) => {
      server.once('listening', () => resolve(true));
      // The port it had last time is taken now (another app took it): try a free one, and the origin changes.
      server.once('error', () => resolve(false));
    });
    if (!listening) { await stop().catch(() => {}); continue; }
    const address = server.address();
    const got = typeof address === 'object' && address ? address.port : 0;
    if (got && got !== SHARED_PORT) return { url: `http://127.0.0.1:${got}`, label: 'serve', stop };
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
