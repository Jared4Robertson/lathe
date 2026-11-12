import type { Page } from '@playwright/test';
import { expect, test } from './test';
import { expectStable, openPage, step } from './measure';
import { DOMAIN, GRAPH_CANVAS, GRAPH_TOOLS, ERD_CANVAS, RECORD } from './scenarios';
import { boxOf, cameraOf, clickBox, clickErdBox, clippedLabels, erdDrawn, erdSceneOf, focusDrawn, GRAPH, graphDrawn, placesOf, pointOnBox, reachableBoxes, sceneOf } from './scene';
import type { SceneBox, SceneHost } from '../src/graph/GraphPage';

// LA-V61-R32-T01: re-centering the graph at depth 1, 2 and 3, and moving around the ERD. The camera
// glides (the canvas draws each frame anew, which is no layout shift); the page bar, the header strip, the
// graph's header and its canvas must hold still, and the canvas must not be mounted anew.
// LA-V93-R16-T03: focusing a domain, a stage, a folder and a record, then Back and Forward, moves the
// camera only: no box of the one map changes its place or its size.

/** The header strip under the active tab, which names the focus: it holds still while its text changes. */
const PANE_TITLE = '.header-strip';
/**
 * The graph's keyboard layer. A re-center moves the camera over the one map (LA-EXP-DS09), and the
 * boxes the camera brings into view join the layer as it starts: that is the picture changing,
 * inside the canvas. The canvas, its toolbar and the panels around it are keys and must hold still,
 * and anything else that shifts is still unexpected.
 */
const GRAPH_BOXES = `${GRAPH} .graph-access`;
const DRAWING = `${GRAPH} canvas`;
// The page's controls: the page bar's right in the desktop app, the header strip's on the web.
const PANE_BAR = '.page-bar-actions';

const nodes = (page: Page) => graphDrawn(page);

/**
 * Whether a focus's child in the Tree reads as LA-V93-R77 says: its title at the page's text size, 12.5 px, or more;
 * or, where the focus stays whole and the child's box is shorter than one line at that size, its title on one line as
 * large as its box holds (less its padding, at most 4 px a side, and its border) and at 5 px or more.
 */
function readsAsChild(b: SceneBox): boolean {
  const title = b.lines.filter((l) => l.face === 'title');
  const px = Math.min(...title.map((l) => l.fontPx));
  if (px >= 12.5 - 1e-6) return true;
  const room = b.rect.height - 2 * Math.min(4, b.rect.height / 8) - 2;
  return title.length === 1 && px >= 5 && title[0].rect.height >= room - 0.01 && 12.5 * 1.4 > room;
}

/** The ID of the n-th record box (not the center) a click can reach in the canvas, and where. */
async function visibleNode(page: Page, n: number): Promise<{ id: string; at: { x: number; y: number } }> {
  const found = await reachableBoxes(page);
  expect(found.length, 'a record box in view').toBeGreaterThan(0);
  return found[Math.min(n, found.length - 1)];
}

test.describe('graph', () => {
  for (const depth of [1, 2, 3]) {
    test(`LA-V61-R32-T01 re-center at depth ${depth}`, async ({ page }) => {
      await openPage(page, `${RECORD}?stage=graph`);
      await nodes(page);
      if (depth > 1) {
        await page.locator('.graph-depth button', { hasText: String(depth) }).click();
        await page.waitForTimeout(900);
      }
      const keys = [PANE_BAR, PANE_TITLE, GRAPH_TOOLS, GRAPH_CANVAS, DRAWING];
      // Two re-centers: out to a neighbor, then on to one of its neighbors.
      for (const hop of [1, 2]) {
        const before = new URL(page.url()).pathname;
        const { at } = await visibleNode(page, hop);
        const r = await step(page, 'graph', `depth ${depth}: re-center ${hop}`, { keys, allow: ['.wiki-panel-scroll', GRAPH_BOXES] }, async () => {
          await page.mouse.click(at.x, at.y);
          await page.waitForURL((u) => u.pathname !== before);
        });
        expectStable(r);
      }
    });
  }

  test('LA-V61-R32-T01 change the depth', async ({ page }) => {
    await openPage(page, `${RECORD}?stage=graph`);
    await nodes(page);
    const keys = [PANE_BAR, PANE_TITLE, GRAPH_TOOLS, GRAPH_CANVAS, DRAWING];
    for (const d of ['2', '3', '1']) {
      const r = await step(page, 'graph', `depth to ${d}`, { keys, allow: ['.wiki-panel-scroll', GRAPH_BOXES] }, () => page.locator('.graph-depth button', { hasText: d }).click());
      expectStable(r);
    }
  });

  test('LA-V93-R16-T03 focusing anything moves the camera only: no box changes its place or size', async ({ page }) => {
    await openPage(page, '/LA?stage=graph');
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
    const keys = [PANE_BAR, PANE_TITLE, GRAPH_TOOLS, GRAPH_CANVAS, DRAWING];
    for (const id of ['LA-EXP', 'LA-EXP/use-cases', 'LA-EXP-CAP03', 'LA-EXP-UC03']) {
      const before = new URL(page.url()).pathname;
      const r = await test.step(`LA-EXP-UC03-R19-T01 the Reader reaches ${id} through the stages and kind groups the nav shows`, () =>
        step(page, 'graph', `focus ${id}`, { keys, allow: ['.wiki-panel-scroll', GRAPH_BOXES] }, async () => {
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
    await openPage(page, '/LA?stage=graph');
    await nodes(page);
    const domain = () => boxOf(page, 'LA-EXP');
    // The product is a rounded box, not a polygon (LA-V93-R06), seen here where it is the focus: once a domain is focused
    // the product sits off the frame, and only what is on screen is drawn.
    expect((await boxOf(page, 'LA'))!.polygon).toBeNull();
    expect((await boxOf(page, 'LA'))!.shape).toBe('product');
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
        if (r.left < c.left || r.left + r.width > c.left + c.width || r.top < c.top || r.top + r.height > c.top + c.height || r.width < 60 || b.block) continue;
        const parts = [
          ...b.lines.map((l) => ({ what: l.text, left: l.rect.left, top: l.rect.top, right: l.rect.left + l.drawnWidth, bottom: l.rect.top + l.rect.height })),
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
      await openPage(page, `${focus}?stage=graph`);
      await nodes(page);
      for (const depth of [1, 2, 3]) {
        await page.locator('.graph-depth button', { hasText: String(depth) }).click();
        await page.waitForTimeout(1300);
        await page.mouse.move(1, 1);
        expect(await outside(), `${focus} at depth ${depth}`).toEqual([]);
      }
    }
    // Nested, every box keeps its rectangle and shows its shape's mark before its kind and ID line.
    await openPage(page, `${DOMAIN}?stage=graph`);
    await nodes(page);
    await page.locator('.focus-stage .graph-layout button', { hasText: 'Nested' }).click();
    await graphDrawn(page, 'nested', 1300);
    // A focus's child whose own label reads too small draws its title alone (LA-V93-R77): it has no kind and ID line to
    // carry the mark. Every other box draws that line, its shape's mark before it.
    const boxes = (await sceneOf(page)).boxes;
    const titleAlone = boxes.filter((b) => b.child && b.lines.length > 0 && b.lines.every((l) => l.face === 'title'));
    expect(titleAlone.every((b) => !b.block && b.icons.length === 0)).toBe(true);
    const marks = boxes.filter((b) => !titleAlone.includes(b))
      .map((b) => ({ id: b.id, icon: b.icons.some((i) => i.draw === 'shape' && i.name === b.shape), outline: b.polygon !== null || b.view !== 'nested' }));
    await test.step("LA-V93-R06-T02 in the Nested view every record shows its kind's shape as a mark", () => {
      expect(marks.length).toBeGreaterThan(5);
      expect(marks.filter((m) => !m.icon || m.outline)).toEqual([]);
    });
    await page.locator('.focus-stage .graph-layout button', { hasText: 'Tree' }).click();
  });

  test('LA-V93-R10-T08 on a domain, the camera frames the domain to most of the open space\'s width, its product at the left edge and its stages starting on the right, each drawn box showing its full title wrapped on whole words', async ({ page }) => {
    await openPage(page, `${DOMAIN}?stage=graph`);
    await nodes(page);
    await page.locator('.graph-depth button', { hasText: '2' }).click();
    await page.waitForTimeout(1300);
    const domain = DOMAIN.slice(1);
    const s = await sceneOf(page);
    // The open space the panels leave over the stage, as the stage measured it.
    const open = await page.evaluate((sel) => {
      const el = document.querySelector<HTMLElement>(sel)!;
      const r = el.getBoundingClientRect();
      const px = (name: string) => parseFloat(el.style.getPropertyValue(name)) || 0;
      return { left: r.left + px('--frame-left'), right: r.right - px('--frame-right'), top: r.top + px('--frame-top'), bottom: r.bottom - px('--frame-bottom') };
    }, '.focus-stage');
    const width = open.right - open.left;
    // The domain, its product and its stages, as drawn.
    const framed = new RegExp(`^(LA|${domain}(/[^/]+)?)$`);
    const boxes = s.boxes.filter((b) => framed.test(b.id)).map((b) => {
      const title = b.lines.filter((l) => l.face === 'title');
      return {
        id: b.id,
        rect: b.rect,
        full: b.tip,
        child: b.child,
        // A focus's child drawn at the readable size wraps its own lines on whole words (LA-V93-R77), joined by spaces.
        title: title.length > 0 ? title.map((l) => l.text).join(b.child ? ' ' : '') : null,
        reads: readsAsChild(b),
        // Each line the map broke it into fits, and every line but the last ends after a space or a hyphen.
        wrapped: title.length > 0 && title.every((l) => l.drawnWidth <= l.rect.width + 0.5 * s.camera.zoom + 0.5) && (b.child || title.slice(0, -1).every((l) => /[\s-]$/.test(l.text))),
      };
    });
    await test.step('LA-V93-R10-T08 the domain is framed with its stages\' level on the right, each stage\'s title read at the page\'s size or as large as its box holds, and the domain whole with its product at the left edge where they fit', () => {
      const d = boxes.find((b) => b.id === domain)!.rect;
      const stages = boxes.filter((b) => b.id.startsWith(`${domain}/`));
      expect(stages.length, 'its stages are drawn').toBeGreaterThanOrEqual(2);
      for (const st of stages) expect(st.reads, `${st.id} reads at 12.5 px or more, or as large as its short box holds`).toBe(true);
      expect(Math.min(...stages.map((b) => b.rect.left)), 'its stages\' level is in the open space').toBeGreaterThanOrEqual(open.left - 1);
      expect(d.left + d.width, 'the domain shows beside its stages').toBeGreaterThan(open.left);
      if (d.left >= open.left - 1) {
        expect(d.width / width, 'a whole domain fills most of the open space\'s width beside its stages').toBeGreaterThan(0.5);
        const product = boxes.find((b) => b.id === 'LA')!.rect;
        expect(product.left + product.width).toBeLessThan(d.left);
      }
    });
    await test.step('LA-V93-R29-T03 every drawn box shows its label, its full title wrapped on whole words', () => {
      for (const b of boxes) {
        expect(b.title, `${b.id} is labeled`).not.toBeNull();
        // The tooltip is "title (ID)" or, for a group, "title (in owner)": the label shows the whole title, or a focus's
        // child read at the readable size its start, cut with an ellipsis (LA-V93-R77).
        if (b.child && b.title!.endsWith('…')) expect(b.full.startsWith(b.title!.slice(0, -1).trimEnd()), `${b.id} shows the start of its title on two lines`).toBe(true);
        else expect(b.full.startsWith(`${b.title} (`), `${b.id} shows its full title`).toBe(true);
        expect(b.wrapped, `${b.id} fits its title, wrapped on whole words`).toBe(true);
      }
    });
  });

  // One test per layout, each walking every domain.
  for (const layout of ['Tree', 'Nested'] as const) test(`LA-V93-R10-T08 in the ${layout} layout, focusing each of Lathe's domains at depth 2, framed and zoomed in, every drawn box shows its title text and its whole label inside it`, async ({ page }) => {
    for (const domain of ['LA-PRD', 'LA-MOD', 'LA-UCS', 'LA-IXD', 'LA-TEC', 'LA-TST', 'LA-CHK', 'LA-EXP', 'LA-PLT', 'LA-TRC']) {
      await openPage(page, `/${domain}?stage=graph`);
      await nodes(page);
      if (layout === 'Tree') await page.locator('.graph-depth button', { hasText: '2' }).click();
      else if (!(await page.locator('.focus-stage .graph-layout button', { hasText: layout }).getAttribute('aria-pressed'))?.includes('true')) await page.locator('.focus-stage .graph-layout button', { hasText: layout }).click();
      await graphDrawn(page, layout.toLowerCase(), 1300);
      // Framed, then zoomed in twice: every drawn box shows its title, and its whole label lies inside it (LA-PAT-APP-UX-R12).
      for (const z of [0, 1, 2]) {
        if (z > 0) { await page.locator('.focus-stage .stage-zoom-in').click(); await page.waitForTimeout(600); }
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
  });

  test('LA-V93-R29-T04 no label is clipped: each line fits its width and height, and the label fits its box, in light and dark, focused or not, at several zooms', async ({ page }) => {
    for (const scheme of ['light', 'dark'] as const) {
      await page.emulateMedia({ colorScheme: scheme });
      for (const focus of [DOMAIN, `${DOMAIN}/use-cases`]) {
        await openPage(page, `${focus}?stage=graph`);
        await nodes(page);
        for (const depth of [1, 2, 3]) {
          await page.locator('.graph-depth button', { hasText: String(depth) }).click();
          await page.waitForTimeout(1300);
          expect(await clippedLabels(page), `${scheme} ${focus} at depth ${depth}`).toEqual([]);
        }
        // Zoomed in on the framed picture, twice.
        for (const z of [1, 2]) {
          await page.locator('.focus-stage .stage-zoom-in').click();
          await page.waitForTimeout(600);
          expect(await clippedLabels(page), `${scheme} ${focus} zoomed in ${z}`).toEqual([]);
        }
      }
    }
  });

  test('LA-V93-R29-T05 a label keeps its size in the map when the focus changes and the camera zooms, or as the focus\'s child reads at the readable size', async ({ page }) => {
    await openPage(page, `${DOMAIN}?stage=graph`);
    await nodes(page);
    const target = `${DOMAIN.slice(1)}/interface-design`;
    const size = async () => {
      const s = await sceneOf(page);
      const b = s.boxes.find((x) => x.id === target)!;
      const title = b.lines.filter((l) => l.face === 'title');
      return { font: title[0].mapPx, reads: readsAsChild(b), screen: title.reduce((h, l) => h + l.rect.height, 0), lines: title.map((l) => l.text), zoom: s.camera.zoom };
    };
    // A child of the focus: its title reads at 12.5 px or more (its own, or its title alone at it), or as large as its short box holds (LA-V93-R77).
    expect((await size()).reads).toBe(true);
    // Focused, then walked out and in again: its font size in map units stays, and its size on screen follows the zoom.
    await clickBox(page, target);
    await page.waitForURL(/\/interface-design(\?|$)/);
    await page.waitForTimeout(1300);
    const before = await size();
    await page.goBack();
    await page.waitForTimeout(1300);
    await page.goForward();
    await page.waitForURL(/\/interface-design(\?|$)/);
    await page.waitForTimeout(1300);
    const focused = await size();
    expect(focused.font).toBe(before.font);
    expect(focused.lines).toEqual(before.lines);
    expect(focused.screen / before.screen).toBeCloseTo(focused.zoom / before.zoom, 1);
    // Zooming in by the camera's control: the same.
    await page.locator('.focus-stage .stage-zoom-in').click();
    await page.waitForTimeout(600);
    const zoomed = await size();
    await test.step('LA-V93-R07-T04 zooming the camera draws the label at its map size times the zoom', () => {
      expect(zoomed.zoom).toBeGreaterThan(focused.zoom);
      expect(zoomed.font).toBe(before.font);
      expect(zoomed.lines).toEqual(before.lines);
      expect(zoomed.screen / focused.screen).toBeCloseTo(zoomed.zoom / focused.zoom, 1);
    });
  });

  test('LA-V93-R07-T09 the wheel pans the Graph and the ERD, and with Scroll to zoom on zooms them, Ctrl with the wheel panning', async ({ page }) => {
    await openPage(page, `${DOMAIN}?stage=graph`);
    await nodes(page);
    const camera = async () => (await sceneOf(page)).camera;
    const canvas = (await page.locator(DRAWING).boundingBox())!;
    await page.mouse.move(canvas.x + canvas.width / 2, canvas.y + canvas.height / 2);
    // A new scroll each time: past the pause that ends the one before, so a change of move is not dropped as its momentum.
    const pause = () => page.waitForTimeout(300);
    // Off, the default: scroll pans, the zoom unchanged.
    let before = await camera();
    await page.mouse.wheel(0, 120);
    await expect.poll(async () => (await camera()).y).not.toBe(before.y);
    expect((await camera()).zoom).toBe(before.zoom);
    await expect(page.locator('.stage-key [data-key-entry="scroll"]')).toHaveText('Scroll pans');

    // On, from Appearance: scroll zooms in on scrolling up, and the key says so.
    await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Appearance' }).click();
    await page.getByRole('switch', { name: 'Scroll to zoom' }).check();
    await page.keyboard.press('Escape');
    await expect(page.locator('.stage-key [data-key-entry="scroll"]')).toHaveText('Scroll zooms');
    await page.mouse.move(canvas.x + canvas.width / 2, canvas.y + canvas.height / 2);
    await pause();
    before = await camera();
    await page.mouse.wheel(0, -240);
    await expect.poll(async () => (await camera()).zoom).toBeGreaterThan(before.zoom);
    // Ctrl held with scroll pans.
    await pause();
    await page.keyboard.down('Control');
    before = await camera();
    await page.mouse.wheel(0, 120);
    await expect.poll(async () => (await camera()).y).not.toBe(before.y);
    expect((await camera()).zoom).toBe(before.zoom);
    await page.keyboard.up('Control');

    // The ERD follows the same rule, the setting kept.
    await openPage(page, `${DOMAIN}?stage=erd`);
    await erdDrawn(page, 500);
    const erdZoom = async () => (await erdSceneOf(page)).camera.zoom;
    const pane = (await page.locator(ERD_CANVAS).boundingBox())!;
    await page.mouse.move(pane.x + pane.width / 2, pane.y + pane.height / 2);
    const zoomBefore = await erdZoom();
    await page.mouse.wheel(0, -240);
    await expect.poll(erdZoom).toBeGreaterThan(zoomBefore);
  });

  test('LA-V61-R32-T01 move around the ERD', async ({ page }) => {
    await openPage(page, `${DOMAIN}?stage=erd`);
    await erdDrawn(page, 500);
    const keys = ['.page-bar-actions', '.header-strip', '.focus-stage .stage-tools', ERD_CANVAS];
    // On the product's one map, the boxes in the domain's scope: an aggregate's boundary holds its entities, so its head is where the boundary itself takes a click.
    const aggregate = (await erdSceneOf(page)).boxes.find((b) => b.kind === 'aggregate' && b.strength === 1)!;
    const r = await step(page, 'graph', 'ERD: domain to aggregate', { keys, allow: ['.wiki-panel-scroll'] }, async () => {
      await clickErdBox(page, aggregate.id);
      await page.waitForURL(/\/LA-[A-Z0-9]+-[A-Z0-9]+/);
      await erdDrawn(page, 0);
    });
    expectStable(r);
    await page.waitForTimeout(500);
    const entity = (await erdSceneOf(page)).boxes.find((b) => b.kind === 'entity' && !b.focus && b.strength === 1)!;
    const before = new URL(page.url()).pathname;
    const e = await step(page, 'graph', 'ERD: aggregate to entity', { keys, allow: ['.wiki-panel-scroll'] }, async () => {
      await clickErdBox(page, entity.id);
      await page.waitForURL((u) => u.pathname !== before);
    });
    expectStable(e);
    const back = await step(page, 'graph', 'ERD: Back to the domain', { keys, allow: ['.wiki-panel-scroll'] }, async () => {
      await page.goBack();
      await page.goBack();
      await expect(page).toHaveURL(/\/LA-EXP(\?|$)/);
    });
    expectStable(back);
    // The arrows walk the map by the picture (LA-V61-R49): Right from the Test planning region's rightmost entity
    // crosses the region's edge into the entity beside it in the next domain's region (where the regions sit is the
    // layout's, by the domains' order: the Checking region, last, has none beside it).
    await openPage(page, '/LA-TST-EN85?stage=erd');
    await page.locator('.erd-flow[data-framed]').waitFor();
    const across = await step(page, 'graph', 'ERD: Right across a region edge', { keys, allow: ['.wiki-panel-scroll'] }, async () => {
      await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
      await page.keyboard.press('ArrowRight');
      await page.waitForURL((u) => /^\/LA-(?!TST-)[A-Z]+-EN\d+$/.test(u.pathname));
    });
    expectStable(across);
  });
});

// LA-V93-R14-T02 (LA-V93-R21, LA-V93-R14, LA-V93-R17): one table of the
// graph's features, run in the Tree and Nested layouts alike, so neither falls behind the other.
const LAYOUT_NAMES = { tree: 'Tree', nested: 'Nested' } as const;
type Layout = keyof typeof LAYOUT_NAMES;

const path = (page: Page) => new URL(page.url()).pathname;
const drawnCount = async (page: Page) => (await sceneOf(page)).boxes.length;

/**
 * A labeled record box, not the focus, with a good part of it in the canvas, and a point on it where
 * the pointer finds it. With `orFocus`, the focus itself when it is the only one (a framed leaf in the
 * Nested layout fills the open space).
 */
async function labeledInView(page: Page, orFocus = false): Promise<{ id: string; x: number; y: number }> {
  const s = await sceneOf(page);
  const c = s.canvas;
  const order = orFocus ? [...s.boxes.filter((b) => !b.focus), ...s.boxes.filter((b) => b.focus)] : s.boxes.filter((b) => !b.focus);
  for (const b of order) {
    if (!b.id.startsWith('LA-') || b.block) continue;
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

/** The table: each feature of the graph, checked the same way in either layout. */
const PARITY: { feature: string; run: (page: Page, layout: Layout) => Promise<void> }[] = [
  {
    feature: 'LA-V93-R21-T01 the Layout switch and its v command',
    run: async (page, layout) => {
      await expect(page.locator('.focus-stage .graph-layout button[aria-pressed="true"]')).toHaveText(LAYOUT_NAMES[layout]);
      await expect(page.locator(GRAPH)).toHaveAttribute('data-layout', layout);
    },
  },
  {
    feature: 'LA-EXP-UC03-R18-T01 a click focuses a box, and the header strip names where it sits',
    run: async (page) => {
      const before = path(page);
      const { id, x, y } = await labeledInView(page);
      await page.mouse.click(x, y);
      await page.waitForURL((u) => u.pathname !== before);
      await focusDrawn(page, id);
      await expect(page.locator('.header-strip .breadcrumb li').first()).toBeVisible();
      // A record names itself by its ID in the strip; a group, which has none, by its name.
      if (!id.includes('/')) await expect(page.locator('.header-strip-id')).toHaveText(id);
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
      // Back focuses the entry before; the camera glides only as far as that focus needs (it may already be in view).
      await focusDrawn(page, path(page).slice(1));
      await page.waitForTimeout(1300);
      await page.goForward();
      await page.waitForURL((u) => u.pathname === here);
      await page.waitForTimeout(1300);
      expect(await cameraOf(page)).toBe(framed);
    },
  },
  {
    feature: 'from the canvas, the plain arrow that steps out in this layout (Left in Tree, Up in Nested) steps out to the parent',
    run: async (page, layout) => {
      const here = path(page);
      // The graph stage takes focus as a click on its canvas gives it.
      await page.locator('.focus-stage .graph-flow').focus();
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
      await page.locator('.focus-stage .graph-box').first().focus();
      const onBox = () => page.evaluate(() => (document.activeElement as HTMLElement | null)?.closest<HTMLElement>('.graph-box')?.dataset.id ?? '');
      await page.keyboard.press('Tab');
      let id = await onBox();
      expect(id, 'keyboard focus is on a box').not.toBe('');
      // Enter focuses another box: past the focus itself, should Tab land on it.
      if (id === here.slice(1)) {
        await page.keyboard.press('Tab');
        id = await onBox();
        expect(id, 'keyboard focus is on another box').not.toBe('');
      }
      // The box the keyboard is on is drawn with the focus ring.
      await expect.poll(async () => (await boxOf(page, id))?.ring).toBe(true);
      await page.keyboard.press('Enter');
      await page.waitForURL((u) => u.pathname !== here);
      await page.goBack();
      await page.waitForURL((u) => u.pathname === here);
      await page.waitForTimeout(900);
    },
  },
  {
    feature: 'the . command frames the focus again after a free zoom',
    run: async (page) => {
      const framed = await cameraOf(page);
      await page.locator('.focus-stage .stage-zoom-out').click();
      await page.waitForTimeout(600);
      expect(await cameraOf(page)).not.toBe(framed);
      // The graph takes focus, as a click on its canvas gives it (the count may be squeezed out of view by the toolbar).
      await page.locator('.focus-stage .graph-flow').focus();
      await page.keyboard.press('.');
      await page.waitForTimeout(1300);
      expect(await cameraOf(page)).toBe(framed);
    },
  },
  {
    feature: 'depth 1 to 3 draws more levels in the Tree layout; the Nested camera frames the focus box, so it has no depth',
    run: async (page, layout) => {
      if (layout !== 'tree') {
        // The Depth group keeps its slot but is neither shown nor reachable (LA-V93-R21).
        const depthGroup = page.locator('.focus-stage [aria-label="Depth"]');
        await expect(depthGroup).toBeHidden();
        await expect(depthGroup).toHaveAttribute('inert', '');
        return;
      }
      const counts: number[] = [];
      for (const d of ['1', '2', '3']) {
        await page.locator('.focus-stage .graph-depth button', { hasText: d }).click();
        await expect(page.locator('.focus-stage .graph-depth button', { hasText: d })).toHaveAttribute('aria-pressed', 'true');
        await page.waitForTimeout(1300);
        counts.push(await drawnCount(page));
      }
      expect(counts.every((c) => c > 0), `drawn boxes at depths 1-3: ${counts}`).toBe(true);
      await page.locator('.focus-stage .graph-depth button', { hasText: '1' }).click();
      await page.waitForTimeout(1300);
    },
  },
  {
    feature: 'a hidden kind keeps its space, and the minimap shows',
    run: async (page) => {
      const before = await placesOf(page);
      await page.locator('.focus-stage .graph-filters > summary').click();
      const kind = page.locator('.focus-stage .graph-filter-body fieldset').nth(1).locator('input[type="checkbox"]').first();
      await kind.uncheck();
      await page.waitForTimeout(600);
      const after = await placesOf(page);
      for (const [id, place] of Object.entries(after)) if (before[id]) expect(place, id).toBe(before[id]);
      await kind.check();
      await page.locator('.focus-stage .graph-filter-body').getByRole('switch', { name: 'Minimap' }).check();
      await expect(page.locator('.focus-stage .graph-minimap')).toBeVisible();
      await page.locator('.focus-stage .graph-filter-body').getByRole('switch', { name: 'Minimap' }).uncheck();
      await page.locator('.focus-stage .graph-filters > summary').click();
    },
  },
  {
    feature: 'LA-V93-R17-T02 hovering a box spotlights it',
    run: async (page) => {
      const { x, y } = await labeledInView(page, true);
      await page.mouse.move(x, y);
      await expect(page.locator(`${GRAPH}.has-spotlight`)).toBeAttached();
      await page.mouse.move(2, 2);
    },
  },
  {
    feature: 'no label is clipped',
    run: async (page) => {
      expect(await clippedLabels(page)).toEqual([]);
    },
  },
];

for (const layout of ['tree', 'nested'] as const) {
  test(`LA-V93-R14-T02 every graph feature works in the ${LAYOUT_NAMES[layout]} layout`, async ({ page }) => {
    await openPage(page, `${RECORD}?stage=graph`);
    await nodes(page);
    await page.locator('.focus-stage .graph-box[data-id^="LA-"]').nth(1).waitFor({ state: 'attached' });
    await page.waitForTimeout(900);
    if (layout !== 'tree') {
      // v steps to the next layout: Nested.
      await page.locator('.focus-stage .graph-flow').focus();
      await page.keyboard.press('v');
      await expect(page.locator(GRAPH)).toHaveAttribute('data-layout', layout);
      await page.locator('.focus-stage .graph-box[data-id^="LA-"]').nth(1).waitFor({ state: 'attached' });
      await page.waitForTimeout(1300);
    }
    for (const row of PARITY) await test.step(row.feature, () => row.run(page, layout));
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
        await expect(page.locator('.focus-stage .graph-layout button[aria-pressed="true"]')).toHaveText(LAYOUT_NAMES[layout]);
      });
    }
  });
}
