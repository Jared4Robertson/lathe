import { expect, test, type Page } from '@playwright/test';
import { openPage } from './measure';
import type { DeliveryHost, DeliveryScene } from '../src/trace/delivery/TraceDelivery';

// The Trace stage's Delivery view stays where the Reader left it (LA-V98-R20, LA-PAT-APP-UX-R22): opening a row moves
// only that row's boxes and the rows below it, which glide there, never the rows above or the camera; selecting a step
// lights its path across its row, the line from each requirement it fulfills to it and on to its chain, the rest faded,
// and the wiki card follows. The outcomes a focused row serves slide beside it and follow the focus to another row
// (LA-V98-R22), and the camera frames them with the focused box.

const USE_CASE = 'LA-AUT-UC06';
const STEP = 'LA-AUT-UC06-FL01-S03';
const DELIVERY = '.focus-stage .trace-flow[data-view="delivery"]';

const sceneOf = (page: Page, whole = true): Promise<DeliveryScene> => page.evaluate(({ sel, whole }) => (document.querySelector(sel) as DeliveryHost).deliveryScene!(whole), { sel: DELIVERY, whole });
/** Each box's place on the page, by its key, and the camera. */
const placesOf = async (page: Page) => {
  const s = await sceneOf(page);
  return { camera: JSON.stringify(s.camera), rows: s.rows, boxes: new Map(s.boxes.map((b) => [b.key, { row: b.row, rect: JSON.stringify(b.rect) }])) };
};

test.describe('the Delivery view stays where the Reader left it', () => {
  test('LA-V98-R20-T03 Opening a row moves only it and the rows below, keeps the camera, and a step\'s path lights across its row', async ({ page }) => {
    await openPage(page, `/${USE_CASE}?stage=trace`);
    await page.getByRole('group', { name: 'Trace view' }).getByRole('button', { name: 'Delivery' }).click();
    await page.locator(`${DELIVERY}[data-ready] canvas`).waitFor();
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
    const toggle = (await sceneOf(page, false)).boxes.find((b) => b.key === flow)?.toggle;
    expect(toggle).toBeTruthy();
    await page.mouse.click(toggle!.x, toggle!.y);
    await page.waitForTimeout(600);
    const step = (await sceneOf(page, false)).boxes.find((b) => b.id === STEP)!;
    await page.mouse.click(step.rect.left + step.rect.width / 2, step.rect.top + step.rect.height / 2);
    await expect(page).toHaveURL(new RegExp(`/${STEP}\\?stage=trace`));
    await expect.poll(async () => (await sceneOf(page)).lines.filter((l) => l.kind === 'path').length, { timeout: 5000 }).toBeGreaterThan(2);
    const lit = await sceneOf(page);
    expect(lit.boxes.find((b) => b.id === STEP && b.column === 2)).toMatchObject({ focus: true, lit: true });
    expect(lit.boxes.some((b) => b.column === 3 && b.lit && b.role === 'record')).toBe(true);
    await expect(page.locator('.wiki-panel h1')).toContainText('flow\'s steps');
  });

  test('LA-V98-R22-T03 The outcomes a focused row serves sit beside it, framed with it, and follow the focus to another row', async ({ page }) => {
    await openPage(page, `/${USE_CASE}?stage=trace`);
    await page.getByRole('group', { name: 'Trace view' }).getByRole('button', { name: 'Delivery' }).click();
    await page.locator(`${DELIVERY}[data-ready] canvas`).waitFor();
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
    const other = s.boxes.find((b) => b.column === 1 && b.depth === 0 && b.row !== USE_CASE && b.row !== null && s.lines.some((l) => l.kind === 'serves' && l.to === b.key))!;
    expect(other).toBeTruthy();
    await page.mouse.click(other.rect.left + other.rect.width / 2, other.rect.top + other.rect.height / 2);
    await expect(page).toHaveURL(new RegExp(`/${other.row}\\?stage=trace`));
    await expect.poll(async () => { try { await level(other.row!); return true; } catch { return false; } }, { timeout: 5000 }).toBe(true);
  });
});
