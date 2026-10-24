import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import type { ServerResponse } from 'node:http';
import type { Plugin, ViteDevServer } from 'vite';
import type { Workspace } from '../../lathe/src/types';

type Source = 'engine' | 'fixture';

interface Loaded {
  workspace: Workspace;
  source: Source;
  /** Why the fixture is served instead of the engine, when it is. */
  reason?: string;
}

// Loads the workspace from the engine (lathe/src/index.ts) through Vite, so edits to the engine and
// its imports are picked up without a restart. Falls back to the sample fixture when the engine
// can't be loaded, or when LATHE_SPEC_FIXTURE=1 is set.
async function loadSpec(server: ViteDevServer, repoRoot: string): Promise<Loaded> {
  const fixture = async (reason: string): Promise<Loaded> => ({
    workspace: JSON.parse(await readFile(path.join(repoRoot, 'lathe/fixtures/workspace.sample.json'), 'utf8')),
    source: 'fixture',
    reason,
  });
  if (process.env.LATHE_SPEC_FIXTURE === '1') return fixture('LATHE_SPEC_FIXTURE=1 is set');

  const entry = path.join(repoRoot, 'lathe/src/index.ts');
  if (!existsSync(entry)) return fixture('lathe/src/index.ts does not exist yet');
  let engine: { loadWorkspace?: (root: string) => Promise<Workspace> };
  try {
    engine = await server.ssrLoadModule(entry);
  } catch (error) {
    return fixture(`the engine could not be loaded: ${error instanceof Error ? error.message : String(error)}`);
  }
  if (typeof engine.loadWorkspace !== 'function') return fixture('lathe/src/index.ts does not export loadWorkspace');
  // Once the engine loads, its own errors (a broken spec file, say) are real errors, not a reason to hide them.
  return { workspace: await engine.loadWorkspace(repoRoot), source: 'engine' };
}

function send(res: ServerResponse, status: number, body: unknown, headers: Record<string, string> = {}) {
  res.statusCode = status;
  res.setHeader('content-type', 'application/json');
  for (const [name, value] of Object.entries(headers)) res.setHeader(name, value);
  res.end(JSON.stringify(body));
}

// API: GET /api/spec returns the whole Workspace. A fixture response carries the header
// x-lathe-source: fixture (and x-lathe-source-reason). Tells the page to reload whenever a file
// under specs/, examples/ or lathe/ changes.
export function specApi(repoRoot: string): Plugin {
  const watched = ['specs', 'examples', 'lathe'].map((dir) => path.join(repoRoot, dir));
  return {
    name: 'lathe-spec-api',
    configureServer(server) {
      server.middlewares.use('/api/spec', async (req, res, next) => {
        // Leave longer paths such as /api/specs alone.
        const rest = (req.url ?? '/').split('?')[0];
        if (rest !== '/' && rest !== '') return next();
        if (req.method !== 'GET') return send(res, 405, { error: 'Method not allowed' });
        try {
          const { workspace, source, reason } = await loadSpec(server, repoRoot);
          send(res, 200, workspace, {
            'x-lathe-source': source,
            ...(reason ? { 'x-lathe-source-reason': encodeURIComponent(reason) } : {}),
          });
        } catch (error) {
          send(res, 500, { error: error instanceof Error ? error.message : String(error) });
        }
      });
      server.watcher.add(watched);
      server.watcher.on('all', (_event, changed) => {
        if (watched.some((dir) => changed === dir || changed.startsWith(dir + path.sep))) {
          server.ws.send({ type: 'custom', event: 'spec:changed' });
        }
      });
    },
  };
}
