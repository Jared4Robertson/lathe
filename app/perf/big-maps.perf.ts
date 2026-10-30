import { execFile } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test, type Page } from '@playwright/test';
import { BUDGETS } from './budgets';
import { installProbes, quiet, record, work } from './measure';
import { GRAPH, sceneOf } from '../stability/scene';

// LA-PLT-UC09-R13-T01: big maps stay smooth (LA-PLT-UC09-R13), on the large product (LA-PLT-TD04, lathe/perf/large-product.ts),
// served by the perf server on its own port. The Graph, the ERD and the Trace are panned and zoomed at 60 Hz; the arrow
// walk frames a new focus within its budget; the Graph's map is laid out off the main thread within its budget; and
// panning goes on at 60 Hz through a data change that lays the map out again.

const here = path.dirname(fileURLToPath(import.meta.url));
const LARGE = `http://127.0.0.1:${process.env.PERF_LARGE_PORT}`;
const DOMAIN = '/LP-D001';
const USE_CASE = 'LP-D001-UC01';

async function open(page: Page, url: string, ready: string) {
  await installProbes(page);
  await page.goto(`${LARGE}${url}`);
  await page.locator(ready).first().waitFor({ state: 'attached', timeout: 120_000 });
  await quiet(page, 1500);
}

/** A drag across the stage's middle, 40 steps; then a zoom in and out by the wheel with Cmd or Ctrl, 16 steps. */
async function panAndZoom(page: Page, stage: string) {
  const box = (await page.locator(stage).first().boundingBox())!;
  const at = { x: box.x + box.width * 0.5, y: box.y + box.height * 0.5 };
  const pan = await work(page, async () => {
    await page.mouse.move(at.x, at.y);
    await page.mouse.down();
    for (let i = 1; i <= 40; i++) await page.mouse.move(at.x - i * 6, at.y - i * 4);
    await page.mouse.up();
  });
  const zoom = await work(page, async () => {
    await page.mouse.move(at.x, at.y);
    for (let i = 0; i < 16; i++) {
      await page.keyboard.down('Control');
      await page.mouse.wheel(0, i < 8 ? 80 : -80);
      await page.keyboard.up('Control');
      await page.waitForTimeout(30);
    }
  });
  return { pan, zoom };
}

const slow = (name: string, r: Awaited<ReturnType<typeof work>>) => record({
  name, value: r.slowFrames, unit: 'frames', budget: BUDGETS.bigMapSlowFrames + 1,
  detail: `${r.slowFrames} of ${r.frames} frames over 20 ms, longest ${Math.round(r.worstFrameMs)} ms${r.worst.scripts.length ? ` [${r.worst.scripts.join('; ')}]` : ''}`,
});

test.describe('big maps', () => {
  test('LA-PLT-UC09-R13-T01 the Graph pans and zooms at 60 Hz on the large product, frames a walked focus within 200 ms, and lays its map out off the main thread', async ({ page }) => {
    await open(page, `${DOMAIN}?stage=graph`, `${GRAPH} .graph-box`);
    const laid = (await sceneOf(page)).laidOut!;
    expect(laid.thread, 'the map is laid out in the worker').toBe('worker');
    await record({ name: 'big map: the Graph map laid out off the main thread', value: laid.ms, unit: 'ms', budget: BUDGETS.bigMapLayoutMs, detail: `${laid.nodes} boxes, in the layout's worker` });
    const { pan, zoom } = await panAndZoom(page, `${GRAPH} canvas`);
    await slow('big map: panning the Graph', pan);
    await slow('big map: zooming the Graph', zoom);
    // The arrow walk: each step moves the focus, and the camera frames it.
    await page.locator('.focus-stage .stage-camera button').last().click();
    await quiet(page);
    const times: number[] = [];
    for (const key of ['ArrowRight', 'ArrowDown', 'ArrowDown', 'ArrowLeft']) {
      const before = page.url();
      const start = await page.evaluate(() => performance.now());
      await page.keyboard.press(key);
      await page.waitForURL((u) => u.href !== before);
      const id = decodeURIComponent(new URL(page.url()).pathname.slice(1));
      await page.waitForFunction(({ sel, id }) => {
        const s = (document.querySelector(sel) as HTMLElement & { graphScene?: () => { boxes: { id: string; focus: boolean }[]; glides: number } }).graphScene?.();
        return !!s?.boxes.some((b) => b.id === id && b.focus);
      }, { sel: GRAPH, id });
      times.push((await page.evaluate(() => performance.now())) - start);
      await quiet(page, 700);
    }
    await record({ name: 'big map: a walked focus framed', value: Math.max(...times), unit: 'ms', budget: BUDGETS.bigMapFocusMs, detail: `worst of ${times.length}: ${times.map(Math.round).join(', ')} ms` });
  });

  test('LA-PLT-UC09-R13-T01 the Graph pans at 60 Hz through a data change that lays its map out again', async ({ page }) => {
    await open(page, `/${USE_CASE}?stage=graph`, `${GRAPH} .graph-box`);
    const before = (await sceneOf(page)).laidOut!;
    const canvas = (await page.locator(`${GRAPH} canvas`).boundingBox())!;
    const at = { x: canvas.x + canvas.width * 0.5, y: canvas.y + canvas.height * 0.5 };
    const title = `Renew tool ${Date.now() % 100_000}`;
    // A write through the CLI, as an Agent writes: the server reloads, the page reads again, and the map is laid out again.
    const written = new Promise<void>((done, fail) => execFile('node', [path.resolve(here, '../../lathe/bin/lathe.ts'), 'use-case', 'change-use-case', '--id', USE_CASE, '--title', title, '--root', process.env.PERF_LARGE_ROOT!], (e) => (e ? fail(e) : done())));
    const r = await work(page, async () => {
      await page.mouse.move(at.x, at.y);
      await page.mouse.down();
      for (let i = 0; ; i++) {
        await page.mouse.move(at.x + 120 * Math.sin(i / 12), at.y + 80 * Math.cos(i / 12));
        if (i % 20 === 0 && (await page.evaluate((t) => document.querySelector('.header-strip h1')?.textContent?.includes(t) ?? false, title))) break;
        if (i > 4000) throw new Error('the change never reached the page');
      }
      await written;
      await expect.poll(async () => (await sceneOf(page)).laidOut!.count, { timeout: 60_000, message: 'the map is laid out again' }).toBeGreaterThan(before.count);
      await page.mouse.up();
    });
    await slow('big map: panning the Graph through a reload and its layout', r);
  });

  test('LA-PLT-UC09-R13-T01 the ERD pans and zooms at 60 Hz on the large product', async ({ page }) => {
    await open(page, `${DOMAIN}?stage=erd`, '.focus-stage .erd-flow[data-framed] .react-flow__node');
    const { pan, zoom } = await panAndZoom(page, '.focus-stage .erd-flow');
    await slow('big map: panning the ERD', pan);
    await slow('big map: zooming the ERD', zoom);
  });

  test('LA-PLT-UC09-R13-T01 the Trace pans and zooms at 60 Hz on the large product', async ({ page }) => {
    await page.addInitScript(() => window.sessionStorage.setItem('lathe:trace-layout', JSON.stringify('tree')));
    await open(page, `${DOMAIN}?stage=trace`, '.focus-stage .trace-flow[data-ready]');
    const { pan, zoom } = await panAndZoom(page, '.focus-stage .trace-flow canvas');
    await slow('big map: panning the Trace', pan);
    await slow('big map: zooming the Trace', zoom);
  });
});
