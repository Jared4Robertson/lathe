import { existsSync } from 'node:fs';
import path from 'node:path';
import type { Plugin, ViteDevServer } from 'vite';

type ApiModule = typeof import('../../lathe/src/server/api.ts');
type DataChange = import('../../lathe/src/server/events.ts').DataChange;

/** How long the server waits after a data file's change for the next, so one write's files make one reload. */
const RELOAD_DELAY_MS = 50;

/** How long the server waits after a change to the engine's code or schema for the next, so a merge makes one reload. */
const ENGINE_RELOAD_DELAY_MS = 400;

/** How long a failed engine reload waits before its one retry, for the merge's files to settle. */
const ENGINE_RELOAD_RETRY_MS = 1500;

// Serves Lathe's API (lathe/src/server/api.ts: the spec, writes and history) inside the Vite dev server. The module
// is loaded through Vite, and when the engine's code, schema or manifest changes (an edit, a merge) the server closes
// the old engine's stores and DuckDB instance, imports the engine afresh and tells the pages to read everything again,
// so no restart is needed. Its packages resolve from lathe/node_modules. `root` is the workspace: vite.config.ts passes LATHE_ROOT, or this repo when it is not set, and
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
      const load = <T>(file: string) => server.ssrLoadModule(path.join(engineDir, file)) as Promise<T>;
      // An engine reload in progress: requests wait for it, so none runs on a half-closed engine.
      let reloading: Promise<void> = Promise.resolve();
      const api = async () => {
        await reloading;
        return load<ApiModule>('src/server/api.ts');
      };

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
      let data: string[] = [path.resolve(root, 'data')];
      let unsubscribe: (() => void) | undefined;
      // Hears the engine's data changes and lists the folders to watch for them.
      const attach = async () => {
        try {
          const module = await load<ApiModule>('src/server/api.ts');
          data = module.watchTargets(root);
          unsubscribe = module.onDataChange(root, send);
        } catch {
          data = [path.resolve(root, 'data')];
        }
        // The package's own data (Lathe's checks) is read again as the product's is.
        const engineData = path.join(engineDir, 'data');
        if (existsSync(engineData) && !data.includes(engineData)) data.push(engineData);
        for (const dir of data) server.watcher.add(dir);
      };
      await attach();
      const src = path.join(engineDir, 'src');
      const schema = path.join(engineDir, 'schema');
      const manifest = path.join(engineDir, 'package.json');
      for (const target of [src, schema, manifest]) if (existsSync(target)) server.watcher.add(target);

      // Imports the engine afresh: stops hearing the old module, closes its stores and the shared DuckDB instance (so
      // it is not held twice), drops every loaded module, loads the new engine and tells the open pages to read all.
      const reloadOnce = async () => {
        unsubscribe?.();
        unsubscribe = undefined;
        // Closes every store the old engine opened, not those its config lists for the root: reading the product's
        // config on the old engine fails when a merge has already moved the data to a new schema version.
        const old = await load<ApiModule>('src/server/api.ts').catch(() => undefined);
        await old?.closeStores();
        const store = await load<{ closeEngine(): Promise<void> }>('src/platform/data/store.ts').catch(() => undefined);
        await store?.closeEngine();
        server.moduleGraph.invalidateAll();
        await attach();
        // The fresh engine must accept the product (its schema version is read again with its code), or this reload failed.
        (await load<ApiModule>('src/server/api.ts')).watchTargets(root);
      };
      // A reload that fails (a merge still writing its files) is tried once more after they settle, so the server
      // does not stay broken until it is restarted.
      const reload = async () => {
        for (let attempt = 1; attempt <= 2; attempt += 1) {
          try {
            await reloadOnce();
            server.config.logger.info('Lathe engine changed: reloaded it.', { timestamp: true });
            break;
          } catch (error) {
            server.config.logger.error(`Lathe engine could not be reloaded${attempt === 1 ? ' (trying once more)' : ''}: ${message(error)}`, { timestamp: true });
            if (attempt === 1) await new Promise((resolve) => setTimeout(resolve, ENGINE_RELOAD_RETRY_MS));
          }
        }
        send({ tables: [], readModels: null });
      };

      const inside = (dir: string, file: string) => file === dir || file.startsWith(dir + path.sep);
      const isEngine = (file: string) => inside(schema, file) || file === manifest || (inside(src, file) && !/\.test\.[cm]?tsx?$/.test(file));
      let timer: NodeJS.Timeout | undefined;
      let engineTimer: NodeJS.Timeout | undefined;
      server.watcher.on('all', (_kind: string, changed: string) => {
        if (isEngine(changed)) {
          // A merge touches hundreds of files: one reload follows the last of them.
          clearTimeout(engineTimer);
          engineTimer = setTimeout(() => { reloading = reloading.then(reload); }, ENGINE_RELOAD_DELAY_MS);
          return;
        }
        if (!data.some((dir) => inside(dir, changed))) return;
        clearTimeout(timer);
        timer = setTimeout(() => void api().then((module) => module.dataFilesChanged(root)).catch(() => undefined), RELOAD_DELAY_MS);
      });
    },
  };
}
