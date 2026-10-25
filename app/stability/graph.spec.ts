import { expect, test, type Page } from '@playwright/test';
import { expectStable, openPage, step } from './measure';
import { DOMAIN, GRAPH_CANVAS, GRAPH_HEADER, MODEL_CANVAS, RECORD } from './scenarios';

// LA-PLT-T76: re-centering the graph at depth 1, 2 and 3, and moving around the ERD. The camera
// glides (a transform, which is no layout shift); the pane's title, the graph's header and its
// canvas must hold still, and the canvas must not be drawn anew.
// LA-EXP-T173: focusing a domain, a stage, a folder and a record, then Back and Forward, moves the
// camera only: no box of the one map changes its place or its size.

const PANE_TITLE = '.pane-graph .pane-title';
/**
 * The graph's boxes. A re-center moves the camera over the one map (LA-EXP-DR59), and the boxes
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

/**
 * In a narrow pane a framed level may run past the canvas's right edge (LA-EXP-DR59): a box is in
 * view when its left part is and it is 24 px tall or more, and is clicked or hovered there.
 */
const AT_LEFT = { x: 20, y: 12 };
/** The ID of the n-th record box (not the center) that is wholly inside the canvas. */
async function visibleNode(page: Page, n: number): Promise<string> {
  const ids = await page.evaluate(() => {
    const canvas = document.querySelector('.pane-graph .graph-flow')!.getBoundingClientRect();
    return [...document.querySelectorAll<HTMLElement>('.graph-flow .react-flow__node[data-id^="LA-"]')]
      .filter((el) => !el.querySelector('.is-focus'))
      .filter((el) => { const r = el.getBoundingClientRect(); return r.height >= 24 && r.left >= canvas.left && r.left + 40 <= canvas.right && r.top >= canvas.top && r.bottom <= canvas.bottom - 40; })
      .map((el) => el.dataset.id!);
  });
  expect(ids.length, 'a record box in view').toBeGreaterThan(0);
  return ids[Math.min(n, ids.length - 1)];
}

test.describe('graph', () => {
  for (const depth of [1, 2, 3]) {
    test(`LA-PLT-T76 re-center at depth ${depth}`, async ({ page }) => {
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
          await page.locator(`.graph-flow .react-flow__node[data-id="${id}"]`).click({ position: AT_LEFT });
          await page.waitForURL((u) => u.pathname !== before);
        });
        expectStable(r);
      }
    });
  }

  test('LA-PLT-T76 change the depth', async ({ page }) => {
    await openPage(page, `${RECORD}?view=graph`);
    await nodes(page);
    const keys = [PANE_BAR, PANE_TITLE, GRAPH_HEADER, GRAPH_CANVAS];
    for (const d of ['2', '3', '1']) {
      const r = await step(page, 'graph', `depth to ${d}`, { keys, allow: ['.side-bar', GRAPH_BOXES] }, () => page.locator('.graph-depth button', { hasText: d }).click());
      expectStable(r);
    }
  });

  test('LA-EXP-T173 focusing anything moves the camera only: no box changes its place or size', async ({ page }) => {
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
    for (const id of ['LA-EXP', 'LA-EXP/define', 'LA-EXP/define/use-cases', 'LA-EXP-CAP03', 'LA-EXP-UC03']) {
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

  test('LA-EXP-T175 a domain is drawn as a hexagon: its outline is the polygon, in every state', async ({ page }) => {
    await openPage(page, '/LA?view=graph');
    const domain = page.locator('.pane-graph .react-flow__node[data-id="LA-EXP"] .graph-node');
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
    await page.locator('.pane-graph .react-flow__node[data-id="LA-EXP"]').hover();
    const hovered = await outline();
    expect(hovered.clip).toBe(at.clip);
    expect(hovered.edge).not.toBe(at.edge);
    // Focused, the same outline, in ink.
    await page.locator('.pane-graph .react-flow__node[data-id="LA-EXP"]').click();
    await page.waitForURL(/\/LA-EXP(\?|$)/);
    await expect(domain).toHaveClass(/is-focus/);
    expect((await outline()).clip).toMatch(/^polygon\(/);
    // Every other kind keeps its box.
    const product = await page.locator('.pane-graph .react-flow__node[data-id="LA"] .graph-node').evaluate((el) => getComputedStyle(el).clipPath);
    expect(product).toBe('none');
  });

  test('LA-EXP-T177 at depth 2 on a domain, every framed box whose title is 7 px or more on screen shows it in full, wrapped on whole words', async ({ page }) => {
    await openPage(page, `${DOMAIN}?view=graph`);
    await nodes(page);
    await page.locator('.graph-depth button', { hasText: '2' }).click();
    await page.waitForTimeout(1300);
    const domain = DOMAIN.slice(1);
    const boxes = await page.evaluate((domain) => {
      const canvas = document.querySelector('.pane-graph .graph-flow')!.getBoundingClientRect();
      const zoom = Number(/scale\(([\d.e-]+)\)/.exec(document.querySelector<HTMLElement>('.pane-graph .react-flow__viewport')!.style.transform)![1]);
      // The framed picture: the domain, its product at the left edge, and two levels below it (its stages, their folders).
      const framed = new RegExp(`^(LA|${domain}(/[^/]+){0,2})$`);
      return [...document.querySelectorAll<HTMLElement>('.pane-graph .react-flow__node[data-id]')]
        .filter((el) => framed.test(el.dataset.id!))
        .map((el) => {
          const r = el.getBoundingClientRect();
          const box = el.querySelector<HTMLElement>('.graph-node')!;
          const scale = Number(getComputedStyle(box).getPropertyValue('--node-scale')) || 1;
          const title = el.querySelector<HTMLElement>('strong');
          const lines = title ? [...title.querySelectorAll<HTMLElement>(':scope > span')] : [];
          const lineHeight = title ? parseFloat(getComputedStyle(title).lineHeight) : 0;
          return {
            id: el.dataset.id!,
            inView: r.left >= canvas.left && r.right <= canvas.right && r.top >= canvas.top && r.bottom <= canvas.bottom,
            // Its title's size on screen: 12.5 map units at its text scale, times the camera's zoom.
            onScreen: 12.5 * scale * zoom,
            full: box.getAttribute('title') ?? '',
            title: title?.textContent ?? null,
            // Each line the map broke it into fits, and every line but the last ends after a space or a hyphen.
            wrapped: !!title && lines.length > 0 && title.scrollHeight <= lines.length * lineHeight + 1 && lines.every((l) => l.scrollWidth <= l.clientWidth)
              && lines.slice(0, -1).every((l) => /[\s-]$/.test(l.textContent ?? '')),
          };
        });
    }, domain);
    const readable = boxes.filter((b) => b.inView && b.onScreen >= 7);
    // Each level's text is at most a third of the level before's (LA-EXP-DR58): in this pane, the domain's title reads at least.
    expect(readable.length, 'framed boxes whose title reads').toBeGreaterThanOrEqual(1);
    expect(readable.map((b) => b.id), 'the domain reads').toContain(domain);
    for (const b of readable) {
      expect(b.title, `${b.id} is labeled`).not.toBeNull();
      // The tooltip is "title (ID)" or, for a group, "title (in owner)": the label shows the whole title.
      expect(b.full.startsWith(`${b.title} (`), `${b.id} shows its full title`).toBe(true);
      expect(b.wrapped, `${b.id} fits its title, wrapped on whole words`).toBe(true);
    }
    // Below 7 px a box draws no label.
    for (const b of boxes.filter((x) => x.onScreen < 6.9)) expect(b.title, `${b.id} is plain`).toBeNull();
  });

  test('LA-EXP-T183 no label is clipped: each line fits its width and height, and the label fits its box, in light and dark, focused or not, at several zooms', async ({ page }) => {
    const clipped = () => page.evaluate(() => {
      const out: string[] = [];
      const canvas = document.querySelector('.pane-graph .graph-flow')!.getBoundingClientRect();
      for (const node of document.querySelectorAll<HTMLElement>('.pane-graph .react-flow__node[data-id]')) {
        const box = node.querySelector<HTMLElement>('.graph-node');
        if (!box || !box.querySelector('strong')) continue;
        const b = box.getBoundingClientRect();
        if (b.bottom < canvas.top || b.top > canvas.bottom || b.right < canvas.left || b.left > canvas.right) continue;
        // On screen sizes are scaled by the zoom; compare in the box's own units, with half a unit to spare.
        for (const line of box.querySelectorAll<HTMLElement>('small, strong, small > span, strong > span')) {
          const r = line.getBoundingClientRect();
          const tol = 0.5 * (b.width / box.offsetWidth) + 0.5;
          if (line.scrollWidth > line.clientWidth + 0.5) out.push(`${node.dataset.id} ${line.tagName}: ${line.scrollWidth} wide in ${line.clientWidth}`);
          if (line.scrollHeight > line.clientHeight + 0.5) out.push(`${node.dataset.id} ${line.tagName}: ${line.scrollHeight} tall in ${line.clientHeight}`);
          if (r.left < b.left - tol || r.right > b.right + tol || r.top < b.top - tol || r.bottom > b.bottom + tol) out.push(`${node.dataset.id} ${line.tagName}: outside its box`);
        }
      }
      return out;
    });
    for (const scheme of ['light', 'dark'] as const) {
      await page.emulateMedia({ colorScheme: scheme });
      for (const focus of [DOMAIN, `${DOMAIN}/define`]) {
        await openPage(page, `${focus}?view=graph`);
        await nodes(page);
        for (const depth of [1, 2, 3]) {
          await page.locator('.graph-depth button', { hasText: String(depth) }).click();
          await page.waitForTimeout(1300);
          expect(await clipped(), `${scheme} ${focus} at depth ${depth}`).toEqual([]);
        }
        // Zoomed in on the framed picture, twice.
        for (const z of [1, 2]) {
          await page.locator('.pane-graph .react-flow__controls-zoomin').click();
          await page.waitForTimeout(600);
          expect(await clipped(), `${scheme} ${focus} zoomed in ${z}`).toEqual([]);
        }
      }
    }
  });

  test('LA-EXP-T184 a label keeps its size in the map when the focus changes and the camera zooms', async ({ page }) => {
    await openPage(page, `${DOMAIN}?view=graph`);
    await nodes(page);
    const target = `${DOMAIN.slice(1)}/design`;
    const label = page.locator(`.pane-graph .react-flow__node[data-id="${target}"] strong`);
    await expect(label).toBeVisible();
    const size = () => label.evaluate((el) => ({ font: getComputedStyle(el).fontSize, screen: el.getBoundingClientRect().height, lines: [...el.children].map((l) => l.textContent) }));
    const zoom = () => page.evaluate(() => Number(/scale\(([\d.e-]+)\)/.exec(document.querySelector<HTMLElement>('.pane-graph .react-flow__viewport')!.style.transform)![1]));
    const before = { ...(await size()), zoom: await zoom() };
    // Focusing it moves the camera only: its font size in map units stays, and its size on screen follows the zoom.
    await page.locator(`.pane-graph .react-flow__node[data-id="${target}"]`).click();
    await page.waitForURL(/\/design(\?|$)/);
    await page.waitForTimeout(1300);
    const focused = { ...(await size()), zoom: await zoom() };
    expect(focused.font).toBe(before.font);
    expect(focused.lines).toEqual(before.lines);
    expect(focused.screen / before.screen).toBeCloseTo(focused.zoom / before.zoom, 1);
    // Zooming in by the camera's control: the same.
    await page.locator('.pane-graph .react-flow__controls-zoomin').click();
    await page.waitForTimeout(600);
    const zoomed = { ...(await size()), zoom: await zoom() };
    expect(zoomed.zoom).toBeGreaterThan(focused.zoom);
    expect(zoomed.font).toBe(before.font);
    expect(zoomed.lines).toEqual(before.lines);
    expect(zoomed.screen / focused.screen).toBeCloseTo(zoomed.zoom / focused.zoom, 1);
  });

  test('LA-PLT-T76 move around the ERD', async ({ page }) => {
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
      await expect(page).toHaveURL(/\/LA-EXP(\?|$)/);
    });
    expectStable(back);
  });
});
