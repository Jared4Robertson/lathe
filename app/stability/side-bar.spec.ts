import { expect, test, type Page } from '@playwright/test';
import { expectStable, openPage, step } from './measure';
import { GRAPH_CANVAS, GRAPH_HEADER, RECORD } from './scenarios';
import { reachableBoxes } from './scene';

// LA-V95-R09-T01: the side bar. Switching its view between Details, Outline and History,
// and the node under the pointer changing what Details shows, change only the side bar's own
// content: the nav, the panes, the canvas, the side bar's box and its switcher hold still.

const NAV = 'nav#nav';
const SIDE = '.side-bar-column';
const SWITCH = '.side-bar .side-switch';
const KEYS = [NAV, '.pane-wiki > .pane-bar', '.pane-wiki .pane-title', '.pane-graph > .pane-bar', GRAPH_HEADER, GRAPH_CANVAS, SIDE, SWITCH];
/** The side bar's content is what changes. */
const ALLOW = ['.side-bar'];

/** The IDs of the graph's boxes wholly inside its canvas, in DOM order (the map runs past the canvas's edges). */
/**
 * The record boxes a click or the pointer can reach on the graph's canvas (a box may lie partly
 * outside it, past its edge), with a point on each where the pointer finds it.
 */
async function boxesInView(page: Page, except = ''): Promise<{ id: string; at: { x: number; y: number } }[]> {
  return (await reachableBoxes(page)).filter((b) => b.id !== except);
}

test.describe('side bar', () => {
  test('LA-V95-R09-T01 switching the side bar\'s view moves nothing outside it', async ({ page }) => {
    await openPage(page, `${RECORD}?stage=graph`);
    await page.locator('.graph-flow .graph-box').first().waitFor({ state: 'attached' });
    await page.waitForTimeout(600);
    for (const view of ['Outline', 'History', 'Details']) {
      const r = await test.step(`LA-EXP-UC12-R07-T01 the Reader reads the record's ${view} in the side bar, on the page`, () =>
        step(page, 'side bar', `switch to ${view}`, { keys: KEYS, allow: ALLOW }, async () => {
          await page.locator(SWITCH).getByRole('button', { name: view }).click();
          await page.locator('.side-bar .side-view > h2', { hasText: view }).waitFor();
        }));
      expectStable(r);
    }
  });

  test('LA-V95-R09-T01 Details following the node under the pointer moves nothing outside it', async ({ page }) => {
    await openPage(page, `${RECORD}?stage=graph`);
    await page.locator('.graph-flow .graph-box[data-id^="LA-"]').first().waitFor({ state: 'attached' });
    await page.waitForTimeout(600);
    const r = await step(page, 'side bar', 'hover nodes, then leave', { keys: KEYS, allow: ALLOW }, async () => {
      const boxes = (await boxesInView(page)).slice(0, 3);
      expect(boxes.length, 'boxes in view').toBeGreaterThan(0);
      for (const { at } of boxes) {
        await page.mouse.move(at.x, at.y);
        await page.waitForTimeout(150);
      }
      await page.mouse.move(5, 5);
    });
    expectStable(r);
  });
});
