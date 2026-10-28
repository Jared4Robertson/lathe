import { appendFileSync } from 'node:fs';
import path from 'node:path';
import { expect, test } from '@playwright/test';
import { served } from './flows';
import { openPage } from './measure';
import { keepData, PRODUCT } from './scenarios';

// Checking's flow that the Owner walks in the app: reviewing every problem of a product on its
// Checks page while an Agent writes, over the suite's copy of this repo's data. The flows run from
// the command line are in lathe/test/flows/checking.test.ts.

const CHECKS = `${PRODUCT}/checks`;
/** A view the suite adds while the page is open; nothing uses it, so it is an error. */
const ADDED = 'LA-V98';

/** The desktop shell's bridge, stood in for: it keeps each error count the page sends for the Dock badge. */
function desktopBridge() {
  const counts: number[] = [];
  (window as unknown as { __counts: number[] }).__counts = counts;
  (window as unknown as { latheDesktop: object }).latheDesktop = {
    isDesktop: true,
    platform: 'darwin',
    onCommand: () => () => {},
    setChrome: () => {},
    onFullScreen: (listener: (full: boolean) => void) => { listener(false); return () => {}; },
    setErrorCount: (count: number) => counts.push(count),
    revealRecord: () => {},
    openRecordInEditor: () => {},
    copyRecordId: () => {},
    showRecordMenu: () => {},
  };
}

test.describe('Checking flows', () => {
  test('LA-CHK-UC07-FL01-T review every problem of a product', async ({ page }) => {
    const restore = keepData();
    try {
      // S01: the product's Checks page: its problems counted, errors first, grouped by check.
      const spec = await served(page);
      const errors = spec.problems.filter((p) => p.severity === 'error').length;
      await openPage(page, CHECKS, '#main h1');
      const main = page.locator('#main');
      await expect(main.locator('h1')).toHaveText('Checks');
      await expect(main.getByText(new RegExp(`^${errors} errors? · \\d+ warnings?$`))).toBeVisible();
      const severity = new Map(spec.problems.map((p) => [p.check, p.severity]));
      const groups = (await main.locator('h2 a[href^="/format/checks/"]').allTextContents()).map((t) => t.trim());
      const order = groups.map((g) => severity.get(g));
      expect(order.indexOf('warning') === -1 || order.lastIndexOf('error') < order.indexOf('warning')).toBe(true);
      // S02: a data file changes while the page is open; the page shows the problems as they are now.
      appendFileSync(path.join(process.env.STABILITY_ROOT!, 'data', 'view.jsonl'), `${JSON.stringify({ id: ADDED, title: 'A page nothing reaches' })}\n`);
      await expect(main.getByRole('heading', { name: /^view-unused \d+$/, level: 2 })).toBeVisible({ timeout: 20_000 });
      await expect(main.getByText(new RegExp(`^${errors + 1} errors · \\d+ warnings?$`))).toBeVisible();
      // S03: they open a problem's record to see it and its problems, and go back.
      await main.getByRole('link', { name: ADDED, exact: true }).first().click();
      await page.waitForURL((u) => u.pathname === `/${ADDED}`);
      await expect(page.locator('.pane-wiki').getByRole('list', { name: 'Problems' })).toContainText('view-unused');
      await page.goBack();
      await page.waitForURL((u) => u.pathname === CHECKS);
      // S04: a check's code leads to its page in the reference.
      await main.getByRole('heading', { name: /^view-unused \d+$/, level: 2 }).getByRole('link').click();
      await page.waitForURL((u) => u.pathname === '/format/checks/view-unused');
      await expect(page.locator('#main h1')).toHaveText('view-unused');
      // S05: in the desktop app, the page sends the product's error count to the Dock badge.
      await page.addInitScript(desktopBridge);
      await openPage(page, CHECKS, '#main h1');
      await expect.poll(() => page.evaluate(() => (window as unknown as { __counts: number[] }).__counts.at(-1))).toBe(errors + 1);
    } finally {
      restore();
    }
  });
});
