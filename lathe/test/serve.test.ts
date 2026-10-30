// `lathe serve`, started on a real port. It needs the built web app: this test uses the package's
// dist/app when it exists, and otherwise builds the app into a temporary folder with the app's own
// Vite. It is skipped, with a message, only when the app's packages are not installed (app/node_modules).
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { configuredRoot } from './store/fixture.ts';
import { run } from './helpers.ts';
import { PACKAGE_DIR } from '../src/index.ts';
import type { WriteAnswer } from '../src/server/contract.ts';
import type { DataChange } from '../src/server/events.ts';
import { summariesIn, type RecordSummaries } from '../src/exploring/record-summaries/read-model.ts';
import type { MetaModel } from '../src/platform/meta-model/read-model.ts';
import { openStore, SCHEMA_DIR } from '../src/platform/data/index.ts';
import { APP_DIR, serve, type LatheServer } from '../src/server/serve.ts';

const APP_SOURCE = path.join(PACKAGE_DIR, '..', 'app');
const VITE = path.join(APP_SOURCE, 'node_modules', '.bin', 'vite');
const PORT = 5340;
const BASE = `http://127.0.0.1:${PORT}`;

const prebuilt = existsSync(path.join(APP_DIR, 'index.html'));
const canBuild = existsSync(VITE);
if (!prebuilt && !canBuild) {
  console.warn(
    `Skipping the lathe serve tests: ${APP_DIR} is missing and the app cannot be built because ${APP_SOURCE}/node_modules is not installed. ` +
      'Run `npm --prefix app install` (or `npm --prefix lathe run build`) to run them.',
  );
}

const temps: string[] = [];
let appDir = APP_DIR;
let root = '';
let running: LatheServer | undefined;

beforeAll(async () => {
  if (!prebuilt && !canBuild) return;
  if (!prebuilt) {
    appDir = mkdtempSync(path.join(tmpdir(), 'lathe-app-'));
    temps.push(appDir);
    const build = spawnSync(VITE, ['build', '--outDir', appDir, '--emptyOutDir', '--logLevel', 'error'], { cwd: APP_SOURCE, encoding: 'utf8' });
    if (build.status !== 0) throw new Error(`Building the app failed:\n${build.stderr}`);
  }
  root = configuredRoot('lathe-serve-');
  temps.push(root);
  const store = await openStore(root);
  await run(store, 'product add-product', { id: 'EX', title: 'Example', description: 'A small product for writing notes.' });
  await run(store, 'domain add-domain', { id: 'EX-NOTE', title: 'Notes', product_id: 'EX', subdomain_type: 'core', description: 'Writing and keeping notes.' });
  await run(store, 'domain add-capability', { id: 'EX-NOTE-CAP01', title: 'Writing', domain_id: 'EX-NOTE', position: 1, description: 'Writing notes down.' });
  await run(store, 'use-case add-use-case', { id: 'EX-NOTE-UC01', title: 'Write a note', capability_id: 'EX-NOTE-CAP01', goal: 'A writer keeps a note.' });
  await store.close();
  running = serve({ root, port: PORT, appDir });
  await new Promise<void>((resolve, reject) => {
    running!.server.once('listening', resolve);
    running!.server.once('error', reject);
  });
}, 180_000);

afterAll(async () => {
  await running?.stop();
  for (const dir of temps) rmSync(dir, { recursive: true, force: true });
});

// Reads the event stream until `wanted` appears, or gives up after the timeout.
async function readEvents(response: Response, wanted: string, timeoutMs: number): Promise<string> {
  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let text = '';
  const deadline = Date.now() + timeoutMs;
  try {
    while (!text.includes(wanted) && Date.now() < deadline) {
      const chunk = await Promise.race([
        reader.read(),
        new Promise<{ done: true; value: undefined }>((resolve) => setTimeout(() => resolve({ done: true, value: undefined }), deadline - Date.now())),
      ]);
      if (chunk.done) break;
      text += decoder.decode(chunk.value, { stream: true });
    }
  } finally {
    await reader.cancel().catch(() => {});
  }
  return text;
}

describe.skipIf(!prebuilt && !canBuild)('lathe serve', () => {
  it('LA-PLT-UC02-R04-T01 Serve serves the app, the spec API and change events for the product repo', async () => {
    const page = await fetch(`${BASE}/`);
    expect(page.status).toBe(200);
    expect(page.headers.get('content-type')).toContain('text/html');
    const html = await page.text();
    expect(html).toContain('<div id="root"></div>');
    // Client-side routes load the app too: a record at its bare ID, a group, a tool over the stage and an old address.
    for (const route of ['/EX-NOTE-UC01', '/EX-NOTE/use_case', '/EX-NOTE?page=format/kinds/use_case', '/records/EX-NOTE-UC01']) {
      expect(await (await fetch(`${BASE}${route}`)).text(), route).toBe(html);
    }
    // The page's script is served from the built app, not from source.
    const script = html.match(/src="([^"]+\.js)"/)?.[1];
    expect(script).toBeDefined();
    const js = await fetch(`${BASE}${script}`);
    expect(js.status).toBe(200);
    expect(js.headers.get('content-type')).toContain('javascript');
    // The self-hosted fonts are served as fonts.
    const font = html.match(/href="([^"]+\.woff2)"/)?.[1];
    if (font) expect((await fetch(`${BASE}${font}`)).headers.get('content-type')).toBe('font/woff2');

    // The stages' own reads: the meta model, a product's record summaries, its problems.
    const meta = await fetch(`${BASE}/api/meta-model/get-meta-model`);
    expect(meta.status).toBe(200);
    expect(((await meta.json()) as MetaModel).kinds.some((k) => k.kind === 'use_case')).toBe(true);
    const summaries = async () => summariesIn((await (await fetch(`${BASE}/api/record-summaries/list-record-summaries?product_id=EX`)).json()) as RecordSummaries);
    expect((await summaries()).filter((r) => r.kind === 'use_case').map((r) => r.id)).toEqual(['EX-NOTE-UC01']);
    expect((await fetch(`${BASE}/api/problems/list-problems?product_id=EX`)).status).toBe(200);

    const events = await fetch(`${BASE}/api/events`);
    expect(events.status).toBe(200);
    expect(events.headers.get('content-type')).toBe('text/event-stream');
    const file = path.join(root, 'data/use_case.jsonl');
    setTimeout(() => writeFileSync(file, readFileSync(file, 'utf8').replace('Write a note', 'Write a long note')), 300);
    const text = await readEvents(events, '"tables":["use_case"]', 5000);
    expect(text).toContain(': connected');
    // The change names the table it changed and the read models that read it: the record summaries read use cases,
    // the meta model (read above) does not.
    const change = JSON.parse(/event: spec:changed\ndata: (\{"tables":\["use_case"\].*)\n/.exec(text)![1]) as DataChange;
    expect(change.readModels).toContain('record-summaries');
    expect(change.readModels).not.toContain('meta-model');

    // The next request sees the change: the store reads the files again when they change under it.
    expect((await summaries()).find((r) => r.id === 'EX-NOTE-UC01')?.title).toBe('Write a long note');

    // A command goes through the store and comes back as the rows it changed.
    const written = await fetch(`${BASE}/api/use-case/change-use-case`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id: 'EX-NOTE-UC01', goal: 'A writer keeps a thought.' }),
    });
    expect(written.status).toBe(200);
    const answer = (await written.json()) as WriteAnswer;
    expect(answer).toMatchObject({ ok: true, tables: ['use_case'] });
    expect(readFileSync(file, 'utf8')).toContain('A writer keeps a thought.');
  }, 30_000);

  it('LA-PLT-EP02-R01-T01 GET /api/events opens an uncached event stream that starts connected', async () => {
    const events = await fetch(`${BASE}/api/events`);
    expect(events.status).toBe(200);
    expect(events.headers.get('content-type')).toBe('text/event-stream');
    expect(events.headers.get('cache-control')).toBe('no-cache');
    expect(await readEvents(events, ': connected', 5000)).toMatch(/^: connected\n\n/);
  });

  it('LA-AUT-UC03-R05-T01 The server has no way to change the meta-model', async () => {
    const schemaFiles = readdirSync(SCHEMA_DIR).map((name) => path.join(SCHEMA_DIR, name));
    const before = schemaFiles.map((file) => readFileSync(file, 'utf8'));
    const send = async (method: string, url: string, body = '{"kind":"memo"}') =>
      (await fetch(`${BASE}${url}`, { method, headers: { 'content-type': 'application/json' }, body })).status;
    expect(await send('POST', '/api/meta-model/get-meta-model')).toBe(405);
    expect(await send('PUT', '/api/meta-model/get-meta-model')).toBe(405);
    expect(await send('POST', '/api/meta')).toBe(404);
    expect(await send('PUT', '/api/kinds')).toBe(404);
    // No command names the meta-model, and no route writes any table it is given.
    expect(await send('POST', '/api/write', JSON.stringify({ commands: [{ op: 'add', table: 'meta_kind', row: { name: 'memo', label: 'Memo', obligation: false } }] }))).toBe(404);
    expect(await send('POST', '/api/meta-kind/add-meta-kind')).toBe(404);
    expect(schemaFiles.map((file) => readFileSync(file, 'utf8'))).toEqual(before);
  });
});
