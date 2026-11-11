import { expect, test } from './test';
import { expectStable, openPage, showCard, step } from './measure';
import { FOCUS, RECORD, SHELL } from './scenarios';

// LA-V61-R34-T01: tooltips, quick find, the command palette, the shortcuts sheet and the tools over the stage. Each is placed
// before it shows and stays where it showed; typing in a search box filters the list under it
// without moving the box; the page behind never moves.

test.describe('overlays', () => {
  test('LA-V61-R34-T01 a tooltip shows in place', async ({ page }) => {
    await openPage(page, `${RECORD}?stage=graph`);
    const button = page.locator('.page-bar-actions .stage-switch button').first();
    const r = await step(page, 'overlays', 'tooltip on hover', { keys: [...SHELL, ...FOCUS, '.tooltip'] }, async () => {
      await button.hover();
      await page.locator('.tooltip').waitFor();
      await page.waitForTimeout(300);
    });
    expectStable(r);
    const next = await step(page, 'overlays', 'tooltip moving to the next button', { keys: [...SHELL, ...FOCUS] }, async () => {
      await page.locator('.page-bar-actions .stage-switch button').nth(1).hover();
      await page.waitForTimeout(400);
    });
    expectStable(next);
  });

  test('LA-V61-R34-T01 quick find', async ({ page }) => {
    await openPage(page, RECORD);
    // Quick find previews a result in the card's summary, whatever the place's setting (FocusPage.tsx); the Reader reads
    // the summary here, so the card holds still while the preview comes and goes.
    await showCard(page, 'summary');
    const r = await step(page, 'overlays', 'quick find: open and type', { keys: [...SHELL, ...FOCUS, '.quick-find-button'], allow: ['.quick-open-backdrop'] }, async () => {
      await page.keyboard.press('Control+k');
      await page.keyboard.type('graph re', { delay: 60 });
      await page.locator('.quick-open .palette-list li').first().waitFor();
    });
    expectStable(r);
    const close = await step(page, 'overlays', 'quick find: Escape', { keys: [...SHELL, ...FOCUS, '.quick-find-button'] }, async () => {
      await page.keyboard.press('Escape');
      await expect(page.locator('.quick-open')).toHaveCount(0);
    });
    expectStable(close);
  });

  test('LA-V61-R34-T01 the command palette', async ({ page }) => {
    await openPage(page, RECORD);
    const r = await step(page, 'overlays', 'palette: open and type', { keys: [...SHELL, ...FOCUS, '.quick-find-button'], allow: ['.quick-open-backdrop'] }, async () => {
      await page.keyboard.press('Control+Shift+p');
      await page.locator('.quick-open input').waitFor();
      await page.keyboard.type('graph', { delay: 60 });
    });
    expectStable(r);
    await page.keyboard.press('Escape');
  });

  test('LA-V61-R34-T01 the shortcuts sheet', async ({ page }) => {
    await openPage(page, RECORD);
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
    const r = await step(page, 'overlays', 'shortcuts sheet: open and search', { keys: [...SHELL, ...FOCUS, '.dialog-search'], allow: ['.shortcut-groups'] }, async () => {
      await page.keyboard.press('Control+/');
      await page.locator('.dialog-search').waitFor();
      await page.keyboard.type('pane', { delay: 60 });
    });
    expectStable(r);
  });

  // Nothing replaces the stage (LA-PAT-APP-UX-R20): a tool opens over it, and the stage, the nav and the tab panel stay put.
  test('LA-V61-R34-T01 the Checks panel and the Appearance popover open over the stage, and nothing on the page jumps', async ({ page }) => {
    await openPage(page, RECORD);
    const r = await step(page, 'overlays', 'Checks panel: open', { keys: ['nav#nav', '.page-bar-actions', '.header-strip', '.tool-panel'], allow: ['.wiki-panel', '.focus-stage'] }, async () => {
      await page.locator('nav#nav').getByRole('link', { name: /^Checks/ }).click();
      await page.locator('.tool-panel.checks-panel .problems').first().waitFor();
      await page.waitForTimeout(400);
    });
    expectStable(r);
    const pick = await step(page, 'overlays', 'Checks panel: select a problem', { keys: ['nav#nav', '.page-bar-actions', '.tool-panel'], allow: ['.wiki-panel', '.focus-stage', '.header-strip'] }, async () => {
      await page.locator('.tool-panel.checks-panel li.problem a.row-link').first().click();
      await page.locator('.tool-panel.checks-panel li.problem.is-current').first().waitFor();
      await page.waitForTimeout(400);
    });
    expectStable(pick);
    await page.keyboard.press('Escape');
    await expect(page.locator('.tool-panel')).toHaveCount(0);
    const pop = await step(page, 'overlays', 'Appearance popover: open', { keys: ['nav#nav', '.page-bar-actions', '.header-strip', '.tool-panel'], allow: ['.wiki-panel', '.focus-stage'] }, async () => {
      await page.locator('nav#nav').getByRole('link', { name: 'Appearance' }).click();
      await page.locator('.tool-panel.appearance-popover .theme-rows').waitFor();
      await page.waitForTimeout(400);
    });
    expectStable(pop);
    await page.keyboard.press('Escape');
  });

  // The Dashboard is the one full-window tool (LA-PAT-APP-UX-R20, its recorded deviation, LA-V157): nothing jumps as its figures come in, and a row closes it.
  test('LA-TRC-UC26-FL-T the Dashboard pulls up by its shortcut, its figures settle in place, and a Needs attention row closes it and goes there', async ({ page }) => {
    await openPage(page, RECORD);
    const r = await step(page, 'overlays', 'Dashboard: open', { keys: ['.tool-panel', '.dashboard-status', '.dashboard-stages', '.metrics'], allow: ['.wiki-panel', '.focus-stage', 'nav#nav', '.page-bar-actions', '.header-strip'] }, async () => {
      await page.keyboard.press('ControlOrMeta+Shift+D');
      await page.locator('.dashboard-panel .dashboard-body:not([data-reading])').waitFor();
      await page.waitForTimeout(600);
    });
    expectStable(r);
    const row = page.locator('.dashboard-panel .dashboard-row').last();
    const target = await row.getAttribute('href');
    await row.click();
    await expect(page.locator('.dashboard-panel')).toHaveCount(0);
    await page.waitForURL((u) => `${u.pathname}${u.search}` === target);
  });
});
