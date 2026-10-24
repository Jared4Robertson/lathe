// Lathe's HTTP API, shared by `lathe serve` and the app's Vite dev server:
//   GET  /api/spec                the whole spec Workspace
//   GET  /api/diagrams            the diagrams
//   POST /api/diagrams            create a diagram {title, description}
//   GET  /api/diagrams/<slug>     one diagram with its check result
import type { IncomingMessage, ServerResponse } from 'node:http';
import { loadConfig } from '../config.ts';
import { loadWorkspace } from '../index.ts';
import { createDiagram, listDiagrams, loadDiagram } from './diagrams.ts';

function send(res: ServerResponse, status: number, body: unknown, headers: Record<string, string> = {}) {
  res.statusCode = status;
  res.setHeader('content-type', 'application/json');
  for (const [name, value] of Object.entries(headers)) res.setHeader(name, value);
  res.end(JSON.stringify(body));
}

async function readBody(req: IncomingMessage): Promise<Record<string, unknown>> {
  let raw = '';
  for await (const chunk of req) raw += chunk;
  return raw ? JSON.parse(raw) : {};
}

/**
 * Handles a request under /api. Returns false when the path is not an API path, so the caller can
 * serve something else. `pathname` is the full path, such as /api/diagrams/people-and-tools.
 */
export async function handleApi(root: string, req: IncomingMessage, res: ServerResponse, pathname: string): Promise<boolean> {
  const config = loadConfig(root);
  try {
    if (pathname === '/api/spec') {
      if (req.method !== 'GET') return (send(res, 405, { error: 'Method not allowed' }), true);
      send(res, 200, await loadWorkspace(config.root), { 'x-lathe-source': 'engine' });
      return true;
    }
    const match = pathname.match(/^\/api\/diagrams(?:\/([^/]*))?\/?$/);
    if (!match) return false;
    const slug = match[1] ?? '';
    if (!slug && req.method === 'GET') return (send(res, 200, await listDiagrams(config.diagramsDir)), true);
    if (!slug && req.method === 'POST') {
      const body = await readBody(req);
      const created = await createDiagram(config.diagramsDir, String(body.title ?? '').trim(), String(body.description ?? '').trim());
      return (send(res, 201, created), true);
    }
    if (slug && req.method === 'GET') {
      if (!/^[a-z0-9-]+$/.test(slug) || !(await listDiagrams(config.diagramsDir)).some((d) => d.slug === slug)) {
        return (send(res, 404, { error: `No diagram called "${slug}".` }), true);
      }
      return (send(res, 200, await loadDiagram(config.diagramsDir, slug)), true);
    }
    send(res, 405, { error: 'Method not allowed' });
  } catch (error) {
    send(res, 400, { error: error instanceof Error ? error.message : String(error) });
  }
  return true;
}

/** The folders whose changes should make open pages reload, and the event each sends. */
export function watchTargets(root: string): { dir: string; event: 'spec:changed' | 'model:changed' }[] {
  const config = loadConfig(root);
  // A product's own checks and meta-model extensions change what the spec pages show, as its records do.
  const extras = [config.checksDir, ...config.metaDirs.slice(1)].filter((dir): dir is string => Boolean(dir));
  return [
    { dir: config.specsDir, event: 'spec:changed' },
    ...extras.map((dir) => ({ dir, event: 'spec:changed' as const })),
    { dir: config.diagramsDir, event: 'model:changed' },
  ];
}
