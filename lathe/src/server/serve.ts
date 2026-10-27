// `lathe serve`: serves the built web app and the API for one product repo, with no build tools.
// Pages reload through server-sent events (GET /api/events) when the data files change.
import { existsSync, watch, type FSWatcher } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import { createServer, type ServerResponse } from 'node:http';
import path from 'node:path';
import { PACKAGE_DIR } from '../config.ts';
import { closeStores, handleApi, watchTargets } from './api.ts';

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

export interface ServeOptions {
  root: string;
  port: number;
  host?: string;
  /** The built web app's folder. Defaults to the package's dist/app. */
  appDir?: string;
}

export function serve({ root, port, host = '127.0.0.1', appDir = APP_DIR }: ServeOptions) {
  if (!existsSync(path.join(appDir, 'index.html'))) {
    throw new Error(`The web app is not built (${appDir} is missing). In the Lathe repo, run: npm --prefix lathe run build`);
  }

  const clients = new Set<ServerResponse>();
  const watchers: FSWatcher[] = [];
  for (const { dir, event } of watchTargets(root)) {
    if (!existsSync(dir)) continue;
    let timer: NodeJS.Timeout | undefined;
    watchers.push(
      watch(dir, { recursive: true }, () => {
        clearTimeout(timer);
        timer = setTimeout(() => {
          for (const client of clients) client.write(`data: ${event}\n\n`);
        }, 150);
      }),
    );
  }

  const server = createServer(async (req, res) => {
    const pathname = decodeURIComponent(new URL(req.url ?? '/', 'http://localhost').pathname);
    try {
      if (pathname === '/api/events') {
        res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache', connection: 'keep-alive' });
        res.write(': connected\n\n');
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
      res.statusCode = 500;
      res.end(error instanceof Error ? error.message : String(error));
    }
  });

  server.on('close', () => { watchers.forEach((w) => w.close()); void closeStores(root); });
  server.listen(port, host);
  return server;
}
