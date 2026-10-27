import { expect, test } from '@playwright/test';
import { expectStable, openPage, step } from './measure';
import { FOCUS, GRAPH_CANVAS, RECORD, SHELL } from './scenarios';

// LA-V61-R35-T01: switching theme changes colors only. LA-V61-R36-T01: at phone width (375 px) the
// nav drawer, quick find and the side bar sheet open and close over the page without moving it.

test.describe('theme', () => {
  test('LA-V61-R35-T01 switching theme moves nothing', async ({ page }) => {
    await openPage(page, `${RECORD}?view=wiki,graph`);
    await page.locator('.pane-graph .graph-flow .graph-box').first().waitFor({ state: 'attached' });
    await page.locator('#main').click({ position: { x: 300, y: 400 } });
    await page.keyboard.press('g');
    await page.keyboard.press('t');
    const pick = page.locator('.dialog-search');
    await pick.waitFor();
    await pick.fill('Midnight');
    const keys = [...SHELL, ...FOCUS, '.page-bar', GRAPH_CANVAS, '.pane-wiki .pane-title h1'];
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
    await openPage(page, RECORD, '.pane-title');
    const behind = ['.topbar', '#main', '.pane-wiki .pane-title h1'];
    const sheets = ['.bottom-sheet', '.sheet', '.sheet-backdrop', '.drawer-backdrop', 'nav#nav'];
    const nav = await step(page, 'mobile', 'open and close the nav drawer', { keys: behind, allow: sheets }, async () => {
      await page.getByRole('button', { name: 'Open the navigation' }).click();
      await page.locator('nav#nav').waitFor();
      await page.waitForTimeout(500);
      await page.keyboard.press('Escape');
    });
    expectStable(nav);
    const find = await step(page, 'mobile', 'open and close quick find', { keys: behind, allow: sheets }, async () => {
      await page.locator('.topbar').getByRole('button', { name: 'Quick find' }).click();
      await page.locator('.find-sheet').waitFor();
      await page.keyboard.type('graph', { delay: 50 });
      await page.waitForTimeout(400);
      await page.locator('.find-sheet .sheet-close').click();
    });
    expectStable(find);
    const sideBar = page.getByRole('button', { name: 'Show the side bar' });
    if (await sideBar.count()) {
      const sheet = await step(page, 'mobile', 'open and close the side bar sheet', { keys: behind, allow: sheets }, async () => {
        await sideBar.first().click();
        await page.locator('.side-bar-sheet').waitFor();
        await page.waitForTimeout(500);
        await page.keyboard.press('Escape');
        await expect(page.locator('.side-bar-sheet')).toHaveCount(0);
      });
      expectStable(sheet);
    }
  });
});
