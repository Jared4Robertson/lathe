import { expect, test, type Page } from '@playwright/test';
import { expectStable, openPage, step } from './measure';
import { DOMAIN, GRAPH_CANVAS, GRAPH_HEADER, ERD_CANVAS, RECORD } from './scenarios';
import { boxOf, cameraOf, clickBox, clippedLabels, focusDrawn, GRAPH, graphDrawn, hitAt, placesOf, pointOnBox, reachableBoxes, sceneOf } from './scene';
import type { SceneHost } from '../src/graph/GraphPage';

// LA-V61-R32-T01: re-centering the graph at depth 1, 2 and 3, and moving around the ERD. The camera
// glides (the canvas draws each frame anew, which is no layout shift); the pane's title, the
// graph's header and its canvas must hold still, and the canvas must not be mounted anew.
// LA-V93-R16-T03: focusing a domain, a stage, a folder and a record, then Back and Forward, moves the
// camera only: no box of the one map changes its place or its size.

const PANE_TITLE = '.pane-graph .pane-title';
/**
 * The graph's keyboard layer. A re-center moves the camera over the one map (LA-EXP-DS09), and the
 * boxes the camera brings into view join the layer as it starts: that is the picture changing,
 * inside the canvas. The canvas, its header and the pane around it are keys and must hold still,
 * and anything else that shifts is still unexpected.
 */
const GRAPH_BOXES = `${GRAPH} .graph-access`;
const DRAWING = `${GRAPH} canvas`;
const PANE_BAR = '.pane-graph > .pane-bar';

const nodes = (page: Page) => graphDrawn(page);

/** The ID of the n-th record box (not the center) a click can reach in the canvas, and where. */
async function visibleNode(page: Page, n: number): Promise<{ id: string; at: { x: number; y: number } }> {
  const found = await reachableBoxes(page);
  expect(found.length, 'a record box in view').toBeGreaterThan(0);
  return found[Math.min(n, found.length - 1)];
}

test.describe('graph', () => {
  for (const depth of [1, 2, 3]) {
    test(`LA-V61-R32-T01 re-center at depth ${depth}`, async ({ page }) => {
      await openPage(page, `${RECORD}?view=graph`);
      await nodes(page);
      if (depth > 1) {
        await page.locator('.graph-depth button', { hasText: String(depth) }).click();
        await page.waitForTimeout(900);
      }
      const keys = [PANE_BAR, PANE_TITLE, GRAPH_HEADER, GRAPH_CANVAS, DRAWING, '.side-bar-column'];
      // Two re-centers: out to a neighbor, then on to one of its neighbors.
      for (const hop of [1, 2]) {
        const before = new URL(page.url()).pathname;
        const { at } = await visibleNode(page, hop);
        const r = await step(page, 'graph', `depth ${depth}: re-center ${hop}`, { keys, allow: ['.side-bar', GRAPH_BOXES] }, async () => {
          await page.mouse.click(at.x, at.y);
          await page.waitForURL((u) => u.pathname !== before);
        });
        expectStable(r);
      }
    });
  }

  test('LA-V61-R32-T01 change the depth', async ({ page }) => {
    await openPage(page, `${RECORD}?view=graph`);
    await nodes(page);
    const keys = [PANE_BAR, PANE_TITLE, GRAPH_HEADER, GRAPH_CANVAS, DRAWING];
    for (const d of ['2', '3', '1']) {
      const r = await step(page, 'graph', `depth to ${d}`, { keys, allow: ['.side-bar', GRAPH_BOXES] }, () => page.locator('.graph-depth button', { hasText: d }).click());
      expectStable(r);
    }
  });

  test('LA-V93-R16-T03 focusing anything moves the camera only: no box changes its place or size', async ({ page }) => {
    await openPage(page, '/LA?view=graph');
    await nodes(page);
    const seen = new Map<string, string>();
    const cameras: string[] = [];
    const check = async (where: string) => {
      cameras.push(await cameraOf(page));
      for (const [id, box] of Object.entries(await placesOf(page))) {
        if (seen.has(id)) expect(box, `${id} at ${where}`).toBe(seen.get(id));
        seen.set(id, box);
      }
    };
    await check('the product');
    const keys = [PANE_BAR, PANE_TITLE, GRAPH_HEADER, GRAPH_CANVAS, DRAWING];
    for (const id of ['LA-EXP', 'LA-EXP/use-cases', 'LA-EXP-CAP03', 'LA-EXP-UC03']) {
      const before = new URL(page.url()).pathname;
      const r = await test.step(`LA-EXP-UC04-R10-T01 the Reader reaches ${id} through the stages and kind groups the nav shows`, () =>
        step(page, 'graph', `focus ${id}`, { keys, allow: ['.side-bar', GRAPH_BOXES] }, async () => {
          await clickBox(page, id);
          await page.waitForURL((u) => u.pathname !== before);
          await focusDrawn(page, id);
        }));
      await test.step(`LA-PAT-APP-UX-R08-T02 focusing ${id} moves nothing outside the graph's boxes`, () => expectStable(r));
      await page.waitForTimeout(900);
      await check(id);
    }
    for (const move of ['back', 'back', 'forward'] as const) {
      if (move === 'back') await page.goBack(); else await page.goForward();
      await page.waitForTimeout(900);
      await check(move);
    }
    // The camera moved at every step; the map never did.
    // Four focuses, then Back, Back and Forward: eight cameras over five places, each unlike the one before it.
    await test.step('LA-V93-R07-T03 the camera moved at every focus, Back and Forward', () => {
      expect(cameras).toHaveLength(8);
      for (let i = 1; i < cameras.length; i++) expect(cameras[i], `the camera at step ${i}`).not.toBe(cameras[i - 1]);
      expect(new Set(cameras).size).toBeGreaterThanOrEqual(5);
    });
    await test.step('LA-V93-R16-T03 focusing moved the camera only: no box of the map changed its place or size', () => expect(seen.size).toBeGreaterThan(50));
  });

  test('LA-V93-R12-T03 a domain is drawn as a hexagon: its outline is the polygon, in every state', async ({ page }) => {
    await openPage(page, '/LA?view=graph');
    await nodes(page);
    const domain = () => boxOf(page, 'LA-EXP');
    const at = (await domain())!;
    await test.step('LA-V93-R05-T02 a domain is drawn as a hexagon', () => {
      expect(at.shape).toBe('hexagon');
      expect(at.polygon).toHaveLength(6);
    });
    // Hovered, the same outline, in the hover state.
    const point = (await pointOnBox(page, 'LA-EXP'))!;
    await page.mouse.move(point.x, point.y);
    await expect.poll(async () => (await domain())!.hover).toBe(true);
    const hovered = (await domain())!;
    expect(hovered.polygon).toEqual(at.polygon);
    // Focused, the same outline, as the focus.
    await page.mouse.click(point.x, point.y);
    await page.waitForURL(/\/LA-EXP(\?|$)/);
    await focusDrawn(page, 'LA-EXP');
    expect((await domain())!.polygon).toHaveLength(6);
    // The product is a rounded box, not a polygon (LA-V93-R06).
    expect((await boxOf(page, 'LA'))!.polygon).toBeNull();
    expect((await boxOf(page, 'LA'))!.shape).toBe('product');
  });

  test('LA-V93-R12-T05 in the Tree view every label line and badge sits inside its box\'s shape, and in the Nested view every record shows its shape\'s mark', async ({ page }) => {
    /** The label lines and badges whose corners, hit-tested by the canvas, land outside their own box's outline. */
    const outside = () => page.evaluate((sel) => {
      const host = document.querySelector(sel) as SceneHost;
      const s = host.graphScene!();
      const c = s.canvas;
      const out: string[] = [];
      for (const b of s.boxes) {
        const r = b.rect;
        // Boxes wholly in the canvas and big enough on screen to read.
        if (r.left < c.left || r.left + r.width > c.left + c.width || r.top < c.top || r.top + r.height > c.top + c.height || r.width < 60) continue;
        const parts = [
          ...b.lines.filter((l) => !l.bar).map((l) => ({ what: l.text, left: l.rect.left, top: l.rect.top, right: l.rect.left + l.drawnWidth, bottom: l.rect.top + l.rect.height })),
          ...b.badges.map((x) => ({ what: `badge ${x.label}`, left: x.rect.left, top: x.rect.top, right: x.rect.left + x.rect.width, bottom: x.rect.top + x.rect.height })),
        ];
        const e = 1.5;
        for (const p of parts) {
          if (p.right - p.left <= 2 * e) continue;
          for (const [x, y] of [[p.left + e, p.top + e], [p.right - e, p.top + e], [p.left + e, p.bottom - e], [p.right - e, p.bottom - e]]) {
            if (host.graphHit!(x, y) !== b.id) out.push(`${b.id} (${b.shape}): ${p.what} at ${Math.round(x - r.left)},${Math.round(y - r.top)}`);
          }
        }
      }
      return out;
    }, GRAPH);
    for (const focus of [DOMAIN, `${DOMAIN}/domain-model`, `${DOMAIN}/use-cases`]) {
      await openPage(page, `${focus}?view=graph`);
      await nodes(page);
      for (const depth of [1, 2, 3]) {
        await page.locator('.graph-depth button', { hasText: String(depth) }).click();
        await page.waitForTimeout(1300);
        await page.mouse.move(1, 1);
        expect(await outside(), `${focus} at depth ${depth}`).toEqual([]);
      }
    }
    // Nested, every box keeps its rectangle and shows its shape's mark before its kind and ID line.
    await openPage(page, `${DOMAIN}?view=graph`);
    await nodes(page);
    await page.locator('.pane-graph .graph-layout button', { hasText: 'Nested' }).click();
    await graphDrawn(page, 'nested', 1300);
    const marks = (await sceneOf(page)).boxes
      .map((b) => ({ id: b.id, icon: b.icons.some((i) => i.draw === 'shape' && i.name === b.shape), outline: b.polygon !== null || b.view !== 'nested' }));
    await test.step("LA-V93-R06-T02 in the Nested view every record shows its kind's shape as a mark", () => {
      expect(marks.length).toBeGreaterThan(5);
      expect(marks.filter((m) => !m.icon || m.outline)).toEqual([]);
    });
    await page.locator('.pane-graph .graph-layout button', { hasText: 'Tree' }).click();
  });

  test('LA-V93-R10-T08 at depth 2 on a domain, the domain, its stages and their folders are framed in the canvas, each showing its full title wrapped on whole words', async ({ page }) => {
    await openPage(page, `${DOMAIN}?view=graph`);
    await nodes(page);
    await page.locator('.graph-depth button', { hasText: '2' }).click();
    await page.waitForTimeout(1300);
    const domain = DOMAIN.slice(1);
    const s = await sceneOf(page);
    const c = s.canvas;
    // The framed picture: the domain, its product at the left edge, and two levels below it (its stages, their folders).
    const framed = new RegExp(`^(LA|${domain}(/[^/]+){0,2})$`);
    const boxes = s.boxes.filter((b) => framed.test(b.id)).map((b) => {
      const r = b.rect;
      const title = b.lines.filter((l) => l.face === 'title');
      return {
        id: b.id,
        inView: r.left >= c.left && r.left + r.width <= c.left + c.width && r.top >= c.top && r.top + r.height <= c.top + c.height,
        full: b.tip,
        title: title.length > 0 ? title.map((l) => l.text).join('') : null,
        // Each line the map broke it into fits, and every line but the last ends after a space or a hyphen.
        wrapped: title.length > 0 && title.every((l) => l.drawnWidth <= l.rect.width + 0.5 * s.camera.zoom + 0.5) && title.slice(0, -1).every((l) => /[\s-]$/.test(l.text)),
      };
    });
    // The camera frames the domain and two levels below it in the canvas (LA-EXP-DS09): the domain, every stage and at least half the folders.
    const shown = boxes.filter((b) => b.inView).map((b) => b.id);
    const level = (n: number) => boxes.filter((b) => b.id.split('/').length === n + 1 && b.id.startsWith(domain)).map((b) => b.id);
    await test.step('LA-V93-R10-T08 depth 2 frames the domain, its stages and at least half their folders', () => {
      expect(shown, 'the domain is framed').toContain(domain);
      for (const stage of level(1)) expect(shown, `${stage} is framed`).toContain(stage);
      expect(level(1).length).toBeGreaterThanOrEqual(2);
      expect(level(2).filter((id) => shown.includes(id)).length * 2, 'half the folders are framed').toBeGreaterThanOrEqual(level(2).length);
    });
    await test.step('LA-V93-R29-T03 every drawn box shows its label, its full title wrapped on whole words', () => {
      for (const b of boxes) {
        expect(b.title, `${b.id} is labeled`).not.toBeNull();
        // The tooltip is "title (ID)" or, for a group, "title (in owner)": the label shows the whole title.
        expect(b.full.startsWith(`${b.title} (`), `${b.id} shows its full title`).toBe(true);
        expect(b.wrapped, `${b.id} fits its title, wrapped on whole words`).toBe(true);
      }
    });
  });

  test('LA-V93-R10-T08 in each layout, focusing each of Lathe\'s domains at depth 2, framed and zoomed in, every drawn box shows its title text and its whole label inside it', async ({ page }) => {
    for (const layout of ['Tree', 'Nested', 'Voronoi'] as const) {
      for (const domain of ['LA-AUT', 'LA-CHK', 'LA-EXP', 'LA-PLT', 'LA-TRC']) {
        await openPage(page, `/${domain}?view=graph`);
        await nodes(page);
        if (layout === 'Tree') await page.locator('.graph-depth button', { hasText: '2' }).click();
        else if (!(await page.locator('.pane-graph .graph-layout button', { hasText: layout }).getAttribute('aria-pressed'))?.includes('true')) await page.locator('.pane-graph .graph-layout button', { hasText: layout }).click();
        await graphDrawn(page, layout.toLowerCase(), 1300);
        // Framed, then zoomed in twice: every drawn box shows its title, and its whole label lies inside it (LA-PAT-APP-UX-R12).
        for (const z of [0, 1, 2]) {
          if (z > 0) { await page.locator('.pane-graph .graph-zoom-in').click(); await page.waitForTimeout(600); }
          const s = await sceneOf(page);
          const c = s.canvas;
          expect(s.boxes.length, `${layout} at ${domain}: boxes drawn`).toBeGreaterThan(0);
          const nameless = s.boxes
            .filter((b) => { const r = b.rect; return r.left + r.width > c.left && r.left < c.left + c.width && r.top + r.height > c.top && r.top < c.top + c.height; })
            // Its title, drawn: lines with text.
            .filter((b) => b.lines.filter((l) => l.face === 'title').map((l) => l.text).join('').trim() === '')
            .map((b) => b.id);
          expect(nameless, `${layout} at ${domain}, zoomed in ${z}: boxes with no title`).toEqual([]);
          expect(await clippedLabels(page), `${layout} at ${domain}, zoomed in ${z}: labels not inside their boxes`).toEqual([]);
        }
      }
    }
  });

  test('LA-V93-R29-T04 no label is clipped: each line fits its width and height, and the label fits its box, in light and dark, focused or not, at several zooms', async ({ page }) => {
    for (const scheme of ['light', 'dark'] as const) {
      await page.emulateMedia({ colorScheme: scheme });
      for (const focus of [DOMAIN, `${DOMAIN}/use-cases`]) {
        await openPage(page, `${focus}?view=graph`);
        await nodes(page);
        for (const depth of [1, 2, 3]) {
          await page.locator('.graph-depth button', { hasText: String(depth) }).click();
          await page.waitForTimeout(1300);
          expect(await clippedLabels(page), `${scheme} ${focus} at depth ${depth}`).toEqual([]);
        }
        // Zoomed in on the framed picture, twice.
        for (const z of [1, 2]) {
          await page.locator('.pane-graph .graph-zoom-in').click();
          await page.waitForTimeout(600);
          expect(await clippedLabels(page), `${scheme} ${focus} zoomed in ${z}`).toEqual([]);
        }
      }
    }
  });

  test('LA-V93-R29-T05 a label keeps its size in the map when the focus changes and the camera zooms', async ({ page }) => {
    await openPage(page, `${DOMAIN}?view=graph`);
    await nodes(page);
    const target = `${DOMAIN.slice(1)}/interaction-design`;
    const size = async () => {
      const s = await sceneOf(page);
      const b = s.boxes.find((x) => x.id === target)!;
      const title = b.lines.filter((l) => l.face === 'title');
      return { font: title[0].mapPx, screen: title.reduce((h, l) => h + l.rect.height, 0), lines: title.map((l) => l.text), zoom: s.camera.zoom };
    };
    const before = await size();
    // Focusing it moves the camera only: its font size in map units stays, and its size on screen follows the zoom.
    await clickBox(page, target);
    await page.waitForURL(/\/interaction-design(\?|$)/);
    await page.waitForTimeout(1300);
    const focused = await size();
    expect(focused.font).toBe(before.font);
    expect(focused.lines).toEqual(before.lines);
    expect(focused.screen / before.screen).toBeCloseTo(focused.zoom / before.zoom, 1);
    // Zooming in by the camera's control: the same.
    await page.locator('.pane-graph .graph-zoom-in').click();
    await page.waitForTimeout(600);
    const zoomed = await size();
    await test.step('LA-V93-R07-T04 zooming the camera draws the label at its map size times the zoom', () => {
      expect(zoomed.zoom).toBeGreaterThan(focused.zoom);
      expect(zoomed.font).toBe(before.font);
      expect(zoomed.lines).toEqual(before.lines);
      expect(zoomed.screen / focused.screen).toBeCloseTo(zoomed.zoom / focused.zoom, 1);
    });
  });

  test('LA-V61-R32-T01 move around the ERD', async ({ page }) => {
    await openPage(page, `${DOMAIN}?view=erd`);
    await page.locator('.erd-flow .react-flow__node').first().waitFor();
    await page.waitForTimeout(500);
    const keys = ['.pane-erd > .pane-bar', '.pane-erd .pane-title', '.pane-erd .erd-header', ERD_CANVAS, '.pane-erd .erd-key'];
    // An aggregate's boundary holds its entities: its head is where the boundary itself takes a click.
    const box = page.locator('.erd-flow .react-flow__node .erd-aggregate .erd-box-head').first();
    const r = await step(page, 'graph', 'ERD: domain to aggregate', { keys, allow: ['.side-bar'] }, async () => {
      await box.click();
      await page.waitForURL(/\/LA-[A-Z0-9]+-[A-Z0-9]+/);
      await page.locator('.erd-flow .react-flow__node').first().waitFor();
    });
    expectStable(r);
    const entity = page.locator('.erd-flow .react-flow__node:not(:has(.is-focus))').first();
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

// LA-V93-R14-T02 (LA-V93-R21, LA-V93-R22, LA-V93-R14, LA-V93-R17): one table of the
// graph's features, run in the Tree, Nested and Voronoi layouts alike, so none falls behind the others.
const LAYOUT_NAMES = { tree: 'Tree', nested: 'Nested', voronoi: 'Voronoi' } as const;
type Layout = keyof typeof LAYOUT_NAMES;

const path = (page: Page) => new URL(page.url()).pathname;
const drawnCount = async (page: Page) => (await sceneOf(page)).boxes.length;

/**
 * A labeled record box, not the focus, with a good part of it in the canvas, and a point on it where
 * the pointer finds it. With `orFocus`, the focus itself when it is the only one (a framed leaf in the
 * Nested layout fills the pane).
 */
async function labeledInView(page: Page, orFocus = false): Promise<{ id: string; x: number; y: number }> {
  const s = await sceneOf(page);
  const c = s.canvas;
  const order = orFocus ? [...s.boxes.filter((b) => !b.focus), ...s.boxes.filter((b) => b.focus)] : s.boxes.filter((b) => !b.focus);
  for (const b of order) {
    if (!b.id.startsWith('LA-') || b.lines.every((l) => l.bar)) continue;
    const r = b.label;
    const l = Math.max(r.left, c.left + 60); const rt = Math.min(r.left + r.width, c.left + c.width - 30);
    const t = Math.max(r.top, c.top + 20); const bt = Math.min(r.top + r.height, c.top + c.height - 30);
    if (rt - l < 40 || bt - t < 16) continue;
    const at = await pointOnBox(page, b.id);
    if (at) return { id: b.id, ...at };
  }
  expect(null, 'a labeled record box in view').not.toBeNull();
  throw new Error('no labeled record box in view');
}

/** A flow step of RECORD's use case: it invokes a query, fulfills a requirement and happens in a view, so Links has something to draw. */
const LINKED = `${RECORD}-FL01-S01`;

/** The table: each feature of the graph, checked the same way in either layout. */
const PARITY: { feature: string; run: (page: Page, layout: Layout) => Promise<void> }[] = [
  {
    feature: 'LA-V93-R21-T01 the Layout switch and its v command',
    run: async (page, layout) => {
      await expect(page.locator('.pane-graph .graph-layout button[aria-pressed="true"]')).toHaveText(LAYOUT_NAMES[layout]);
      await expect(page.locator(GRAPH)).toHaveAttribute('data-layout', layout);
    },
  },
  {
    feature: 'Links draws the focus\'s links as curves (on a flow step, which invokes a query, fulfills a requirement and happens in a view)',
    run: async (page) => {
      // The use case has no links of its own: its flow's first step has, so the graph goes there and back, in the app.
      const here = path(page);
      await page.evaluate((to) => { window.history.pushState(null, '', `${to}?view=graph`); window.dispatchEvent(new PopStateEvent('popstate')); }, LINKED);
      await page.waitForURL((u) => u.pathname === LINKED);
      await page.waitForTimeout(900);
      await page.locator('.pane-graph .graph-links button').click();
      await expect.poll(async () => (await sceneOf(page)).lines.filter((l) => l.link).length).toBeGreaterThan(0);
      await page.locator('.pane-graph .graph-links button').click();
      await expect.poll(async () => (await sceneOf(page)).lines.filter((l) => l.link).length).toBe(0);
      await page.goBack();
      await page.waitForURL((u) => u.pathname === here);
      await page.waitForTimeout(900);
    },
  },
  {
    feature: 'LA-EXP-UC03-R18-T01 a click focuses a box, and the trail grows',
    run: async (page) => {
      const before = path(page);
      const { id, x, y } = await labeledInView(page);
      await page.mouse.click(x, y);
      await page.waitForURL((u) => u.pathname !== before);
      await focusDrawn(page, id);
      expect(await page.locator('.pane-graph .graph-trail li').count()).toBeGreaterThanOrEqual(2);
      await page.waitForTimeout(1300);
    },
  },
  {
    feature: 'Back and Forward glide the camera',
    run: async (page) => {
      const here = path(page);
      const framed = await cameraOf(page);
      await page.goBack();
      await page.waitForURL((u) => u.pathname !== here);
      await page.waitForTimeout(1300);
      expect(await cameraOf(page)).not.toBe(framed);
      await page.goForward();
      await page.waitForURL((u) => u.pathname === here);
      await page.waitForTimeout(1300);
      expect(await cameraOf(page)).toBe(framed);
    },
  },
  {
    feature: 'once the graph has focus, the plain arrow that steps out in this layout (Left in Tree, Up in Nested and Voronoi) steps out to the parent',
    run: async (page, layout) => {
      const here = path(page);
      // The graph pane takes focus as a click on its canvas gives it.
      await page.locator('.pane-graph .graph-flow').focus();
      await page.keyboard.press(layout === 'tree' ? 'ArrowLeft' : 'ArrowUp');
      await page.waitForURL((u) => u.pathname !== here);
      await page.goBack();
      await page.waitForURL((u) => u.pathname === here);
      await page.waitForTimeout(900);
    },
  },
  {
    feature: 'Tab reaches the drawn boxes with a visible focus ring, and Enter focuses one',
    run: async (page) => {
      const here = path(page);
      await page.locator('.pane-graph .graph-box').first().focus();
      await page.keyboard.press('Tab');
      const id = await page.evaluate(() => (document.activeElement as HTMLElement | null)?.closest<HTMLElement>('.graph-box')?.dataset.id ?? '');
      expect(id, 'keyboard focus is on a box').not.toBe('');
      // The box the keyboard is on is drawn with the focus ring.
      await expect.poll(async () => (await boxOf(page, id))?.ring).toBe(true);
      await page.keyboard.press('Enter');
      if (id !== here.slice(1)) await page.waitForURL((u) => u.pathname !== here);
      await page.goBack();
      await page.waitForURL((u) => u.pathname === here);
      await page.waitForTimeout(900);
    },
  },
  {
    feature: 'the . command frames the focus again after a free zoom',
    run: async (page) => {
      const framed = await cameraOf(page);
      await page.locator('.pane-graph .graph-zoom-out').click();
      await page.waitForTimeout(600);
      expect(await cameraOf(page)).not.toBe(framed);
      // The graph takes focus, as a click on its canvas gives it (the count may be squeezed out of view by the toolbar).
      await page.locator('.pane-graph .graph-flow').focus();
      await page.keyboard.press('.');
      await page.waitForTimeout(1300);
      expect(await cameraOf(page)).toBe(framed);
    },
  },
  {
    feature: 'depth 1 to 3 frames more in the Tree layout; the Nested and Voronoi cameras frame the focus box or cell, so they have no depth',
    run: async (page, layout) => {
      if (layout !== 'tree') {
        // The Depth group keeps its slot but is neither shown nor reachable (LA-V93-R21).
        const depthGroup = page.locator('.pane-graph [aria-label="Depth"]');
        await expect(depthGroup).toBeHidden();
        await expect(depthGroup).toHaveAttribute('inert', '');
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
      const before = await placesOf(page);
      await page.locator('.pane-graph .graph-filters > summary').click();
      const kind = page.locator('.pane-graph .graph-filter-body fieldset').nth(1).locator('input[type="checkbox"]').first();
      await kind.uncheck();
      await page.waitForTimeout(600);
      const after = await placesOf(page);
      for (const [id, place] of Object.entries(after)) if (before[id]) expect(place, id).toBe(before[id]);
      await kind.check();
      await page.locator('.pane-graph .graph-filter-body input[role="switch"]').check();
      await expect(page.locator('.pane-graph .graph-minimap')).toBeVisible();
      await page.locator('.pane-graph .graph-filter-body input[role="switch"]').uncheck();
      await page.locator('.pane-graph .graph-filters > summary').click();
    },
  },
  {
    feature: 'LA-V93-R17-T02 hovering a box spotlights it and Details follows the hover',
    run: async (page) => {
      const { id, x, y } = await labeledInView(page, true);
      await page.mouse.move(x, y);
      await expect(page.locator(`${GRAPH}.has-spotlight`)).toBeAttached();
      // Details names what is under the pointer: its title, as its box shows it.
      const title = (await boxOf(page, id))!.lines.filter((l) => l.face === 'title').map((l) => l.text).join('');
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
      expect(await clippedLabels(page)).toEqual([]);
    },
  },
];

for (const layout of ['tree', 'nested', 'voronoi'] as const) {
  test(`LA-V93-R14-T02 every graph feature works in the ${LAYOUT_NAMES[layout]} layout`, async ({ page }) => {
    await openPage(page, `${RECORD}?view=graph`);
    await nodes(page);
    await page.locator('.pane-graph .graph-box[data-id^="LA-"]').nth(1).waitFor({ state: 'attached' });
    await page.waitForTimeout(900);
    if (layout !== 'tree') {
      // v steps to the next layout: Nested, then Voronoi.
      await page.locator('.pane-graph .graph-flow').focus();
      for (let i = 0; i < (layout === 'nested' ? 1 : 2); i++) await page.keyboard.press('v');
      await expect(page.locator(GRAPH)).toHaveAttribute('data-layout', layout);
      await page.locator('.pane-graph .graph-box[data-id^="LA-"]').nth(1).waitFor({ state: 'attached' });
      await page.waitForTimeout(1300);
    }
    for (const row of PARITY) await test.step(row.feature, () => row.run(page, layout));
    if (layout === 'voronoi') {
      await test.step('LA-V93-R22-T01 every drawn cell is a polygon, and the pointer finds the cell under it, not a larger cell\'s box', async () => {
        const s = await sceneOf(page);
        const c = s.canvas;
        const wrong: string[] = [];
        for (const b of s.boxes) {
          if (!b.polygon || b.view !== 'voronoi') { wrong.push(`${b.id}: not a cell`); continue; }
          const x = b.label.left + b.label.width / 2;
          const y = b.label.top + b.label.height / 2;
          if (!(x > c.left && x < c.left + c.width && y > c.top && y < c.top + c.height)) continue;
          const over = await page.evaluate(({ x, y }) => document.elementFromPoint(x, y)?.tagName ?? '', { x, y });
          if (over !== 'CANVAS') continue;
          const hit = await hitAt(page, x, y);
          if (hit !== b.id) wrong.push(`${b.id}: the pointer at its label finds ${hit}`);
        }
        expect(wrong).toEqual([]);
      });
    }
    if (layout !== 'tree') {
      await test.step('every drawn child lies inside its parent on screen', async () => {
        const rects = new Map((await sceneOf(page)).boxes.map((b) => [b.id, b.rect]));
        const out: string[] = [];
        for (const [id, r] of rects) {
          // A child's ID extends its parent's here: a group's by "/".
          for (const [pid, p] of rects) {
            if (pid === id || !(id.startsWith(`${pid}/`))) continue;
            if (r.left < p.left - 1 || r.left + r.width > p.left + p.width + 1 || r.top < p.top - 1 || r.top + r.height > p.top + p.height + 1) out.push(`${id} outside ${pid}`);
          }
        }
        expect(out).toEqual([]);
      });
      await test.step('the layout is kept for the session across a reload', async () => {
        await page.reload();
        await nodes(page);
        await expect(page.locator('.pane-graph .graph-layout button[aria-pressed="true"]')).toHaveText(LAYOUT_NAMES[layout]);
      });
    }
  });
}
