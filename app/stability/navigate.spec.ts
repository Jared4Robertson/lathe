import { expect, test } from '@playwright/test';
import { expectStable, openPage, step } from './measure';
import { DOMAIN, FOCUS, GRAPH_CANVAS, GRAPH_HEADER, RECORD, SHELL } from './scenarios';

// LA-BRW-T481: moving between records through the nav, a link, a graph click, Back and quick
// find keeps the shell, the pane bar and the side bar where they were. The page's content
// changes (it is a new page), so shifts inside the wiki pane's scroll box and the side bar's
// body are the change itself; the frame around them must hold still.

const CONTENT = ['.pane-scroll', '.side-bar'];
const KEYS = [...SHELL, ...FOCUS];
/** A new page's title may be taller or shorter than the last one's, but must not jump back. */
const TITLE = [FOCUS[1]];

test.describe('navigate', () => {
  test('LA-BRW-T481 through the nav', async ({ page }) => {
    await openPage(page, DOMAIN);
    const link = page.locator('nav#nav .nav-space a[href^="/LA/"]:not([aria-current])').first();
    await expect(link).toBeVisible();
    const r = await step(page, 'navigate', 'through the nav', { keys: KEYS, allow: CONTENT, resizes: TITLE }, async () => {
      await link.click();
      await page.waitForURL(/\/LA\//);
    });
    expectStable(r);
  });

  test('LA-BRW-T481 through a link in the page', async ({ page }) => {
    await openPage(page, RECORD);
    const link = page.locator('.pane-wiki .spec-body a.record-link[href^="/LA-"]').first();
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
  // never drawn once at the last page's scroll and then moved up (a scroll set after paint). Back
  // comes back to the old page where it was scrolled, also from its first frame.
  test('LA-BRW-T481 from a page scrolled half-way, and Back', async ({ page }) => {
    await openPage(page, DOMAIN);
    await page.evaluate(() => {
      const box = document.querySelector('.pane-wiki .pane-scroll')!;
      box.scrollTop = (box.scrollHeight - box.clientHeight) / 2;
    });
    await page.waitForTimeout(300);
    // The row at the top of the view, and where it sits: Back must show it there again.
    const topRow = () => page.evaluate(() => {
      const box = document.querySelector('.pane-wiki .pane-scroll')!.getBoundingClientRect();
      const el = document.elementFromPoint(box.left + box.width / 2, box.top + 120)?.closest('li, p, h2, h3, section');
      return el ? { text: (el.textContent ?? '').slice(0, 80), top: Math.round(el.getBoundingClientRect().top) } : null;
    });
    const frames = () => page.evaluate(() => {
      const w = window as unknown as { __frames: { top: number; title: string }[]; __framesStop: boolean };
      w.__frames = [];
      w.__framesStop = false;
      // Each frame is read just after it is painted (a message posted from requestAnimationFrame runs
      // after the frame's layout and paint), so it records what the Reader saw.
      const channel = new MessageChannel();
      channel.port1.onmessage = () => {
        const box = document.querySelector('.pane-wiki .pane-scroll');
        w.__frames.push({ top: Math.round(box?.scrollTop ?? -1), title: document.querySelector('.pane-wiki .pane-title h1')?.textContent ?? '' });
        if (!w.__framesStop) requestAnimationFrame(loop);
      };
      const loop = () => channel.port2.postMessage(null);
      requestAnimationFrame(loop);
    });
    const stop = () => page.evaluate(() => {
      const w = window as unknown as { __frames: { top: number; title: string }[]; __framesStop: boolean };
      w.__framesStop = true;
      return w.__frames;
    });
    const before = await page.locator('.pane-wiki .pane-title h1').textContent();
    // A link already in view, so the click does not scroll the page to reach it first.
    const links = '.pane-wiki .pane-scroll a.row-link[href^="/LA-BRW-"]';
    const inView = await page.evaluate((sel) => {
      const box = document.querySelector('.pane-wiki .pane-scroll')!.getBoundingClientRect();
      return [...document.querySelectorAll(sel)].findIndex((a) => {
        const r = a.getBoundingClientRect();
        return r.width > 0 && r.top >= box.top + 40 && r.bottom <= box.bottom - 40;
      });
    }, links);
    expect(inView, 'a link in view half-way down').toBeGreaterThanOrEqual(0);
    const link = page.locator(links).nth(inView);
    await frames();
    let scrolledTo: Awaited<ReturnType<typeof topRow>> = null;
    const r = await step(page, 'navigate', 'link from a scrolled page', { keys: KEYS, allow: CONTENT, resizes: TITLE }, async () => {
      scrolledTo = await topRow();
      await link.click();
      await page.waitForURL(/\/LA-[A-Z0-9]+-[A-Z0-9]+/);
    });
    expectStable(r);
    const forward = await stop();
    const late = forward.filter((f) => f.title !== before && f.top > 0);
    expect.soft(late, 'the new page is never drawn at the old scroll').toEqual([]);

    await frames();
    const b = await step(page, 'navigate', 'Back to the scrolled page', { keys: KEYS, allow: CONTENT, resizes: TITLE }, async () => {
      await page.goBack();
      await page.waitForURL(/\/LA-BRW(\?|$)/);
    });
    expectStable(b);
    const after = await page.locator('.pane-wiki .pane-title h1').textContent();
    const backFrames = await stop();
    const jumped = backFrames.filter((f, i) => i > 0 && f.title === after && backFrames[i - 1].title === after && f.top !== backFrames[i - 1].top);
    expect.soft(jumped, 'Back draws the page once, at its place').toEqual([]);
    // Back comes back to where the page was scrolled: the same row at the top of the view, where it was
    // (and, with the check above, drawn there from its first frame).
    expect(scrolledTo).not.toBeNull();
    expect.soft(await topRow(), 'Back restores the scroll').toEqual(scrolledTo);
    expect.soft(backFrames.find((f) => f.title === after)?.top ?? 0, 'Back does not start at the top').toBeGreaterThan(0);
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
