import { expect, test, type Page } from '@playwright/test';
import { openPage } from './measure';
import { cameraOf, clickBox, GRAPH, graphDrawn } from './scene';

// LA-V93-R72-T02: moving through the graph never changes how it is drawn. In each layout, the four
// arrows and clicks on boxes step across pages already open in a tab (a lasting one, drawn
// differently before the person changed the settings) and pages that are not; the layout, depth
// and minimap stay as the person set them.

const FLOW = 'LA-EXP-UC03-FL01';
const LAYOUTS = { tree: 'Tree', nested: 'Nested' } as const;
/** The arrow for each step in each layout (LA-V93-R19): Tree steps Left out and Right in; Nested, Up out and Down in. */
const NESTED = { out: 'ArrowUp', in: 'ArrowDown', previous: 'ArrowLeft', next: 'ArrowRight' } as const;
const ARROWS = { tree: { out: 'ArrowLeft', in: 'ArrowRight', previous: 'ArrowUp', next: 'ArrowDown' }, nested: NESTED } as const;

const at = (page: Page) => new URL(page.url()).pathname.slice(1);
const drawn = async (page: Page) => ({
  layout: await page.locator(GRAPH).getAttribute('data-layout'),
  pressed: (await page.locator('.focus-stage .graph-layout button[aria-pressed="true"]').textContent())?.trim(),
  depth: (await page.locator('.focus-stage .graph-depth:not(.graph-layout) button[aria-pressed="true"]').textContent())?.trim(),
  minimap: await page.locator('.focus-stage .graph-minimap').count() > 0,
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

for (const layout of ['tree', 'nested'] as const) {
  test(`LA-V93-R72-T02 in the ${LAYOUTS[layout]} layout, the arrows and clicks keep the layout, depth and minimap, into tabs open or new`, async ({ page }) => {
    await openPage(page, `/${FLOW}?stage=graph`);
    await graphDrawn(page);
    const canvas = page.locator(`${GRAPH}`);
    // A lasting tab on the flow, drawn as it starts (Tree, depth 1, no minimap).
    await page.locator('.tab.is-preview [role="tab"]').dblclick();
    await canvas.focus();
    await move(page, () => page.keyboard.press('ArrowRight'));
    const step = at(page);
    // A lasting tab on its first step, where the person sets depth 2, the minimap and the layout.
    await page.locator('.tab.is-preview [role="tab"]').dblclick();
    await page.locator('.focus-stage .graph-depth:not(.graph-layout) button', { hasText: '2' }).click();
    await page.locator('.focus-stage .graph-filters > summary').click();
    await page.locator('.focus-stage .graph-filter-body input[role="switch"]').check();
    await page.locator('.focus-stage .graph-filters > summary').click();
    await page.locator('.focus-stage .graph-layout button', { hasText: LAYOUTS[layout] }).click();
    await graphDrawn(page, layout, 900);
    const set = { layout, pressed: LAYOUTS[layout], depth: '2', minimap: true };
    expect(await drawn(page)).toEqual(set);

    // The four arrows, each taking its step in this layout (LA-V93-R19): out to the flow's tab, in to the step's, and
    // across to the next and previous steps no tab holds.
    await canvas.focus();
    for (const key of (['out', 'in', 'next', 'next', 'previous', 'previous', 'out'] as const).map((s) => ARROWS[layout][s])) {
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
      await move(page, () => page.keyboard.press(ARROWS[layout].out));
      expect(await drawn(page), `${ARROWS[layout].out} from ${id}`).toEqual(set);
    }
  });
}
