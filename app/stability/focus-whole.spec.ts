import { expect, test, type Page } from '@playwright/test';
import { openPage } from './measure';
import { erdDrawn, erdSceneOf, GRAPH, graphDrawn, sceneOf, traceDrawn, traceSceneOf } from './scene';
import type { DeliveryHost } from '../src/trace/delivery/TraceDelivery';

// The focused box is always whole on screen (LA-PAT-APP-UX-R23): on every stage, framing a focus puts its whole box in
// the frame, never cut at the canvas's edge and never under a floating panel (the nav, the wiki card, the key, the
// minimap) or the stage's tools. A pattern with many rules on the Graph's Tree (the frame once cut it to read its
// children), its box in the Nested view and the Map, a use case with its flows on the Map and the Trace's two views, and
// a domain on the ERD.

const MANY = 'LA-PAT-APP-UX';
const USE_CASE = 'LA-AUT-UC06';
const DOMAIN = 'LA-EXP';

type Rect = { left: number; top: number; width: number; height: number };

/** What cuts or covers a box on screen: the canvas's edges, and every floating panel and stage tool it lies under. */
const coveredBy = (page: Page, box: Rect, stage: string) => page.evaluate(({ box, stage }) => {
  const out: string[] = [];
  const canvas = document.querySelector(`${stage} canvas`)!.getBoundingClientRect();
  const [l, t, r, b] = [box.left, box.top, box.left + box.width, box.top + box.height];
  if (l < canvas.left - 0.5 || t < canvas.top - 0.5 || r > canvas.right + 0.5 || b > canvas.bottom + 0.5) out.push('the canvas edge');
  for (const el of document.querySelectorAll<HTMLElement>('[data-floating], [data-stage-tools]')) {
    const p = el.getBoundingClientRect();
    if (p.width <= 0 || p.height <= 0) continue;
    if (l < p.right - 0.5 && r > p.left + 0.5 && t < p.bottom - 0.5 && b > p.top + 0.5) out.push(el.className || el.tagName);
  }
  return out;
}, { box, stage });

/** The Graph's focused box as drawn. */
async function graphFocus(page: Page): Promise<Rect> {
  const f = (await sceneOf(page)).boxes.find((b) => b.focus);
  expect(f, 'the focus is drawn').toBeTruthy();
  return f!.rect;
}

test.describe('the focused box is always whole on screen', () => {
  test('LA-PAT-APP-UX-R23-T02 On the Graph (Tree with the minimap, Nested, Map), the Trace (All at once, Delivery) and the ERD, the framed focus is whole and clear of every panel', async ({ page }) => {
    // The Graph's Tree: a focus with many children, at depths 1 to 3, with the minimap on.
    await openPage(page, `/${MANY}?stage=graph`, `${GRAPH} .graph-box`);
    await graphDrawn(page, 'tree', 900);
    await page.locator('.focus-stage .graph-filters summary').click();
    await page.locator('.focus-stage .graph-filters').getByRole('switch', { name: 'Minimap' }).check();
    await page.locator('.focus-stage .graph-filters summary').click();
    for (const depth of ['1', '2', '3']) {
      await page.locator('.focus-stage .graph-depth:not(.graph-layout) button', { hasText: depth }).click();
      await page.waitForTimeout(900);
      expect(await coveredBy(page, await graphFocus(page), GRAPH), `Tree depth ${depth}`).toEqual([]);
    }
    // Nested and the Map: the same focus, then a use case too big for the pane at street level.
    for (const layout of ['Nested', 'Map']) {
      await page.locator('.focus-stage .graph-layout button', { hasText: layout }).click();
      await page.waitForTimeout(900);
      expect(await coveredBy(page, await graphFocus(page), GRAPH), layout).toEqual([]);
    }
    await openPage(page, `/${USE_CASE}?stage=graph`, `${GRAPH} .graph-box`);
    await graphDrawn(page, 'map', 900);
    expect(await coveredBy(page, await graphFocus(page), GRAPH), 'Map, a use case').toEqual([]);

    // The Trace: All at once, then Delivery.
    await openPage(page, `/${USE_CASE}?stage=trace`);
    await traceDrawn(page, 900);
    const all = (await traceSceneOf(page)).boxes.find((b) => b.focus);
    expect(all, 'the focus is drawn').toBeTruthy();
    expect(await coveredBy(page, all!.rect, '.focus-stage .trace-flow'), 'All at once').toEqual([]);
    await page.getByRole('group', { name: 'Trace view' }).getByRole('button', { name: 'Delivery' }).click();
    const delivery = '.focus-stage .trace-flow[data-view="delivery"]';
    await page.locator(`${delivery}[data-ready] canvas`).waitFor();
    await page.waitForTimeout(900);
    const row = await page.evaluate((sel) => (document.querySelector(sel) as DeliveryHost).deliveryScene!(false).boxes.find((b) => b.focus)?.rect, delivery);
    expect(row, 'the focus is drawn').toBeTruthy();
    expect(await coveredBy(page, row!, delivery), 'Delivery').toEqual([]);

    // The ERD: a domain.
    await openPage(page, `/${DOMAIN}?stage=erd`);
    await erdDrawn(page, 900);
    const erd = (await erdSceneOf(page)).boxes.find((b) => b.focus);
    expect(erd, 'the focus is drawn').toBeTruthy();
    expect(await coveredBy(page, erd!.rect, '.focus-stage .erd-flow'), 'ERD').toEqual([]);
  });
});
