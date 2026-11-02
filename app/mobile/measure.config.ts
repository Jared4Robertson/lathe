import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, devices } from '@playwright/test';

// The phone checks' own tests (mobile/measure.spec.ts): fixture pages only, so no server and no copy of the data.
// Run with `npm --prefix app run test:mobile-measure`.

const here = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  testDir: here,
  testMatch: 'measure.spec.ts',
  outputDir: path.join(here, 'results/measure-artifacts'),
  workers: 1,
  retries: 0,
  reporter: [['list']],
  use: { ...devices['Desktop Chrome'], trace: 'off', video: 'off' },
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],
});
