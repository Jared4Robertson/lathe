// @vitest-environment node
import { beforeAll, describe, expect, it } from 'vitest';
import { indexOf } from './fixtures/load';
import { repoData } from './fixtures/repo';
import { spaceIndex, type SpecIndex } from '../src/specs/data';
import { graphMap } from '../src/graph/map';
import { GRAPH_LAYOUTS } from '../src/graph/GraphPage';
import { graphTarget } from '../src/graph/steps';
import { erdMap } from '../src/erd/erd';
import { erdLayout } from '../src/erd/layout';
import { erdLevels } from '../src/erd/walk';
import { traceMap } from '../src/trace/lanes';
import { traceLevels, traceNode } from '../src/trace/walk';
import { levelMove, MOVES, reachable } from '../src/views/levels';

// Every node is reachable by keyboard (LA-PAT-APP-UX-R21): on Lathe's own spec, a breadth-first search over every move
// of the stage walk (the arrows, which W, A, S and D take too, and Out and In) from the product reaches every node each
// stage draws: every box of the Graph's map in each layout, every region, area and entity of the ERD, and every box of
// the Trace, the boxes a "+N more" hides among them (In, as Enter, opens it). A node it misses is named.

const PRODUCT = 'LA';
let index: SpecIndex;
beforeAll(async () => { index = spaceIndex(indexOf(await repoData({ chains: true })), PRODUCT); }, 120_000);

/** The nodes of `all` a walk misses, named. */
const missed = (all: Iterable<string>, reached: ReadonlySet<string>) => [...all].filter((id) => !reached.has(id));

describe('every node is reachable by keyboard', () => {
  it('LA-PAT-APP-UX-R21-T02 On the Graph, every box of the map is reached from the product in each layout', () => {
    const drawn = [...graphMap(index, PRODUCT).nodes.keys()];
    expect(drawn.length).toBeGreaterThan(1000);
    for (const { layout } of GRAPH_LAYOUTS) {
      const seen = new Set([PRODUCT]);
      const queue = [PRODUCT];
      for (let i = 0; i < queue.length; i++) {
        for (const move of MOVES) {
          const to = graphTarget(index, queue[i], layout, move);
          if (to !== null && !seen.has(to)) { seen.add(to); queue.push(to); }
        }
      }
      expect(missed(drawn, seen), `${layout}: unreachable`).toEqual([]);
    }
  }, 60_000);

  it('LA-PAT-APP-UX-R21-T02 On the ERD, every region, aggregate area and entity is reached from the product', async () => {
    const map = erdMap(index, PRODUCT);
    const rects = await erdLayout(index, PRODUCT);
    expect(map.boxes.length).toBeGreaterThan(20);
    const seen = reachable(erdLevels(map, rects));
    expect(missed(map.boxes.map((b) => b.id), seen), 'unreachable').toEqual([]);
  }, 60_000);

  it('LA-PAT-APP-UX-R21-T02 On the Trace, every box is reached from the product, those a "+N more" hides among them', () => {
    const map = traceMap(index, PRODUCT);
    expect(map.lanes.some((l) => l.open)).toBe(true);
    // The lane drawn open where the walk stands: a box's own lane, when it has an open form, as focusing it opens it.
    const openAt = (node: string) => {
      const n = traceNode(map, node);
      const lane = n?.level === 'box' ? map.byKey.get(n.at.key)!.lane : n?.level === 'lane' ? n.lane : -1;
      return lane >= 0 && map.lanes[lane].open ? lane : null;
    };
    const seen = new Set([map.product]);
    const queue = [map.product];
    for (let i = 0; i < queue.length; i++) {
      for (const move of MOVES) {
        const to = levelMove(traceLevels(map, openAt(queue[i])), queue[i], move);
        if (to !== null && !seen.has(to)) { seen.add(to); queue.push(to); }
      }
    }
    const keys = new Set([...seen].flatMap((node) => { const n = traceNode(map, node); return n?.level === 'box' ? [n.at.key] : []; }));
    const hidden = map.lanes.flatMap((l) => (l.open ? l.open.boxes.filter((b) => !l.boxes.includes(b)) : []));
    expect(hidden.length).toBeGreaterThan(0);
    expect(missed(map.byKey.keys(), keys), 'unreachable').toEqual([]);
  }, 120_000);
});
