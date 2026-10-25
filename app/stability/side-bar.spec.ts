import { expect, test, type Page } from '@playwright/test';
import { expectStable, openPage, step } from './measure';
import { GRAPH_CANVAS, GRAPH_HEADER, RECORD } from './scenarios';

// LA-PLT-T89: the side bar (brief 64). Switching its view between Details, Outline and History,
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
 * A level is as wide as its widest label (LA-EXP-DR58), so a box may run past the canvas's right
 * edge: a box is in view when its left part is and it is 24 px tall or more, and is clicked or hovered there.
 */
const AT_LEFT = { x: 20, y: 12 };
async function boxesInView(page: Page, except = ''): Promise<string[]> {
  return page.evaluate((except) => {
    const canvas = document.querySelector('.graph-flow')!.getBoundingClientRect();
    return [...document.querySelectorAll<HTMLElement>('.graph-flow .react-flow__node[data-id^="LA-"]')]
      .filter((el) => el.dataset.id !== except)
      .filter((el) => { const r = el.getBoundingClientRect(); return r.height >= 24 && r.left >= canvas.left && r.left + 40 <= canvas.right && r.top >= canvas.top && r.bottom <= canvas.bottom - 40; })
      .map((el) => el.dataset.id!);
  }, except);
}

test.describe('side bar', () => {
  test('LA-PLT-T89 switching the side bar\'s view moves nothing outside it', async ({ page }) => {
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

  test('LA-PLT-T89 Details following the node under the pointer moves nothing outside it', async ({ page }) => {
    await openPage(page, `${RECORD}?view=wiki,graph`);
    const nodes = page.locator('.graph-flow .react-flow__node[data-id^="LA-"]');
    await nodes.first().waitFor();
    await page.waitForTimeout(600);
    const r = await step(page, 'side bar', 'hover nodes, then leave', { keys: KEYS, allow: ALLOW }, async () => {
      const ids = (await boxesInView(page)).slice(0, 3);
      expect(ids.length, 'boxes in view').toBeGreaterThan(0);
      for (const id of ids) {
        await page.locator(`.graph-flow .react-flow__node[data-id="${id}"]`).hover({ position: AT_LEFT });
        await page.waitForTimeout(150);
      }
      await page.mouse.move(5, 5);
    });
    expectStable(r);
  });
});
