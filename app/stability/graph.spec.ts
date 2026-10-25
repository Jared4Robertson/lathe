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
 * A level is as wide as its widest label (LA-EXP-DR58), so a box may run past the canvas's right
 * edge: a box is in view when its left part is and it is 24 px tall or more, and is clicked or hovered there.
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

  test('LA-EXP-T177 at depth 2 on a domain, every framed box whose title is 7 px or more on screen shows it in full on one line', async ({ page }) => {
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
          const lineHeight = title ? parseFloat(getComputedStyle(title).lineHeight) : 0;
          return {
            id: el.dataset.id!,
            inView: r.left >= canvas.left && r.right <= canvas.right && r.top >= canvas.top && r.bottom <= canvas.bottom,
            // Its title's size on screen: 12.5 map units at its text scale, times the camera's zoom.
            onScreen: 12.5 * scale * zoom,
            full: box.getAttribute('title') ?? '',
            title: title?.textContent ?? null,
            oneLine: !!title && title.scrollHeight <= lineHeight + 1 && title.scrollWidth <= title.clientWidth,
          };
        });
    }, domain);
    const readable = boxes.filter((b) => b.inView && b.onScreen >= 7);
    expect(readable.length, 'framed boxes whose title reads').toBeGreaterThanOrEqual(3);
    for (const b of readable) {
      expect(b.title, `${b.id} is labeled`).not.toBeNull();
      // The tooltip is "title (ID)" or, for a group, "title (in owner)": the label shows the whole title.
      expect(b.full.startsWith(`${b.title} (`), `${b.id} shows its full title`).toBe(true);
      expect(b.oneLine, `${b.id} fits its title on one line`).toBe(true);
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
        for (const line of box.querySelectorAll<HTMLElement>('small, strong')) {
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
    const size = () => label.evaluate((el) => ({ font: getComputedStyle(el).fontSize, screen: el.getBoundingClientRect().height }));
    const zoom = () => page.evaluate(() => Number(/scale\(([\d.e-]+)\)/.exec(document.querySelector<HTMLElement>('.pane-graph .react-flow__viewport')!.style.transform)![1]));
    const before = { ...(await size()), zoom: await zoom() };
    // Focusing it moves the camera only: its font size in map units stays, and its size on screen follows the zoom.
    await page.locator(`.pane-graph .react-flow__node[data-id="${target}"]`).click();
    await page.waitForURL(/\/design(\?|$)/);
    await page.waitForTimeout(1300);
    const focused = { ...(await size()), zoom: await zoom() };
    expect(focused.font).toBe(before.font);
    expect(focused.screen / before.screen).toBeCloseTo(focused.zoom / before.zoom, 1);
    // Zooming in by the camera's control: the same.
    await page.locator('.pane-graph .react-flow__controls-zoomin').click();
    await page.waitForTimeout(600);
    const zoomed = { ...(await size()), zoom: await zoom() };
    expect(zoomed.zoom).toBeGreaterThan(focused.zoom);
    expect(zoomed.font).toBe(before.font);
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

// LA-EXP-T189 (LA-EXP-UC03-R16, LA-EXP-UC03-R06, LA-EXP-UC03-R10): one table of the graph's
// features, run in the Tree and the Nested layout alike, so neither falls behind the other.
const LAYOUT_NAMES = { tree: 'Tree', nested: 'Nested' } as const;
type Layout = keyof typeof LAYOUT_NAMES;

const path = (page: Page) => new URL(page.url()).pathname;
const camera = (page: Page) => page.evaluate(() => document.querySelector<HTMLElement>('.pane-graph .react-flow__viewport')!.style.transform);
const labeledCount = (page: Page) => page.locator('.pane-graph .react-flow__node:not(.is-plain):not(.is-bar)').count();
/** Every drawn box's place and size in the map. */
const places = (page: Page) => page.evaluate(() => Object.fromEntries([...document.querySelectorAll<HTMLElement>('.pane-graph .react-flow__node')].map((el) => [el.dataset.id!, `${el.style.transform} ${el.style.width} ${el.style.height}`])));

/** A labeled record box, not the focus, with a good part of it in the canvas, and a point on that part to click or hover. */
async function labeledInView(page: Page): Promise<{ id: string; x: number; y: number }> {
  const found = await page.evaluate(() => {
    const c = document.querySelector('.pane-graph .graph-flow')!.getBoundingClientRect();
    // Clear of the zoom buttons at the bottom left and the edge hints.
    const area = { left: c.left + 60, right: c.right - 30, top: c.top + 20, bottom: c.bottom - 30 };
    for (const el of document.querySelectorAll<HTMLElement>('.pane-graph .react-flow__node[data-id^="LA-"]:not(.is-plain)')) {
      if (el.querySelector('.is-focus')) continue;
      const r = el.getBoundingClientRect();
      const l = Math.max(r.left, area.left); const rt = Math.min(r.right, area.right);
      const t = Math.max(r.top, area.top); const b = Math.min(r.bottom, area.bottom);
      if (rt - l < 40 || b - t < 16) continue;
      // The point must hit this box, not a child drawn over it.
      const x = (l + rt) / 2; const y = t + Math.min(12, (b - t) / 2);
      if (document.elementFromPoint(x, y)?.closest('.react-flow__node') !== el) continue;
      return { id: el.dataset.id!, x, y };
    }
    return null;
  });
  expect(found, 'a labeled record box in view').not.toBeNull();
  return found!;
}

/** The table: each feature of the graph, checked the same way in either layout. */
const PARITY: { feature: string; run: (page: Page, layout: Layout) => Promise<void> }[] = [
  {
    feature: 'the Layout switch and its v command',
    run: async (page, layout) => {
      await expect(page.locator('.pane-graph .graph-layout button[aria-pressed="true"]')).toHaveText(LAYOUT_NAMES[layout]);
      await expect(page.locator('.pane-graph .graph-flow')).toHaveAttribute('data-layout', layout);
    },
  },
  {
    feature: 'Links draws the focus\'s links as curves (on a use case with links)',
    run: async (page) => {
      await page.locator('.pane-graph .graph-links button').click();
      await expect(page.locator('.pane-graph .graph-edge.is-link').first()).toBeAttached();
      await page.locator('.pane-graph .graph-links button').click();
      await expect(page.locator('.pane-graph .graph-edge.is-link')).toHaveCount(0);
    },
  },
  {
    feature: 'a click focuses a box, and the trail grows',
    run: async (page) => {
      const before = path(page);
      const { id, x, y } = await labeledInView(page);
      await page.mouse.click(x, y);
      await page.waitForURL((u) => u.pathname !== before);
      await expect(page.locator(`.pane-graph .react-flow__node[data-id="${id}"] .graph-node.is-focus`)).toBeVisible();
      expect(await page.locator('.pane-graph .graph-trail li').count()).toBeGreaterThanOrEqual(2);
      await page.waitForTimeout(1300);
    },
  },
  {
    feature: 'Back and Forward glide the camera',
    run: async (page) => {
      const here = path(page);
      const framed = await camera(page);
      await page.goBack();
      await page.waitForURL((u) => u.pathname !== here);
      await page.waitForTimeout(1300);
      expect(await camera(page)).not.toBe(framed);
      await page.goForward();
      await page.waitForURL((u) => u.pathname === here);
      await page.waitForTimeout(1300);
      expect(await camera(page)).toBe(framed);
    },
  },
  {
    feature: 'the step keys step out to the parent and back in',
    run: async (page) => {
      const here = path(page);
      await page.locator('.pane-graph .graph-count').click();
      await page.keyboard.press('Alt+ArrowUp');
      await page.waitForURL((u) => u.pathname !== here);
      await page.goBack();
      await page.waitForURL((u) => u.pathname === here);
      await page.waitForTimeout(900);
    },
  },
  {
    feature: 'Tab and the arrow keys reach the labeled boxes with a visible focus ring, and Enter focuses one',
    run: async (page) => {
      const here = path(page);
      await page.locator('.pane-graph .react-flow__node[data-id]:not(.is-plain)').first().focus();
      await page.keyboard.press('ArrowRight');
      const ring = await page.evaluate(() => {
        const el = document.activeElement as HTMLElement | null;
        const box = el?.querySelector<HTMLElement>('.graph-node');
        return { node: !!el?.classList.contains('react-flow__node'), outline: box ? getComputedStyle(box).outlineStyle : 'none', id: el?.dataset.id ?? '' };
      });
      expect(ring.node, 'keyboard focus is on a box').toBe(true);
      expect(ring.outline, 'the focus ring shows').not.toBe('none');
      await page.keyboard.press('Enter');
      if (ring.id !== here.slice(1)) await page.waitForURL((u) => u.pathname !== here);
      await page.goBack();
      await page.waitForURL((u) => u.pathname === here);
      await page.waitForTimeout(900);
    },
  },
  {
    feature: 'the . command frames the focus again after a free zoom',
    run: async (page) => {
      const framed = await camera(page);
      await page.locator('.pane-graph .react-flow__controls-zoomout').click();
      await page.waitForTimeout(600);
      expect(await camera(page)).not.toBe(framed);
      await page.locator('.pane-graph .graph-count').click();
      await page.keyboard.press('.');
      await page.waitForTimeout(1300);
      expect(await camera(page)).toBe(framed);
    },
  },
  {
    feature: 'depth 1 to 3 labels or frames more',
    run: async (page) => {
      const counts: number[] = [];
      for (const d of ['1', '2', '3']) {
        await page.locator('.pane-graph .graph-depth button', { hasText: d }).click();
        await expect(page.locator('.pane-graph .graph-depth button', { hasText: d })).toHaveAttribute('aria-pressed', 'true');
        await page.waitForTimeout(1300);
        counts.push(await labeledCount(page));
      }
      expect(counts.every((c) => c > 0), `labeled boxes at depths 1-3: ${counts}`).toBe(true);
      await page.locator('.pane-graph .graph-depth button', { hasText: '1' }).click();
      await page.waitForTimeout(1300);
    },
  },
  {
    feature: 'a hidden kind keeps its space, and the minimap shows',
    run: async (page) => {
      const before = await places(page);
      await page.locator('.pane-graph .graph-filters > summary').click();
      const kind = page.locator('.pane-graph .graph-filter-body fieldset').nth(1).locator('input[type="checkbox"]').first();
      await kind.uncheck();
      await page.waitForTimeout(600);
      const after = await places(page);
      for (const [id, place] of Object.entries(after)) if (before[id] && !id.startsWith('bar:')) expect(place, id).toBe(before[id]);
      await kind.check();
      await page.locator('.pane-graph .graph-filter-body input[role="switch"]').check();
      await expect(page.locator('.pane-graph .graph-minimap')).toBeVisible();
      await page.locator('.pane-graph .graph-filter-body input[role="switch"]').uncheck();
      await page.locator('.pane-graph .graph-filters > summary').click();
    },
  },
  {
    feature: 'hovering a box spotlights it and Details follows the hover',
    run: async (page) => {
      const { id, x, y } = await labeledInView(page);
      await page.mouse.move(x, y);
      await expect(page.locator('.pane-graph .graph-flow.has-spotlight')).toBeAttached();
      await expect(page.locator('.side-bar')).toContainText(id);
      await page.mouse.move(2, 2);
    },
  },
  {
    feature: 'the side bar\'s Outline lists what the camera frames, and History opens',
    run: async (page) => {
      for (const view of ['Outline', 'History', 'Details']) {
        await page.locator('.side-bar .side-switch button', { hasText: view }).or(page.locator(`.side-bar .side-switch button[aria-label="${view}"]`)).first().click();
        await page.locator('.side-bar .side-view > h2', { hasText: view }).waitFor();
        if (view === 'Outline') expect(await page.locator('.side-bar .side-view a, .side-bar .side-view li').count()).toBeGreaterThan(0);
      }
    },
  },
  {
    feature: 'no label is clipped',
    run: async (page) => {
      const clipped = await page.evaluate(() => {
        const out: string[] = [];
        for (const node of document.querySelectorAll<HTMLElement>('.pane-graph .react-flow__node[data-id]')) {
          const box = node.querySelector<HTMLElement>('.graph-node');
          if (!box) continue;
          for (const line of box.querySelectorAll<HTMLElement>('small, strong')) {
            if (line.scrollWidth > line.clientWidth + 0.5) out.push(`${node.dataset.id} ${line.tagName}: ${line.scrollWidth} wide in ${line.clientWidth}`);
            if (line.scrollHeight > line.clientHeight + 0.5) out.push(`${node.dataset.id} ${line.tagName}: ${line.scrollHeight} tall in ${line.clientHeight}`);
            if (line.offsetTop + line.offsetHeight > box.clientHeight + 1) out.push(`${node.dataset.id} ${line.tagName}: below its box`);
          }
        }
        return out;
      });
      expect(clipped).toEqual([]);
    },
  },
];

for (const layout of ['tree', 'nested'] as const) {
  test(`LA-EXP-T189 every graph feature works in the ${LAYOUT_NAMES[layout]} layout`, async ({ page }) => {
    await openPage(page, `${RECORD}?view=graph`);
    await nodes(page);
    await page.locator('.pane-graph .react-flow__node[data-id^="LA-"]:not(.is-plain)').nth(1).waitFor();
    await page.waitForTimeout(900);
    if (layout === 'nested') {
      await page.locator('.pane-graph .graph-count').click();
      await page.keyboard.press('v');
      await page.waitForTimeout(1300);
    }
    for (const row of PARITY) await test.step(row.feature, () => row.run(page, layout));
    if (layout === 'nested') {
      await test.step('every drawn child lies inside its parent on screen', async () => {
        const outside = await page.evaluate(() => {
          const rects = new Map([...document.querySelectorAll<HTMLElement>('.pane-graph .react-flow__node[data-id]')].map((el) => [el.dataset.id!, el.getBoundingClientRect()]));
          const out: string[] = [];
          for (const [id, r] of rects) {
            // A child's ID extends its parent's here: a group's by "/", a record's own children by "-".
            for (const [pid, p] of rects) {
              if (pid === id || !(id.startsWith(`${pid}/`))) continue;
              if (r.left < p.left - 1 || r.right > p.right + 1 || r.top < p.top - 1 || r.bottom > p.bottom + 1) out.push(`${id} outside ${pid}`);
            }
          }
          return out;
        });
        expect(outside).toEqual([]);
      });
      await test.step('the layout is kept with the tab across a reload', async () => {
        await page.reload();
        await nodes(page);
        await expect(page.locator('.pane-graph .graph-layout button[aria-pressed="true"]')).toHaveText('Nested');
      });
    }
  });
}
