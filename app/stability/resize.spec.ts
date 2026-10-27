import { expect, test, type Locator, type Page } from '@playwright/test';
import { expectStable, openPage, step } from './measure';
import { RECORD } from './scenarios';

// LA-PLT-T75: dragging each resize gap, and collapsing by drag. What sits beside the gap
// resizes with the pointer: its box may change on every move, but never jump back to a box it
// left, and the panels on the far side of the page must hold still.

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
  test('LA-PLT-T75 drag the nav gap, then collapse the nav by drag', async ({ page }) => {
    await openPage(page, RECORD);
    const handle = page.locator('.app-nav-handle');
    const keys = ['nav#nav', '#main', '.side-bar-column'];
    const r = await step(page, 'resize', 'drag the nav gap', { keys, allow: ALL, resizes: ['nav#nav', '#main'] }, () => drag(page, handle, 120));
    expectStable(r);
    const c = await step(page, 'resize', 'collapse the nav by drag', { keys: ['.side-bar-column'], allow: ALL }, () => drag(page, handle, -400, 16));
    await expect(page.locator('nav#nav.is-rail')).toHaveCount(1);
    expectStable(c);
  });

  test('LA-PLT-T75 drag the gap between two panes', async ({ page }) => {
    await openPage(page, `${RECORD}?view=wiki,graph`);
    await page.locator('.pane-graph .graph-flow .graph-box').first().waitFor({ state: 'attached' });
    const handle = page.locator('.pane-gap').first();
    const keys = ['nav#nav', '.side-bar-column', '.pane-wiki', '.pane-graph', '.pane-graph .graph-canvas'];
    const r = await step(page, 'resize', 'drag the pane gap', { keys, allow: ALL, resizes: ['.pane-wiki', '.pane-graph', '.pane-graph .graph-canvas'] }, () => drag(page, handle, -160));
    expectStable(r);
  });

  test('LA-PLT-T75 drag the side bar gap, then collapse it by drag', async ({ page }) => {
    await openPage(page, RECORD);
    const handle = page.locator('.focus-layout > .resize-handle');
    const keys = ['nav#nav', '.side-bar-column', '.pane-wiki > .pane-bar'];
    const r = await step(page, 'resize', 'drag the side bar gap', { keys, allow: ALL, resizes: ['.side-bar-column', '.pane-wiki > .pane-bar'] }, () => drag(page, handle, -120));
    expectStable(r);
    const c = await step(page, 'resize', 'collapse the side bar by drag', { keys: ['nav#nav'], allow: ALL }, () => drag(page, handle, 500, 16));
    await expect(page.locator('.side-bar-column')).toHaveCount(0);
    expectStable(c);
  });
});
