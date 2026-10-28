import { expect, test, type Page } from '@playwright/test';
import { openPage } from './measure';
import { cameraOf, clickBox, GRAPH, graphDrawn } from './scene';

// LA-V93-R72-T02: moving through the graph never changes how it is drawn. In each layout, the four
// arrows and clicks on boxes step across pages already open in a tab (a lasting one, drawn
// differently before the person changed the settings) and pages that are not; the layout, depth
// and Links switch stay as the person set them.

const FLOW = 'LA-EXP-UC03-FL01';
const LAYOUTS = { tree: 'Tree', nested: 'Nested', voronoi: 'Voronoi' } as const;

const at = (page: Page) => new URL(page.url()).pathname.slice(1);
const drawn = async (page: Page) => ({
  layout: await page.locator(GRAPH).getAttribute('data-layout'),
  pressed: (await page.locator('.pane-graph .graph-layout button[aria-pressed="true"]').textContent())?.trim(),
  depth: (await page.locator('.pane-graph .graph-depth:not(.graph-layout) button[aria-pressed="true"]').textContent())?.trim(),
  links: await page.locator('.pane-graph button', { hasText: /^Links/ }).getAttribute('aria-pressed'),
});

/** One move: the address changes, and the graph draws the new focus. */
async function move(page: Page, how: () => Promise<unknown>) {
  const from = at(page);
  await how();
  await page.waitForURL((u) => u.pathname.slice(1) !== from);
  await graphDrawn(page, undefined, 300);
}

/** Waits for the camera to stop gliding, so a point found on a box is still on it when clicked. */
async function cameraStill(page: Page) {
  let before = await cameraOf(page);
  for (;;) {
    await page.waitForTimeout(150);
    const now = await cameraOf(page);
    if (now === before) return;
    before = now;
  }
}

for (const layout of ['tree', 'nested', 'voronoi'] as const) {
  test(`LA-V93-R72-T02 in the ${LAYOUTS[layout]} layout, the arrows and clicks keep the layout, depth and Links, into tabs open or new`, async ({ page }) => {
    await openPage(page, `/${FLOW}?view=graph`);
    await graphDrawn(page);
    const canvas = page.locator(`${GRAPH}`);
    // A lasting tab on the flow, drawn as it starts (Tree, depth 1, Links off).
    await page.locator('.tab.is-preview [role="tab"]').dblclick();
    await canvas.focus();
    await move(page, () => page.keyboard.press('ArrowRight'));
    const step = at(page);
    // A lasting tab on its first step, where the person sets depth 2, Links on and the layout.
    await page.locator('.tab.is-preview [role="tab"]').dblclick();
    await page.locator('.pane-graph .graph-depth:not(.graph-layout) button', { hasText: '2' }).click();
    await page.locator('.pane-graph button', { hasText: /^Links/ }).click();
    await page.locator('.pane-graph .graph-layout button', { hasText: LAYOUTS[layout] }).click();
    await graphDrawn(page, layout, 900);
    const set = { layout, pressed: LAYOUTS[layout], depth: '2', links: 'true' };
    expect(await drawn(page)).toEqual(set);

    // The four arrows: out to the flow's tab, in to the step's, and down and up across steps no tab holds.
    await canvas.focus();
    for (const key of ['ArrowLeft', 'ArrowRight', 'ArrowDown', 'ArrowDown', 'ArrowUp', 'ArrowUp', 'ArrowLeft']) {
      await move(page, () => page.keyboard.press(key));
      expect(await drawn(page), `${key} to ${at(page)}`).toEqual(set);
    }
    expect(at(page)).toBe(FLOW);
    // Clicks from the flow: on the step open in its tab, and on steps no tab holds (the preview's
    // and a new one's), each time back to the flow's tab by the Left arrow.
    for (const id of [step, `${FLOW}-S04`, `${FLOW}-S05`]) {
      await cameraStill(page);
      await move(page, () => clickBox(page, id));
      expect(await drawn(page), `a click to ${id}`).toEqual(set);
      await canvas.focus();
      await move(page, () => page.keyboard.press('ArrowLeft'));
      expect(await drawn(page), `ArrowLeft from ${id}`).toEqual(set);
    }
  });
}
