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
import { traceMap } from '../src/trace/tree';
import { tracesOf } from './trace/traces';
import { traceTarget } from '../src/trace/walk';
import { MOVES, reachable } from '../src/views/levels';

// Every node is reachable by keyboard (LA-PAT-APP-UX-R21): on Lathe's own spec, a breadth-first search over every move
// of the stage walk (the arrows, which W, A, S and D take too, and Out and In) from the product reaches every node each
// stage draws: every box of the Graph's map in each layout, every region, area and entity of the ERD, and every box of
// the Trace's tree. A node it misses is named.

const PRODUCT = 'LA';
let index: SpecIndex;
beforeAll(async () => { index = spaceIndex(recordIndexOf(await repoData({ chains: true })), PRODUCT); }, 120_000);

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

  it('LA-PAT-APP-UX-R21-T02 On the Trace, every box of the tree is reached from the product', () => {
    const map = traceMap(index, tracesOf(index, PRODUCT), PRODUCT);
    expect(map.map.nodes.size).toBeGreaterThan(1000);
    const seen = new Set([map.product]);
    const queue = [map.product];
    for (let i = 0; i < queue.length; i++) {
      for (const move of MOVES) {
        const to = traceTarget(map, queue[i], move);
        if (to !== null && !seen.has(to)) { seen.add(to); queue.push(to); }
      }
    }
    expect(missed(map.map.nodes.keys(), seen), 'unreachable').toEqual([]);
  }, 120_000);
});
