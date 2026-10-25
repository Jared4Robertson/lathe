import { readFile } from 'node:fs/promises';
import type { ServerResponse } from 'node:http';
import path from 'node:path';
import type { Plugin, ViteDevServer } from 'vite';

type ApiModule = typeof import('../../lathe/src/server/api.ts');
type Watched = { dir: string; event: 'spec:changed' | 'model:changed' };

// Serves Lathe's API (lathe/src/server/api.ts) inside the Vite dev server. The module is loaded
// through Vite, so edits to the engine are picked up without a restart, and its packages resolve
// from lathe/node_modules. GET /api/spec serves the sample workspace, with `x-lathe-source: fixture`,
// when LATHE_SPEC_FIXTURE=1 is set or the engine cannot be loaded.
// `root` is the product folder: vite.config.ts passes LATHE_ROOT, or this repo when it is not set.
// Sends spec:changed or model:changed when the product's specs or diagrams, or the engine's checks
// and meta-model, change.
export function latheApi(root: string, engineDir = path.resolve(import.meta.dirname, '../../lathe')): Plugin {
  const sendFixture = async (res: ServerResponse, reason: string) => {
    res.statusCode = 200;
    res.setHeader('content-type', 'application/json');
    res.setHeader('x-lathe-source', 'fixture');
    res.setHeader('x-lathe-source-reason', encodeURIComponent(reason));
    res.end(await readFile(path.join(engineDir, 'fixtures/workspace.sample.json')));
  };
  const message = (error: unknown) => (error instanceof Error ? error.message : String(error));

  return {
    name: 'lathe-api',
    async configureServer(server: ViteDevServer) {
      const api = () => server.ssrLoadModule(path.join(engineDir, 'src/server/api.ts')) as Promise<ApiModule>;

      server.middlewares.use(async (req, res, next) => {
        const pathname = decodeURIComponent((req.url ?? '/').split('?')[0]);
        if (!pathname.startsWith('/api/')) return next();
        // The product folder this server reads, so the desktop shell shares it only for that folder.
        res.setHeader('x-lathe-root', encodeURIComponent(root));
        if (pathname === '/api/spec' && process.env.LATHE_SPEC_FIXTURE === '1') {
          return sendFixture(res, 'LATHE_SPEC_FIXTURE=1 is set');
        }
        let module: ApiModule;
        try {
          module = await api();
        } catch (error) {
          if (pathname === '/api/spec') return sendFixture(res, `the engine could not be loaded: ${message(error)}`);
          res.statusCode = 500;
          res.setHeader('content-type', 'application/json');
          res.end(JSON.stringify({ error: `The engine could not be loaded: ${message(error)}` }));
          return;
        }
        try {
          if (!(await module.handleApi(root, req, res, pathname))) next();
        } catch (error) {
          res.statusCode = 500;
          res.setHeader('content-type', 'application/json');
          res.end(JSON.stringify({ error: message(error) }));
        }
      });

      let watched: Watched[];
      try {
        watched = (await api()).watchTargets(root);
      } catch {
        watched = [
          { dir: path.resolve(root, 'specs'), event: 'spec:changed' },
          { dir: path.resolve(root, 'model'), event: 'model:changed' },
        ];
      }
      // The engine's checks and meta-model decide the problems and coverage a spec page shows.
      watched.push({ dir: path.join(engineDir, 'checks'), event: 'spec:changed' }, { dir: path.join(engineDir, 'meta'), event: 'spec:changed' });
      for (const { dir } of watched) server.watcher.add(dir);
      server.watcher.on('all', (_kind: string, changed: string) => {
        const events = new Set(watched.filter(({ dir }) => changed === dir || changed.startsWith(dir + path.sep)).map((w) => w.event));
        for (const event of events) server.ws.send({ type: 'custom', event });
      });
    },
  };
}
