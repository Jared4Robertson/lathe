import type { Page } from '@playwright/test';
import { expect, test } from './test';
import { openPage } from './measure';
import { TRACE, traceSceneOf } from './scene';

// The Trace stage stays where the Reader left it (LA-V98-R20, LA-PAT-APP-UX-R22): opening a row moves
// only that row's boxes and the rows below it, which glide there, never the rows above or the camera; selecting a step
// lights its path across its row, the line from each requirement it fulfills to it and on to its chain, the rest faded,
// and the wiki card follows. The outcomes a focused row serves slide beside it and follow the focus to another row
// (LA-V98-R22), and the camera frames them with the focused box.

const USE_CASE = 'LA-AUT-UC06';
const STEP = 'LA-AUT-UC06-FL-S04';

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

    // A step of its first flow: its path across the row, the wiki card on it.
    const flow = `${USE_CASE}|design/${USE_CASE}-FL01`;
    expect((await sceneOf(page, false)).boxes.find((b) => b.key === flow)?.toggle).toBeTruthy();
    const toggle = await reach(page, async () => (await sceneOf(page, false)).boxes.find((b) => b.key === flow)!.toggle!);
    await page.mouse.click(toggle.x, toggle.y);
    await page.waitForTimeout(600);
    const centerOf = async (id: string) => { const r = (await sceneOf(page, false)).boxes.find((b) => b.id === id)!.rect; return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; };
    const step = await reach(page, () => centerOf(STEP));
    await page.mouse.click(step.x, step.y);
    await expect(page).toHaveURL(new RegExp(`/${STEP}\\?stage=trace`));
    await expect.poll(async () => (await sceneOf(page)).lines.filter((l) => l.kind === 'path').length, { timeout: 5000 }).toBeGreaterThan(2);
    const lit = await sceneOf(page);
    expect(lit.boxes.find((b) => b.id === STEP && b.column === 2)).toMatchObject({ focus: true, lit: true });
    expect(lit.boxes.some((b) => b.column === 3 && b.lit && b.role === 'record')).toBe(true);
    await expect(page.locator('.wiki-panel-title h2')).toContainText('flow\'s steps');
  });

  test('LA-V98-R22-T03 The outcomes a focused row serves sit beside it, framed with it, and follow the focus to another row', async ({ page }) => {
    await openPage(page, `/${USE_CASE}?stage=trace`);
    await page.locator(`${TRACE}[data-ready] canvas`).waitFor();
    /** The outcomes a row serves, as drawn now, and its use case's box. */
    const beside = async (u: string) => {
      const s = await sceneOf(page);
      const outcomes = s.lines.filter((l) => l.kind === 'serves' && l.to === `${u}|use-case`).map((l) => s.boxes.find((b) => b.key === l.from)!.rect);
      return { s, own: s.boxes.find((b) => b.key === `${u}|use-case`)!.rect, outcomes };
    };
    /** The stack's middle level with the use case's, every box of it in the frame. */
    const level = async (u: string) => {
      const { s, own, outcomes } = await beside(u);
      expect(outcomes.length).toBeGreaterThan(0);
      const top = Math.min(...outcomes.map((r) => r.top));
      const bottom = Math.max(...outcomes.map((r) => r.top + r.height));
      expect(Math.abs((top + bottom) / 2 - (own.top + own.height / 2))).toBeLessThan(2);
      for (const r of [own, ...outcomes]) {
        expect(r.top).toBeGreaterThanOrEqual(s.canvas.top - 1);
        expect(r.top + r.height).toBeLessThanOrEqual(s.canvas.top + s.canvas.height + 1);
      }
    };
    await expect.poll(async () => { try { await level(USE_CASE); return true; } catch { return false; } }, { timeout: 5000 }).toBe(true);
    await level(USE_CASE);

    // Another row's use case, clicked where it is drawn: its outcomes glide to it.
    const s = await sceneOf(page, false);
    const serving = s.boxes.filter((b) => b.column === 1 && b.depth === 0 && b.row !== USE_CASE && b.row !== null && s.lines.some((l) => l.kind === 'serves' && l.to === b.key));
    // One whose middle is in the open space, as drawn: not under a panel, not past the canvas's edge.
    const middle = (b: (typeof serving)[number]) => ({ x: b.rect.left + b.rect.width / 2, y: b.rect.top + b.rect.height / 2 });
    let other: (typeof serving)[number] | undefined;
    for (const b of serving) if (await onCanvas(page, middle(b).x, middle(b).y)) { other = b; break; }
    expect(other).toBeTruthy();
    await page.mouse.click(middle(other!).x, middle(other!).y);
    await expect(page).toHaveURL(new RegExp(`/${other!.row}\\?stage=trace`));
    await expect.poll(async () => { try { await level(other!.row!); return true; } catch { return false; } }, { timeout: 5000 }).toBe(true);
  });
});
