// @vitest-environment node
import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { Readable } from 'node:stream';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { latheApi } from '../server/lathe';
import * as realApi from '../../lathe/src/server/api.ts';
import type { SpecData, WriteAnswer } from '../../lathe/src/server/contract.ts';
import { openStore } from '../../lathe/src/store/index.ts';

const engineDir = path.resolve(import.meta.dirname, '../../lathe');

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

interface Sent { method?: string; body?: string; headers?: Record<string, string> }

async function request(middleware: Middleware, url: string, { method = 'GET', body, headers = {} }: Sent = {}) {
  const answer: Record<string, string> = {};
  let text = '';
  let nextCalled = false;
  const req = Object.assign(Readable.from(body === undefined ? [] : [Buffer.from(body)]), {
    url,
    method,
    headers: { host: '127.0.0.1:5300', ...headers },
  }) as unknown as IncomingMessage;
  const res = {
    statusCode: 200,
    setHeader: (name: string, value: string) => { answer[name.toLowerCase()] = value; },
    end: (chunk?: string | Buffer) => { text = chunk ? chunk.toString() : ''; },
  } as unknown as ServerResponse;
  await middleware(req, res, () => { nextCalled = true; });
  return { status: res.statusCode, headers: answer, body: text, json: () => JSON.parse(text), nextCalled };
}

async function start(api: () => Promise<unknown>, root: string) {
  const fake = fakeServer(api);
  const plugin = latheApi(root, engineDir);
  await (plugin.configureServer as (server: unknown) => Promise<void>)(fake.server);
  return fake;
}

const post = (middleware: Middleware, commands: unknown, headers: Record<string, string> = {}) =>
  request(middleware, '/api/write', { method: 'POST', body: JSON.stringify({ commands }), headers: { 'content-type': 'application/json', ...headers } });

let root = '';

beforeAll(async () => {
  root = await mkdtemp(path.join(tmpdir(), 'lathe-app-'));
  const store = await openStore(root);
  await store.apply([
    { op: 'add', table: 'product', row: { id: 'EX', title: 'Example' } },
    { op: 'add', table: 'domain', row: { id: 'EX-NOTE', title: 'Notes', product_id: 'EX' } },
    { op: 'add', table: 'use_case', row: { id: 'EX-NOTE-UC01', title: 'Write a note', domain_id: 'EX-NOTE' } },
  ]);
  await store.close();
});

afterAll(async () => {
  await realApi.closeStores();
  await rm(root, { recursive: true, force: true });
});

describe('dev API plugin', () => {
  it('serves the typed data from the data folder, with the schema, and the folder it reads', async () => {
    const fake = await start(async () => realApi, root);
    const spec = await request(fake.middlewares[0], '/api/spec');
    expect(spec.status).toBe(200);
    expect(decodeURIComponent(spec.headers['x-lathe-root'])).toBe(root);
    const data = spec.json() as SpecData;
    expect(data.dataDir).toBe('data');
    expect(data.tables.product).toEqual([{ id: 'EX', title: 'Example' }]);
    expect(data.tables.use_case.map((r) => r.id)).toEqual(['EX-NOTE-UC01']);
    expect(data.tables.requirement).toBeUndefined();
    expect(data.schema.kinds.use_case.parents.map((p) => p.kind)).toEqual(['capability', 'domain']);
    expect(Array.isArray(data.problems) && Array.isArray(data.coverage)).toBe(true);
    // Non-API paths pass through.
    expect((await request(fake.middlewares[0], '/EX')).nextCalled).toBe(true);
  });

  it('writes through the store and answers with the rows it changed', async () => {
    const fake = await start(async () => realApi, root);
    const written = await post(fake.middlewares[0], [
      { op: 'set', table: 'use_case', key: 'EX-NOTE-UC01', changes: { goal: 'A writer keeps a thought.' } },
      { op: 'add', table: 'requirement', row: { id: 'EX-NOTE-UC01-R01', title: 'The note is saved', use_case_id: 'EX-NOTE-UC01', statement: 'The note MUST be saved.' } },
    ]);
    expect(written.status).toBe(200);
    const answer = written.json() as Extract<WriteAnswer, { ok: true }>;
    expect(answer.ok).toBe(true);
    expect([...answer.tables].sort()).toEqual(['requirement', 'use_case']);
    expect(answer.changes).toContainEqual({
      table: 'use_case',
      key: 'EX-NOTE-UC01',
      before: { id: 'EX-NOTE-UC01', title: 'Write a note', domain_id: 'EX-NOTE' },
      after: { id: 'EX-NOTE-UC01', title: 'Write a note', domain_id: 'EX-NOTE', goal: 'A writer keeps a thought.' },
    });
    expect(answer.changes).toContainEqual(expect.objectContaining({ table: 'requirement', key: 'EX-NOTE-UC01-R01', before: null }));
    expect(await readFile(path.join(root, 'data/requirement.jsonl'), 'utf8')).toContain('The note MUST be saved.');
    const data = (await request(fake.middlewares[0], '/api/spec')).json() as SpecData;
    expect(data.tables.requirement.map((r) => r.id)).toEqual(['EX-NOTE-UC01-R01']);
  });

  it('answers a refused write with every reason and changes nothing', async () => {
    const fake = await start(async () => realApi, root);
    const before = await readFile(path.join(root, 'data/use_case.jsonl'), 'utf8');
    const refused = await post(fake.middlewares[0], [
      { op: 'set', table: 'use_case', key: 'EX-NOTE-UC01', changes: { goal: 'Changed' } },
      { op: 'add', table: 'requirement', row: { id: 'EX-NOTE-UC09-R01', title: 'Orphan', use_case_id: 'EX-NOTE-UC09', statement: 'It MUST fail.' } },
    ]);
    expect(refused.status).toBe(422);
    const answer = refused.json() as Extract<WriteAnswer, { ok: false }>;
    expect(answer.ok).toBe(false);
    expect(answer.problems.length).toBeGreaterThan(0);
    expect(answer.error).toMatch(/EX-NOTE-UC09/);
    expect(await readFile(path.join(root, 'data/use_case.jsonl'), 'utf8')).toBe(before);
  });

  it('refuses a write from another site, one not sent as JSON, and one that is not a list of commands', async () => {
    const fake = await start(async () => realApi, root);
    const m = fake.middlewares[0];
    const set = [{ op: 'set', table: 'use_case', key: 'EX-NOTE-UC01', changes: { goal: 'x' } }];
    expect((await post(m, set, { origin: 'https://elsewhere.example' })).status).toBe(403);
    expect((await post(m, set, { 'sec-fetch-site': 'cross-site' })).status).toBe(403);
    expect((await post(m, set, { origin: 'http://127.0.0.1:5300' })).status).toBe(200);
    expect((await request(m, '/api/write', { method: 'POST', body: '{}', headers: { 'content-type': 'text/plain' } })).status).toBe(415);
    expect((await request(m, '/api/write', { method: 'POST', body: '{not json', headers: { 'content-type': 'application/json' } })).status).toBe(400);
    expect((await post(m, [])).status).toBe(400);
    expect((await post(m, [{ op: 'drop', table: 'use_case' }])).status).toBe(400);
    expect((await post(m, [{ op: 'add', table: 'use_case' }])).status).toBe(400);
    expect((await request(m, '/api/write')).status).toBe(405);
    const big = await request(m, '/api/write', { method: 'POST', body: `{"commands":[],"pad":"${'x'.repeat(1024 * 1024)}"}`, headers: { 'content-type': 'application/json' } });
    expect(big.status).toBe(413);
  });

  it('reads the data again when a file changes under it', async () => {
    const fake = await start(async () => realApi, root);
    const file = path.join(root, 'data/use_case.jsonl');
    await writeFile(file, (await readFile(file, 'utf8')).replace('Write a note', 'Write a long note'));
    const data = (await request(fake.middlewares[0], '/api/spec')).json() as SpecData;
    expect(data.tables.use_case[0].title).toBe('Write a long note');
    // A file that breaks the schema is an error naming the file and line, until it is fixed.
    const good = await readFile(file, 'utf8');
    await writeFile(file, `${good}{"id":"EX-NOTE-UC02","title":"No domain"}\n`);
    const broken = await request(fake.middlewares[0], '/api/spec');
    expect(broken.status).toBe(500);
    expect(broken.json().error).toMatch(/use_case\.jsonl:2/);
    await writeFile(file, good);
    expect((await request(fake.middlewares[0], '/api/spec')).status).toBe(200);
  });

  it('answers 500 with the reason when the engine cannot be loaded', async () => {
    const broken = await start(async () => { throw new Error('Cannot find module @duckdb/node-api'); }, root);
    const spec = await request(broken.middlewares[0], '/api/spec');
    expect(spec.status).toBe(500);
    expect(spec.json().error).toBe('The engine could not be loaded: Cannot find module @duckdb/node-api');
    expect((await request(broken.middlewares[0], '/EX')).nextCalled).toBe(true);
  });

  it('LA-PLT-T12 The server sends spec:changed when a data file, or the package\'s schema or checks, change', async () => {
    const product = await mkdtemp(path.join(tmpdir(), 'lathe-app-watch-'));
    try {
      const data = path.join(product, 'data');
      await mkdir(data);
      const fake = await start(async () => realApi, product);
      const engineFolders = ['schema', 'data', 'checks'].map((d) => path.join(engineDir, d)).filter((d) => existsSync(d));
      expect(fake.watched).toEqual([data, ...engineFolders]);
      const change = (file: string) => {
        fake.sent.length = 0;
        for (const listener of fake.listeners) listener('change', file);
        return fake.sent;
      };
      expect(change(path.join(data, 'requirement.jsonl'))).toEqual([{ type: 'custom', event: 'spec:changed' }]);
      expect(change(path.join(engineDir, 'schema', '005-use-cases.sql'))).toEqual([{ type: 'custom', event: 'spec:changed' }]);
      expect(change(path.join(product, 'data-old', 'x.jsonl'))).toEqual([]);
      expect(change(path.join(product, 'README.md'))).toEqual([]);
    } finally {
      await rm(product, { recursive: true, force: true });
    }
  });
});
