import { readFile } from 'node:fs/promises';
import path from 'node:path';
import type { Plugin } from 'vite';

type ApiModule = typeof import('../../lathe/src/server/api.ts');

// Serves Lathe's API (lathe/src/server/api.ts) inside the Vite dev server. The module is loaded
// through Vite, so edits to the engine are picked up without a restart, and its packages resolve
// from lathe/node_modules. LATHE_SPEC_FIXTURE=1 serves the sample workspace for /api/spec.
// Sends spec:changed or model:changed when the product's specs or diagrams change.
export function latheApi(root: string): Plugin {
  const engineDir = path.resolve(import.meta.dirname, '../../lathe');
  return {
    name: 'lathe-api',
    async configureServer(server) {
      const api = () => server.ssrLoadModule(path.join(engineDir, 'src/server/api.ts')) as Promise<ApiModule>;

      server.middlewares.use(async (req, res, next) => {
        const pathname = decodeURIComponent((req.url ?? '/').split('?')[0]);
        if (!pathname.startsWith('/api/')) return next();
        if (pathname === '/api/spec' && process.env.LATHE_SPEC_FIXTURE === '1') {
          res.setHeader('content-type', 'application/json');
          res.setHeader('x-lathe-source', 'fixture');
          res.setHeader('x-lathe-source-reason', encodeURIComponent('LATHE_SPEC_FIXTURE=1 is set'));
          res.end(await readFile(path.join(engineDir, 'fixtures/workspace.sample.json')));
          return;
        }
        try {
          if (!(await (await api()).handleApi(root, req, res, pathname))) next();
        } catch (error) {
          res.statusCode = 500;
          res.setHeader('content-type', 'application/json');
          res.end(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }));
        }
      });

      for (const { dir, event } of (await api()).watchTargets(root)) {
        server.watcher.add(dir);
        server.watcher.on('all', (_kind, changed) => {
          if (changed === dir || changed.startsWith(dir + path.sep)) server.ws.send({ type: 'custom', event });
        });
      }
    },
  };
}
