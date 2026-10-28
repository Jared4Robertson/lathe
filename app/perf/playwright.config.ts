import { cpSync, existsSync, mkdtempSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, devices } from '@playwright/test';

// The performance suite (LA-PAT-APP-UX-R11): Playwright with Chromium, one worker. It builds the app
// for production and serves it with `lathe serve`'s server (perf/serve.ts) on a free port, never
// 5199, over a copy of this repo's data, then measures the first load, view switches, graph
// re-centers, the ERD view and memory against the budgets in perf/budgets.ts. Run it with
// `npm --prefix app run test:perf`, after the stability suite for a UI change.

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '../..');
const RESERVED_PORT = 5199;

async function freePort(): Promise<number> {
  for (;;) {
    const port = await new Promise<number>((resolve, reject) => {
      const server = createServer();
      server.once('error', reject);
      server.listen(0, '127.0.0.1', () => {
        const address = server.address();
        const p = typeof address === 'object' && address ? address.port : 0;
        server.close(() => resolve(p));
      });
    });
    if (port !== RESERVED_PORT && port > 0) return port;
  }
}

if (!process.env.PERF_PORT) process.env.PERF_PORT = String(await freePort());
if (!process.env.PERF_ROOT) {
  const root = mkdtempSync(path.join(tmpdir(), 'lathe-perf-data-'));
  for (const part of ['data', 'lathe.config.json']) {
    const from = path.join(repo, part);
    if (existsSync(from)) cpSync(from, path.join(root, part), { recursive: true });
  }
  process.env.PERF_ROOT = root;
}
const port = Number(process.env.PERF_PORT);

export default defineConfig({
  testDir: here,
  testMatch: '*.perf.ts',
  outputDir: path.join(here, 'results/artifacts'),
  globalTeardown: path.join(here, 'teardown.ts'),
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 120_000,
  expect: { timeout: 20_000 },
  reporter: [['list'], ['./reporter.ts']],
  use: {
    ...devices['Desktop Chrome'],
    baseURL: `http://127.0.0.1:${port}`,
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
    trace: 'off',
    video: 'off',
    launchOptions: { args: ['--enable-precise-memory-info', '--js-flags=--expose-gc'] },
  },
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],
  webServer: {
    command: 'node perf/serve.ts',
    cwd: path.resolve(here, '..'),
    url: `http://127.0.0.1:${port}/`,
    reuseExistingServer: false,
    timeout: 180_000,
    env: { PERF_PORT: String(port), PERF_ROOT: process.env.PERF_ROOT! },
    stdout: 'ignore',
    stderr: 'pipe',
  },
});
