import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from '@playwright/test';
import stability from '../stability/playwright.config';

// The accessibility suite (LA-PAT-APP-UX-R10, "Every page passes the accessibility audit"). It runs
// on the stability suite's harness (app/stability/playwright.config.ts): Chromium only, one worker,
// the Vite dev server on a free port (never 5199) over a copy of this repo's data. axe-core audits
// every page and state at WCAG 2.2 AA (a11y/audit.spec.ts), and keyboard scenarios walk the main
// tasks (a11y/keyboard.spec.ts). Run it with `npm --prefix app run test:a11y`.

const here = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  ...stability,
  testDir: here,
  outputDir: path.join(here, 'results/artifacts'),
  reporter: [['list'], ['./reporter.ts']],
});
