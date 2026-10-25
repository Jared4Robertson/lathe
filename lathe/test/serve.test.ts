// `lathe serve`, started on a real port. It needs the built web app: this test uses the package's
// dist/app when it exists, and otherwise builds the app into a temporary folder with the app's own
// Vite. It is skipped, with a message, only when the app's packages are not installed (app/node_modules).
import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import type { Server } from 'node:http';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PACKAGE_DIR, type Workspace } from '../src/index.ts';
import { APP_DIR, serve } from '../src/server/serve.ts';

const here = path.dirname(fileURLToPath(import.meta.url));
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
let server: Server | undefined;

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
  cpSync(path.join(here, 'fixtures', 'good'), root, { recursive: true });
  server = serve({ root, port: PORT, appDir });
  await new Promise<void>((resolve, reject) => {
    server!.once('listening', resolve);
    server!.once('error', reject);
  });
}, 180_000);

afterAll(async () => {
  if (server) {
    server.closeAllConnections();
    await new Promise((resolve) => server!.close(resolve));
  }
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
  it('LA-PLT-T05 Serve serves the app, the spec API and change events for the product repo', async () => {
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
    expect(spec.headers.get('x-lathe-source')).toBe('engine');
    const workspace = (await spec.json()) as Workspace;
    expect(workspace.records.map((r) => r.id)).toContain('EX-NOTE-UC01');
    expect(workspace.problems).toEqual([]);

    const events = await fetch(`${BASE}/api/events`);
    expect(events.status).toBe(200);
    expect(events.headers.get('content-type')).toBe('text/event-stream');
    const file = path.join(root, 'specs/example/notes/01-define/use-cases/UC01.md');
    setTimeout(() => writeFileSync(file, readFileSync(file, 'utf8').replace('Write a note', 'Write a long note')), 300);
    const text = await readEvents(events, 'data: spec:changed', 5000);
    expect(text).toContain(': connected');
    expect(text).toContain('data: spec:changed');

    // The next request sees the change: nothing is cached between loads.
    const reloaded = (await (await fetch(`${BASE}/api/spec`)).json()) as Workspace;
    expect(reloaded.records.find((r) => r.id === 'EX-NOTE-UC01')?.title).toBe('Write a long note');
  }, 30_000);

  it('LA-AUT-T22 The server has no way to change the meta-model', async () => {
    const metaFiles = ['kinds.csv', 'relations.csv'].map((name) => path.join(PACKAGE_DIR, 'meta', name));
    const before = metaFiles.map((file) => readFileSync(file, 'utf8'));
    const write = async (method: string, url: string) =>
      (await fetch(`${BASE}${url}`, { method, headers: { 'content-type': 'application/json' }, body: '{"kind":"memo"}' })).status;
    expect(await write('POST', '/api/spec')).toBe(405);
    expect(await write('PUT', '/api/spec')).toBe(405);
    expect(await write('POST', '/api/meta')).toBe(404);
    expect(await write('PUT', '/api/kinds')).toBe(404);
    expect(await write('POST', '/api/relations')).toBe(404);
    expect(metaFiles.map((file) => readFileSync(file, 'utf8'))).toEqual(before);
  });
});
