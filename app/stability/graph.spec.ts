import { expect, test, type Page } from '@playwright/test';
import { expectStable, openPage, step } from './measure';
import { DOMAIN, GRAPH_CANVAS, GRAPH_HEADER, MODEL_CANVAS, RECORD } from './scenarios';

// LA-BRW-T485: re-centering the graph at depth 1, 2 and 3, and moving around the ERD. The camera
// glides (a transform, which is no layout shift); the pane's title, the graph's header and its
// canvas must hold still, and the canvas must not be drawn anew.
// LA-BRW-T744: focusing a domain, a stage, a folder and a record, then Back and Forward, moves the
// camera only: no box of the one map changes its place or its size.

const PANE_TITLE = '.pane-graph .pane-title';
/**
 * The graph's boxes. A re-center moves the camera over the one map (LA-BRW-DR392), and the boxes
 * the camera brings into view are drawn as it starts: that is the picture changing, inside the
 * canvas. The canvas, its header and the pane around it are keys and must hold still, and anything
 * else that shifts is still unexpected.
 */
const GRAPH_BOXES = '.pane-graph .graph-flow .react-flow__nodes';
const PANE_BAR = '.pane-graph > .pane-bar';

async function nodes(page: Page) {
  await page.locator('.graph-flow .react-flow__node').first().waitFor();
  await page.waitForTimeout(500);
}

/** The ID of the n-th record box (not the center) that is wholly inside the canvas. */
async function visibleNode(page: Page, n: number): Promise<string> {
  const ids = await page.evaluate(() => {
    const canvas = document.querySelector('.pane-graph .graph-flow')!.getBoundingClientRect();
    return [...document.querySelectorAll<HTMLElement>('.graph-flow .react-flow__node[data-id^="LA-"]:not(.is-plain)')]
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
        const r = await step(page, 'graph', `depth ${depth}: re-center ${hop}`, { keys, allow: ['.side-bar', GRAPH_BOXES] }, async () => {
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
      const r = await step(page, 'graph', `depth to ${d}`, { keys, allow: ['.side-bar', GRAPH_BOXES] }, () => page.locator('.graph-depth button', { hasText: d }).click());
      expectStable(r);
    }
  });

  test('LA-BRW-T744 focusing anything moves the camera only: no box changes its place or size', async ({ page }) => {
    await openPage(page, '/LA?view=graph');
    await nodes(page);
    /** Every drawn box's place and size in the map (its style, in world units), and the camera. */
    const read = () => page.evaluate(() => ({
      camera: document.querySelector<HTMLElement>('.pane-graph .react-flow__viewport')!.style.transform,
      boxes: [...document.querySelectorAll<HTMLElement>('.pane-graph .react-flow__node')].map((el) => [el.dataset.id!, `${el.style.transform} ${el.style.width} ${el.style.height}`] as const),
    }));
    const seen = new Map<string, string>();
    const cameras: string[] = [];
    const check = async (where: string) => {
      const { camera, boxes } = await read();
      cameras.push(camera);
      for (const [id, box] of boxes) {
        if (seen.has(id)) expect(box, `${id} at ${where}`).toBe(seen.get(id));
        seen.set(id, box);
      }
    };
    await check('the product');
    const keys = [PANE_BAR, PANE_TITLE, GRAPH_HEADER, GRAPH_CANVAS, '.pane-graph .graph-flow .react-flow__renderer'];
    for (const id of ['LA-BRW', 'LA-BRW/define', 'LA-BRW/define/use-cases', 'LA-BRW-CAP03', 'LA-BRW-UC20']) {
      const before = new URL(page.url()).pathname;
      const r = await step(page, 'graph', `focus ${id}`, { keys, allow: ['.side-bar', GRAPH_BOXES] }, async () => {
        await page.locator(`.pane-graph .react-flow__node[data-id="${id}"]`).click({ force: true });
        await page.waitForURL((u) => u.pathname !== before);
        await page.locator(`.pane-graph .react-flow__node[data-id="${id}"] .is-focus`).waitFor();
      });
      expectStable(r);
      await page.waitForTimeout(900);
      await check(id);
    }
    for (const move of ['back', 'back', 'forward'] as const) {
      if (move === 'back') await page.goBack(); else await page.goForward();
      await page.waitForTimeout(900);
      await check(move);
    }
    // The camera moved at every step; the map never did.
    expect(new Set(cameras).size).toBeGreaterThan(5);
    expect(seen.size).toBeGreaterThan(50);
  });

  test('LA-BRW-T746 a domain is drawn as a hexagon: its outline is the polygon, in every state', async ({ page }) => {
    await openPage(page, '/LA?view=graph');
    const domain = page.locator('.pane-graph .react-flow__node[data-id="LA-BRW"] .graph-node');
    await domain.waitFor();
    /** The drawn outline: the clip-path polygon's six points, and the inner fill clipped the same way. */
    const outline = () => domain.evaluate((el) => {
      const style = getComputedStyle(el);
      const inner = getComputedStyle(el, '::before');
      return { clip: style.clipPath, inner: inner.clipPath, edge: style.backgroundColor, radius: style.borderRadius, shadow: style.boxShadow };
    });
    const at = await outline();
    expect(at.clip).toMatch(/^polygon\(/);
    expect(at.inner).toBe(at.clip);
    expect(at.shadow).toBe('none');
    // Hovered, the edge takes the hover color, still on the outline.
    await page.locator('.pane-graph .react-flow__node[data-id="LA-BRW"]').hover();
    const hovered = await outline();
    expect(hovered.clip).toBe(at.clip);
    expect(hovered.edge).not.toBe(at.edge);
    // Focused, the same outline, in ink.
    await page.locator('.pane-graph .react-flow__node[data-id="LA-BRW"]').click();
    await page.waitForURL(/\/LA-BRW(\?|$)/);
    await expect(domain).toHaveClass(/is-focus/);
    expect((await outline()).clip).toMatch(/^polygon\(/);
    // Every other kind keeps its box.
    const product = await page.locator('.pane-graph .react-flow__node[data-id="LA"] .graph-node').evaluate((el) => getComputedStyle(el).clipPath);
    expect(product).toBe('none');
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
