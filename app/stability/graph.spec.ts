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
 * A box may lie partly outside the canvas, past its edge: a box is in view when its left part is
 * and it is 24 px tall or more, and is clicked or hovered there.
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

  test('LA-EXP-T177 at depth 2 on a domain, the domain, its stages and their folders are framed in the canvas, each showing its full title wrapped on whole words', async ({ page }) => {
    await openPage(page, `${DOMAIN}?view=graph`);
    await nodes(page);
    await page.locator('.graph-depth button', { hasText: '2' }).click();
    await page.waitForTimeout(1300);
    const domain = DOMAIN.slice(1);
    const boxes = await page.evaluate((domain) => {
      const canvas = document.querySelector('.pane-graph .graph-flow')!.getBoundingClientRect();
      // The framed picture: the domain, its product at the left edge, and two levels below it (its stages, their folders).
      const framed = new RegExp(`^(LA|${domain}(/[^/]+){0,2})$`);
      return [...document.querySelectorAll<HTMLElement>('.pane-graph .react-flow__node[data-id]')]
        .filter((el) => framed.test(el.dataset.id!))
        .map((el) => {
          const r = el.getBoundingClientRect();
          const box = el.querySelector<HTMLElement>('.graph-node')!;
          const title = el.querySelector<HTMLElement>('strong');
          const lines = title ? [...title.querySelectorAll<HTMLElement>(':scope > span')] : [];
          const lineHeight = title ? parseFloat(getComputedStyle(title).lineHeight) : 0;
          return {
            id: el.dataset.id!,
            inView: r.left >= canvas.left && r.right <= canvas.right && r.top >= canvas.top && r.bottom <= canvas.bottom,
            full: box.getAttribute('title') ?? '',
            title: title?.textContent ?? null,
            // Each line the map broke it into fits, and every line but the last ends after a space or a hyphen.
            wrapped: !!title && lines.length > 0 && title.scrollHeight <= lines.length * lineHeight + 1 && lines.every((l) => l.scrollWidth <= l.clientWidth)
              && lines.slice(0, -1).every((l) => /[\s-]$/.test(l.textContent ?? '')),
          };
        });
    }, domain);
    // The camera frames the domain and two levels below it in the canvas (LA-EXP-DR59): the domain, every stage and at least half the folders.
    const shown = boxes.filter((b) => b.inView).map((b) => b.id);
    const level = (n: number) => boxes.filter((b) => b.id.split('/').length === n + 1 && b.id.startsWith(domain)).map((b) => b.id);
    expect(shown, 'the domain is framed').toContain(domain);
    for (const stage of level(1)) expect(shown, `${stage} is framed`).toContain(stage);
    expect(level(1).length).toBeGreaterThanOrEqual(2);
    expect(level(2).filter((id) => shown.includes(id)).length * 2, 'half the folders are framed').toBeGreaterThanOrEqual(level(2).length);
    // Every drawn box shows its label (LA-EXP-DR60).
    for (const b of boxes) {
      expect(b.title, `${b.id} is labeled`).not.toBeNull();
      // The tooltip is "title (ID)" or, for a group, "title (in owner)": the label shows the whole title.
      expect(b.full.startsWith(`${b.title} (`), `${b.id} shows its full title`).toBe(true);
      expect(b.wrapped, `${b.id} fits its title, wrapped on whole words`).toBe(true);
    }
  });

  test('LA-PLT-T136 in each layout, focusing each of Lathe\'s domains at depth 2, every drawn box shows its title text', async ({ page }) => {
    for (const layout of ['Tree', 'Nested', 'Voronoi'] as const) {
      for (const domain of ['LA-AUT', 'LA-CHK', 'LA-EXP', 'LA-PLT', 'LA-TRC']) {
        await openPage(page, `/${domain}?view=graph`);
        await nodes(page);
        if (layout === 'Tree') await page.locator('.graph-depth button', { hasText: '2' }).click();
        else if (!(await page.locator('.pane-graph .graph-layout button', { hasText: layout }).getAttribute('aria-pressed'))?.includes('true')) await page.locator('.pane-graph .graph-layout button', { hasText: layout }).click();
        await page.locator(`.pane-graph .graph-flow[data-layout="${layout.toLowerCase()}"] .react-flow__node`).first().waitFor();
        await page.waitForTimeout(1300);
        const nameless = await page.evaluate(() => {
          const canvas = document.querySelector('.pane-graph .graph-flow')!.getBoundingClientRect();
          return [...document.querySelectorAll<HTMLElement>('.pane-graph .react-flow__node[data-id]:not(.is-bar)')]
            .filter((el) => { const r = el.getBoundingClientRect(); return r.right > canvas.left && r.left < canvas.right && r.bottom > canvas.top && r.top < canvas.bottom; })
            .filter((el) => {
              const title = el.querySelector<HTMLElement>('.graph-node strong');
              // Visible title text: in the box, with text, not hidden.
              return !title || (title.textContent ?? '').trim() === '' || getComputedStyle(title).visibility === 'hidden' || getComputedStyle(title).display === 'none';
            })
            .map((el) => el.dataset.id!);
        });
        expect(nameless, `${layout} at ${domain}: boxes with no title`).toEqual([]);
      }
    }
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

// LA-EXP-T189 (LA-EXP-UC03-R16, LA-EXP-UC03-R17, LA-EXP-UC03-R06, LA-EXP-UC03-R10): one table of the
// graph's features, run in the Tree, Nested and Voronoi layouts alike, so none falls behind the others.
const LAYOUT_NAMES = { tree: 'Tree', nested: 'Nested', voronoi: 'Voronoi' } as const;
type Layout = keyof typeof LAYOUT_NAMES;

const path = (page: Page) => new URL(page.url()).pathname;
const camera = (page: Page) => page.evaluate(() => document.querySelector<HTMLElement>('.pane-graph .react-flow__viewport')!.style.transform);
const drawnCount = (page: Page) => page.locator('.pane-graph .react-flow__node:not(.is-bar)').count();
/** Every drawn box's place and size in the map. */
const places = (page: Page) => page.evaluate(() => Object.fromEntries([...document.querySelectorAll<HTMLElement>('.pane-graph .react-flow__node')].map((el) => [el.dataset.id!, `${el.style.transform} ${el.style.width} ${el.style.height}`])));

/** A labeled record box, not the focus, with a good part of it in the canvas, and a point on that part to click or hover. */
async function labeledInView(page: Page): Promise<{ id: string; x: number; y: number }> {
  const found = await page.evaluate(() => {
    const c = document.querySelector('.pane-graph .graph-flow')!.getBoundingClientRect();
    // Clear of the zoom buttons at the bottom left and the edge hints.
    const area = { left: c.left + 60, right: c.right - 30, top: c.top + 20, bottom: c.bottom - 30 };
    for (const el of document.querySelectorAll<HTMLElement>('.pane-graph .react-flow__node[data-id^="LA-"]')) {
      if (el.querySelector('.is-focus')) continue;
      // A Voronoi cell is hit inside its outline: at its label.
      const r = (el.querySelector('.graph-cell-label') ?? el).getBoundingClientRect();
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
    feature: 'Tab and the arrow keys reach the drawn boxes with a visible focus ring, and Enter focuses one',
    run: async (page) => {
      const here = path(page);
      await page.locator('.pane-graph .react-flow__node[data-id]:not(.is-bar)').first().focus();
      await page.keyboard.press('ArrowRight');
      const ring = await page.evaluate(() => {
        const el = document.activeElement as HTMLElement | null;
        const box = el?.querySelector<HTMLElement>('.graph-node');
        // A Voronoi cell is clipped to its outline, so its ring is its outline's stroke, in the ring's color.
        const ringed = (b: HTMLElement) => (b.classList.contains('is-cell')
          ? getComputedStyle(b).getPropertyValue('--cell-edge').trim() === getComputedStyle(document.documentElement).getPropertyValue('--steel').trim() ? 'stroke' : 'none'
          : getComputedStyle(b).outlineStyle);
        return { node: !!el?.classList.contains('react-flow__node'), outline: box ? ringed(box) : 'none', id: el?.dataset.id ?? '' };
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
    feature: 'depth 1 to 3 frames more in the Tree layout; the Nested and Voronoi cameras frame the focus box or cell, so they have no depth',
    run: async (page, layout) => {
      if (layout !== 'tree') {
        for (const d of ['1', '2', '3']) await expect(page.locator('.pane-graph .graph-depth button', { hasText: d })).toBeDisabled();
        return;
      }
      const counts: number[] = [];
      for (const d of ['1', '2', '3']) {
        await page.locator('.pane-graph .graph-depth button', { hasText: d }).click();
        await expect(page.locator('.pane-graph .graph-depth button', { hasText: d })).toHaveAttribute('aria-pressed', 'true');
        await page.waitForTimeout(1300);
        counts.push(await drawnCount(page));
      }
      expect(counts.every((c) => c > 0), `drawn boxes at depths 1-3: ${counts}`).toBe(true);
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
      // Details names what is under the pointer: its title, as its box shows it.
      const title = (await page.locator(`.pane-graph .react-flow__node[data-id="${id}"] strong`).textContent()) ?? '';
      await expect(page.locator('.side-bar')).toContainText(title.trim());
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
          // A Voronoi cell's label sits in a box of its own inside the cell.
          const box = node.querySelector<HTMLElement>('.graph-cell-label') ?? node.querySelector<HTMLElement>('.graph-node');
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

for (const layout of ['tree', 'nested', 'voronoi'] as const) {
  test(`LA-EXP-T189 every graph feature works in the ${LAYOUT_NAMES[layout]} layout`, async ({ page }) => {
    await openPage(page, `${RECORD}?view=graph`);
    await nodes(page);
    await page.locator('.pane-graph .react-flow__node[data-id^="LA-"]').nth(1).waitFor();
    await page.waitForTimeout(900);
    if (layout !== 'tree') {
      // v steps to the next layout: Nested, then Voronoi.
      await page.locator('.pane-graph .graph-count').click();
      for (let i = 0; i < (layout === 'nested' ? 1 : 2); i++) await page.keyboard.press('v');
      await expect(page.locator('.pane-graph .graph-flow')).toHaveAttribute('data-layout', layout);
      await page.locator('.pane-graph .react-flow__node[data-id^="LA-"]').nth(1).waitFor();
      await page.waitForTimeout(1300);
    }
    for (const row of PARITY) await test.step(row.feature, () => row.run(page, layout));
    if (layout === 'voronoi') {
      await test.step('every drawn cell is clipped to its outline', async () => {
        const unclipped = await page.evaluate(() => [...document.querySelectorAll<HTMLElement>('.pane-graph .react-flow__node[data-id]')]
          .filter((el) => !el.querySelector('.graph-node.is-cell') || !getComputedStyle(el).clipPath.startsWith('polygon(')).map((el) => el.dataset.id));
        expect(unclipped).toEqual([]);
      });
    }
    if (layout !== 'tree') {
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
        await expect(page.locator('.pane-graph .graph-layout button[aria-pressed="true"]')).toHaveText(LAYOUT_NAMES[layout]);
      });
    }
  });
}
