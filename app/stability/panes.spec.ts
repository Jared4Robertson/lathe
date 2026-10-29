import { expect, test, type Page } from '@playwright/test';
import { expectStable, openPage, step } from './measure';
import { AGGREGATE, RECORD, STAGE } from './scenarios';
import { sceneOf } from './scene';

// LA-V61-R29-T01: the stage and the panels floating over it (LA-V96). Switching the stage changes
// only the stage; collapsing or showing the wiki card, or resizing it, moves
// only the card and recenters the stage's focus in the open space they leave (a short glide).
// The nav, the page bar, the header strip and every panel that stays must hold still, and none is
// thrown away and drawn anew. The panels are frosted, and opaque under reduced transparency.

const NAV = 'nav#nav';
const PAGE_BAR = '.stage-layout > .page-bar';
const STRIP = '.header-strip';
const CARD = '.wiki-panel';
const BOXES = `${STAGE} .graph-flow .graph-box`;
/** What floats in the open space (the stage's tools, the camera's buttons, the minimap, the edge hints): it moves with the open space on purpose. */
const MOVES_WITH_OPEN_SPACE = [`${STAGE} .stage-tools`, `${STAGE} .stage-camera`, `${STAGE} .graph-minimap`, `${STAGE} .graph-edge-hints`];

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
    await page.locator(CARD).waitFor();
    // The narrow strip still names the focus: its title keeps room, the trail giving way first (LA-V96-R09).
    expect((await page.locator('.header-strip h1').boundingBox())?.width ?? 0, 'the title is shown').toBeGreaterThan(40);
    const box = (sel: string) => page.locator(sel).first().boundingBox();
    const [nav, card, bar, stage] = await Promise.all([box(NAV), box(CARD), box(PAGE_BAR), box(STAGE)]);
    expect(card!.x, 'the card starts after the nav ends').toBeGreaterThanOrEqual(nav!.x + nav!.width);
    expect(card!.x + card!.width, 'the card ends before the window does').toBeLessThanOrEqual(1440);
    expect(bar!.x, 'the page bar starts after the nav').toBeGreaterThanOrEqual(nav!.x + nav!.width);
    expect(bar!.x + bar!.width, 'the page bar ends before the window does').toBeLessThanOrEqual(1440);
    expect(card!.y, 'the card sits below the page bar').toBeGreaterThanOrEqual(bar!.y + bar!.height);
    expect(stage, 'the stage fills the window behind the panels').toEqual({ x: 0, y: 0, width: 1440, height: 700 });
  });

  // The panels never crowd the page (LA-PAT-APP-UX-R18): as the window narrows the wiki card collapses for space first, then
  // the nav; the card never gets narrower than its minimum, the stage keeps its own, and no title breaks mid-word.
  test('LA-V96-R19-T02 panels collapse for space in order, the card never under 360 px, and come back as the window widens', async ({ page }) => {
    const crowded = () => page.locator('.app').getAttribute('data-crowded');
    await page.setViewportSize({ width: 1920, height: 900 });
    await openPage(page, `${RECORD}?stage=graph`, STRIP);
    await page.locator(CARD).waitFor();
    expect(await crowded()).toBeNull();
    // With the nav open (336 px) and no chat, the card at 360 px leaves the stage its 300 px down to about 1050 px.
    for (const [width, expected] of [[1440, null], [1100, null], [960, 'card'], [1920, null]] as const) {
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
    const keys = [NAV, PAGE_BAR, STRIP, CARD, STAGE];
    const erd = await step(page, 'stage', 'switch to ERD (Ctrl+2)', { keys, allow: [STAGE, '.header-strip-counts'] }, async () => {
      await page.keyboard.press('Control+2');
      await page.locator(`${STAGE} .erd-flow .react-flow__node`).first().waitFor();
    });
    expectStable(erd);
    expect(new URL(page.url()).search).toBe('?stage=erd');
    const trace = await step(page, 'stage', 'switch to Trace (Ctrl+3)', { keys, allow: [STAGE, '.header-strip-counts'] }, async () => {
      await page.keyboard.press('Control+3');
      await page.locator(`${STAGE} .trace-flow[data-ready]`).first().waitFor();
    });
    expectStable(trace);
    const graph = await step(page, 'stage', 'back to Graph (Ctrl+1)', { keys, allow: [STAGE, '.header-strip-counts'] }, async () => {
      await page.keyboard.press('Control+1');
      await stageReady(page);
    });
    expectStable(graph);
  });

  test('LA-V61-R29-T01 collapse and show the wiki card (Enter): only the card goes, and the focus recenters in the open space', async ({ page }) => {
    await openPage(page, `${RECORD}?stage=graph`);
    await stageReady(page);
    await expectFocusInOpenSpace(page, 'with the card open');
    const before = (await sceneOf(page)).moves;
    const keys = [NAV, PAGE_BAR, STRIP, STAGE];
    const collapse = await step(page, 'stage', 'collapse the wiki card (Enter)', { keys, allow: MOVES_WITH_OPEN_SPACE, optional: [CARD] }, async () => {
      await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
      await page.keyboard.press('Enter');
      await expect(page.locator(CARD)).toHaveCount(0);
    });
    expectStable(collapse);
    expect((await sceneOf(page)).moves, 'the camera moved to the wider open space').toBeGreaterThan(before);
    await expectFocusInOpenSpace(page, 'with the card collapsed');
    const show = await step(page, 'stage', 'show the wiki card (Enter)', { keys, allow: MOVES_WITH_OPEN_SPACE, optional: [CARD] }, async () => {
      await page.keyboard.press('Enter');
      await page.locator(CARD).waitFor();
    });
    expectStable(show);
    await expectFocusInOpenSpace(page, 'with the card back');
  });

  test('LA-V61-R29-T01 resize the wiki card from the keyboard: the card follows, the focus stays in the open space', async ({ page }) => {
    await openPage(page, `${RECORD}?stage=graph`);
    await stageReady(page);
    const handle = page.getByRole('separator', { name: 'Resize the wiki card' });
    const r = await step(page, 'stage', 'widen the wiki card', { keys: [NAV, PAGE_BAR, STRIP, STAGE], allow: [...MOVES_WITH_OPEN_SPACE, CARD], resizes: [CARD] }, async () => {
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
    }), ['nav#nav', '.stage-layout > .page-bar', '.header-strip', '.wiki-panel']);
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

  // The card sits in one spot under the stage's toolbar row (LA-V96-R19), a steady share of the stage high: a new focus or a pan never moves it.
  test('LA-V96-R19-T04 the wiki card holds one spot under the toolbar, about 60% of the stage high as a summary and 85% expanded, whatever the focus', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openPage(page, `${AGGREGATE}?stage=graph`, STRIP);
    await stageReady(page);
    const where = () => page.evaluate((stage) => {
      const card = document.querySelector('.wiki-panel')!.getBoundingClientRect();
      const tools = document.querySelector(`${stage} [data-stage-tools="top"]`)?.getBoundingClientRect();
      const host = document.querySelector(stage)!.getBoundingClientRect();
      return { top: Math.round(card.top), height: Math.round(card.height), right: Math.round(card.right), toolsBottom: tools?.bottom ?? 0, stage: host.height, foot: host.bottom };
    }, STAGE);
    const first = await where();
    expect(first.top, 'the card starts just under the stage\'s toolbar').toBeGreaterThan(first.toolsBottom);
    expect(first.top - first.toolsBottom, 'by the card\'s own gap').toBeLessThan(40);
    expect(first.height / first.stage, 'a summary is about 60% of the stage high').toBeCloseTo(0.6, 1);
    // A new focus (the arrow keys walk the stage) and a pan leave it where it is.
    await page.locator(`${STAGE} .graph-flow`).focus();
    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(800);
    const canvas = (await page.locator(`${STAGE} .graph-flow canvas`).boundingBox())!;
    await page.mouse.move(canvas.x + 120, canvas.y + 300);
    await page.mouse.down();
    await page.mouse.move(canvas.x + 120, canvas.y + 200, { steps: 8 });
    await page.mouse.up();
    await page.waitForTimeout(600);
    expect(await where(), 'the card holds its spot and height across a new focus and a pan').toEqual(first);
    // Expanded: about 85% of the stage, kept above the foot by the card's gap.
    await page.locator(CARD).getByRole('button', { name: 'More' }).click();
    await expect.poll(async () => (await where()).height, { message: 'expanded, the card grows' }).toBeGreaterThan(first.height);
    const expanded = await where();
    expect(expanded.top, 'expanded, its top stays').toBe(first.top);
    expect(expanded.height / expanded.stage, 'up to about 85% of the stage').toBeLessThanOrEqual(0.86);
    expect(expanded.top + expanded.height, 'above the foot').toBeLessThanOrEqual(expanded.foot - 20);
  });
});
