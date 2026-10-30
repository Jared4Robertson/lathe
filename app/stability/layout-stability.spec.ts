import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test, type Page } from '@playwright/test';
import { openPage } from './measure';
import { keepData } from './scenarios';
import { erdSceneOf, GRAPH, graphDrawn, sceneOf } from './scene';
import type { SceneHost } from '../src/graph/GraphPage';
import type { AllHost } from '../src/trace/TraceAll';

// A change moves only what it changed (LA-PAT-APP-UX-R22): with a use case framed on the Graph and on the Trace's
// All-at-once view, an Agent adds a requirement to it through the real CLI. The page reloads on its own; on the Graph
// the new box lands among its siblings, every box outside the use case's region keeps its place and size; on the Trace
// and the Map every box shown before keeps its place, the new one put in free room; and the camera does not move. Tidy
// up then lays the stage out afresh. The suite's copy of Lathe's data is put back after.

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const lathe = (...args: string[]) => execFileSync('node', [path.join(repo, 'lathe/bin/lathe.ts'), ...args, '--root', process.env.STABILITY_ROOT!], { stdio: 'pipe' }).toString();
const USE_CASE = 'LA-EXP-UC15';
const ADDED = 'LA-EXP-UC15-R99';
const addRequirement = () => lathe('use-case', 'add-uc-requirement', '--id', ADDED, '--title', 'A change keeps the map where the Reader left it', '--use_case_id', USE_CASE, '--statement', 'A change MUST move only what it changed.');

type Placed = { key: string; parent: string | null; rect: string };
/** Every box the Graph draws, by its ID, with its box in the map. */
const graphBoxes = async (page: Page): Promise<{ boxes: Placed[]; camera: string }> => {
  const s = await sceneOf(page);
  return { camera: JSON.stringify(s.camera), boxes: s.boxes.map((b) => ({ key: b.id, parent: null, rect: JSON.stringify(b.map) })) };
};
/** Every box of the Trace's All-at-once view, each column's keys top to bottom, each box's place on the page, the top of the boxes under no outcome, and the camera. */
const traceColumns = (page: Page): Promise<{ columns: string[][]; places: Record<string, string>; under: Record<string, boolean>; camera: string }> => page.evaluate(() => {
  const s = (document.querySelector('.trace-flow') as AllHost).traceScene!(true);
  return {
    camera: JSON.stringify(s.camera),
    columns: [0, 1, 2, 3, 4].map((c) => s.boxes.filter((b) => b.column === c).sort((a, b) => a.rect.top - b.rect.top).map((b) => b.key)),
    places: Object.fromEntries(s.boxes.map((b) => [b.key, `${b.rect.left.toFixed(2)},${b.rect.top.toFixed(2)}`])),
    under: Object.fromEntries(s.boxes.map((b) => [b.key, b.under])),
  };
});

test.describe('the map stays where the Reader left it', () => {
  test('LA-PAT-APP-UX-R22-T01 Adding a record moves only its parent\'s region on the Graph, keeps every box where it was on the Trace, and keeps the camera', async ({ page }) => {
    const restore = keepData();
    try {
      // The Graph: the use case framed with its requirements; what is drawn around it stays put.
      await openPage(page, `/${USE_CASE}?stage=graph`);
      await graphDrawn(page, 'tree');
      const before = await graphBoxes(page);
      addRequirement();
      await page.waitForFunction(({ sel, id }) => !!(document.querySelector(sel) as SceneHost).graphScene?.().boxes.some((b) => b.id === id), { sel: GRAPH, id: ADDED }, { timeout: 20_000 });
      await page.waitForTimeout(600);
      const after = await graphBoxes(page);
      expect(after.camera).toBe(before.camera);
      const requirements = (await sceneOf(page)).boxes.filter((b) => b.id.startsWith(`${USE_CASE}-R`)).sort((a, b) => a.map.y - b.map.y).map((b) => b.id);
      expect(requirements).toEqual([...requirements].sort());
      const now = new Map(after.boxes.map((b) => [b.key, b.rect]));
      const moved = before.boxes.filter((b) => !b.key.startsWith(`${USE_CASE}-R`) && now.get(b.key) !== b.rect).map((b) => b.key);
      expect(moved).toEqual([]);

      // The Trace's All-at-once view: every box keeps its place (the boxes under no outcome together, pushed down only
      // as far as a new box reaches into them), the new requirement in free room in its column; the camera stays.
      await openPage(page, `/${USE_CASE}?stage=trace`);
      await page.locator('.trace-flow[data-ready] canvas').waitFor();
      await page.waitForTimeout(900);
      const traceBefore = await traceColumns(page);
      const added = 'LA-EXP-UC15-R98';
      lathe('use-case', 'add-uc-requirement', '--id', added, '--title', 'Added while the Trace was open', '--use_case_id', USE_CASE, '--statement', 'The Trace MUST keep its boxes in their places.');
      await expect.poll(async () => (await traceColumns(page)).columns[2].includes(added), { timeout: 20_000 }).toBe(true);
      await page.waitForTimeout(900);
      const traceAfter = await traceColumns(page);
      expect(traceAfter.camera).toBe(traceBefore.camera);
      const top = (place: string) => Number(place.split(',')[1]);
      const shifts = new Set(Object.keys(traceBefore.places).filter((k) => k in traceAfter.places && !traceBefore.under[k]).map((k) => (top(traceAfter.places[k]) - top(traceBefore.places[k])).toFixed(1)));
      expect(shifts.size).toBeLessThanOrEqual(1);
      const traceMoved = Object.keys(traceBefore.places).filter((k) => k in traceAfter.places && traceBefore.under[k] && traceAfter.places[k] !== traceBefore.places[k]);
      expect(traceMoved).toEqual([]);
      traceAfter.columns.forEach((c, i) => expect(c.filter((k) => k in traceBefore.places), `column ${i}`).toEqual(traceBefore.columns[i].filter((k) => traceAfter.columns[i].includes(k))));

      // Tidy up lays the columns out afresh: every box drawn, and the camera follows the focus's box, keeping it where it was on screen.
      await page.keyboard.press('t');
      await page.waitForTimeout(900);
      const tidied = await traceColumns(page);
      expect(Object.keys(tidied.places).sort()).toEqual(Object.keys(traceAfter.places).sort());
      const [focusWas, focusNow] = [traceAfter.places[USE_CASE].split(',').map(Number), tidied.places[USE_CASE].split(',').map(Number)];
      expect(Math.abs(focusNow[0] - focusWas[0]) + Math.abs(focusNow[1] - focusWas[1])).toBeLessThan(2);
    } finally {
      restore();
    }
  });

  test('LA-V93-R74-T02 Adding a record on the Map keeps every box where it was unless a grown container now covers it; the camera stays; Tidy up packs afresh', async ({ page }) => {
    const restore = keepData();
    try {
      await openPage(page, `/${USE_CASE}?stage=graph`);
      await graphDrawn(page);
      await page.locator('.graph-layout button', { hasText: 'Map' }).click();
      await graphDrawn(page, 'map', 900);
      const before = await graphBoxes(page);
      const was = new Map(before.boxes.map((b) => [b.key, JSON.parse(b.rect) as { x: number; y: number; w: number; h: number }]));
      addRequirement();
      await page.waitForFunction(({ sel, id }) => !!(document.querySelector(sel) as SceneHost).graphScene?.().boxes.some((b) => b.id === id), { sel: GRAPH, id: ADDED }, { timeout: 20_000 });
      await page.waitForTimeout(900);
      const after = await graphBoxes(page);
      expect(after.camera).toBe(before.camera);
      // The use case's own requirements keep their places; a box anywhere else moves only right or down, pushed by a
      // container that grew, and none above and left of the use case moves at all.
      const uc = was.get(USE_CASE)!;
      const moved = after.boxes.map((b) => ({ key: b.key, now: JSON.parse(b.rect) as { x: number; y: number }, then: was.get(b.key) })).filter((b) => b.then && (b.now.x !== b.then.x || b.now.y !== b.then.y));
      expect(moved.filter((b) => /^LA-EXP-UC15-R\d+$/.test(b.key)).map((b) => b.key)).toEqual([]);
      expect(moved.filter((b) => b.now.x < b.then!.x || b.now.y < b.then!.y).map((b) => b.key)).toEqual([]);
      expect(moved.filter((b) => b.then!.x + b.then!.w <= uc.x && b.then!.y + b.then!.h <= uc.y).map((b) => b.key)).toEqual([]);

      // Tidy up packs the Map afresh: the use case's requirements in ID order.
      await page.keyboard.press('t');
      await page.waitForTimeout(900);
      const tidied = await sceneOf(page);
      const requirements = tidied.boxes.filter((b) => /^LA-EXP-UC15-R\d+$/.test(b.id)).sort((a, b) => a.map.y - b.map.y || a.map.x - b.map.x).map((b) => b.id);
      expect(requirements).toEqual([...requirements].sort());
    } finally {
      restore();
    }
  });

  test('LA-PAT-APP-UX-R22-T01 Adding an entity on the ERD moves only its aggregate\'s boundary and what it pushes, and keeps the camera', async ({ page }) => {
    const restore = keepData();
    try {
      // Every box's place inside its parent and its size, and the camera.
      const erdBoxes = async () => {
        const s = await erdSceneOf(page, true);
        const at = new Map(s.boxes.map((b) => [b.id, b.map]));
        return {
          camera: JSON.stringify(s.camera),
          boxes: Object.fromEntries(s.boxes.map((b) => { const p = b.parent ? at.get(b.parent) : undefined; return [b.id, `${b.map.x - (p?.x ?? 0)},${b.map.y - (p?.y ?? 0)} ${b.map.width}x${b.map.height}`]; })),
        };
      };
      await openPage(page, '/LA-EXP-A5?stage=erd');
      await page.locator('.erd-flow[data-framed]').waitFor();
      await page.waitForTimeout(600);
      const before = await erdBoxes();
      lathe('aggregate', 'add-entity', '--id', 'LA-EXP-EN99', '--title', 'Pinned tab', '--aggregate_id', 'LA-EXP-A5', '--role', 'child', '--description', 'A tab kept open across sessions.');
      await expect.poll(async () => (await erdSceneOf(page, true)).boxes.some((b) => b.id === 'LA-EXP-EN99'), { timeout: 20_000 }).toBe(true);
      await page.waitForTimeout(600);
      const after = await erdBoxes();
      expect(after.camera).toBe(before.camera);
      // The boxes of every other domain keep their places inside their regions and their sizes (a region may be pushed whole).
      const elsewhere = Object.keys(before.boxes).filter((id) => /^LA-(?!EXP-)[A-Z0-9]+-(A|EN)\d+$/.test(id));
      expect(elsewhere.length).toBeGreaterThan(0);
      expect(elsewhere.filter((id) => after.boxes[id] !== before.boxes[id])).toEqual([]);
    } finally {
      restore();
    }
  });
});
