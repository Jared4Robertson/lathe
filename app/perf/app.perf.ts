import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test, type Page } from '@playwright/test';
import { BUDGETS } from './budgets';
import { installProbes, quiet, record, work } from './measure';
import { focusDrawn, reachableBoxes, sceneOf } from '../stability/scene';

// LA-PAT-APP-UX-R11-T01 and LA-V61-R37-T01 to T04: the app's performance budgets (LA-PAT-APP-UX-R11), on the production build.

const here = path.dirname(fileURLToPath(import.meta.url));
const RECORD = '/LA-PLT-UC05';
const DOMAIN = '/LA-EXP';
const AGGREGATE = '/LA-EXP-A1';
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
  test('LA-PAT-APP-UX-R11-T01 the first load ships 250 KB of JavaScript or less', async () => {
    const { chunks } = JSON.parse(readFileSync(path.join(here, 'results/bundle.json'), 'utf8')) as { chunks: { file: string; gzip: number; initial: boolean }[] };
    const initial = chunks.filter((c) => c.initial);
    const kb = initial.reduce((n, c) => n + c.gzip, 0) / 1024;
    const largest = [...chunks].sort((a, b) => b.gzip - a.gzip).slice(0, 4).map((c) => `${c.file} ${(c.gzip / 1024).toFixed(0)} KB${c.initial ? ' (first load)' : ''}`).join(', ');
    await record({ name: 'first-load JavaScript (gzip)', value: kb, unit: 'KB', budget: BUDGETS.firstLoadKb, detail: `${initial.map((c) => c.file).join(', ')}; largest: ${largest}` });
  });

  test('LA-V61-R37-T01 a record page is interactive within 1.5 s', async ({ page }) => {
    await installProbes(page);
    // A warm server: the server has loaded the data once, as it has for any page after the first.
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

  test('LA-V61-R37-T02 a view switch takes under 100 ms of main-thread work', async ({ page }) => {
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

  // In the Tree, Nested and Voronoi layouts (LA-V93-R21): the same budgets.
  for (const layout of ['Tree', 'Nested', 'Voronoi'] as const) test(`LA-V61-R37-T03 a graph re-center at depth 3 takes under 500 ms of main-thread work, and glides at 60 Hz, in the ${layout} layout`, async ({ page }) => {
    const label = layout === 'Tree' ? 'graph re-center at depth 3' : `${layout} graph re-center at depth 3`;
    await open(page, `${RECORD}?stage=graph`);
    await boxesDrawn(page);
    if (layout !== 'Tree') {
      await page.locator('.graph-layout button', { hasText: layout }).click();
      await boxesDrawn(page, layout.toLowerCase());
    }
    // The Nested camera frames the focus's box, so it has no depth (LA-EXP-DS09).
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
      // Nested and Voronoi, a framed leaf fills the pane with its equal siblings cut off at the edges (LA-EXP-DS06): go back to the record
      // before the next hop, outside the measure.
      if (layout !== 'Tree' && hop < 3) { await page.goBack(); await page.waitForURL((u) => u.pathname === before); await quiet(page, 900); }
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

  test('LA-V61-R37-T04 opening the ERD pane takes under 100 ms of main-thread work', async ({ page }) => {
    await open(page, AGGREGATE);
    const first = await work(page, async () => {
      await page.keyboard.press('Control+4');
      await page.locator('.pane-erd .erd-flow .react-flow__node').first().waitFor();
    });
    await page.keyboard.press('Control+4');
    await expect(page.locator('.pane-erd')).toHaveCount(0);
    const again = await work(page, async () => {
      await page.keyboard.press('Control+4');
      await page.locator('.pane-erd .erd-flow .react-flow__node').first().waitFor();
    });
    await record({ name: 'ERD view: first open (loads its code and ELK)', value: first.workMs, unit: 'ms', budget: null, detail: `longest frame ${Math.round(first.worstFrameMs)} ms` });
    await record({ name: 'view switch: open the ERD pane', value: again.workMs, unit: 'ms', budget: BUDGETS.viewSwitchMs, detail: `longest frame ${Math.round(again.worstFrameMs)} ms` });
    // The time from the key press to the laid-out diagram, on a domain page (the ELK layout in its worker).
    await page.goto(`${DOMAIN}?stage=erd`);
    const start = await page.evaluate(() => performance.now());
    await page.locator('.pane-erd .erd-flow .react-flow__node').first().waitFor();
    const laid = (await page.evaluate(() => performance.now())) - start;
    await record({ name: 'ERD view: domain ERD drawn after the page', value: laid, unit: 'ms', budget: null });
  });

  test("LA-V98-R06-T02 the Trace pane opens, and the product's whole matrix draws, within the view switch budget", async ({ page }) => {
    const rows = '.pane-trace .trace-matrix tbody tr';
    // A use case's page, as the other view switches are measured: the Trace pane opened beside its wiki, once to load its code, then again.
    await open(page, RECORD);
    const first = await work(page, async () => {
      await page.keyboard.press('Control+5');
      await page.locator(rows).first().waitFor();
    });
    await page.keyboard.press('Control+5');
    await expect(page.locator('.pane-trace')).toHaveCount(0);
    const again = await work(page, async () => {
      await page.keyboard.press('Control+5');
      await page.locator(rows).first().waitFor();
    });
    await record({ name: 'Trace view: first open (loads its code)', value: first.workMs, unit: 'ms', budget: null, detail: `longest frame ${Math.round(first.worstFrameMs)} ms` });
    await record({ name: 'view switch: open the Trace pane', value: again.workMs, unit: 'ms', budget: BUDGETS.viewSwitchMs, detail: `longest frame ${Math.round(again.worstFrameMs)} ms` });
    // The product's whole matrix, its first page of rows and its Untraced section: from a domain's Trace view to the product's.
    await open(page, `${DOMAIN}?stage=trace`, rows);
    const product = await work(page, async () => {
      await page.evaluate(() => { window.history.pushState(null, '', '/LA?stage=trace'); window.dispatchEvent(new PopStateEvent('popstate')); });
      await page.waitForFunction(() => window.location.pathname === '/LA' && document.querySelector('.pane-trace .trace-untraced') !== null);
    });
    const drawn = await page.locator(`${rows}:not(.group-row)`).count();
    await record({ name: "Trace view: the product's matrix drawn", value: product.workMs, unit: 'ms', budget: BUDGETS.viewSwitchMs, detail: `${drawn} rows drawn; longest frame ${Math.round(product.worstFrameMs)} ms` });
  });
});
