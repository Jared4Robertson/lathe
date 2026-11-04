import type { Page } from '@playwright/test';
import { expect, test } from './test';
import { openPage } from './measure';
import { TRACE, traceSceneOf } from './scene';
import type { TraceHost } from '../src/trace/TraceCanvas';

// The Trace stage stays where the Reader left it (LA-V98-R20, LA-PAT-APP-UX-R22): opening a row moves
// only that row's boxes and the rows below it, which glide there, never the rows above or the camera; selecting a step
// lights its path across its row, the line from each requirement it fulfills to it and on to its chain, the rest faded,
// and the wiki card follows. The outcomes a focused row serves and the journeys carrying it out slide beside it and
// follow the focus to another row (LA-V98-R22), and the camera frames them with the focused box.

const USE_CASE = 'LA-UCS-UC06';
const STEP = 'LA-UCS-UC06-FL-S04';
/** Lathe's own journey "Take an idea to proof": its first steps carry out LA-UCS-UC06, then LA-MOD-UC12. */
const JOURNEY = 'LA-JR01';

const sceneOf = (page: Page, whole = true) => traceSceneOf(page, whole);
/** Each box's place on the page, by its key, and the camera. */
const placesOf = async (page: Page) => {
  const s = await sceneOf(page);
  return { camera: JSON.stringify(s.camera), rows: s.rows, boxes: new Map(s.boxes.map((b) => [b.key, { row: b.row, rect: JSON.stringify(b.rect) }])) };
};

/** Whether a point of the page is the Trace's own canvas, not a panel floating over it (the wiki card, the key, the tools). */
const onCanvas = (page: Page, x: number, y: number) => page.evaluate(({ sel, x, y }) => !!document.elementFromPoint(x, y)?.closest(sel), { sel: TRACE, x, y });

/**
 * A point of what `at` finds, in the open space: where a panel floats over it, the Reader pans it out from under the
 * panel first (the wheel pans the Trace), as they would to click it.
 */
async function reach(page: Page, at: () => Promise<{ x: number; y: number }>) {
  for (let tries = 0; tries < 4; tries++) {
    const point = await at();
    if (await onCanvas(page, point.x, point.y)) return point;
    await page.mouse.move(600, 450);
    await page.mouse.wheel(point.x - 600, point.y - 450);
    await page.waitForTimeout(600);
  }
  throw new Error('the box stays under the panels');
}

test.describe('the Trace stage stays where the Reader left it', () => {
  test('LA-V98-R20-T03 Opening a row moves only it and the rows below, keeps the camera, and a step\'s path lights across its row', async ({ page }) => {
    await openPage(page, `/${USE_CASE}?stage=trace`);
    await page.locator(`${TRACE}[data-ready] canvas`).waitFor();
    await page.waitForTimeout(900);
    const before = await placesOf(page);
    const at = before.rows.indexOf(USE_CASE);
    expect(at).toBeGreaterThanOrEqual(0);
    await page.getByRole('button', { name: 'Expand row' }).click();
    await page.waitForTimeout(900);
    const after = await placesOf(page);
    expect(after.camera).toBe(before.camera);
    expect(after.rows).toEqual(before.rows);
    const above = new Set(before.rows.slice(0, at));
    const moved = [...before.boxes].filter(([key, b]) => b.row !== null && above.has(b.row) && after.boxes.get(key)?.rect !== b.rect).map(([key]) => key);
    expect(moved).toEqual([]);

    // A step of its flow through the web app: its path across the row, the wiki card on it. The flow opens to a box per
    // interface that offers the use case, the web app's to its version's steps.
    for (const key of [`${USE_CASE}|flow/${USE_CASE}-FL`, `${USE_CASE}|flow/${USE_CASE}-FL/LA-IF01`]) {
      expect((await sceneOf(page, false)).boxes.find((b) => b.key === key)?.toggle).toBeTruthy();
      const toggle = await reach(page, async () => (await sceneOf(page, false)).boxes.find((b) => b.key === key)!.toggle!);
      await page.mouse.click(toggle.x, toggle.y);
      await page.waitForTimeout(600);
    }
    const centerOf = async (id: string) => { const r = (await sceneOf(page, false)).boxes.find((b) => b.id === id)!.rect; return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; };
    const step = await reach(page, () => centerOf(STEP));
    await page.mouse.click(step.x, step.y);
    await expect(page).toHaveURL(new RegExp(`/${STEP}\\?stage=trace`));
    await expect.poll(async () => (await sceneOf(page)).lines.filter((l) => l.kind === 'path').length, { timeout: 5000 }).toBeGreaterThan(2);
    const lit = await sceneOf(page);
    expect(lit.boxes.find((b) => b.id === STEP && b.column === 3)).toMatchObject({ focus: true, lit: true });
    expect(lit.boxes.some((b) => b.column === 4 && b.lit && b.role === 'record')).toBe(true);
    await expect(page.locator('.wiki-panel-title h2')).toContainText('flow\'s steps');
  });

  test('LA-V98-R22-T03 The outcomes a focused row serves and the journeys carrying it out sit beside it, framed with it, and follow the focus to another row', async ({ page }) => {
    await openPage(page, `/${USE_CASE}?stage=trace`);
    await page.locator(`${TRACE}[data-ready] canvas`).waitFor();
    /** What sits beside a row as drawn now: the outcomes it serves, the journeys' boxes carrying it out, and its use case's box. */
    const beside = async (u: string) => {
      const s = await sceneOf(page);
      const to = (kind: 'serves' | 'carries') => s.lines.filter((l) => l.kind === kind && l.to === `${u}|use-case`).map((l) => s.boxes.find((b) => b.key === l.from)!.rect);
      return { s, own: s.boxes.find((b) => b.key === `${u}|use-case`)!.rect, outcomes: to('serves'), journeys: to('carries') };
    };
    /** Each column's stack (the outcomes, the journeys) with its middle level with the use case's, every box of it in the frame. */
    const level = async (u: string) => {
      const { s, own, outcomes, journeys } = await beside(u);
      expect(outcomes.length).toBeGreaterThan(0);
      expect(journeys.length).toBeGreaterThan(0);
      for (const stack of [outcomes, journeys]) {
        const top = Math.min(...stack.map((r) => r.top));
        const bottom = Math.max(...stack.map((r) => r.top + r.height));
        expect(Math.abs((top + bottom) / 2 - (own.top + own.height / 2))).toBeLessThan(2);
      }
      for (const r of [own, ...outcomes, ...journeys]) {
        expect(r.top).toBeGreaterThanOrEqual(s.canvas.top - 1);
        expect(r.top + r.height).toBeLessThanOrEqual(s.canvas.top + s.canvas.height + 1);
      }
    };
    await expect.poll(async () => { try { await level(USE_CASE); return true; } catch { return false; } }, { timeout: 5000 }).toBe(true);
    await level(USE_CASE);

    // Another row's use case, served by an outcome and carried out by a journey, clicked where it is drawn: its outcomes
    // and journeys glide to it.
    const s = await sceneOf(page, false);
    const candidates = s.boxes.filter((b) => b.column === 2 && b.depth === 0 && b.row !== USE_CASE && b.row !== null
      && s.lines.some((l) => l.kind === 'serves' && l.to === b.key) && s.lines.some((l) => l.kind === 'carries' && l.to === b.key));
    // One whose middle the canvas hits as that box, in the open space: not under a panel or the columns' names, not past
    // the canvas's edge.
    const middle = (b: (typeof candidates)[number]) => ({ x: b.rect.left + b.rect.width / 2, y: b.rect.top + b.rect.height / 2 });
    const hits = (b: (typeof candidates)[number]) => page.evaluate(({ sel, x, y }) => (document.querySelector(sel) as TraceHost).traceHit!(x, y), { sel: TRACE, ...middle(b) });
    let other: (typeof candidates)[number] | undefined;
    for (const b of candidates) if (await onCanvas(page, middle(b).x, middle(b).y) && (await hits(b)) === b.key) { other = b; break; }
    expect(other).toBeTruthy();
    await page.mouse.click(middle(other!).x, middle(other!).y);
    await expect(page).toHaveURL(new RegExp(`/${other!.row}\\?stage=trace`));
    await expect.poll(async () => { try { await level(other!.row!); return true; } catch { return false; } }, { timeout: 5000 }).toBe(true);
  });

  test('LA-V98-R25-T02 Selecting a journey lights its rows, and the walk goes along it row by row in its order', async ({ page }) => {
    await openPage(page, `/${JOURNEY}?stage=trace`);
    await page.locator(`${TRACE}[data-ready] canvas`).waitFor();
    // The journey focused in the Journey column, its lines to its rows lit, each labeled with its step.
    await expect.poll(async () => (await sceneOf(page)).boxes.find((b) => b.key === `journey/${JOURNEY}`)?.focus, { timeout: 5000 }).toBe(true);
    const lit = await sceneOf(page);
    const carries = lit.lines.filter((l) => l.kind === 'carries' && l.from === `journey/${JOURNEY}`);
    expect(carries.length).toBeGreaterThan(1);
    for (const l of carries) expect(l).toMatchObject({ lit: true, label: expect.stringMatching(/\d/) });
    for (const l of carries) expect(lit.boxes.find((b) => b.key === l.to)?.lit, l.to).toBe(true);
    expect(lit.boxes.some((b) => b.column === 2 && b.depth === 0 && b.lit === false), 'the other rows faded').toBe(true);
    // The walk: Right to the first step's row, Down to the next step's row, Left back to the journey.
    const walk = (name: string) => page.locator('.focus-stage .stage-toolbar').getByRole('button', { name }).click();
    const first = carries.find((l) => l.label === '1')!.to.split('|')[0];
    await walk('Step along the row to the nearest linked box on the right');
    await expect(page).toHaveURL(new RegExp(`/${first}\\?stage=trace`));
    await walk('Step to the box below in its column');
    await expect(page).not.toHaveURL(new RegExp(`/${first}\\?stage=trace`));
    const second = new URL(page.url()).pathname.slice(1);
    expect(carries.map((l) => l.to)).toContain(`${second}|use-case`);
    await walk('Step along the row to the nearest linked box on the left');
    await expect(page).toHaveURL(new RegExp(`/${JOURNEY}\\?stage=trace`));
  });
});
