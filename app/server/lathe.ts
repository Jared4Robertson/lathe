import { existsSync } from 'node:fs';
import path from 'node:path';
import type { Plugin, ViteDevServer } from 'vite';

type ApiModule = typeof import('../../lathe/src/server/api.ts');
type Watched = { dir: string; event: 'spec:changed' };

// Serves Lathe's API (lathe/src/server/api.ts: the spec, writes and history) inside the Vite dev server. The module
// is loaded through Vite, so edits to the engine are picked up without a restart, and its packages resolve from
// lathe/node_modules. `root` is the product folder: vite.config.ts passes LATHE_ROOT, or this repo when it is not set.
// Sends spec:changed when the product's data files change, or the package's own data (Lathe's checks) or schema.
export function latheApi(root: string, engineDir = path.resolve(import.meta.dirname, '../../lathe')): Plugin {
  const message = (error: unknown) => (error instanceof Error ? error.message : String(error));
  const fail = (res: import('node:http').ServerResponse, error: string) => {
    res.statusCode = 500;
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify({ error }));
  };

  return {
    name: 'lathe-api',
    async configureServer(server: ViteDevServer) {
      const api = () => server.ssrLoadModule(path.join(engineDir, 'src/server/api.ts')) as Promise<ApiModule>;

      server.middlewares.use(async (req, res, next) => {
        const pathname = decodeURIComponent((req.url ?? '/').split('?')[0]);
        if (!pathname.startsWith('/api/')) return next();
        // The product folder this server reads, so the desktop shell shares it only for that folder.
        res.setHeader('x-lathe-root', encodeURIComponent(root));
        let module: ApiModule;
        try {
          module = await api();
        } catch (error) {
          return fail(res, `The engine could not be loaded: ${message(error)}`);
        }
        try {
          if (!(await module.handleApi(root, req, res, pathname))) next();
        } catch (error) {
          fail(res, message(error));
        }
      });

      let watched: Watched[];
      try {
        watched = (await api()).watchTargets(root);
      } catch {
        watched = [{ dir: path.resolve(root, 'data'), event: 'spec:changed' }];
      }
      // The package's own data (Lathe's checks) and its schema decide what the pages show, as the product's data does.
      for (const dir of ['data', 'schema']) {
        const full = path.join(engineDir, dir);
        if (existsSync(full) && !watched.some((w) => w.dir === full)) watched.push({ dir: full, event: 'spec:changed' });
      }
      for (const { dir } of watched) server.watcher.add(dir);
      server.watcher.on('all', (_kind: string, changed: string) => {
        const events = new Set(watched.filter(({ dir }) => changed === dir || changed.startsWith(dir + path.sep)).map((w) => w.event));
        for (const event of events) server.ws.send({ type: 'custom', event });
      });
    },
  };
}
