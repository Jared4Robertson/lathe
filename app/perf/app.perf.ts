import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Page } from '@playwright/test';
import { expect, test } from '../stability/test';
import { BUDGETS } from './budgets';
import { installProbes, quiet, record, work } from './measure';
import { focusDrawn, reachableBoxes, sceneOf } from '../stability/scene';

// LA-PAT-APP-UX-R11-T01, LA-V96-R21-T01, LA-V96-R24-T03, LA-V96-R29-T02 and LA-V96-R29-T04: the app's performance budgets (LA-PAT-APP-UX-R11), on the production build.

const here = path.dirname(fileURLToPath(import.meta.url));
const RECORD = '/LA-PLT-UC07';
const DOMAIN = '/LA-EXP';
const AGGREGATE = '/LA-EXP-A1';
const TITLE = '.header-strip h1';

async function open(page: Page, url: string, ready = TITLE) {
  await installProbes(page);
  await page.goto(url);
  await page.locator(ready).first().waitFor();
  await quiet(page, 600);
}

/** The graph's boxes, in its keyboard layer: there once the canvas has drawn them. */
const BOXES = '.focus-stage .graph-flow .graph-box';
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

  test('LA-PAT-APP-UX-R11-T01 a record page is interactive within 1.5 s', async ({ page }) => {
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

  test('LA-PAT-APP-UX-R11-T01 a stage switch takes under 100 ms of main-thread work', async ({ page }) => {
    await open(page, `${RECORD}?stage=graph`);
    await boxesDrawn(page);
    // Warm: the ERD's code and ELK load on the first switch; time later ones.
    await page.keyboard.press('Control+2');
    await page.locator('.focus-stage .erd-page').first().waitFor();
    await quiet(page);
    const toGraph = await work(page, async () => {
      await page.keyboard.press('Control+1');
      await boxesDrawn(page);
    });
    await record({ name: 'stage switch: to the Graph', value: toGraph.workMs, unit: 'ms', budget: BUDGETS.viewSwitchMs, detail: `longest frame ${Math.round(toGraph.worstFrameMs)} ms` });
    const toErd = await work(page, async () => {
      await page.keyboard.press('Control+2');
      await page.locator('.focus-stage .erd-page').first().waitFor();
    });
    await record({ name: 'stage switch: Graph to ERD', value: toErd.workMs, unit: 'ms', budget: BUDGETS.viewSwitchMs, detail: `longest frame ${Math.round(toErd.worstFrameMs)} ms` });
  });

  test('LA-V96-R21-T01 a camera move with every panel open takes under 500 ms of main-thread work, and the stage redraws only for the camera', async ({ page }) => {
    // Every panel open: the nav, the tab panel and the wiki card.
    await open(page, `${RECORD}?stage=graph`);
    await boxesDrawn(page);
    await expect(page.locator('.wiki-panel')).toBeVisible();
    await quiet(page, 900);
    // A panel's content changing (the wiki card scrolled) moves no camera.
    const still = (await sceneOf(page)).moves;
    await page.locator('.wiki-panel-scroll').evaluate((el) => { el.scrollTop = el.scrollHeight / 2; });
    await quiet(page, 400);
    expect((await sceneOf(page)).moves, 'scrolling the wiki card moves no camera').toBe(still);
    // Collapsing the wiki card widens the open space: the graph recenters with a glide.
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
    const r = await work(page, async () => {
      await page.keyboard.press('Enter');
      await expect(page.locator('.wiki-panel')).toHaveCount(0);
      await expect.poll(async () => (await sceneOf(page)).moves).toBeGreaterThan(still);
    }, 900);
    await record({ name: 'camera move with every panel open (collapse the wiki card)', value: r.workMs, unit: 'ms', budget: BUDGETS.cameraMoveMs, detail: `longest frame ${Math.round(r.worstFrameMs)} ms, ${r.slowFrames} of ${r.frames} frames over 20 ms` });
  });

  // In the Tree and Nested layouts (LA-V93-R21): the same budgets.
  for (const layout of ['Tree', 'Nested'] as const) test(`LA-PAT-APP-UX-R11-T01 a graph re-center at depth 3 takes under 500 ms of main-thread work, and glides at 60 Hz, in the ${layout} layout`, async ({ page }) => {
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
      // Nested, a framed leaf fills the pane with its equal siblings cut off at the edges (LA-EXP-DS06): go back to the record
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

  test('LA-PAT-APP-UX-R11-T01 switching to the ERD stage takes under 100 ms of main-thread work', async ({ page }) => {
    await open(page, AGGREGATE);
    const first = await work(page, async () => {
      await page.keyboard.press('Control+2');
      await page.locator('.focus-stage .erd-flow[data-ready] .erd-node').first().waitFor({ state: 'attached' });
    });
    await page.keyboard.press('Control+1');
    await boxesDrawn(page);
    const again = await work(page, async () => {
      await page.keyboard.press('Control+2');
      await page.locator('.focus-stage .erd-flow[data-ready] .erd-node').first().waitFor({ state: 'attached' });
    });
    await record({ name: 'ERD stage: first switch (loads its code and ELK)', value: first.workMs, unit: 'ms', budget: null, detail: `longest frame ${Math.round(first.worstFrameMs)} ms` });
    await record({ name: 'stage switch: to the ERD', value: again.workMs, unit: 'ms', budget: BUDGETS.viewSwitchMs, detail: `longest frame ${Math.round(again.worstFrameMs)} ms` });
    // The time from the key press to the laid-out diagram, on a domain page (the ELK layout in its worker).
    await page.goto(`${DOMAIN}?stage=erd`);
    const start = await page.evaluate(() => performance.now());
    await page.locator('.focus-stage .erd-flow[data-ready] .erd-node').first().waitFor({ state: 'attached' });
    const laid = (await page.evaluate(() => performance.now())) - start;
    await record({ name: 'ERD stage: map drawn after the page', value: laid, unit: 'ms', budget: null });
  });

  test("LA-V94-R08-T02 the product's ERD map is drawn and framed within its first-frame budget, and a focus after it lays nothing out", async ({ page }) => {
    await open(page, '/LA?stage=graph');
    await boxesDrawn(page);
    const start = await page.evaluate(() => performance.now());
    await page.keyboard.press('Control+2');
    await page.locator('.focus-stage .erd-flow[data-framed][data-ready] .erd-node').first().waitFor({ state: 'attached' });
    const first = (await page.evaluate(() => performance.now())) - start;
    await record({ name: 'ERD map: first frame of the product map', value: first, unit: 'ms', budget: BUDGETS.erdMapFirstFrameMs, detail: 'key press to the map drawn and framed, ELK and the layout included' });
    // A domain focus on the same map: the camera glides, nothing is laid out again.
    await quiet(page);
    const toDomain = await work(page, async () => {
      const b = (await page.evaluate(() => (document.querySelector('.focus-stage .erd-flow') as HTMLElement & { erdScene: () => { boxes: { id: string; rect: { left: number; top: number } }[] } }).erdScene().boxes.find((x) => x.id === 'LA-EXP')))!;
      await page.mouse.click(b.rect.left + 6, b.rect.top + 4);
      await page.waitForURL((u) => u.pathname === DOMAIN);
      await quiet(page);
    });
    await record({ name: 'ERD map: focus a domain (camera only)', value: toDomain.workMs, unit: 'ms', budget: BUDGETS.cameraMoveMs, detail: `longest frame ${Math.round(toDomain.worstFrameMs)} ms` });
  });

  test("LA-V98-R06-T02 the Trace stage's first frame orders the product's rows within its budget; every switch after it within the stage switch budget, and a drag within the frame budget", async ({ page }) => {
    // The Trace stage's rows, ordered in their worker and drawn, with the list under them.
    const drawnTrace = '.focus-stage .trace-flow[data-ready]';
    const list = '.focus-stage .trace-access .trace-list';
    // A use case's page, as the other stage switches are measured: the Trace stage switched to once, which loads its code and orders the
    // product's rows (the first frame of the product's trace), then again, which reuses the order.
    await open(page, RECORD);
    const first = await work(page, async () => {
      await page.keyboard.press('Control+3');
      await page.locator(drawnTrace).first().waitFor();
      await page.locator(list).first().waitFor({ state: 'attached' });
    });
    await page.keyboard.press('Control+1');
    await boxesDrawn(page);
    const again = await work(page, async () => {
      await page.keyboard.press('Control+3');
      await page.locator(drawnTrace).first().waitFor();
      await page.locator(list).first().waitFor({ state: 'attached' });
    });
    await record({ name: "Trace stage: first frame of the product's rows (loads its code, orders the rows)", value: first.workMs, unit: 'ms', budget: BUDGETS.traceMapFirstFrameMs, detail: `longest frame ${Math.round(first.worstFrameMs)} ms` });
    await record({ name: 'stage switch: to the Trace', value: again.workMs, unit: 'ms', budget: BUDGETS.viewSwitchMs, detail: `longest frame ${Math.round(again.worstFrameMs)} ms` });
    // The product's rows: a frame draws only what is in view, at most 260 boxes.
    const scene = await page.evaluate(() => {
      const host = document.querySelector('.focus-stage .trace-flow') as HTMLElement & { traceScene?: (whole?: boolean) => { boxes: unknown[]; bars: number } };
      const now = host.traceScene!();
      return { drawn: now.boxes.length, bars: now.bars, whole: host.traceScene!(true).boxes.length };
    });
    expect(scene.drawn).toBeLessThanOrEqual(260);
    // Panning the product's trace: a frame draws only what is in view, so a drag stays within the frame budget.
    const canvas = page.locator('.focus-stage .trace-flow canvas');
    const box = (await canvas.boundingBox())!;
    const pan = await work(page, async () => {
      await page.mouse.move(box.x + box.width * 0.7, box.y + box.height * 0.8);
      await page.mouse.down();
      for (let i = 1; i <= 20; i++) await page.mouse.move(box.x + box.width * 0.7, box.y + box.height * 0.8 - i * 30);
      await page.mouse.up();
    });
    await record({ name: "Trace stage: panning the product's trace", value: pan.worstFrameMs, unit: 'ms', budget: BUDGETS.traceDragFrameMs, detail: `${scene.drawn} of ${scene.whole} boxes drawn, ${scene.bars} bars; ${pan.slowFrames} of ${pan.frames} frames over 20 ms while dragging 600 px` });
  });

  test('LA-V96-R24-T03 the leader line to the wiki card adds no measurable cost: a pan with it drawn every frame stays within the camera-move budget', async ({ page }) => {
    await open(page, `${AGGREGATE}?stage=graph`);
    await boxesDrawn(page);
    await expect(page.locator('.wiki-panel')).toBeVisible();
    const drawn = () => page.evaluate(() => !!(document.querySelector('.focus-stage .graph-flow') as HTMLElement & { leaderLine?: unknown }).leaderLine);
    await expect.poll(drawn, { message: 'the leader line is drawn' }).toBe(true);
    const box = (await page.locator('.focus-stage .graph-flow canvas').boundingBox())!;
    const pan = await work(page, async () => {
      await page.mouse.move(box.x + box.width * 0.4, box.y + box.height * 0.5);
      await page.mouse.down();
      for (let i = 1; i <= 20; i++) await page.mouse.move(box.x + box.width * 0.4 - i * 4, box.y + box.height * 0.5 + i * 3);
      await page.mouse.up();
    });
    expect(await drawn(), 'the line is still drawn after the pan').toBe(true);
    await record({ name: 'a pan with the leader line drawn every frame', value: pan.workMs, unit: 'ms', budget: BUDGETS.cameraMoveMs, detail: `longest frame ${Math.round(pan.worstFrameMs)} ms, ${pan.slowFrames} of ${pan.frames} frames over 20 ms` });
  });

  test('LA-V96-R29-T02 marking 50 changes at once takes under 500 ms of main-thread work', async ({ page }) => {
    await open(page, `${DOMAIN}?stage=graph`);
    await boxesDrawn(page);
    await quiet(page, 900);
    // 50 records the graph draws, retitled in one write through their own commands, as an Agent writes; then put back.
    // Records of kinds with a Change command that takes a title (perf/retitle.ts).
    const retitle = path.resolve(here, 'retitle.ts');
    const kinds = new Set(JSON.parse(execFileSync('node', [retitle, '--kinds'], { encoding: 'utf8' })) as string[]);
    const drawn = (await sceneOf(page)).boxes.filter((b) => !b.group && !b.focus && kinds.has(b.kind)).slice(0, 50);
    expect(drawn.length, '50 records drawn').toBe(50);
    const root = process.env.PERF_ROOT!;
    const titleOf = (kind: string, id: string) => readFileSync(path.join(root, 'data', `${kind}.jsonl`), 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l) as { id: string; title: string }).find((r) => r.id === id)!.title;
    const titles = drawn.map((b) => ({ kind: b.kind, id: b.id, title: titleOf(b.kind, b.id) }));
    // One write of the 50, each through its own Change command, as an Agent writes (perf/retitle.ts).
    const write = (title: (was: string) => string) => execFileSync('node', [retitle, '--root', root], {
      input: JSON.stringify(titles.map((t) => ({ kind: t.kind, id: t.id, title: title(t.title) }))), stdio: ['pipe', 'pipe', 'pipe'],
    });
    const r = await work(page, async () => {
      write((was) => `${was} (changed)`);
      await expect.poll(async () => (await sceneOf(page)).boxes.filter((b) => b.change === 'changed').length, { timeout: 20_000 }).toBeGreaterThanOrEqual(drawn.length);
    }, 900);
    await record({ name: 'marking 50 changes at once', value: r.workMs, unit: 'ms', budget: BUDGETS.markChangesMs, detail: `longest frame ${Math.round(r.worstFrameMs)} ms, ${r.slowFrames} of ${r.frames} frames over 20 ms` });
    write((was) => was);
  });
  test('LA-V96-R29-T04 with Highlight changes on, marking 50 changes at once, with their pills and roll-ups, takes under 500 ms of main-thread work', async ({ page }) => {
    await open(page, `${DOMAIN}?stage=graph`);
    await boxesDrawn(page);
    await quiet(page, 900);
    await page.locator('.focus-stage').getByRole('group', { name: 'Changes' }).getByRole('button', { name: 'Highlight changes' }).click();
    const retitle = path.resolve(here, 'retitle.ts');
    const kinds = new Set(JSON.parse(execFileSync('node', [retitle, '--kinds'], { encoding: 'utf8' })) as string[]);
    const drawn = (await sceneOf(page)).boxes.filter((b) => !b.group && !b.focus && kinds.has(b.kind)).slice(0, 50);
    expect(drawn.length, '50 records drawn').toBe(50);
    const root = process.env.PERF_ROOT!;
    const titleOf = (kind: string, id: string) => readFileSync(path.join(root, 'data', `${kind}.jsonl`), 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l) as { id: string; title: string }).find((r) => r.id === id)!.title;
    const titles = drawn.map((b) => ({ kind: b.kind, id: b.id, title: titleOf(b.kind, b.id) }));
    const write = (title: (was: string) => string) => execFileSync('node', [retitle, '--root', root], {
      input: JSON.stringify(titles.map((t) => ({ kind: t.kind, id: t.id, title: title(t.title) }))), stdio: ['pipe', 'pipe', 'pipe'],
    });
    const r = await work(page, async () => {
      write((was) => `${was} (changed)`);
      await expect.poll(async () => (await sceneOf(page)).boxes.filter((b) => b.pill === 'changed').length, { timeout: 20_000 }).toBeGreaterThanOrEqual(drawn.length);
    }, 900);
    await record({ name: 'marking 50 changes at once under Highlight changes', value: r.workMs, unit: 'ms', budget: BUDGETS.markChangesMs, detail: `longest frame ${Math.round(r.worstFrameMs)} ms, ${r.slowFrames} of ${r.frames} frames over 20 ms` });
    write((was) => was);
  });
});
