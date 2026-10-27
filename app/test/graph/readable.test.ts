// @vitest-environment node
import path from 'node:path';
import type { SpecData } from '../../../lathe/src/server/contract';
import { indexOf } from '../fixtures/load';
import { beforeAll, describe, expect, it } from 'vitest';
import { openStore } from '../../../lathe/src/store/index';
import { drawnFor, drawnNested, FRAME_PADDING, frameNested, frameOnMap, MAX_ZOOM, MIN_ZOOM, type Drawn, type Viewport } from '../../src/graph/camera';
import { graphMap, treeText, type GraphMap, type PlacedMap } from '../../src/graph/map';
import { nestedMap } from '../../src/graph/nested';
import { holds, polygonArea, readyVoronoiMap, type VoronoiMap } from '../../src/graph/voronoi';
import { BORDER, labelHeight, labelLines, TITLE_FONT } from '../../src/graph/text';
import { treeOf } from '../../src/graph/tree';
import { spaceIndex, type SpecIndex } from '../../src/specs/data';

/** This repo's products, Lathe's (data/) and the Tool Library's (examples/tool-library/data/), as one data set read through the store. */
async function repoData(): Promise<SpecData> {
  const repo = path.resolve(import.meta.dirname, '../../..');
  const data: SpecData = { schema: undefined as unknown as SpecData['schema'], dataDir: 'data', tables: {}, problems: [], coverage: [] };
  for (const dir of ['data', 'examples/tool-library/data']) {
    const store = await openStore(repo, { dataDir: path.join(repo, dir) });
    data.schema ??= store.schema;
    for (const table of store.schema.loadOrder) data.tables[table] = [...(data.tables[table] ?? []), ...store.rows(table)];
    await store.close();
  }
  return data;
}
import { siblingGroups } from './workspace';
import { plateOf, type Plate, type PlateSource } from '../../src/graph/plate';
import { inPolygon } from '../../src/graph/hit';
import type { NestedNode } from '../../src/graph/nested';
import type { VoronoiNode } from '../../src/graph/voronoi';

/** The scene's check (the canvas draws a box's plate, plate.ts): every line of its label lies whole inside the box, and a cell's inside its outline. */
function plateOutside(p: Plate): string | null {
  const eps = 1e-6 * Math.max(1, p.w);
  for (const l of p.lines) {
    const corners = [[l.x, l.top], [l.x + l.width, l.top], [l.x, l.top + l.height], [l.x + l.width, l.top + l.height]] as const;
    if (corners.some(([x, y]) => x < p.x - eps || x > p.x + p.w + eps || y < p.y - eps || y > p.y + p.h + eps)) return `"${l.text}" lies outside its box`;
    if (p.view === 'voronoi' && p.outline.kind === 'polygon' && corners.some(([x, y]) => !inPolygon(p.outline.kind === 'polygon' ? p.outline.points : [], { x, y }))) return `"${l.text}" lies outside its cell`;
  }
  return null;
}
const sourceOf = (map: PlacedMap, id: string): PlateSource => {
  const n = map.nodes.get(id)!;
  return map.view === 'tree' ? { view: 'tree', node: n } : map.view === 'nested' ? { view: 'nested', node: n as NestedNode } : { view: 'voronoi', node: n as VoronoiNode };
};

// Every drawn box shows its name (LA-PAT-APP-UX-R12): in every layout of the graph, at every focus
// and depth, each box the camera draws carries its label, its title and its kind and ID line in the
// lines the page draws, siblings are the same size with one text scale (LA-EXP-DS06), and the label
// fits its box at its scale, so nothing is clipped. The sweep frames every domain, stage and folder
// group of every product in Lathe's own spec and the Tool Library's (data/ and examples/tool-library/data/),
// with the real camera, in two panes, at depths 1 to 3, and checks each drawn box's label as the
// canvas places it (its plate) lies whole inside the box.

const PANES = [[770, 640], [1200, 800]] as const;
const DEPTHS = [1, 2, 3] as const;

/** A layout of the graph: its map of a product, its camera for a focus and depth, what that camera draws, how tall each box's label is with its border, and each box's size (what siblings share). */
interface Layout {
  name: string;
  map: (index: SpecIndex, root: string) => PlacedMap;
  frame: (map: PlacedMap, focus: string, depth: number, w: number, h: number) => Viewport;
  drawn: (map: PlacedMap, v: Viewport, focus: string, w: number, h: number) => Drawn;
  height: (map: PlacedMap, id: string) => number;
  size: (map: PlacedMap, id: string) => number;
}
const LAYOUTS: Layout[] = [
  {
    name: 'Tree',
    map: graphMap,
    frame: (map, focus, depth, w, h) => frameOnMap(map as GraphMap, focus, depth, w, h),
    drawn: (map, v, focus, w, h) => drawnFor(map as GraphMap, v, w, h, [focus]),
    height: (map, id) => { const n = map.nodes.get(id)!; return n.text * (labelHeight(n.lines) + 2 * BORDER); },
    size: (map, id) => map.nodes.get(id)!.h,
  },
  {
    name: 'Nested',
    map: nestedMap,
    frame: (map, focus, _depth, w, h) => frameNested(map, focus, w, h),
    drawn: (map, v, focus, w, h) => drawnNested(map, v, w, h, [focus]),
    height: (map, id) => { const n = map.nodes.get(id)!; return n.text * labelHeight(n.lines); },
    size: (map, id) => map.nodes.get(id)!.w,
  },
  {
    // Voronoi (LA-EXP-DS08): laid out here, not in a worker (there are none in node); a cell's label fits when its box lies inside the cell's outline.
    name: 'Voronoi',
    map: (index, root) => readyVoronoiMap(index, root)!,
    frame: (map, focus, _depth, w, h) => frameNested(map, focus, w, h),
    drawn: (map, v, focus, w, h) => drawnNested(map, v, w, h, [focus]),
    height: (map, id) => { const n = (map as VoronoiMap).nodes.get(id)!; return holds(n.polygon, n.label) && n.text > 0 ? n.text * labelHeight(n.lines) : Infinity; },
    size: (map, id) => polygonArea((map as VoronoiMap).nodes.get(id)!.polygon),
  },
];

/** Every drawn box with no name, or whose label does not fit it, named with its layout, focus, depth, pane and size on screen. */
function nameless(workspace: SpecData): { problems: string[]; frames: number } {
  const whole = indexOf(workspace);
  const problems: string[] = [];
  let frames = 0;
  for (const product of whole.products) {
    const index = spaceIndex(whole, product.id);
    const foci = [
      ...index.workspace.records.filter((r) => r.kind === 'domain' && r.product === product.id).map((r) => r.id),
      ...[...treeOf(index).groups].filter(([, g]) => g.role === 'stage' || g.role === 'folder').map(([id]) => id),
    ];
    for (const layout of LAYOUTS) {
      const map = layout.map(index, product.id);
      const plates = new Map<string, string | null>();
      // Siblings are the same size, with one text scale (LA-EXP-DS06): equal boxes in the Tree and Nested maps, equal areas within 5% in the Voronoi map.
      for (const group of siblingGroups(map)) {
        const sizes = group.map((n) => layout.size(map, n.id));
        const spread = Math.max(...sizes) / Math.min(...sizes) - 1;
        if (spread > (layout.name === 'Voronoi' ? 0.1 : 0)) problems.push(`${layout.name} ${product.id}: ${group[0].parent}'s children differ in size by ${(spread * 100).toFixed(1)}%`);
        if (new Set(group.map((n) => n.text)).size !== 1) problems.push(`${layout.name} ${product.id}: ${group[0].parent}'s children have ${new Set(group.map((n) => n.text)).size} text scales`);
      }
      for (const focus of foci) {
        if (!map.nodes.has(focus)) continue;
        for (const [w, h] of PANES) for (const depth of DEPTHS) {
          frames++;
          const v = layout.frame(map, focus, depth, w, h);
          for (const b of layout.drawn(map, v, focus, w, h).boxes) {
            const n = map.nodes.get(b.id)!;
            const { title, meta } = labelLines(index, b.id);
            const { lines } = n;
            const height = layout.height(map, b.id);
            const at = `${layout.name} ${focus} depth ${depth} in ${w}x${h}: ${b.id} (${Math.round(n.w * v.zoom)} x ${Math.round(n.h * v.zoom)} px)`;
            if (lines.title.join('') !== title || lines.meta.join('') !== meta || title === '') problems.push(`${at} does not show its name`);
            else if (n.text <= 0 || height > n.h + 0.5) problems.push(`${at}: its label does not fit it`);
            else {
              if (!plates.has(b.id)) plates.set(b.id, plateOutside(plateOf(index, b.id, sourceOf(map, b.id))));
              const outside = plates.get(b.id);
              if (outside) problems.push(`${at}: as drawn, ${outside}`);
            }
          }
        }
      }
    }
  }
  return { problems, frames };
}

describe('every drawn box shows its name', () => {
  let workspace: SpecData;
  beforeAll(async () => { workspace = await repoData(); }, 60_000);

  it('LA-PAT-APP-UX-R12-T01 In the Tree, Nested and Voronoi layouts, at every domain, stage and folder of every product, at depths 1 to 3 in two panes, siblings share one size and text scale and every drawn box shows its name', () => {
    expect(indexOf(workspace).products.map((r) => r.id).sort()).toEqual(['LA', 'TL']);
    const { problems, frames } = nameless(workspace);
    expect(frames).toBeGreaterThan(100);
    expect(problems.length, problems.slice(0, 40).join('\n')).toBe(0);
  }, 120_000);

  it.each(['LA-EXP-DS06-T12', 'LA-EXP-DS09-T13'])("%s A framed box's header reads at about the same size on screen at every depth, and the camera can frame the deepest leaf", () => {
    const whole = indexOf(workspace);
    for (const product of ['LA', 'TL']) {
      const index = spaceIndex(whole, product);
      for (const layout of LAYOUTS) {
        const map = layout.map(index, product);
        // The title's size on screen, framed at depth 1 in a 770 by 640 pane. In the Tree, of each parent whose text its column sets (not one
        // whose siblings' labels need less, in boxes much wider than tall) and whose frame its columns' width sets (not a box taller than
        // its columns are wide, which reads smaller), the product aside (its frame keeps no parent strip): a Tree frame takes in its
        // children's column too.
        const sizes = new Map<number, number[]>();
        for (const n of map.nodes.values()) {
          const v = layout.frame(map, n.id, 1, 770, 640);
          expect(v.zoom, `${layout.name} ${n.id}`).toBeLessThanOrEqual(MAX_ZOOM);
          expect(v.zoom, `${layout.name} ${n.id}`).toBeGreaterThanOrEqual(MIN_ZOOM);
          if (layout.name === 'Tree' && (n.parent === null || n.children.length === 0 || n.text < treeText(n.w) * (1 - 1e-9) || v.zoom >= (640 - 2 * FRAME_PADDING) / n.h * (1 - 1e-9))) continue;
          (sizes.get(n.level) ?? sizes.set(n.level, []).get(n.level)!).push(n.text * v.zoom * TITLE_FONT);
        }
        const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];
        const medians = [...sizes.values()].map(median);
        // Nested: exactly the same at every depth; Tree (whose columns narrow with how many children share them) within a
        // tenth or so; Voronoi (whose frame fits a cell's box) within a few pixels.
        const [lo, hi] = [Math.min(...medians), Math.max(...medians)];
        if (layout.name === 'Nested') expect(hi - lo, `${product} ${layout.name}: ${medians.map((m) => m.toFixed(1)).join(', ')}`).toBeLessThan(1e-6);
        else expect(hi / lo, `${product} ${layout.name}: ${medians.map((m) => m.toFixed(1)).join(', ')}`).toBeLessThan(layout.name === 'Tree' ? 1.2 : 1.4);
        // Readable: at least 9 pixels, at most 20, in every layout and at every depth.
        for (const m of medians) { expect(m).toBeGreaterThanOrEqual(9); expect(m).toBeLessThanOrEqual(20); }
        // The camera frames even the deepest, smallest leaf without reaching its zoom limit.
        const smallest = [...map.nodes.values()].reduce((a, b) => (Math.min(b.w, b.h) < Math.min(a.w, a.h) ? b : a));
        expect(layout.frame(map, smallest.id, 1, 770, 640).zoom, `${layout.name} ${smallest.id}`).toBeLessThan(MAX_ZOOM);
      }
    }
  }, 120_000);
});
