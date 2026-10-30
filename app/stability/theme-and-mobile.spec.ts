import { expect, test } from '@playwright/test';
import { expectStable, openPage, step } from './measure';
import { FOCUS, GRAPH_CANVAS, RECORD, SHELL } from './scenarios';

// LA-V61-R35-T01: switching to a theme that differs only in color (Midnight) changes colors only. LA-V61-R36-T01: at phone width (375 px) the
// nav drawer, quick find and the wiki card's sheet open and close over the stage without moving it.

test.describe('theme', () => {
  test('LA-V61-R35-T01 switching to a color-only theme moves nothing', async ({ page }) => {
    await openPage(page, `${RECORD}?stage=graph`);
    await page.locator('.focus-stage .graph-flow .graph-box').first().waitFor({ state: 'attached' });
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
    await page.keyboard.press('g');
    await page.keyboard.press('t');
    const pick = page.locator('.dialog-search');
    await pick.waitFor();
    await pick.fill('Midnight');
    const keys = [...SHELL, ...FOCUS, GRAPH_CANVAS, '.header-strip h1'];
    const r = await step(page, 'theme', 'switch to Midnight', { keys }, async () => {
      await page.keyboard.press('Enter');
      await expect(page.locator('.dialog-search')).toHaveCount(0);
      await expect(page.locator('html')).toHaveAttribute('data-theme', /midnight/);
    });
    expectStable(r);
  });
});

test.describe('mobile at 375 px', () => {
  test.use({ viewport: { width: 375, height: 812 }, hasTouch: true, isMobile: true });

  test('LA-V61-R36-T01 the sheets and the drawer move nothing behind them', async ({ page }) => {
    await openPage(page, RECORD, '.header-strip h1');
    const behind = ['.topbar', '#main', '.page-bar.is-compact', '.header-strip', '.focus-stage'];
    const sheets = ['.bottom-sheet', '.sheet', '.quick-open-backdrop', '.sheet-backdrop', '.drawer-backdrop', 'nav#nav'];
    const nav = await step(page, 'mobile', 'open and close the nav drawer', { keys: behind, allow: sheets }, async () => {
      await page.getByRole('button', { name: 'Open the navigation' }).click();
      await page.locator('nav#nav').waitFor();
      await page.waitForTimeout(500);
      await page.keyboard.press('Escape');
    });
    expectStable(nav);
    const find = await step(page, 'mobile', 'open and close quick find', { keys: behind, allow: sheets }, async () => {
      await page.locator('.topbar').getByRole('button', { name: 'Quick find' }).click();
      await page.locator('.quick-open').waitFor();
      await page.keyboard.type('graph', { delay: 50 });
      await page.waitForTimeout(400);
      await page.locator('.quick-open .sheet-close').click();
    });
    expectStable(find);
    const card = await step(page, 'mobile', 'open and close the wiki card sheet', { keys: behind, allow: sheets }, async () => {
      await page.getByRole('button', { name: 'Show the wiki card' }).click();
      await page.locator('.wiki-panel-sheet .wiki-panel').waitFor();
      await page.waitForTimeout(500);
      await page.keyboard.press('Escape');
      await expect(page.locator('.wiki-panel-sheet')).toHaveCount(0);
    });
    expectStable(card);
  });
});
