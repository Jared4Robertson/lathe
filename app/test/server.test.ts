// @vitest-environment node
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { latheApi } from '../server/lathe';

const engineDir = path.resolve(import.meta.dirname, '../../lathe');
const sample = () => readFile(path.join(engineDir, 'fixtures/workspace.sample.json'), 'utf8');

type Middleware = (req: IncomingMessage, res: ServerResponse, next: () => void) => Promise<void>;
type WatchListener = (kind: string, file: string) => void;

/** Just enough of a Vite dev server to run the plugin's configureServer hook. */
function fakeServer(api: () => Promise<unknown>) {
  const middlewares: Middleware[] = [];
  const listeners: WatchListener[] = [];
  const watched: string[] = [];
  const sent: unknown[] = [];
  const server = {
    middlewares: { use: (m: Middleware) => middlewares.push(m) },
    ssrLoadModule: vi.fn(api),
    watcher: { add: (dir: string) => watched.push(dir), on: (_event: string, l: WatchListener) => listeners.push(l) },
    ws: { send: (payload: unknown) => sent.push(payload) },
  };
  return { server, middlewares, listeners, watched, sent };
}

async function request(middleware: Middleware, url: string) {
  const headers: Record<string, string> = {};
  let body = '';
  let nextCalled = false;
  const res = {
    statusCode: 200,
    setHeader: (name: string, value: string) => { headers[name.toLowerCase()] = value; },
    end: (chunk?: string | Buffer) => { body = chunk ? chunk.toString() : ''; },
  } as unknown as ServerResponse;
  await middleware({ url, method: 'GET' } as IncomingMessage, res, () => { nextCalled = true; });
  return { status: res.statusCode, headers, body, nextCalled };
}

async function start(api: () => Promise<unknown>, root = '/repo') {
  const fake = fakeServer(api);
  const plugin = latheApi(root, engineDir);
  await (plugin.configureServer as (server: unknown) => Promise<void>)(fake.server);
  return fake;
}

const engine = (watchTargets: () => unknown[] = () => []) => async () => ({
  handleApi: async (_root: string, _req: IncomingMessage, res: ServerResponse, pathname: string) => {
    if (pathname !== '/api/spec') return false;
    res.setHeader('x-lathe-source', 'engine');
    res.end(JSON.stringify({ from: 'engine' }));
    return true;
  },
  watchTargets,
});

describe('dev API plugin', () => {
  beforeEach(() => { delete process.env.LATHE_SPEC_FIXTURE; });
  afterEach(() => { delete process.env.LATHE_SPEC_FIXTURE; });

  it('LA-BRW-T17 GET /api/spec serves the sample fixture, labeled, when LATHE_SPEC_FIXTURE=1 is set or the engine cannot load', async () => {
    // The engine works: its answer is served.
    const working = await start(engine());
    const fromEngine = await request(working.middlewares[0], '/api/spec');
    expect(fromEngine.headers['x-lathe-source']).toBe('engine');
    expect(JSON.parse(fromEngine.body)).toEqual({ from: 'engine' });

    // LATHE_SPEC_FIXTURE=1: the fixture, with the header and the reason.
    process.env.LATHE_SPEC_FIXTURE = '1';
    const forced = await request(working.middlewares[0], '/api/spec?x=1');
    expect(forced.status).toBe(200);
    expect(forced.headers['x-lathe-source']).toBe('fixture');
    expect(decodeURIComponent(forced.headers['x-lathe-source-reason'])).toBe('LATHE_SPEC_FIXTURE=1 is set');
    expect(forced.body).toBe(await sample());
    delete process.env.LATHE_SPEC_FIXTURE;

    // The engine cannot be loaded: the fixture again, saying why.
    const broken = await start(async () => { throw new Error('Cannot find module @duckdb/node-api'); });
    const fallback = await request(broken.middlewares[0], '/api/spec');
    expect(fallback.status).toBe(200);
    expect(fallback.headers['x-lathe-source']).toBe('fixture');
    expect(decodeURIComponent(fallback.headers['x-lathe-source-reason'])).toBe('the engine could not be loaded: Cannot find module @duckdb/node-api');
    expect(fallback.body).toBe(await sample());

    // Other API paths report the failure; non-API paths pass through.
    const diagrams = await request(broken.middlewares[0], '/api/diagrams');
    expect(diagrams.status).toBe(500);
    expect(JSON.parse(diagrams.body).error).toMatch(/engine could not be loaded/);
    expect((await request(broken.middlewares[0], '/records/LA')).nextCalled).toBe(true);
  });

  it('LA-BRW-T18 The server sends spec:changed when a spec record or the engine\'s checks or meta-model change', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'lathe-app-'));
    try {
      const specs = path.join(root, 'specs');
      const model = path.join(root, 'model');
      await mkdir(specs);
      const fake = await start(engine(() => [{ dir: specs, event: 'spec:changed' }, { dir: model, event: 'model:changed' }]), root);
      expect(fake.watched).toEqual([specs, model, path.join(engineDir, 'checks'), path.join(engineDir, 'meta')]);
      const change = (file: string) => {
        fake.sent.length = 0;
        for (const listener of fake.listeners) listener('change', file);
        return fake.sent;
      };
      const record = path.join(specs, 'lathe', 'browsing', 'domain.md');
      await mkdir(path.dirname(record), { recursive: true });
      await writeFile(record, '---\nid: X\n---\n');
      expect(change(record)).toEqual([{ type: 'custom', event: 'spec:changed' }]);
      expect(change(path.join(engineDir, 'checks', '01-duplicate-id.sql'))).toEqual([{ type: 'custom', event: 'spec:changed' }]);
      expect(change(path.join(engineDir, 'meta', 'kinds.csv'))).toEqual([{ type: 'custom', event: 'spec:changed' }]);
      expect(change(path.join(model, 'people', 'terms.csv'))).toEqual([{ type: 'custom', event: 'model:changed' }]);
      expect(change(path.join(root, 'specs-old', 'x.md'))).toEqual([]);
      expect(change(path.join(root, 'README.md'))).toEqual([]);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
