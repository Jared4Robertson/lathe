import type { Page } from '@playwright/test';
import { expect, test } from './test';
import { openPage } from './measure';
import { erdDrawn, erdSceneOf, GRAPH, graphDrawn, sceneOf, traceDrawn, traceSceneOf } from './scene';

// The focused box is always whole on screen (LA-PAT-APP-UX-R23): on every stage, framing a focus puts its whole box in
// the frame, never cut at the canvas's edge and never under a floating panel (the nav, the wiki card, the key, the
// minimap) or the stage's tools; on the Graph, unless its direct children cannot read with it whole (LA-V93-R77): then
// each of them is drawn with a readable title and the first of them is clear of every panel. A domain and a pattern
// with many rules on the Graph's Tree, the pattern in the Nested view and the Map, a use case with its flows on the Map
// and on the Trace stage, and a domain on the ERD.

const MANY = 'LA-PAT-APP-UX';
const USE_CASE = 'LA-UCS-UC06';
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

/** What is wrong with the Graph's framing: the focus whole and clear, or else its children read and the first of them is clear. */
async function graphFraming(page: Page): Promise<string[]> {
  const covered = await coveredBy(page, await graphFocus(page), GRAPH);
  if (covered.length === 0) return [];
  const children = (await sceneOf(page)).boxes.filter((b) => b.child);
  if (children.length === 0) return covered;
  const unread = children.filter((b) => b.block || !b.lines.some((l) => l.face === 'title' && l.text.trim() !== '' && l.fontPx >= 12.5 - 1e-6)).map((b) => `${b.id} unread`);
  const first = children.reduce((a, b) => (b.rect.top < a.rect.top || (b.rect.top === a.rect.top && b.rect.left < a.rect.left) ? b : a));
  return [...unread, ...(await coveredBy(page, first.rect, GRAPH)).map((c) => `its first child under ${c}`)];
}

test.describe('the focused box is always whole on screen', () => {
  test('LA-PAT-APP-UX-R23-T02 On the Graph (Tree with the minimap, Nested, Map), the Trace and the ERD, the framed focus is whole and clear of every panel', async ({ page }) => {
    // The Graph's Tree: a domain with its stages, at depths 1 to 3, with the minimap on.
    await openPage(page, `/${DOMAIN}?stage=graph`, `${GRAPH} .graph-box`);
    await graphDrawn(page, 'tree', 900);
    await page.locator('.focus-stage .graph-filters summary').click();
    await page.locator('.focus-stage .graph-filters').getByRole('switch', { name: 'Minimap' }).check();
    await page.locator('.focus-stage .graph-filters summary').click();
    for (const depth of ['1', '2', '3']) {
      await page.locator('.focus-stage .graph-depth:not(.graph-layout) button', { hasText: depth }).click();
      await page.waitForTimeout(900);
      expect(await graphFraming(page), `Tree depth ${depth}`).toEqual([]);
    }
    // A focus with many children: on the Tree, in Nested and on the Map, whole, or its children read beside it.
    await openPage(page, `/${MANY}?stage=graph`, `${GRAPH} .graph-box`);
    await graphDrawn(page, 'tree', 900);
    expect(await graphFraming(page), 'Tree, many children').toEqual([]);
    for (const layout of ['Nested', 'Map']) {
      await page.locator('.focus-stage .graph-layout button', { hasText: layout }).click();
      await page.waitForTimeout(900);
      expect(await graphFraming(page), layout).toEqual([]);
    }
    // Then, on the Map, a use case too big for the pane at street level.
    await openPage(page, `/${USE_CASE}?stage=graph`, `${GRAPH} .graph-box`);
    await graphDrawn(page, 'map', 900);
    expect(await graphFraming(page), 'Map, a use case').toEqual([]);

    // The Trace: the use case's box in its row.
    await openPage(page, `/${USE_CASE}?stage=trace`);
    await traceDrawn(page, 900);
    const row = (await traceSceneOf(page)).boxes.find((b) => b.focus);
    expect(row, 'the focus is drawn').toBeTruthy();
    expect(await coveredBy(page, row!.rect, '.focus-stage .trace-flow'), 'Trace').toEqual([]);

    // The ERD: a domain.
    await openPage(page, `/${DOMAIN}?stage=erd`);
    await erdDrawn(page, 900);
    const erd = (await erdSceneOf(page)).boxes.find((b) => b.focus);
    expect(erd, 'the focus is drawn').toBeTruthy();
    expect(await coveredBy(page, erd!.rect, '.focus-stage .erd-flow'), 'ERD').toEqual([]);
  });
});
