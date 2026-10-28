import { expect, test, type Locator, type Page } from '@playwright/test';
import { expectStable, openPage, step } from './measure';
import { RECORD } from './scenarios';

// LA-V61-R31-T01: dragging each panel's resize edge, and collapsing by drag. The panel the edge
// belongs to resizes with the pointer: its box may change on every move, but never jump back to a box it
// left; the stage behind and the panels on the far side of the page must hold still.

async function drag(page: Page, handle: Locator, dx: number, steps = 12) {
  const box = (await handle.boundingBox())!;
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  for (let i = 1; i <= steps; i++) {
    await page.mouse.move(x + (dx * i) / steps, y);
    await page.waitForTimeout(16);
  }
  await page.mouse.up();
}

const ALL = ['*'];

test.describe('resize', () => {
  test('LA-V61-R31-T01 drag the nav gap, then collapse the nav by drag', async ({ page }) => {
    await openPage(page, RECORD);
    const handle = page.locator('.app-nav-handle');
    const keys = ['nav#nav', '#main', '.focus-stage', '.stage-layout > .side-bar-column'];
    const r = await step(page, 'resize', 'drag the nav gap', { keys, allow: ALL, resizes: ['nav#nav'] }, () => drag(page, handle, 120));
    expectStable(r);
    const c = await step(page, 'resize', 'collapse the nav by drag', { keys: ['.stage-layout > .side-bar-column', '.focus-stage'], allow: ALL }, () => drag(page, handle, -400, 16));
    await expect(page.locator('nav#nav.is-rail')).toHaveCount(1);
    expectStable(c);
  });

  test('LA-V61-R31-T01 drag the wiki card\'s edge', async ({ page }) => {
    await openPage(page, `${RECORD}?stage=graph`);
    await page.locator('.focus-stage .graph-flow .graph-box').first().waitFor({ state: 'attached' });
    const handle = page.locator('.wiki-panel-handle .resize-handle');
    const keys = ['nav#nav', '.stage-layout > .side-bar-column', '.wiki-panel', '.focus-stage', '.focus-stage .graph-canvas'];
    const r = await step(page, 'resize', 'drag the wiki card\'s edge', { keys, allow: ALL, resizes: ['.wiki-panel'] }, () => drag(page, handle, 160));
    expectStable(r);
  });

  test('LA-V61-R31-T01 drag the side bar gap, then collapse it by drag', async ({ page }) => {
    await openPage(page, RECORD);
    const handle = page.locator('.side-bar-handle');
    const keys = ['nav#nav', '#main', '.focus-stage', '.stage-layout > .side-bar-column', '.stage-layout > .page-bar', '.wiki-panel'];
    const r = await step(page, 'resize', 'drag the side bar\'s edge', { keys, allow: ALL, resizes: ['.stage-layout > .side-bar-column', '.stage-layout > .page-bar', '.wiki-panel'] }, () => drag(page, handle, -120));
    expectStable(r);
    const c = await step(page, 'resize', 'collapse the side bar by drag', { keys: ['nav#nav', '.focus-stage'], allow: ALL }, () => drag(page, handle, 500, 16));
    await expect(page.locator('.side-bar-column')).toHaveCount(0);
    expectStable(c);
  });
});
