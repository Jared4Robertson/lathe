import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test, type Page } from '@playwright/test';
import { BUDGETS } from './budgets';
import { heapMb, installProbes, quiet, record, work } from './measure';
import { focusDrawn, reachableBoxes, sceneOf } from '../stability/scene';

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

/** The graph's boxes, in its keyboard layer: there once the canvas has drawn them. */
const BOXES = '.pane-graph .graph-flow .graph-box';
const boxesDrawn = (page: Page, layout?: string) => page.locator(layout ? `.graph-flow[data-layout="${layout}"] .graph-box` : BOXES).first().waitFor({ state: 'attached' });

/** The n-th record box (not the center) a click can reach on the graph's canvas, and the point of the page where the pointer finds it. */
async function visibleNode(page: Page, n: number): Promise<{ id: string; at: { x: number; y: number } }> {
  const found = await reachableBoxes(page);
  expect(found.length, 'a record box in view').toBeGreaterThan(0);
  return found[Math.min(n, found.length - 1)];
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
    await boxesDrawn(page);
    await quiet(page);
    await page.keyboard.press('Control+2');
    await expect(page.locator('.pane-graph')).toHaveCount(0);
    const openGraph = await work(page, async () => {
      await page.keyboard.press('Control+2');
      await boxesDrawn(page);
    });
    await record({ name: 'view switch: open the Graph pane', value: openGraph.workMs, unit: 'ms', budget: BUDGETS.viewSwitchMs, detail: `longest frame ${Math.round(openGraph.worstFrameMs)} ms` });
    const closeGraph = await work(page, async () => {
      await page.keyboard.press('Control+2');
      await expect(page.locator('.pane-graph')).toHaveCount(0);
    });
    await record({ name: 'view switch: close the Graph pane', value: closeGraph.workMs, unit: 'ms', budget: BUDGETS.viewSwitchMs, detail: `longest frame ${Math.round(closeGraph.worstFrameMs)} ms` });
  });

  // In the Tree, Nested and Voronoi layouts (LA-EXP-UC03-R16): the same budgets.
  for (const layout of ['Tree', 'Nested', 'Voronoi'] as const) test(`LA-PLT-T93 a graph re-center at depth 3 takes under 500 ms of main-thread work, and glides at 60 Hz, in the ${layout} layout`, async ({ page }) => {
    const label = layout === 'Tree' ? 'graph re-center at depth 3' : `${layout} graph re-center at depth 3`;
    await open(page, `${RECORD}?view=graph`);
    await boxesDrawn(page);
    if (layout !== 'Tree') {
      await page.locator('.graph-layout button', { hasText: layout }).click();
      await boxesDrawn(page, layout.toLowerCase());
    }
    // The Nested camera frames the focus's box, so it has no depth (LA-EXP-DR63).
    if (layout === 'Tree') await page.locator('.graph-depth button', { hasText: '3' }).click();
    await quiet(page, 900);
    const works: number[] = [];
    const frames: number[] = [];
    const slow: number[] = [];
    const notes: string[] = [];
    for (const hop of [1, 2, 3]) {
      const before = new URL(page.url()).pathname;
      const { id, at } = await visibleNode(page, hop);
      const r = await work(page, async () => {
        await page.mouse.click(at.x, at.y);
        await page.waitForURL((u) => u.pathname !== before);
        await focusDrawn(page, id);
      }, 900);
      // Nested, a framed leaf fills the pane with nothing else in view: go back to the record before the next hop, outside the measure.
      if (layout === 'Nested' && hop < 3) { await page.goBack(); await page.waitForURL((u) => u.pathname === before); await quiet(page, 900); }
      works.push(r.workMs);
      frames.push(r.worstFrameMs);
      slow.push(r.slowFrames);
      notes.push(`${id}: ${Math.round(r.workMs)} ms work, longest frame ${Math.round(r.worstFrameMs)} ms, ${r.slowFrames} of ${r.frames} frames over 20 ms${r.worst.scripts.length ? ` [${r.worst.scripts.join('; ')}]` : ''}`);
    }
    const nodes = (await sceneOf(page)).boxes.length;
    await record({ name: `${label}: main-thread work`, value: Math.max(...works), unit: 'ms', budget: BUDGETS.recenterMs, detail: `worst of 3 (${nodes} boxes in the last picture); ${notes.join(' | ')}` });
    await record({ name: `${label}: longest frame`, value: Math.max(...frames), unit: 'ms', budget: BUDGETS.recenterFrameMs, detail: 'the longest time between two frames, worst of 3' });
    // "Under" a count of 3 is 3 or fewer, so the budget is one more.
    await record({ name: `${label}: frames over 20 ms`, value: Math.max(...slow), unit: 'frames', budget: BUDGETS.recenterSlowFrames + 1, detail: `worst of 3: ${slow.join(', ')}; at most ${BUDGETS.recenterSlowFrames}` });
  });

  // The canvas's free camera on Lathe's map (LA-EXP-DR59): a wheel zoom in and out about the pointer, and a drag pan, in each layout.
  for (const layout of ['Tree', 'Nested', 'Voronoi'] as const) test(`LA-PLT-T137 zoom and pan on Lathe's map are measured, frame by frame, in the ${layout} layout`, async ({ page }) => {
    await open(page, '/LA?view=graph');
    await boxesDrawn(page);
    if (layout !== 'Tree') {
      await page.locator('.graph-layout button', { hasText: layout }).click();
      await boxesDrawn(page, layout.toLowerCase());
    }
    await quiet(page, 900);
    const box = (await page.locator('.pane-graph .graph-canvas').boundingBox())!;
    const mid = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
    await page.mouse.move(mid.x, mid.y);
    const zoom = await work(page, async () => {
      for (let i = 0; i < 20; i++) { await page.mouse.wheel(0, -120); await page.waitForTimeout(16); }
      for (let i = 0; i < 20; i++) { await page.mouse.wheel(0, 120); await page.waitForTimeout(16); }
    });
    const pan = await work(page, async () => {
      await page.mouse.down();
      for (let i = 1; i <= 40; i++) await page.mouse.move(mid.x - i * 8, mid.y - i * 4);
      await page.mouse.up();
    });
    const boxes = (await sceneOf(page)).boxes.length;
    await record({ name: `${layout} zoom on LA: longest frame`, value: zoom.worstFrameMs, unit: 'ms', budget: null, detail: `${Math.round(zoom.workMs)} ms work over ${zoom.frames} frames, ${zoom.slowFrames} over 20 ms; ${boxes} boxes in the last picture` });
    await record({ name: `${layout} pan on LA: longest frame`, value: pan.worstFrameMs, unit: 'ms', budget: null, detail: `${Math.round(pan.workMs)} ms work over ${pan.frames} frames, ${pan.slowFrames} over 20 ms` });
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
    await boxesDrawn(page);
    const start = await heapMb(page);
    const links = await page.evaluate(() => [...new Set([...document.querySelectorAll<HTMLAnchorElement>('#nav a[href^="/LA"]')].map((a) => a.getAttribute('href')!))]
      // Record and group pages only: a space's Checks page has no views to open.
      .filter((href) => !href.endsWith('/checks')).slice(0, 25));
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
