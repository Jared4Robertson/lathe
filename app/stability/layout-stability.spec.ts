import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Page } from '@playwright/test';
import { expect, test } from './test';
import { openPage } from './measure';
import { keepData } from './scenarios';
import { erdSceneOf, GRAPH, graphDrawn, sceneOf, traceSceneOf } from './scene';
import type { SceneHost } from '../src/graph/GraphPage';

// A change moves only what it changed (LA-PAT-APP-UX-R22): with a use case framed on the Graph, an Agent adds a
// requirement to it through the real CLI, and on the Trace stage a use case beside it. The page reloads on its own; on
// the Graph the new box lands among its siblings, every box outside the use case's region keeps its place and size; on
// the Trace every row keeps its order and the rows above the new one their places; on the Map every box shown before
// keeps its place, the new one put in free room; and the camera does not move. Tidy up then lays the stage out afresh. The suite's copy of Lathe's data is put back after.

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
/** The Trace stage's rows top to bottom, each closed row's boxes' places on the page by key, and the camera. */
const traceRows = async (page: Page): Promise<{ rows: string[]; places: Record<string, string>; camera: string }> => {
  const s = await traceSceneOf(page, true);
  return {
    camera: JSON.stringify(s.camera),
    rows: s.rows,
    places: Object.fromEntries(s.boxes.filter((b) => b.row !== null).map((b) => [b.key, `${b.rect.left.toFixed(2)},${b.rect.top.toFixed(2)}`])),
  };
};

test.describe('the map stays where the Reader left it', () => {
  test('LA-PAT-APP-UX-R22-T01 Adding a record moves only its parent\'s region on the Graph, keeps every row where it was on the Trace, and keeps the camera', async ({ page }) => {
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

      // The Trace stage: a use case an Agent adds takes a free room near where its links put it, else the end of its
      // section; every row shown before keeps its order, the rows above it every box at its place, and the camera stays.
      await openPage(page, `/${USE_CASE}?stage=trace`);
      await page.locator('.trace-flow[data-ready] canvas').waitFor();
      await page.waitForTimeout(900);
      const traceBefore = await traceRows(page);
      const added = 'LA-EXP-UC98';
      lathe('use-case', 'add-use-case', '--id', added, '--title', 'Watch a use case appear', '--capability_id', 'LA-EXP-CAP02', '--goal', 'The Reader sees a new use case appear while following the trace.', '--actors', 'Reader');
      await expect.poll(async () => (await traceRows(page)).rows.includes(added), { timeout: 20_000 }).toBe(true);
      await page.waitForTimeout(900);
      const traceAfter = await traceRows(page);
      expect(traceAfter.camera).toBe(traceBefore.camera);
      expect(traceAfter.rows.filter((r) => r !== added)).toEqual(traceBefore.rows);
      // The rows above the new one, every box at its place (the rows after it in its section step down by its row).
      const above = new Set(traceAfter.rows.slice(0, traceAfter.rows.indexOf(added)));
      const traceMoved = Object.keys(traceBefore.places).filter((k) => above.has(k.split('|')[0]) && traceAfter.places[k] !== traceBefore.places[k]);
      expect(traceMoved).toEqual([]);

      // Tidy up orders the rows afresh: every row drawn, and the camera follows the focus's box, keeping it where it was on screen.
      await page.keyboard.press('t');
      await page.waitForTimeout(900);
      const tidied = await traceRows(page);
      expect([...tidied.rows].sort()).toEqual([...traceAfter.rows].sort());
      const own = `${USE_CASE}|use-case`;
      const [focusWas, focusNow] = [traceAfter.places[own].split(',').map(Number), tidied.places[own].split(',').map(Number)];
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
