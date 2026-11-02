import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, devices } from '@playwright/test';
import stability from '../stability/playwright.config';

// The phone suite (LA-STD-EXPERIENCE-R13, "On a phone nothing is cut off, overlapping, unreachable or too small to
// tap"). It runs on the stability suite's harness (app/stability/playwright.config.ts): Chromium only, one worker, the
// Vite dev server on a free port (never 5199) over a copy of this repo's data. Every stage, view and one record of each
// kind is opened on three phones upright and one on its side, emulated with touch, and measured by the five checks
// in mobile/measure.ts (mobile/phone.spec.ts). Run it with `npm --prefix app run test:mobile`; the findings, with a
// cropped screenshot of each, gather in app/mobile/results/.

const here = path.dirname(fileURLToPath(import.meta.url));
const phone = { ...devices['Pixel 7'], browserName: 'chromium' as const, deviceScaleFactor: 2, isMobile: true, hasTouch: true };

export default defineConfig({
  ...stability,
  testDir: here,
  testMatch: 'phone.spec.ts',
  outputDir: path.join(here, 'results/artifacts'),
  reporter: [['list'], ['./reporter.ts']],
  projects: [
    { name: '375x812', use: { ...phone, viewport: { width: 375, height: 812 } } },
    { name: '390x844', use: { ...phone, viewport: { width: 390, height: 844 } } },
    { name: '430x932', use: { ...phone, viewport: { width: 430, height: 932 } } },
    { name: '812x375', use: { ...phone, viewport: { width: 812, height: 375 } } },
  ],
});
