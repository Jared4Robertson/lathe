import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test, type Page } from '@playwright/test';
import { BUDGETS } from './budgets';
import { heapMb, installProbes, quiet, record, work } from './measure';

// LA-PLT-T90 to T605: the app's performance budgets (LA-PAT-APP-UX-R11), on the production build.

const here = path.dirname(fileURLToPath(import.meta.url));
const RECORD = '/LA-PLT-UC05';
const DOMAIN = '/LA-EXP';
const AGGREGATE = '/LA-EXP-A4';
const TITLE = '.focus-views .pane-title';

async function open(page: Page, url: string, ready = TITLE) {
  await installProbes(page);
  await page.goto(url);
  await page.locator(ready).first().waitFor();
  await quiet(page, 600);
}

/** The ID of a record box (not the center) wholly inside the graph's canvas. */
async function visibleNode(page: Page, n: number): Promise<string> {
  const ids = await page.evaluate(() => {
    const canvas = document.querySelector('.pane-graph .graph-flow')!.getBoundingClientRect();
    return [...document.querySelectorAll<HTMLElement>('.graph-flow .react-flow__node[data-id^="LA-"]')]
      .filter((el) => !el.querySelector('.is-focus'))
      .filter((el) => { const r = el.getBoundingClientRect(); return r.left >= canvas.left && r.right <= canvas.right && r.top >= canvas.top && r.bottom <= canvas.bottom - 40; })
      .map((el) => el.dataset.id!);
  });
  expect(ids.length, 'a record box in view').toBeGreaterThan(0);
  return ids[Math.min(n, ids.length - 1)];
}

test.describe('performance', () => {
  test('LA-PLT-T90 the first load ships 250 KB of JavaScript or less', async () => {
    const { chunks } = JSON.parse(readFileSync(path.join(here, 'results/bundle.json'), 'utf8')) as { chunks: { file: string; gzip: number; initial: boolean }[] };
    const initial = chunks.filter((c) => c.initial);
    const kb = initial.reduce((n, c) => n + c.gzip, 0) / 1024;
    const largest = [...chunks].sort((a, b) => b.gzip - a.gzip).slice(0, 4).map((c) => `${c.file} ${(c.gzip / 1024).toFixed(0)} KB${c.initial ? ' (first load)' : ''}`).join(', ');
    await record({ name: 'first-load JavaScript (gzip)', value: kb, unit: 'KB', budget: BUDGETS.firstLoadKb, detail: `${initial.map((c) => c.file).join(', ')}; largest: ${largest}` });
  });

  test('LA-PLT-T91 a record page is interactive within 1.5 s', async ({ page }) => {
    await installProbes(page);
    // A warm server: the engine has loaded the specs once, as it has for any page after the first.
    await page.goto(RECORD);
    await page.locator(TITLE).first().waitFor();
    const times: number[] = [];
    for (let i = 0; i < 3; i++) {
      await page.goto('about:blank');
      await page.goto(RECORD);
      await page.locator(TITLE).first().waitFor();
      const drawn = await page.evaluate(() => performance.now());
      await quiet(page, 500);
      // Interactive: drawn, and the long frames that follow have ended (the page answers input).
      const interactive = await page.evaluate((drawn) => {
        const after = window.__perf.loafs.filter((l) => l.t + l.duration > drawn - 50);
        return Math.max(drawn, ...after.map((l) => l.t + l.duration));
      }, drawn);
      times.push(interactive);
    }
    times.sort((a, b) => a - b);
    await record({ name: 'record page interactive', value: times[1], unit: 'ms', budget: BUDGETS.interactiveMs, detail: `median of 3: ${times.map(Math.round).join(', ')} ms` });
  });

  test('LA-PLT-T92 a view switch takes under 100 ms of main-thread work', async ({ page }) => {
    await open(page, RECORD);
    // Warm: the graph's code and ELK load on the first switch; time a later one.
    await page.keyboard.press('Control+2');
    await page.locator('.pane-graph .graph-flow .react-flow__node').first().waitFor();
    await quiet(page);
    await page.keyboard.press('Control+2');
    await expect(page.locator('.pane-graph')).toHaveCount(0);
    const openGraph = await work(page, async () => {
      await page.keyboard.press('Control+2');
      await page.locator('.pane-graph .graph-flow .react-flow__node').first().waitFor();
    });
    await record({ name: 'view switch: open the Graph pane', value: openGraph.workMs, unit: 'ms', budget: BUDGETS.viewSwitchMs, detail: `longest frame ${Math.round(openGraph.worstFrameMs)} ms` });
    const closeGraph = await work(page, async () => {
      await page.keyboard.press('Control+2');
      await expect(page.locator('.pane-graph')).toHaveCount(0);
    });
    await record({ name: 'view switch: close the Graph pane', value: closeGraph.workMs, unit: 'ms', budget: BUDGETS.viewSwitchMs, detail: `longest frame ${Math.round(closeGraph.worstFrameMs)} ms` });
  });

  test('LA-PLT-T93 a graph re-center at depth 3 takes under 500 ms of main-thread work, and glides at 60 Hz', async ({ page }) => {
    await open(page, `${RECORD}?view=graph`);
    await page.locator('.graph-flow .react-flow__node').first().waitFor();
    await page.locator('.graph-depth button', { hasText: '3' }).click();
    await quiet(page, 900);
    const works: number[] = [];
    const frames: number[] = [];
    const slow: number[] = [];
    const notes: string[] = [];
    for (const hop of [1, 2, 3]) {
      const before = new URL(page.url()).pathname;
      const id = await visibleNode(page, hop);
      const r = await work(page, async () => {
        await page.locator(`.graph-flow .react-flow__node[data-id="${id}"]`).click();
        await page.waitForURL((u) => u.pathname !== before);
        await page.locator(`.graph-flow .react-flow__node[data-id="${id}"] .is-focus`).waitFor();
      }, 900);
      works.push(r.workMs);
      frames.push(r.worstFrameMs);
      slow.push(r.slowFrames);
      notes.push(`${id}: ${Math.round(r.workMs)} ms work, longest frame ${Math.round(r.worstFrameMs)} ms, ${r.slowFrames} of ${r.frames} frames over 20 ms${r.worst.scripts.length ? ` [${r.worst.scripts.join('; ')}]` : ''}`);
    }
    const nodes = await page.locator('.graph-flow .react-flow__node').count();
    await record({ name: 'graph re-center at depth 3: main-thread work', value: Math.max(...works), unit: 'ms', budget: BUDGETS.recenterMs, detail: `worst of 3 (${nodes} boxes in the last picture); ${notes.join(' | ')}` });
    await record({ name: 'graph re-center at depth 3: longest frame', value: Math.max(...frames), unit: 'ms', budget: BUDGETS.recenterFrameMs, detail: 'the longest time between two frames, worst of 3' });
    // "Under" a count of 3 is 3 or fewer, so the budget is one more.
    await record({ name: 'graph re-center at depth 3: frames over 20 ms', value: Math.max(...slow), unit: 'frames', budget: BUDGETS.recenterSlowFrames + 1, detail: `worst of 3: ${slow.join(', ')}; at most ${BUDGETS.recenterSlowFrames}` });
  });

  test('LA-PLT-T94 opening the Model pane takes under 100 ms of main-thread work', async ({ page }) => {
    await open(page, AGGREGATE);
    const first = await work(page, async () => {
      await page.keyboard.press('Control+4');
      await page.locator('.pane-model .model-flow .react-flow__node').first().waitFor();
    });
    await page.keyboard.press('Control+4');
    await expect(page.locator('.pane-model')).toHaveCount(0);
    const again = await work(page, async () => {
      await page.keyboard.press('Control+4');
      await page.locator('.pane-model .model-flow .react-flow__node').first().waitFor();
    });
    await record({ name: 'Model view: first open (loads its code and ELK)', value: first.workMs, unit: 'ms', budget: null, detail: `longest frame ${Math.round(first.worstFrameMs)} ms` });
    await record({ name: 'view switch: open the Model pane', value: again.workMs, unit: 'ms', budget: BUDGETS.viewSwitchMs, detail: `longest frame ${Math.round(again.worstFrameMs)} ms` });
    // The time from the key press to the laid-out diagram, on a domain page (the ELK layout in its worker).
    await page.goto(`${DOMAIN}?view=model`);
    const start = await page.evaluate(() => performance.now());
    await page.locator('.pane-model .model-flow .react-flow__node').first().waitFor();
    const laid = (await page.evaluate(() => performance.now())) - start;
    await record({ name: 'Model view: domain ERD drawn after the page', value: laid, unit: 'ms', budget: null });
  });

  test('LA-PLT-T95 memory after 50 navigations', async ({ page }) => {
    await open(page, `${RECORD}?view=wiki,graph`);
    await page.locator('.pane-graph .graph-flow .react-flow__node').first().waitFor();
    const start = await heapMb(page);
    const links = await page.evaluate(() => [...new Set([...document.querySelectorAll<HTMLAnchorElement>('#nav a[href^="/LA"]')].map((a) => a.getAttribute('href')!))].slice(0, 25));
    for (let i = 0; i < 50; i++) {
      const href = links[i % links.length];
      await page.evaluate((href) => { history.pushState(null, '', `${href}?view=wiki,graph`); dispatchEvent(new PopStateEvent('popstate')); }, href);
      await page.locator(TITLE).first().waitFor();
      await page.waitForTimeout(150);
    }
    await quiet(page, 900);
    const end = await heapMb(page);
    await record({ name: 'JS heap after 50 navigations', value: end, unit: 'MB', budget: null, detail: `${start.toFixed(1)} MB before, ${(end - start).toFixed(1)} MB more` });
  });
});
