import { expect, test, type Page } from '@playwright/test';
import { expectStable, openPage, step } from './measure';
import { AGGREGATE, RECORD, STAGE } from './scenarios';
import { sceneOf } from './scene';

// LA-V61-R29-T01: the stage and the panels floating over it (LA-V96). Switching the stage changes
// only the stage; collapsing or showing the wiki card or the side bar, or resizing the card, moves
// only that panel and recenters the stage's focus in the open space they leave (a short glide).
// The nav, the page bar, the header strip and every panel that stays must hold still, and none is
// thrown away and drawn anew. The panels are frosted, and opaque under reduced transparency.

const NAV = 'nav#nav';
const PAGE_BAR = '.stage-layout > .page-bar';
const STRIP = '.header-strip';
const CARD = '.wiki-panel';
const SIDE_BAR = '.stage-layout > .side-bar-column';
const BOXES = `${STAGE} .graph-flow .graph-box`;
/** What floats in the open space (the stage's tools, the camera's buttons, the minimap, the edge hints): it moves with the open space on purpose. */
const MOVES_WITH_OPEN_SPACE = [`${STAGE} .stage-tools`, `${STAGE} .graph-controls`, `${STAGE} .graph-minimap`, `${STAGE} .graph-edge-hints`, `${STAGE} .react-flow__controls`];

/** The open space the panels leave over the stage, in the page's pixels, as the stage measured it. */
async function openSpace(page: Page) {
  return page.evaluate((sel) => {
    const el = document.querySelector<HTMLElement>(sel)!;
    const r = el.getBoundingClientRect();
    const px = (name: string) => parseFloat(el.style.getPropertyValue(name)) || 0;
    return { left: r.left + px('--frame-left'), top: r.top + px('--frame-top'), right: r.right - px('--frame-right'), bottom: r.bottom - px('--frame-bottom') };
  }, STAGE);
}

/** The focus's drawn box lies whole in the open space, so no panel covers it. */
async function expectFocusInOpenSpace(page: Page, what: string) {
  await expect.poll(async () => {
    const focus = (await sceneOf(page)).boxes.find((b) => b.focus);
    const open = await openSpace(page);
    if (!focus) return 'no focus drawn';
    const { left, top, width, height } = focus.rect;
    const inside = left >= open.left - 1 && top >= open.top - 1 && left + width <= open.right + 1 && top + height <= open.bottom + 1;
    return inside ? 'inside' : `outside: ${JSON.stringify({ focus: focus.rect, open })}`;
  }, { message: `${what}: the focus sits in the open space`, timeout: 5000 }).toBe('inside');
}

const stageReady = (page: Page) => page.locator(BOXES).first().waitFor({ state: 'attached' });

test.describe('the stage and its panels', () => {
  test('LA-V61-R29-T01 at 1440 px with every panel open, the panels never overlap and the stage spans the window behind them', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 700 });
    await openPage(page, `${AGGREGATE}?stage=erd`, STRIP);
    await page.locator(SIDE_BAR).waitFor();
    // The narrow strip still names the focus: its title keeps room, the trail giving way first (LA-V96-R09).
    expect((await page.locator('.header-strip h1').boundingBox())?.width ?? 0, 'the title is shown').toBeGreaterThan(40);
    const box = (sel: string) => page.locator(sel).first().boundingBox();
    const [nav, card, side, bar, stage] = await Promise.all([box(NAV), box(CARD), box(SIDE_BAR), box(PAGE_BAR), box(STAGE)]);
    expect(card!.x, 'the card starts after the nav ends').toBeGreaterThanOrEqual(nav!.x + nav!.width);
    expect(side!.x, 'the side bar starts after the card ends').toBeGreaterThanOrEqual(card!.x + card!.width);
    expect(side!.x - (card!.x + card!.width), 'the card sits beside the side bar, a gap away').toBeLessThanOrEqual(16);
    expect(bar!.x, 'the page bar starts after the nav').toBeGreaterThanOrEqual(nav!.x + nav!.width);
    expect(bar!.x + bar!.width, 'the page bar ends before the side bar').toBeLessThanOrEqual(side!.x);
    expect(side!.x + side!.width).toBeLessThanOrEqual(1440);
    expect(stage, 'the stage fills the window behind the panels').toEqual({ x: 0, y: 0, width: 1440, height: 700 });
  });

  // The panels never crowd the page (LA-PAT-APP-UX-R18): as the window narrows the side bar collapses for space first, then the wiki
  // card, then the nav; the card never gets narrower than its minimum, the stage keeps its own, and no title breaks mid-word.
  test('LA-V96-R19-T02 panels collapse for space in order, the card never under 360 px, and come back as the window widens', async ({ page }) => {
    const crowded = () => page.locator('.app').getAttribute('data-crowded');
    await page.setViewportSize({ width: 1920, height: 900 });
    await openPage(page, `${RECORD}?stage=graph`, STRIP);
    await page.locator(SIDE_BAR).waitFor();
    expect(await crowded()).toBeNull();
    for (const [width, expected] of [[1440, null], [1100, 'sideBar'], [960, 'sideBar card'], [1920, null]] as const) {
      await page.setViewportSize({ width, height: 900 });
      await expect.poll(crowded, { message: `collapsed for space at ${width} px` }).toBe(expected);
      const card = await page.locator(CARD).boundingBox();
      if (card) expect(card.width, `the card at ${width} px`).toBeGreaterThanOrEqual(359);
      const open = await openSpace(page);
      expect(open.right - open.left, `the open space at ${width} px`).toBeGreaterThanOrEqual(299);
    }
    // The card's title wraps on whole words: no line of it ends inside a word.
    const title = page.locator(`${CARD} .wiki-panel-title h2`);
    const broken = await title.evaluate((h) => {
      const text = h.textContent ?? '';
      const range = document.createRange();
      const node = h.firstChild;
      if (!node || node.nodeType !== Node.TEXT_NODE) return [];
      const tops: number[] = [];
      for (let i = 0; i < text.length; i++) {
        range.setStart(node, i);
        range.setEnd(node, i + 1);
        tops.push(range.getBoundingClientRect().top);
      }
      return text.split('').filter((c, i) => i > 0 && tops[i] > tops[i - 1] + 1 && /\w/.test(c) && /\w/.test(text[i - 1]));
    });
    expect(broken, 'no line break inside a word').toEqual([]);
  });

  test('LA-V61-R29-T01 switch the stage: only the stage changes', async ({ page }) => {
    await openPage(page, `${AGGREGATE}?stage=graph`);
    await stageReady(page);
    await test.step('LA-V93-R03-T01 the graph\'s canvas fits its first picture before it paints, with no glide', async () => expect((await sceneOf(page)).glides, 'the first picture is framed at once').toBe(0));
    const keys = [NAV, PAGE_BAR, STRIP, CARD, SIDE_BAR, STAGE];
    const erd = await step(page, 'stage', 'switch to ERD (Ctrl+2)', { keys, allow: [STAGE, '.header-strip-counts', '.side-bar'] }, async () => {
      await page.keyboard.press('Control+2');
      await page.locator(`${STAGE} .erd-flow .react-flow__node`).first().waitFor();
    });
    expectStable(erd);
    expect(new URL(page.url()).search).toBe('?stage=erd');
    const trace = await step(page, 'stage', 'switch to Trace (Ctrl+3)', { keys, allow: [STAGE, '.header-strip-counts', '.side-bar'] }, async () => {
      await page.keyboard.press('Control+3');
      await page.locator(`${STAGE} .trace-flow[data-ready]`).first().waitFor();
    });
    expectStable(trace);
    const graph = await step(page, 'stage', 'back to Graph (Ctrl+1)', { keys, allow: [STAGE, '.header-strip-counts', '.side-bar'] }, async () => {
      await page.keyboard.press('Control+1');
      await stageReady(page);
    });
    expectStable(graph);
  });

  test('LA-V61-R29-T01 collapse and show the wiki card (w): only the card goes, and the focus recenters in the open space', async ({ page }) => {
    await openPage(page, `${RECORD}?stage=graph`);
    await stageReady(page);
    await expectFocusInOpenSpace(page, 'with the card open');
    const before = (await sceneOf(page)).moves;
    const keys = [NAV, PAGE_BAR, STRIP, SIDE_BAR, STAGE];
    const collapse = await step(page, 'stage', 'collapse the wiki card (w)', { keys, allow: MOVES_WITH_OPEN_SPACE, optional: [CARD] }, async () => {
      await page.keyboard.press('w');
      await expect(page.locator(CARD)).toHaveCount(0);
    });
    expectStable(collapse);
    expect((await sceneOf(page)).moves, 'the camera moved to the wider open space').toBeGreaterThan(before);
    await expectFocusInOpenSpace(page, 'with the card collapsed');
    const show = await step(page, 'stage', 'show the wiki card (w)', { keys, allow: MOVES_WITH_OPEN_SPACE, optional: [CARD] }, async () => {
      await page.keyboard.press('w');
      await page.locator(CARD).waitFor();
    });
    expectStable(show);
    await expectFocusInOpenSpace(page, 'with the card back');
  });

  test('LA-V61-R29-T01 hide and show the side bar: only the side bar goes, and the focus recenters', async ({ page }) => {
    await openPage(page, `${RECORD}?stage=graph`);
    await stageReady(page);
    const keys = [NAV, PAGE_BAR, STRIP, CARD, STAGE];
    const hide = await step(page, 'stage', 'hide the side bar', { keys, allow: [...MOVES_WITH_OPEN_SPACE, CARD, PAGE_BAR], resizes: [PAGE_BAR, STRIP, CARD], optional: [SIDE_BAR] }, async () => {
      await page.keyboard.press('Control+Alt+b');
      await expect(page.locator(SIDE_BAR)).toHaveCount(0);
    });
    expectStable(hide);
    await expectFocusInOpenSpace(page, 'with the side bar hidden');
    const show = await step(page, 'stage', 'show the side bar', { keys, allow: [...MOVES_WITH_OPEN_SPACE, CARD, PAGE_BAR], resizes: [PAGE_BAR, STRIP, CARD], optional: [SIDE_BAR] }, async () => {
      await page.keyboard.press('Control+Alt+b');
      await expect(page.locator(SIDE_BAR)).toHaveCount(1);
    });
    expectStable(show);
    await expectFocusInOpenSpace(page, 'with the side bar back');
  });

  test('LA-V61-R29-T01 resize the wiki card from the keyboard: the card follows, the focus stays in the open space', async ({ page }) => {
    await openPage(page, `${RECORD}?stage=graph`);
    await stageReady(page);
    const handle = page.getByRole('separator', { name: 'Resize the wiki card' });
    const r = await step(page, 'stage', 'widen the wiki card', { keys: [NAV, PAGE_BAR, STRIP, SIDE_BAR, STAGE], allow: [...MOVES_WITH_OPEN_SPACE, CARD], resizes: [CARD] }, async () => {
      await handle.focus();
      await page.keyboard.press('Shift+ArrowLeft');
      await page.keyboard.press('Shift+ArrowLeft');
    });
    expectStable(r);
    await expectFocusInOpenSpace(page, 'with a wider card');
  });

  test('LA-V96-R20-T02 the panels are frosted over the stage, and opaque under reduced transparency', async ({ page }) => {
    const looks = () => page.evaluate((sels) => sels.map((sel) => {
      const s = getComputedStyle(document.querySelector(sel)!);
      return { sel, filter: s.backdropFilter, background: s.backgroundColor };
    }), ['nav#nav', '.stage-layout > .page-bar', '.header-strip', '.wiki-panel', '.stage-layout > .side-bar-column']);
    await openPage(page, `${RECORD}?stage=graph`);
    for (const l of await looks()) {
      expect(l.filter, `${l.sel} blurs the stage behind it`).toContain('blur');
      expect(l.background, `${l.sel} lets the stage show through`).toMatch(/oklab|color-mix|rgba|\/ 0\.\d/);
    }
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-transparency', value: 'reduce' }] });
    for (const l of await looks()) {
      expect(l.filter, `${l.sel} draws no blur`).toMatch(/none|blur\(0px\)/);
      expect(l.background, `${l.sel} is opaque`).not.toMatch(/\/ 0\.\d|, 0\.\d+\)/);
    }
  });

  // The card settles level with the focused box (LA-V96-R23), below the stage's tools; a pan never moves it.
  test('LA-V96-R23-T02 the wiki card settles level with the focused box, below the toolbar, and stays put while the Reader pans', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openPage(page, `${AGGREGATE}?stage=graph`, STRIP);
    await stageReady(page);
    const level = () => page.evaluate((stage) => {
      const card = document.querySelector('.wiki-panel')!.getBoundingClientRect();
      const title = document.querySelector('.wiki-panel-title h2')!.getBoundingClientRect();
      const tools = document.querySelector(`${stage} [data-stage-tools="top"]`)?.getBoundingClientRect();
      const host = document.querySelector(`${stage} .graph-flow`) as HTMLElement & { graphScene?: () => { boxes: { focus: boolean; rect: { top: number; height: number } }[] } };
      const focus = host.graphScene!().boxes.find((b) => b.focus)!;
      return { cardTop: card.top, toolsBottom: tools?.bottom ?? 0, title: title.top + title.height / 2, focus: focus.rect.top + focus.rect.height / 2 };
    }, STAGE);
    await expect.poll(async () => { const l = await level(); return Math.abs(l.title - l.focus); }, { message: 'the title row is level with the focused box', timeout: 5000 }).toBeLessThan(3);
    const placed = await level();
    expect(placed.cardTop, 'the card starts below the stage\'s toolbar').toBeGreaterThan(placed.toolsBottom);
    // A pan by the Reader moves the stage, never the card.
    const canvas = (await page.locator(`${STAGE} .graph-flow canvas`).boundingBox())!;
    await page.mouse.move(canvas.x + 120, canvas.y + 300);
    await page.mouse.down();
    await page.mouse.move(canvas.x + 120, canvas.y + 200, { steps: 8 });
    await page.mouse.up();
    await page.waitForTimeout(600);
    expect((await level()).cardTop, 'the card holds still while the Reader pans').toBeCloseTo(placed.cardTop, 0);
  });
});
