// @vitest-environment node
import { beforeAll, describe, expect, it } from 'vitest';
import { type ServedData } from './read-view';
import { repoData } from './fixtures/repo';
import { type RecordIndex } from '../src/exploring/record-summaries/record-index';
import { GRAPH_LAYOUTS } from '../src/graph/GraphPage';
import { graphTarget } from '../src/graph/steps';
import { erdLayout } from '../src/erd/layout';
import { erdLevels } from '../src/erd/walk';
import { allGraph } from '../src/trace/all';
import { traced, tracesOf } from './trace/traces';
import { erdOf } from './erd-of';
import { allTarget } from '../src/trace/all-walk';
import { MOVES, reachable } from '../src/views/levels';
import { graphMap, groundMap } from './graph/maps';

// Every node is reachable by keyboard (LA-PAT-APP-UX-R21): on Lathe's own spec, a breadth-first search over every move
// of the stage walk (the arrows, which W, A, S and D take too, and Out and In) from the product reaches every node each
// stage draws: every box of the Graph's map in each layout, every region, area and entity of the ERD, and every box of
// the Trace's All-at-once view. A node it misses is named.

const PRODUCT = 'LA';
let data: ServedData;
let index: RecordIndex;
beforeAll(async () => { data = await repoData({ chains: true }); index = traced(data, PRODUCT).index; }, 120_000);

/** The nodes of `all` a walk misses, named. */
const missed = (all: Iterable<string>, reached: ReadonlySet<string>) => [...all].filter((id) => !reached.has(id));

describe('every node is reachable by keyboard', () => {
  it('LA-PAT-APP-UX-R21-T02 On the Graph, every box of the map is reached from the product in each layout', () => {
    const tree = [...graphMap(index, PRODUCT).nodes.keys()];
    const ground = [...groundMap(index).nodes.keys()];
    expect(tree.length).toBeGreaterThan(1000);
    expect(ground.length).toBeGreaterThan(1000);
    for (const { layout } of GRAPH_LAYOUTS) {
      // The Map draws its own tree (ground.ts): each layout's walk must reach every box that layout draws.
      const drawn = layout === 'map' ? ground : tree;
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
    const map = erdOf(data, PRODUCT);
    const rects = await erdLayout(map);
    expect(map.boxes.length).toBeGreaterThan(20);
    const seen = reachable(erdLevels(map, rects));
    expect(missed(map.boxes.map((b) => b.id), seen), 'unreachable').toEqual([]);
  }, 60_000);

  it('LA-PAT-APP-UX-R21-T02 On the Trace, every box of the All-at-once view is reached from the product', () => {
    const graph = allGraph(index, tracesOf(data, PRODUCT), PRODUCT);
    expect(graph.nodes.size).toBeGreaterThan(1000);
    // The product has no box: the walk starts from none.
    const seen = new Set<string>();
    const queue: (string | null)[] = [null];
    for (let i = 0; i < queue.length; i++) {
      for (const move of MOVES) {
        const to = allTarget(graph, null, queue[i], move);
        if (to !== null && !seen.has(to)) { seen.add(to); queue.push(to); }
      }
    }
    expect(missed(graph.nodes.keys(), seen), 'unreachable').toEqual([]);
  }, 120_000);
});
