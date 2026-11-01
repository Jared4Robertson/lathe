// `lathe serve`: serves the built web app and the API for one product repo, with no build tools.
// When a data file changes, the server reads only the changed files' tables again and tells the pages what changed
// through server-sent events (GET /api/events, LA-PLT-EP02-H): each `spec:changed` names the tables and read models it
// changed, so a page reads again only those. Its stop waits for the work in progress and closes the database, so the
// process that ran it exits cleanly (LA-PLT-UC23-R02).
import { existsSync, watch, type FSWatcher } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import path from 'node:path';
import { PACKAGE_DIR } from '../config.ts';
import { closeEngine } from '../platform/data/store.ts';
import { closeStores, dataFilesChanged, handleApi, onDataChange, watchTargets } from './api.ts';
import { DATA_CHANGED, type DataChange } from './events.ts';

/** Where `npm --prefix lathe run build` puts the built web app. */
export const APP_DIR = path.join(PACKAGE_DIR, 'dist', 'app');
const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.json': 'application/json',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  // The app's self-hosted fonts and their license files.
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.txt': 'text/plain; charset=utf-8',
};

async function sendFile(res: ServerResponse, file: string) {
  res.setHeader('content-type', TYPES[path.extname(file)] ?? 'application/octet-stream');
  res.end(await readFile(file));
}

/** How long the server waits after a data file's change for the next, so one write's files make one reload. */
export const RELOAD_DELAY_MS = 50;

export interface ServeOptions {
  root: string;
  port: number;
  host?: string;
  /** The built web app's folder. Defaults to the package's dist/app. */
  appDir?: string;
}

/** A running `serve()`: its HTTP server, and the one way to stop it. */
export interface LatheServer {
  /** The HTTP server; it emits 'listening' once it listens, or 'error'. */
  server: Server;
  /**
   * Stops watching the data, closes every connection and stops taking requests, waits for the requests in progress
   * (a load, a reload or a write), then closes the root's stores and, when no other store is open, the database
   * engine. A process may exit once it resolves. Calling it again returns the same stop.
   */
  stop(): Promise<void>;
}

export function serve({ root, port, host = '127.0.0.1', appDir = APP_DIR }: ServeOptions): LatheServer {
  if (!existsSync(path.join(appDir, 'index.html'))) {
    throw new Error(`The web app is not built (${appDir} is missing). In the Lathe repo, run: npm --prefix lathe run build`);
  }

  const clients = new Set<ServerResponse>();
  const watchers: FSWatcher[] = [];
  // Each change, written to every page as a named event with what changed.
  const unsubscribe = onDataChange(root, (change) => {
    for (const client of clients) client.write(`event: ${DATA_CHANGED}\ndata: ${JSON.stringify(change)}\n\n`);
  });
  // A burst of file events (one write's files, a git pull) is read as one reload, a moment after the last.
  let timer: NodeJS.Timeout | undefined;
  let reloading: Promise<void> = Promise.resolve();
  for (const dir of watchTargets(root)) {
    if (!existsSync(dir)) continue;
    watchers.push(
      watch(dir, () => {
        clearTimeout(timer);
        timer = setTimeout(() => { reloading = reloading.then(() => dataFilesChanged(root)); }, RELOAD_DELAY_MS);
      }),
    );
  }

  // The requests being answered, which a stop waits for.
  const inFlight = new Set<Promise<void>>();
  let stopping: Promise<void> | undefined;

  const server = createServer((req, res) => {
    if (stopping) {
      res.statusCode = 503;
      res.end('Lathe is stopping.');
      return;
    }
    const answering = answer(req, res);
    inFlight.add(answering);
    void answering.finally(() => inFlight.delete(answering));
  });

  async function answer(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const pathname = decodeURIComponent(new URL(req.url ?? '/', 'http://localhost').pathname);
    try {
      if (pathname === '/api/events') {
        res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache', connection: 'keep-alive' });
        // Each page is greeted with an empty change, so it knows the channel is open (and, after a reconnect, that
        // anything may have changed while it was closed).
        res.write(`: connected\n\nevent: ${DATA_CHANGED}\ndata: ${JSON.stringify({ tables: [], readModels: [] } satisfies DataChange)}\n\n`);
        clients.add(res);
        req.on('close', () => clients.delete(res));
        return;
      }
      if (pathname.startsWith('/api/')) {
        if (!(await handleApi(root, req, res, pathname))) {
          res.statusCode = 404;
          res.setHeader('content-type', 'application/json');
          res.end(JSON.stringify({ error: `No API at ${pathname}.` }));
        }
        return;
      }
      // Static files, falling back to index.html so client-side routes such as a record at its ID (/LA-TRC-UC09) or a group (/LA-EXP/use_case) load.
      const file = path.join(appDir, pathname);
      const insideApp = path.relative(appDir, file).startsWith('..') === false;
      if (insideApp && existsSync(file) && (await stat(file)).isFile()) return await sendFile(res, file);
      return await sendFile(res, path.join(appDir, 'index.html'));
    } catch (error) {
      if (res.destroyed) return;
      res.statusCode = 500;
      res.end(error instanceof Error ? error.message : String(error));
    }
  }

  const stop = () =>
    (stopping ??= (async () => {
      for (const watcher of watchers) watcher.close();
      clearTimeout(timer);
      unsubscribe();
      await reloading;
      for (const client of clients) client.end();
      const closed = new Promise<void>((resolve) => server.close(() => resolve()));
      server.closeAllConnections();
      await closed;
      while (inFlight.size) await Promise.allSettled([...inFlight]);
      await closeStores(root);
      await closeEngine();
    })());

  server.listen(port, host);
  return { server, stop };
}
