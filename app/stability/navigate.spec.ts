import { expect, test } from '@playwright/test';
import { expectStable, openPage, step } from './measure';
import { DOMAIN, FOCUS, GRAPH_CANVAS, GRAPH_HEADER, RECORD, SHELL } from './scenarios';

// LA-BRW-T481: moving between records through the nav, a link, a graph click, Back and quick
// find keeps the shell, the pane bar and the inspector where they were. The page's content
// changes (it is a new page), so shifts inside the wiki pane's scroll box and the inspector's
// body are the change itself; the frame around them must hold still.

const CONTENT = ['.pane-scroll', '.inspector'];
const KEYS = [...SHELL, ...FOCUS];
/** A new page's title may be taller or shorter than the last one's, but must not jump back. */
const TITLE = [FOCUS[1]];

test.describe('navigate', () => {
  test('LA-BRW-T481 through the nav', async ({ page }) => {
    await openPage(page, DOMAIN);
    const link = page.locator('nav#nav .nav-space a[href^="/records/"]:not([aria-current])').first();
    await expect(link).toBeVisible();
    const r = await step(page, 'navigate', 'through the nav', { keys: KEYS, allow: CONTENT, resizes: TITLE }, async () => {
      await link.click();
      await page.waitForURL(/\/records\//);
    });
    expectStable(r);
  });

  test('LA-BRW-T481 through a link in the page', async ({ page }) => {
    await openPage(page, RECORD);
    const link = page.locator('.pane-wiki .spec-body a[href^="/records/"]').first();
    const r = await step(page, 'navigate', 'through a link', { keys: KEYS, allow: CONTENT, resizes: TITLE }, async () => {
      await link.click();
      await page.waitForURL((u) => !u.pathname.endsWith('LA-BRW-UC91'));
    });
    expectStable(r);
  });

  test('LA-BRW-T481 by clicking a graph node, then Back', async ({ page }) => {
    await openPage(page, `${RECORD}?view=graph`);
    await page.locator('.graph-flow .react-flow__node:not(.is-leaving)').nth(1).waitFor();
    const keys = [...KEYS, GRAPH_CANVAS, GRAPH_HEADER];
    const node = page.locator('.graph-flow .react-flow__node[data-id^="LA-"]:not([data-id="LA-BRW-UC91"])').first();
    const r = await step(page, 'navigate', 'graph click', { keys, allow: CONTENT, resizes: TITLE }, async () => {
      await node.click();
      await page.waitForURL((u) => !u.pathname.endsWith('LA-BRW-UC91'));
    });
    expectStable(r);
    const back = await step(page, 'navigate', 'Back', { keys, allow: CONTENT, resizes: TITLE }, async () => {
      await page.goBack();
      await page.waitForURL(/LA-BRW-UC91/);
    });
    expectStable(back);
  });

  // A new page starts at the top of the wiki pane. It must be drawn there from its first frame,
  // never drawn once at the last page's scroll and then moved up (a scroll set after paint).
  test('LA-BRW-T481 from a page scrolled half-way, and Back', async ({ page }) => {
    await openPage(page, DOMAIN);
    await page.evaluate(() => {
      const box = document.querySelector('.pane-wiki .pane-scroll')!;
      box.scrollTop = (box.scrollHeight - box.clientHeight) / 2;
    });
    await page.waitForTimeout(300);
    const frames = () => page.evaluate(() => {
      const w = window as unknown as { __frames: { top: number; title: string }[]; __framesStop: boolean };
      w.__frames = [];
      w.__framesStop = false;
      const loop = () => {
        const box = document.querySelector('.pane-wiki .pane-scroll');
        w.__frames.push({ top: Math.round(box?.scrollTop ?? -1), title: document.querySelector('.pane-wiki .pane-title h1')?.textContent ?? '' });
        if (!w.__framesStop) requestAnimationFrame(loop);
      };
      requestAnimationFrame(loop);
    });
    const stop = () => page.evaluate(() => {
      const w = window as unknown as { __frames: { top: number; title: string }[]; __framesStop: boolean };
      w.__framesStop = true;
      return w.__frames;
    });
    const before = await page.locator('.pane-wiki .pane-title h1').textContent();
    const link = page.locator('.pane-wiki .pane-scroll a.row-link[href^="/records/"]').filter({ visible: true }).first();
    await frames();
    const r = await step(page, 'navigate', 'link from a scrolled page', { keys: KEYS, allow: CONTENT, resizes: TITLE }, async () => {
      await link.click();
      await page.waitForURL(/\/records\//);
    });
    expectStable(r);
    const forward = await stop();
    const late = forward.filter((f) => f.title !== before && f.top > 0);
    expect.soft(late, 'the new page is never drawn at the old scroll').toEqual([]);

    await frames();
    const b = await step(page, 'navigate', 'Back to the scrolled page', { keys: KEYS, allow: CONTENT, resizes: TITLE }, async () => {
      await page.goBack();
      await page.waitForURL(/\/specs\/LA\/LA-BRW/);
    });
    expectStable(b);
    const after = await page.locator('.pane-wiki .pane-title h1').textContent();
    const backFrames = await stop();
    const jumped = backFrames.filter((f, i) => i > 0 && f.title === after && backFrames[i - 1].title === after && f.top !== backFrames[i - 1].top);
    expect.soft(jumped, 'Back draws the page once, at its place').toEqual([]);
  });

  test('LA-BRW-T481 through quick find', async ({ page }) => {
    await openPage(page, RECORD);
    await page.keyboard.press('Control+k');
    const find = page.locator('.quick-find input');
    await expect(find).toBeFocused();
    await find.fill('LA-BRW-UC90');
    await page.locator('.quick-find-results li').first().waitFor();
    const r = await step(page, 'navigate', 'quick find', { keys: KEYS, allow: CONTENT, resizes: TITLE }, async () => {
      await page.keyboard.press('Enter');
      await page.waitForURL(/LA-BRW-UC90/);
    });
    expectStable(r);
  });
});
