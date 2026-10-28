// `lathe serve`, started on a real port. It needs the built web app: this test uses the package's
// dist/app when it exists, and otherwise builds the app into a temporary folder with the app's own
// Vite. It is skipped, with a message, only when the app's packages are not installed (app/node_modules).
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PACKAGE_DIR } from '../src/index.ts';
import type { SpecData, WriteAnswer } from '../src/server/contract.ts';
import { openStore, SCHEMA_DIR } from '../src/store/index.ts';
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
  root = mkdtempSync(path.join(tmpdir(), 'lathe-serve-'));
  temps.push(root);
  const store = await openStore(root);
  await store.apply([
    { op: 'add', table: 'product', row: { id: 'EX', title: 'Example' } },
    { op: 'add', table: 'domain', row: { id: 'EX-NOTE', title: 'Notes', product_id: 'EX', subdomain_type: 'core' } },
    { op: 'add', table: 'capability', row: { id: 'EX-NOTE-CAP01', title: 'Writing', domain_id: 'EX-NOTE', position: 1 } },
    { op: 'add', table: 'use_case', row: { id: 'EX-NOTE-UC01', title: 'Write a note', capability_id: 'EX-NOTE-CAP01' } },
  ]);
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
    // Client-side routes load the app too: a record at its bare ID, a group, an app page and an old address.
    for (const route of ['/EX-NOTE-UC01', '/EX-NOTE/use_case', '/format/kinds/use_case', '/records/EX-NOTE-UC01']) {
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

    const spec = await fetch(`${BASE}/api/spec`);
    expect(spec.status).toBe(200);
    const data = (await spec.json()) as SpecData;
    expect(data.dataDir).toBe('data');
    expect(data.tables.use_case.map((r) => r.id)).toEqual(['EX-NOTE-UC01']);
    expect(data.schema.tables.use_case.role).toBe('kind');
    expect(Array.isArray(data.problems)).toBe(true);

    const events = await fetch(`${BASE}/api/events`);
    expect(events.status).toBe(200);
    expect(events.headers.get('content-type')).toBe('text/event-stream');
    const file = path.join(root, 'data/use_case.jsonl');
    setTimeout(() => writeFileSync(file, readFileSync(file, 'utf8').replace('Write a note', 'Write a long note')), 300);
    const text = await readEvents(events, 'data: spec:changed', 5000);
    expect(text).toContain(': connected');
    expect(text).toContain('data: spec:changed');

    // The next request sees the change: the store reads the files again when they change under it.
    const reloaded = (await (await fetch(`${BASE}/api/spec`)).json()) as SpecData;
    expect(reloaded.tables.use_case[0].title).toBe('Write a long note');

    // A write goes through the store and comes back as the rows it changed.
    const written = await fetch(`${BASE}/api/write`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ commands: [{ op: 'set', table: 'use_case', key: 'EX-NOTE-UC01', changes: { goal: 'A writer keeps a thought.' } }] }),
    });
    expect(written.status).toBe(200);
    const answer = (await written.json()) as WriteAnswer;
    expect(answer).toMatchObject({ ok: true, tables: ['use_case'] });
    expect(readFileSync(file, 'utf8')).toContain('A writer keeps a thought.');
  }, 30_000);

  it('LA-AUT-UC03-R05-T01 The server has no way to change the meta-model', async () => {
    const schemaFiles = readdirSync(SCHEMA_DIR).map((name) => path.join(SCHEMA_DIR, name));
    const before = schemaFiles.map((file) => readFileSync(file, 'utf8'));
    const send = async (method: string, url: string, body = '{"kind":"memo"}') =>
      (await fetch(`${BASE}${url}`, { method, headers: { 'content-type': 'application/json' }, body })).status;
    expect(await send('POST', '/api/spec')).toBe(405);
    expect(await send('PUT', '/api/spec')).toBe(405);
    expect(await send('POST', '/api/meta')).toBe(404);
    expect(await send('PUT', '/api/kinds')).toBe(404);
    expect(await send('POST', '/api/write', JSON.stringify({ commands: [{ op: 'add', table: 'meta_kind', row: { name: 'memo', label: 'Memo', obligation: false } }] }))).toBe(422);
    expect(schemaFiles.map((file) => readFileSync(file, 'utf8'))).toEqual(before);
  });
});
