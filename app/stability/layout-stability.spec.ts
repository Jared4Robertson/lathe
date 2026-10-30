import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test, type Page } from '@playwright/test';
import { openPage } from './measure';
import { keepData } from './scenarios';
import { GRAPH, graphDrawn, sceneOf } from './scene';
import type { SceneHost } from '../src/graph/GraphPage';
import type { TraceHost } from '../src/trace/TraceCanvas';

// A change moves only what it changed (LA-PAT-APP-UX-R22): with a use case framed on the Graph and on the Trace's tree,
// an Agent adds a requirement to it through the real CLI. The page reloads on its own; the new box lands among its
// siblings, every box outside the use case's region keeps its place and size, the siblings keep their order, and the
// camera does not move. The suite's copy of Lathe's data is put back after.

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
/** Every box of the Trace's whole tree, by its key, with its parent's key and its box in the map. */
const traceBoxes = (page: Page): Promise<{ boxes: Placed[]; camera: string }> => page.evaluate(() => {
  const s = (document.querySelector('.trace-flow') as TraceHost).traceScene!(true);
  return { camera: JSON.stringify(s.camera), boxes: s.boxes.map((b) => ({ key: b.key, parent: b.parent, rect: JSON.stringify(b.rect) })) };
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

      // The Trace's tree: the use case's region under its outcome takes the new requirement; nothing else moves.
      await openPage(page, `/${USE_CASE}?stage=trace`);
      await page.getByRole('button', { name: 'Tree', exact: true }).click();
      await page.locator('.trace-flow canvas').waitFor();
      await page.waitForTimeout(800);
      const traceBefore = await traceBoxes(page);
      lathe('use-case', 'add-uc-requirement', '--id', 'LA-EXP-UC15-R98', '--title', 'Added while the Trace was open', '--use_case_id', USE_CASE, '--statement', 'The Trace MUST keep its boxes in place.');
      await expect.poll(async () => (await traceBoxes(page)).boxes.length, { timeout: 20_000 }).toBeGreaterThan(traceBefore.boxes.length);
      await page.waitForTimeout(600);
      const traceAfter = await traceBoxes(page);
      expect(traceAfter.camera).toBe(traceBefore.camera);
      const parentOf = new Map(traceAfter.boxes.map((b) => [b.key, b.parent]));
      const underUseCase = (key: string) => { for (let at: string | null | undefined = key; at; at = parentOf.get(at)) if (at.endsWith(`|${USE_CASE}`)) return at !== key; return false; };
      const placed = new Map(traceAfter.boxes.map((b) => [b.key, b.rect]));
      expect(traceBefore.boxes.filter((b) => !underUseCase(b.key) && placed.get(b.key) !== b.rect).map((b) => b.key)).toEqual([]);
    } finally {
      restore();
    }
  });
});
