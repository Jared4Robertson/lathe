// Lathe's HTTP API, shared by `lathe serve` and the app's Vite dev server:
//   GET  /api/spec                the whole spec Workspace, from the product's data/ folder
//   GET  /api/reference           the reference (Reference): kinds, tables, relations, folders, checks
//   GET  /api/history?id=<ID>     the git history of a record's row (&skip=<n> for older commits)
//   GET  /api/history?id=<ID>&commit=<hash>   that commit's change of the row ("working": the uncommitted change)
import type { IncomingMessage, ServerResponse } from 'node:http';
import { loadConfig } from '../config.ts';
import { buildReference, loadWorkspace } from '../index.ts';
import { LATHE_DATA_DIR } from '../store/store.ts';
import { COMMIT_PATTERN, recordDiff, recordHistory } from './history.ts';

function send(res: ServerResponse, status: number, body: unknown, headers: Record<string, string> = {}) {
  res.statusCode = status;
  res.setHeader('content-type', 'application/json');
  for (const [name, value] of Object.entries(headers)) res.setHeader(name, value);
  res.end(JSON.stringify(body));
}

/**
 * Handles a request under /api. Returns false when the path is not an API path, so the caller can
 * serve something else. `pathname` is the full path, such as /api/spec.
 */
export async function handleApi(root: string, req: IncomingMessage, res: ServerResponse, pathname: string): Promise<boolean> {
  const config = loadConfig(root);
  try {
    if (pathname === '/api/spec') {
      if (req.method !== 'GET') return (send(res, 405, { error: 'Method not allowed' }), true);
      send(res, 200, await loadWorkspace(config.root), { 'x-lathe-source': 'engine' });
      return true;
    }
    if (pathname === '/api/reference') {
      if (req.method !== 'GET') return (send(res, 405, { error: 'Method not allowed' }), true);
      send(res, 200, await buildReference(config.root), { 'x-lathe-source': 'engine' });
      return true;
    }
    if (pathname === '/api/history') {
      if (req.method !== 'GET') return (send(res, 405, { error: 'Method not allowed' }), true);
      const query = new URL(req.url ?? '/', 'http://localhost').searchParams;
      const id = (query.get('id') ?? '').trim();
      const commit = query.get('commit');
      const skip = Number(query.get('skip') ?? '0');
      if (!id) return (send(res, 400, { error: 'Give a record ID: /api/history?id=<ID>.' }), true);
      if (commit !== null && !COMMIT_PATTERN.test(commit)) return (send(res, 400, { error: 'A commit is a hex hash, or "working".' }), true);
      if (!Number.isInteger(skip) || skip < 0) return (send(res, 400, { error: 'skip is a whole number.' }), true);
      const answer = commit === null ? await recordHistory(config.root, id, skip) : await recordDiff(config.root, id, commit);
      const status = answer.state === 'no-record' || answer.state === 'no-commit' ? 404 : 200;
      return (send(res, status, answer, { 'cache-control': 'no-store' }), true);
    }
    return false;
  } catch (error) {
    send(res, 400, { error: error instanceof Error ? error.message : String(error) });
  }
  return true;
}

/** The folders whose changes should make open pages reload, and the event each sends: the product's data and Lathe's. */
export function watchTargets(root: string): { dir: string; event: 'spec:changed' }[] {
  const config = loadConfig(root);
  return [...new Set([config.dataDir, LATHE_DATA_DIR])].map((dir) => ({ dir, event: 'spec:changed' as const }));
}
