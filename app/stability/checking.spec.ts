import { appendFileSync } from 'node:fs';
import path from 'node:path';
import { expect, test } from './test';
import { asDesktop } from './desktop';
import { servedWorkspace } from './flows';
import { openPage } from './measure';
import { keepData, PRODUCT } from './scenarios';

// Checking's flows that the Owner walks in the app and in the desktop app: reviewing every problem of a product in
// the Checks panel over the stage (LA-PAT-APP-UX-R20) while an Agent writes, over the suite's copy of this repo's data. The flows run from
// the command line are in lathe/test/flows/checking.test.ts.

const CHECKS = `${PRODUCT}?panel=checks`;
/** The Checks panel over the stage. */
const PANEL = '.tool-panel.checks-panel';
/** A view the suite adds while the page is open; nothing uses it, so it is an error. */
const ADDED = 'LA-V990';
const ADDED_ROW = `${JSON.stringify({ id: ADDED, title: 'A page nothing reaches', description: 'A view no step happens in.' })}\n`;

/** The desktop shell's bridge, stood in for: it keeps each error count the page sends for the Dock badge. */
function keepCounts(bridge: LatheDesktop) {
  const counts: number[] = [];
  (window as unknown as { __counts: number[] }).__counts = counts;
  bridge.setErrorCount = (count) => { counts.push(count); };
}

test.describe('Checking flows', () => {
  test('LA-CHK-UC07-FL01-T review every problem of a product', async ({ page }) => {
    const restore = keepData();
    try {
      // S01: the product's Checks panel over its stage: its problems counted, errors first, grouped by check.
      const spec = await servedWorkspace();
      const errors = spec.problems.filter((p) => p.severity === 'error').length;
      await openPage(page, CHECKS, PANEL);
      const main = page.locator(PANEL);
      await expect(main.locator('.tool-panel-title')).toHaveText('Checks');
      await expect(page.locator('.focus-stage')).toBeVisible();
      await expect(main.getByText(new RegExp(`^${errors} errors? · \\d+ warnings?$`))).toBeVisible();
      const severity = new Map(spec.problems.map((p) => [p.check, p.severity]));
      const groups = (await main.locator('h3 a[href*="page=format/checks/"]').allTextContents()).map((t) => t.trim());
      const order = groups.map((g) => severity.get(g));
      expect(order.indexOf('warning') === -1 || order.lastIndexOf('error') < order.indexOf('warning')).toBe(true);
      // S02: a data file changes while the page is open; the page shows the problems as they are now.
      appendFileSync(path.join(process.env.STABILITY_ROOT!, 'data', 'view.jsonl'), ADDED_ROW);
      await expect(main.getByRole('heading', { name: /^view-unused \d+$/, level: 3 })).toBeVisible({ timeout: 20_000 });
      await expect(main.getByText(new RegExp(`^${errors + 1} errors? · \\d+ warnings?$`))).toBeVisible();
      // S03: they select a problem: its record takes the stage and the wiki card, and the panel stays open.
      await main.getByRole('link', { name: ADDED, exact: true }).first().click();
      await page.waitForURL((u) => u.pathname === `/${ADDED}` && u.search === '?panel=checks');
      await expect(page.locator('.wiki-panel')).toHaveAttribute('data-page', ADDED);
      await expect(main.locator('li.problem.is-current')).toContainText(ADDED);
      // S04: a check's code opens its page in the reference, in the wiki card over the stage.
      await main.getByRole('heading', { name: /^view-unused \d+$/, level: 3 }).getByRole('link').click();
      await page.waitForURL((u) => u.pathname === `/${ADDED}` && u.search === '?panel=checks&page=format/checks/view-unused');
      await expect(page.locator('.wiki-panel h2')).toHaveText('view-unused');
      // Escape closes the topmost overlay first: the card's page, then the panel.
      await page.keyboard.press('Escape');
      await page.waitForURL((u) => u.search === '?panel=checks');
      await page.keyboard.press('Escape');
      await page.waitForURL((u) => u.search === '');
      await expect(page.locator(PANEL)).toHaveCount(0);
    } finally {
      restore();
    }
  });

  test("LA-CHK-UC07-R01-T01 every problem of a product shows in one place, as the data is after its latest change", async ({ page }) => {
    const restore = keepData();
    try {
      const spec = await servedWorkspace();
      const errors = spec.problems.filter((p) => p.severity === 'error').length;
      await openPage(page, CHECKS, PANEL);
      const main = page.locator(PANEL);
      await expect(main.getByText(new RegExp(`^${errors} errors? · \\d+ warnings?$`))).toBeVisible();
      appendFileSync(path.join(process.env.STABILITY_ROOT!, 'data', 'view.jsonl'), ADDED_ROW);
      await expect(main.getByText(new RegExp(`^${errors + 1} errors? · \\d+ warnings?$`))).toBeVisible({ timeout: 20_000 });
    } finally {
      restore();
    }
  });

  test('LA-CHK-UC07-FL02-T review every problem of a product in the desktop app', async ({ page }) => {
    const restore = keepData();
    try {
      // S01: the product's Checks panel in the desktop app, its bridge stood in for, sends its error count to the Dock badge.
      const spec = await servedWorkspace();
      const errors = spec.problems.filter((p) => p.severity === 'error').length;
      await asDesktop(page, keepCounts);
      await openPage(page, CHECKS, PANEL);
      const main = page.locator(PANEL);
      const badge = () => page.evaluate(() => (window as unknown as { __counts: number[] }).__counts.at(-1));
      await expect.poll(badge).toBe(errors);
      // S02, S05: a data file changes while the page is open; the page shows the new error and the badge counts it.
      appendFileSync(path.join(process.env.STABILITY_ROOT!, 'data', 'view.jsonl'), ADDED_ROW);
      await expect(main.getByRole('heading', { name: /^view-unused \d+$/, level: 3 })).toBeVisible({ timeout: 20_000 });
      await expect.poll(badge).toBe(errors + 1);
    } finally {
      restore();
    }
  });
});
