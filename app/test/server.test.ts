// @vitest-environment node
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { Readable } from 'node:stream';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { latheApi } from '../server/lathe';
import * as realApi from '../../lathe/src/server/api.ts';
import type { WriteAnswer } from '../../lathe/src/server/contract.ts';
import type { DataChange } from '../../lathe/src/server/events.ts';
import { summariesIn, type RecordSummaries } from '../../lathe/src/exploring/record-summaries/read-model.ts';
import { openStore } from '../../lathe/src/platform/data/index.ts';
import { ALL_COMMANDS } from '../../lathe/src/commands.ts';
import { runCommand } from '../../lathe/src/platform/commands/run.ts';
import { SCHEMA_VERSION } from '../../lathe/src/config.ts';

const engineDir = path.resolve(import.meta.dirname, '../../lathe');

type Middleware = (req: IncomingMessage, res: ServerResponse, next: () => void) => Promise<void>;
type WatchListener = (kind: string, file: string) => void;

/** Just enough of a Vite dev server to run the plugin's configureServer hook. */
function fakeServer(api: (id: string) => Promise<unknown>) {
  const middlewares: Middleware[] = [];
  const listeners: WatchListener[] = [];
  const watched: string[] = [];
  const sent: unknown[] = [];
  const server = {
    middlewares: { use: (m: Middleware) => middlewares.push(m) },
    ssrLoadModule: vi.fn(api),
    watcher: { add: (dir: string) => watched.push(dir), on: (_event: string, l: WatchListener) => listeners.push(l) },
    ws: { send: (payload: unknown) => sent.push(payload) },
    moduleGraph: { invalidateAll: vi.fn() },
    config: { logger: { info: vi.fn(), error: vi.fn() } } };
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
    headers: { host: '127.0.0.1:5300', ...headers } }) as unknown as IncomingMessage;
  const res = {
    statusCode: 200,
    setHeader: (name: string, value: string) => { answer[name.toLowerCase()] = value; },
    end: (chunk?: string | Buffer) => { text = chunk ? chunk.toString() : ''; } } as unknown as ServerResponse;
  await middleware(req, res, () => { nextCalled = true; });
  return { status: res.statusCode, headers: answer, body: text, json: () => JSON.parse(text), nextCalled };
}

async function start(api: (id: string) => Promise<unknown>, root: string) {
  const fake = fakeServer(api);
  const plugin = latheApi(root, engineDir);
  await (plugin.configureServer as (server: unknown) => Promise<void>)(fake.server);
  return fake;
}

/** Sends one aggregate command to its route. */
const post = (middleware: Middleware, route: string, input: unknown, headers: Record<string, string> = {}) =>
  request(middleware, route, { method: 'POST', body: JSON.stringify(input), headers: { 'content-type': 'application/json', ...headers } });

/** The command at a route, as the interfaces register it. */
const commandAt = (route: string) => ALL_COMMANDS.find((c) => c.route === route)!;

/** The product's record summaries, through the plugin. */
const summaries = async (middleware: Middleware) => request(middleware, '/api/record-summaries/list-record-summaries?product_id=EX');

let root = '';

beforeAll(async () => {
  root = await mkdtemp(path.join(tmpdir(), 'lathe-app-'));
  await writeFile(path.join(root, 'lathe.config.json'), `${JSON.stringify({ schema: SCHEMA_VERSION })}\n`);
  const store = await openStore(root);
  await runCommand(store, commandAt('/api/product/add-product'), { id: 'EX', title: 'Example', description: 'A small product for keeping notes.' });
  await runCommand(store, commandAt('/api/domain/add-domain'), { id: 'EX-NOTE', title: 'Notes', product_id: 'EX', subdomain_type: 'core', description: 'Notes a writer keeps.' });
  await runCommand(store, commandAt('/api/domain/add-capability'), { id: 'EX-NOTE-CAP01', title: 'Writing', domain_id: 'EX-NOTE', position: 1, description: 'Writing and keeping notes.' });
  await runCommand(store, commandAt('/api/use-case/add-use-case'), { id: 'EX-NOTE-UC01', title: 'Write a note', capability_id: 'EX-NOTE-CAP01', goal: 'A writer writes a note.' });
  await store.close();
});

afterAll(async () => {
  await realApi.closeStores();
  await rm(root, { recursive: true, force: true });
});

describe('dev API plugin', () => {
  /** One change and one add, sent once and read by the tests below. */
  let firstWrite: Promise<{ fake: Awaited<ReturnType<typeof start>>; changed: Awaited<ReturnType<typeof request>>; added: Awaited<ReturnType<typeof request>> }> | undefined;
  const writeOnce = () =>
    (firstWrite ??= (async () => {
      const fake = await start(async () => realApi, root);
      const changed = await post(fake.middlewares[0], '/api/use-case/change-use-case', { id: 'EX-NOTE-UC01', goal: 'A writer keeps a thought.' });
      const added = await post(fake.middlewares[0], '/api/use-case/add-uc-requirement', { id: 'EX-NOTE-UC01-R01', title: 'The note is saved', use_case_id: 'EX-NOTE-UC01', statement: 'The note MUST be saved.' });
      return { fake, changed, added };
    })());

  it('LA-PLT-UC16-R01-T01 writes through the aggregate\'s commands, each in one write, which the reads then show', async () => {
    const { fake, changed, added } = await writeOnce();
    expect(changed.status).toBe(200);
    expect(added.status).toBe(200);
    expect((changed.json() as Extract<WriteAnswer, { ok: true }>).changes).toContainEqual(expect.objectContaining({ table: 'use_case', key: 'EX-NOTE-UC01' }));
    expect(await readFile(path.join(root, 'data/uc_requirement.jsonl'), 'utf8')).toContain('The note MUST be saved.');
    const read = await summaries(fake.middlewares[0]);
    expect(read.status).toBe(200);
    expect(decodeURIComponent(read.headers['x-lathe-root'])).toBe(root);
    expect(summariesIn(read.json() as RecordSummaries).map((r) => r.id)).toContain('EX-NOTE-UC01-R01');
    // Non-API paths pass through.
    expect((await request(fake.middlewares[0], '/EX')).nextCalled).toBe(true);
  });

  const change = { id: 'EX-NOTE-UC01', goal: 'x' };

  it('LA-PLT-UC16-R02-T01 refuses a write from another site, and one not sent as JSON, before the store sees it', async () => {
    const m = (await start(async () => realApi, root)).middlewares[0];
    expect((await post(m, '/api/use-case/change-use-case', change, { origin: 'https://elsewhere.example' })).status).toBe(403);
    expect((await post(m, '/api/use-case/change-use-case', change, { 'sec-fetch-site': 'cross-site' })).status).toBe(403);
    expect((await post(m, '/api/use-case/change-use-case', change, { origin: 'http://127.0.0.1:5300' })).status).toBe(200);
    expect((await request(m, '/api/use-case/change-use-case', { method: 'POST', body: '{}', headers: { 'content-type': 'text/plain' } })).status).toBe(415);
  });

  it('LA-PLT-UC03-R01-T02 reads the data again when a file changes under it', async () => {
    const fake = await start(async () => realApi, root);
    const file = path.join(root, 'data/use_case.jsonl');
    await writeFile(file, (await readFile(file, 'utf8')).replace('Write a note', 'Write a long note'));
    const data = (await summaries(fake.middlewares[0])).json() as RecordSummaries;
    expect(summariesIn(data).find((r) => r.id === 'EX-NOTE-UC01')?.title).toBe('Write a long note');
    // A file that breaks the schema is an error naming the file and line, until it is fixed.
    const good = await readFile(file, 'utf8');
    await writeFile(file, `${good}{"id":"EX-NOTE-UC02","title":"No domain"}\n`);
    const broken = await summaries(fake.middlewares[0]);
    expect(broken.status).toBe(500);
    expect(broken.json().error).toMatch(/use_case\.jsonl:2/);
    await writeFile(file, good);
    expect((await summaries(fake.middlewares[0])).status).toBe(200);
  });

  it('LA-PLT-UC03-R01-T02 answers 500 with the reason when the engine cannot be loaded', async () => {
    const broken = await start(async () => { throw new Error('Cannot find module @duckdb/node-api'); }, root);
    const spec = await summaries(broken.middlewares[0]);
    expect(spec.status).toBe(500);
    expect(spec.json().error).toBe('The engine could not be loaded: Cannot find module @duckdb/node-api');
    expect((await request(broken.middlewares[0], '/EX')).nextCalled).toBe(true);
  });

  it('LA-PLT-UC03-R01-T01 The server reads a changed data file\'s table again and sends spec:changed naming it and the read models that read it; a change to the package\'s schema changes every read', async () => {
    const product = await mkdtemp(path.join(tmpdir(), 'lathe-app-watch-'));
    try {
      const data = path.join(product, 'data');
      await mkdir(data);
      await writeFile(path.join(product, 'lathe.config.json'), `${JSON.stringify({ schema: SCHEMA_VERSION })}\n`);
      const fake = await start(async () => realApi, product);
      expect(fake.watched).toEqual([data, path.join(engineDir, 'data'), path.join(engineDir, 'src'), path.join(engineDir, 'schema'), path.join(engineDir, 'package.json')]);
      // The product's store is opened by a read; its checks' run is announced once it is ready.
      const m = fake.middlewares[0];
      expect((await request(m, '/api/meta-model/get-meta-model')).status).toBe(200);
      const changes = () => fake.sent as { type: string; event: string; data: DataChange }[];
      await vi.waitFor(() => expect(changes().some((c) => c.data.readModels?.includes('problems'))).toBe(true), { timeout: 10_000 });
      const change = (file: string) => {
        fake.sent.length = 0;
        for (const listener of fake.listeners) listener('change', file);
      };

      await writeFile(path.join(data, 'product.jsonl'), `${JSON.stringify({ id: 'EX', title: 'Example', description: 'A product.' })}\n`);
      change(path.join(data, 'product.jsonl'));
      await vi.waitFor(() => expect(changes().length).toBeGreaterThan(0), { timeout: 10_000 });
      const [first] = changes();
      expect(first).toMatchObject({ type: 'custom', event: 'spec:changed', data: { tables: ['product'] } });
      // The meta model read above reads no product, so it is not named.
      expect(first.data.readModels).toContain('product');
      expect(first.data.readModels).not.toContain('meta-model');

      change(path.join(product, 'data-old', 'x.jsonl'));
      change(path.join(product, 'README.md'));
      await new Promise((resolve) => setTimeout(resolve, 200));
      expect(changes()).toEqual([]);
    } finally {
      await realApi.closeStores(product);
      await rm(product, { recursive: true, force: true });
    }
  });

  it('LA-PLT-UC03-R01-T01 reloads the engine once after a burst of changes to its code, schema or manifest, then tells the pages to read everything', async () => {
    const product = await mkdtemp(path.join(tmpdir(), 'lathe-app-engine-'));
    try {
      await writeFile(path.join(product, 'lathe.config.json'), `${JSON.stringify({ schema: SCHEMA_VERSION })}\n`);
      const loaded: string[] = [];
      const closeEngine = vi.fn(async () => undefined);
      const fake = await start(async (id: string) => { loaded.push(id); return id.endsWith('store.ts') ? { closeEngine } : realApi; }, product);
      const m = fake.middlewares[0];
      const change = (file: string) => { for (const listener of fake.listeners) listener('change', file); };
      fake.sent.length = 0;
      // A merge touches many files; tests and other folders of the package do not reload the engine.
      for (let i = 0; i < 20; i++) change(path.join(engineDir, 'src', 'server', `file${i}.ts`));
      change(path.join(engineDir, 'schema', '005-use-cases.sql'));
      change(path.join(engineDir, 'package.json'));
      change(path.join(engineDir, 'src', 'server', 'api.test.ts'));
      change(path.join(engineDir, 'README.md'));
      expect(fake.sent).toEqual([]);
      // A request during the reload waits for it.
      await new Promise((resolve) => setTimeout(resolve, 450));
      expect((await request(m, '/api/meta-model/get-meta-model')).status).toBe(200);
      await vi.waitFor(() => expect(fake.sent).toEqual([{ type: 'custom', event: 'spec:changed', data: { tables: [], readModels: null } }]));
      expect(closeEngine).toHaveBeenCalledTimes(1);
      expect(fake.server.moduleGraph.invalidateAll).toHaveBeenCalledTimes(1);
      expect(loaded.filter((id) => id.endsWith('store.ts'))).toHaveLength(1);
    } finally {
      await realApi.closeStores(product);
      await rm(product, { recursive: true, force: true });
    }
  });
});
