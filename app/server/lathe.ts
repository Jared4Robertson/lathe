import { existsSync } from 'node:fs';
import path from 'node:path';
import type { Plugin, ViteDevServer } from 'vite';

type ApiModule = typeof import('../../lathe/src/server/api.ts');
type DataChange = import('../../lathe/src/server/events.ts').DataChange;

/** How long the server waits after a data file's change for the next, so one write's files make one reload. */
const RELOAD_DELAY_MS = 50;

// Serves Lathe's API (lathe/src/server/api.ts: the spec, writes and history) inside the Vite dev server. The module
// is loaded through Vite, so edits to the engine are picked up without a restart, and its packages resolve from
// lathe/node_modules. `root` is the workspace: vite.config.ts passes LATHE_ROOT, or this repo when it is not set, and
// the API serves its product and each other product its lathe.config.json lists. When any of their data files change,
// or the package's own data (Lathe's checks), the API reads only the changed tables again and the pages hear
// spec:changed with what changed (LA-PLT-EV06); a change to the package's schema changes every read.
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

      const send = (change: DataChange) => server.ws.send({ type: 'custom', event: 'spec:changed', data: change });
      let data: string[];
      try {
        const module = await api();
        data = module.watchTargets(root);
        module.onDataChange(root, send);
      } catch {
        data = [path.resolve(root, 'data')];
      }
      // The package's own data (Lathe's checks) is read again as the product's is; its schema changes every read.
      const engineData = path.join(engineDir, 'data');
      if (existsSync(engineData) && !data.includes(engineData)) data.push(engineData);
      const schema = path.join(engineDir, 'schema');
      const watched = existsSync(schema) ? [...data, schema] : data;
      for (const dir of watched) server.watcher.add(dir);
      const inside = (dir: string, file: string) => file === dir || file.startsWith(dir + path.sep);
      let timer: NodeJS.Timeout | undefined;
      server.watcher.on('all', (_kind: string, changed: string) => {
        if (inside(schema, changed)) return send({ tables: [], readModels: null });
        if (!data.some((dir) => inside(dir, changed))) return;
        clearTimeout(timer);
        timer = setTimeout(() => void api().then((module) => module.dataFilesChanged(root)).catch(() => undefined), RELOAD_DELAY_MS);
      });
    },
  };
}
