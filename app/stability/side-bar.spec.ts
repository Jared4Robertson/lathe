import { test } from '@playwright/test';
import { expectStable, openPage, step } from './measure';
import { GRAPH_CANVAS, GRAPH_HEADER, RECORD } from './scenarios';

// LA-BRW-T599: the side bar (brief 64). Switching its view between Details, Outline and History,
// and the node under the pointer changing what Details shows, change only the side bar's own
// content: the nav, the panes, the canvas, the side bar's box and its switcher hold still.

const NAV = 'nav#nav';
const SIDE = '.side-bar-column';
const SWITCH = '.side-bar .side-switch';
const KEYS = [NAV, '.pane-wiki > .pane-bar', '.pane-wiki .pane-title', '.pane-graph > .pane-bar', GRAPH_HEADER, GRAPH_CANVAS, SIDE, SWITCH];
/** The side bar's content is what changes. */
const ALLOW = ['.side-bar'];

test.describe('side bar', () => {
  test('LA-BRW-T599 switching the side bar\'s view moves nothing outside it', async ({ page }) => {
    await openPage(page, `${RECORD}?view=wiki,graph`);
    await page.locator('.graph-flow .react-flow__node').first().waitFor();
    await page.waitForTimeout(600);
    for (const view of ['Outline', 'History', 'Details']) {
      const r = await step(page, 'side bar', `switch to ${view}`, { keys: KEYS, allow: ALLOW }, async () => {
        await page.locator(SWITCH).getByRole('button', { name: view }).click();
        await page.locator('.side-bar .side-view > h2', { hasText: view }).waitFor();
      });
      expectStable(r);
    }
  });

  test('LA-BRW-T599 Details following the node under the pointer moves nothing outside it', async ({ page }) => {
    await openPage(page, `${RECORD}?view=wiki,graph`);
    const nodes = page.locator('.graph-flow .react-flow__node[data-id^="LA-"]:not(.is-context)');
    await nodes.first().waitFor();
    await page.waitForTimeout(600);
    const r = await step(page, 'side bar', 'hover nodes, then leave', { keys: KEYS, allow: ALLOW }, async () => {
      const count = Math.min(3, await nodes.count());
      for (let i = 0; i < count; i++) {
        await nodes.nth(i).hover();
        await page.waitForTimeout(150);
      }
      await page.mouse.move(5, 5);
    });
    expectStable(r);
  });
});
