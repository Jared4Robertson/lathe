import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test, type Page } from '@playwright/test';
import { openPage } from './measure';
import { keepData } from './scenarios';
import { GRAPH, graphDrawn, sceneOf } from './scene';
import type { SceneHost } from '../src/graph/GraphPage';
import type { AllHost } from '../src/trace/TraceAll';

// A change moves only what it changed (LA-PAT-APP-UX-R22): with a use case framed on the Graph and on the Trace's
// All-at-once view, an Agent adds a requirement to it through the real CLI. The page reloads on its own; on the Graph
// the new box lands among its siblings, every box outside the use case's region keeps its place and size; on the Trace
// every column keeps its order with the new box in its place; and the camera does not move. The suite's copy of
// Lathe's data is put back after.

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
/** Every box of the Trace's All-at-once view, each column's keys top to bottom, and the camera. */
const traceColumns = (page: Page): Promise<{ columns: string[][]; camera: string }> => page.evaluate(() => {
  const s = (document.querySelector('.trace-flow') as AllHost).traceScene!(true);
  return { camera: JSON.stringify(s.camera), columns: [0, 1, 2, 3, 4].map((c) => s.boxes.filter((b) => b.column === c).sort((a, b) => a.rect.top - b.rect.top).map((b) => b.key)) };
});

test.describe('the map stays where the Reader left it', () => {
  test('LA-PAT-APP-UX-R22-T01 Adding a record moves only its parent\'s region, keeps the camera and morphs into place, on the Graph and the Trace', async ({ page }) => {
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

      // The Trace's All-at-once view: the new requirement goes in among the others, every column keeps its order, the camera stays.
      await openPage(page, `/${USE_CASE}?stage=trace`);
      await page.locator('.trace-flow[data-ready] canvas').waitFor();
      await page.waitForTimeout(900);
      const traceBefore = await traceColumns(page);
      const added = 'LA-EXP-UC15-R98';
      lathe('use-case', 'add-uc-requirement', '--id', added, '--title', 'Added while the Trace was open', '--use_case_id', USE_CASE, '--statement', 'The Trace MUST keep its boxes in their order.');
      await expect.poll(async () => (await traceColumns(page)).columns[2].includes(added), { timeout: 20_000 }).toBe(true);
      await page.waitForTimeout(900);
      const traceAfter = await traceColumns(page);
      expect(traceAfter.camera).toBe(traceBefore.camera);
      traceAfter.columns.forEach((c, i) => expect(c.filter((k) => k !== added), `column ${i}`).toEqual(traceBefore.columns[i]));
    } finally {
      restore();
    }
  });
});
