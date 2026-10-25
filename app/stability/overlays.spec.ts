import { expect, test } from '@playwright/test';
import { expectStable, openPage, step } from './measure';
import { FOCUS, RECORD, SHELL } from './scenarios';

// LA-PLT-T75: tooltips, quick find, the command palette and the shortcuts sheet. Each is placed
// before it shows and stays where it showed; typing in a search box filters the list under it
// without moving the box; the page behind never moves.

test.describe('overlays', () => {
  test('LA-PLT-T75 a tooltip shows in place', async ({ page }) => {
    await openPage(page, `${RECORD}?view=wiki,graph`);
    const button = page.locator('.page-bar .pane-views button').first();
    const r = await step(page, 'overlays', 'tooltip on hover', { keys: [...SHELL, ...FOCUS, '.tooltip'] }, async () => {
      await button.hover();
      await page.locator('.tooltip').waitFor();
      await page.waitForTimeout(300);
    });
    expectStable(r);
    const next = await step(page, 'overlays', 'tooltip moving to the next button', { keys: [...SHELL, ...FOCUS] }, async () => {
      await page.locator('.page-bar .pane-views button').nth(1).hover();
      await page.waitForTimeout(400);
    });
    expectStable(next);
  });

  test('LA-PLT-T75 quick find', async ({ page }) => {
    await openPage(page, RECORD);
    const r = await step(page, 'overlays', 'quick find: open and type', { keys: [...SHELL, ...FOCUS, '.quick-find input'], allow: ['.quick-find-results'] }, async () => {
      await page.keyboard.press('Control+k');
      await page.keyboard.type('graph re', { delay: 60 });
      await page.locator('.quick-find-results li').first().waitFor();
    });
    expectStable(r);
    const close = await step(page, 'overlays', 'quick find: Escape', { keys: [...SHELL, ...FOCUS, '.quick-find input'] }, async () => {
      await page.keyboard.press('Escape');
      await expect(page.locator('.quick-find-results')).toHaveCount(0);
    });
    expectStable(close);
  });

  test('LA-PLT-T75 the command palette', async ({ page }) => {
    await openPage(page, RECORD);
    const r = await step(page, 'overlays', 'palette: open and type', { keys: [...SHELL, ...FOCUS, '.dialog-search'], allow: ['.palette-list'] }, async () => {
      await page.keyboard.press('Control+Shift+p');
      await page.locator('.dialog-search').waitFor();
      await page.keyboard.type('graph', { delay: 60 });
    });
    expectStable(r);
    await page.keyboard.press('Escape');
  });

  test('LA-PLT-T75 the shortcuts sheet', async ({ page }) => {
    await openPage(page, RECORD);
    await page.locator('#main').click({ position: { x: 400, y: 300 } });
    const r = await step(page, 'overlays', 'shortcuts sheet: open and search', { keys: [...SHELL, ...FOCUS, '.dialog-search'], allow: ['.shortcut-groups'] }, async () => {
      await page.keyboard.press('Control+/');
      await page.locator('.dialog-search').waitFor();
      await page.keyboard.type('pane', { delay: 60 });
    });
    expectStable(r);
  });
});
