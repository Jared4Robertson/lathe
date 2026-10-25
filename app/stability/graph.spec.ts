import { expect, test, type Page } from '@playwright/test';
import { expectStable, openPage, step } from './measure';
import { DOMAIN, GRAPH_CANVAS, GRAPH_HEADER, MODEL_CANVAS, RECORD } from './scenarios';

// LA-BRW-T485: re-centering the graph at depth 1, 2 and 3, and moving around the ERD. The boxes
// glide (a transform, which is no layout shift) and the camera moves; the pane's title, the
// graph's header and its canvas must hold still, and the canvas must not be drawn anew.

const PANE_TITLE = '.pane-graph .pane-title';
const PANE_BAR = '.pane-graph > .pane-bar';

async function nodes(page: Page) {
  await page.locator('.graph-flow .react-flow__node').first().waitFor();
  await page.waitForTimeout(500);
}

/** The ID of the n-th record box (not the center) that is wholly inside the canvas. */
async function visibleNode(page: Page, n: number): Promise<string> {
  const ids = await page.evaluate(() => {
    const canvas = document.querySelector('.pane-graph .graph-flow')!.getBoundingClientRect();
    return [...document.querySelectorAll<HTMLElement>('.graph-flow .react-flow__node[data-id^="LA-"]:not(.is-leaving)')]
      .filter((el) => !el.querySelector('.is-focus'))
      .filter((el) => { const r = el.getBoundingClientRect(); return r.left >= canvas.left && r.right <= canvas.right && r.top >= canvas.top && r.bottom <= canvas.bottom - 40; })
      .map((el) => el.dataset.id!);
  });
  expect(ids.length, 'a record box in view').toBeGreaterThan(0);
  return ids[Math.min(n, ids.length - 1)];
}

test.describe('graph', () => {
  for (const depth of [1, 2, 3]) {
    test(`LA-BRW-T485 re-center at depth ${depth}`, async ({ page }) => {
      await openPage(page, `${RECORD}?view=graph`);
      await nodes(page);
      if (depth > 1) {
        await page.locator('.graph-depth button', { hasText: String(depth) }).click();
        await page.waitForTimeout(900);
      }
      const keys = [PANE_BAR, PANE_TITLE, GRAPH_HEADER, GRAPH_CANVAS, '.pane-graph .graph-flow .react-flow__renderer', '.side-bar-column'];
      // Two re-centers: out to a neighbor, then on to one of its neighbors.
      for (const hop of [1, 2]) {
        const before = new URL(page.url()).pathname;
        const id = await visibleNode(page, hop);
        const r = await step(page, 'graph', `depth ${depth}: re-center ${hop}`, { keys, allow: ['.side-bar'] }, async () => {
          await page.locator(`.graph-flow .react-flow__node[data-id="${id}"]`).click();
          await page.waitForURL((u) => u.pathname !== before);
        });
        expectStable(r);
      }
    });
  }

  test('LA-BRW-T485 change the depth', async ({ page }) => {
    await openPage(page, `${RECORD}?view=graph`);
    await nodes(page);
    const keys = [PANE_BAR, PANE_TITLE, GRAPH_HEADER, GRAPH_CANVAS];
    for (const d of ['2', '3', '1']) {
      const r = await step(page, 'graph', `depth to ${d}`, { keys, allow: ['.side-bar'] }, () => page.locator('.graph-depth button', { hasText: d }).click());
      expectStable(r);
    }
  });

  test('LA-BRW-T485 move around the ERD', async ({ page }) => {
    await openPage(page, `${DOMAIN}?view=model`);
    await page.locator('.model-flow .react-flow__node').first().waitFor();
    await page.waitForTimeout(500);
    const keys = ['.pane-model > .pane-bar', '.pane-model .pane-title', '.pane-model .model-header', MODEL_CANVAS, '.pane-model .erd-key'];
    const box = page.locator('.model-flow .react-flow__node').first();
    const r = await step(page, 'graph', 'ERD: domain to aggregate', { keys, allow: ['.side-bar'] }, async () => {
      await box.click();
      await page.waitForURL(/\/LA-[A-Z0-9]+-[A-Z0-9]+/);
      await page.locator('.model-flow .react-flow__node').first().waitFor();
    });
    expectStable(r);
    const entity = page.locator('.model-flow .react-flow__node:not(:has(.is-focus))').first();
    const before = new URL(page.url()).pathname;
    const e = await step(page, 'graph', 'ERD: aggregate to entity', { keys, allow: ['.side-bar'] }, async () => {
      await entity.click();
      await page.waitForURL((u) => u.pathname !== before);
    });
    expectStable(e);
    const back = await step(page, 'graph', 'ERD: Back to the domain', { keys, allow: ['.side-bar'] }, async () => {
      await page.goBack();
      await page.goBack();
      await expect(page).toHaveURL(/\/LA-BRW(\?|$)/);
    });
    expectStable(back);
  });
});
