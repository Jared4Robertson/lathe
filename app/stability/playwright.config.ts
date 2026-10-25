import { cpSync, existsSync, mkdtempSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, devices } from '@playwright/test';

// The stability suite (LA-PAT-APP-CODE-R17, "Nothing jumps"): Playwright with Chromium only. It
// starts the app's Vite dev server on a free port (never 5199, Jared's own server) over a copy of
// this repo's specs, so a scenario can edit a spec file while the page is open, and records the
// layout shifts, long animation frames and the boxes of key elements in each scenario
// (app/stability/measure.ts). Run it with `npm --prefix app run test:stability`; it runs one
// worker, as the scenarios share one server and the machine's load.

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '../..');
const RESERVED_PORT = 5199;

/** A free TCP port, never 5199. */
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

// The runner works these out once; its workers inherit them through the environment, so every
// process agrees on the port and the product folder.
if (!process.env.STABILITY_PORT) process.env.STABILITY_PORT = String(await freePort());
if (!process.env.STABILITY_ROOT) {
  const root = mkdtempSync(path.join(tmpdir(), 'lathe-stability-'));
  for (const part of ['specs', 'model', 'lathe-checks', 'lathe.config.json']) {
    const from = path.join(repo, part);
    if (existsSync(from)) cpSync(from, path.join(root, part), { recursive: true });
  }
  process.env.STABILITY_ROOT = root;
}
const port = Number(process.env.STABILITY_PORT);

export default defineConfig({
  testDir: here,
  testMatch: '*.spec.ts',
  outputDir: path.join(here, 'results/artifacts'),
  globalTeardown: path.join(here, 'teardown.ts'),
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  reporter: [['list'], ['./reporter.ts']],
  use: {
    ...devices['Desktop Chrome'],
    baseURL: `http://127.0.0.1:${port}`,
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
    trace: 'off',
    video: 'off',
  },
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],
  webServer: {
    command: `npx vite --host 127.0.0.1 --port ${port} --strictPort`,
    cwd: path.resolve(here, '..'),
    url: `http://127.0.0.1:${port}/`,
    reuseExistingServer: false,
    timeout: 120_000,
    env: { LATHE_ROOT: process.env.STABILITY_ROOT!, BROWSER: 'none' },
    stdout: 'ignore',
    stderr: 'pipe',
  },
});
