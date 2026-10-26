// @vitest-environment node
import path from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { loadWorkspace } from '../../../lathe/src/index';
import type { Workspace } from '../../../lathe/src/types';
import { drawnFor, drawnNested, frameNested, frameOnMap, type Drawn, type Viewport } from '../../src/graph/camera';
import { graphMap, type GraphMap, type PlacedMap } from '../../src/graph/map';
import { nestedMap, type NestedMap } from '../../src/graph/nested';
import { holds, readyVoronoiMap, type VoronoiMap } from '../../src/graph/voronoi';
import { isCentered, labelFor, labelHeight, labelLines, type WrappedLabel } from '../../src/graph/text';
import { treeOf } from '../../src/graph/tree';
import { indexWorkspace, spaceIndex, type SpecIndex } from '../../src/specs/data';
import { heightLevels } from './workspace';

// Every drawn box shows its name (LA-PAT-APP-UX-R12): in every layout of the graph, at every focus
// and depth, each box the camera draws carries its label, its title and its kind and ID line in the
// lines the page draws, every box at one Tree or Nested level has one text scale, and the label fits
// its box at its scale, so nothing is clipped. The sweep
// frames every domain, stage and folder group of every product in Lathe's own spec and the Tool
// Library's (both under the repo's specs/), with the real camera, in two panes, at depths 1 to 3.

const PANES = [[770, 640], [1200, 800]] as const;
const DEPTHS = [1, 2, 3] as const;

/** A layout of the graph: its map of a product, its camera for a focus and depth, what that camera draws, and the label each box draws with how tall it is. */
interface Layout {
  name: string;
  map: (index: SpecIndex, root: string) => PlacedMap;
  frame: (map: PlacedMap, focus: string, depth: number, w: number, h: number) => Viewport;
  drawn: (map: PlacedMap, v: Viewport, focus: string, w: number, h: number) => Drawn;
  label: (index: SpecIndex, map: PlacedMap, id: string) => { lines: WrappedLabel; height: number };
}
const LAYOUTS: Layout[] = [
  {
    name: 'Tree',
    map: graphMap,
    frame: (map, focus, depth, w, h) => frameOnMap(map as GraphMap, focus, depth, w, h),
    drawn: (map, v, focus, w, h) => drawnFor(map as GraphMap, v, w, h, [focus]),
    label: (index, map, id) => {
      const n = map.nodes.get(id)!;
      const lines = labelFor(index, id, isCentered(n.text, n.children.length > 0));
      return { lines, height: n.text * labelHeight(lines) };
    },
  },
  {
    name: 'Nested',
    map: nestedMap,
    frame: (map, focus, _depth, w, h) => frameNested(map, focus, w, h),
    drawn: (map, v, focus, w, h) => drawnNested(map, v, w, h, [focus]),
    label: (_index, map, id) => {
      const n = (map as NestedMap).nodes.get(id)!;
      return { lines: n.lines, height: n.text * labelHeight(n.lines) };
    },
  },
  {
    // Voronoi (LA-EXP-DR64): laid out here, not in a worker (there are none in node); a cell's label fits when its box lies inside the cell's outline.
    name: 'Voronoi',
    map: (index, root) => readyVoronoiMap(index, root)!,
    frame: (map, focus, _depth, w, h) => frameNested(map, focus, w, h),
    drawn: (map, v, focus, w, h) => drawnNested(map, v, w, h, [focus]),
    label: (_index, map, id) => {
      const n = (map as VoronoiMap).nodes.get(id)!;
      return { lines: n.lines, height: holds(n.polygon, n.label) && n.text > 0 ? n.text * labelHeight(n.lines) : Infinity };
    },
  },
];

/** Every drawn box with no name, or whose label does not fit it, named with its layout, focus, depth, pane and size on screen. */
function nameless(workspace: Workspace): { problems: string[]; frames: number } {
  const whole = indexWorkspace(workspace);
  const problems: string[] = [];
  let frames = 0;
  for (const product of workspace.records.filter((r) => r.kind === 'product')) {
    const index = spaceIndex(whole, product.id);
    const foci = [
      ...index.workspace.records.filter((r) => r.kind === 'domain' && r.product === product.id).map((r) => r.id),
      ...[...treeOf(index).groups].filter(([, g]) => g.role === 'stage' || g.role === 'folder').map(([id]) => id),
    ];
    for (const layout of LAYOUTS) {
      const map = layout.map(index, product.id);
      // One text scale per level (LA-EXP-DR58, LA-EXP-DR62): every box at a level has the same, a Tree level by depth, a Nested level by height from
      // the leaves. A Voronoi cell's text is its own size's (LA-EXP-DR64), so Voronoi has no levels to check.
      if (layout.name !== 'Voronoi') (layout.name === 'Tree' ? map.byLevel : heightLevels(map.nodes)).forEach((boxes, l) => {
        const scales = [...new Set(boxes.map((n) => n.text))];
        if (scales.length !== 1) problems.push(`${layout.name} ${product.id} level ${l} has ${scales.length} text scales: ${scales.slice(0, 5).join(', ')}`);
      });
      for (const focus of foci) {
        if (!map.nodes.has(focus)) continue;
        for (const [w, h] of PANES) for (const depth of DEPTHS) {
          frames++;
          const v = layout.frame(map, focus, depth, w, h);
          for (const b of layout.drawn(map, v, focus, w, h).boxes) {
            const n = map.nodes.get(b.id)!;
            const { title, meta } = labelLines(index, b.id);
            const { lines, height } = layout.label(index, map, b.id);
            const at = `${layout.name} ${focus} depth ${depth} in ${w}x${h}: ${b.id} (${Math.round(n.w * v.zoom)} x ${Math.round(n.h * v.zoom)} px)`;
            if (lines.title.join('') !== title || lines.meta.join('') !== meta || title === '') problems.push(`${at} does not show its name`);
            else if (n.text <= 0 || height > n.h + 0.5) problems.push(`${at}: its label does not fit it`);
          }
        }
      }
    }
  }
  return { problems, frames };
}

describe('every drawn box shows its name', () => {
  let workspace: Workspace;
  beforeAll(async () => { workspace = await loadWorkspace(path.resolve(import.meta.dirname, '../../..')); }, 60_000);

  it('LA-PLT-T135 In the Tree, Nested and Voronoi layouts, at every domain, stage and folder of every product, at depths 1 to 3 in two panes, every Tree and Nested level has one text scale and every drawn box shows its name', () => {
    expect(workspace.records.filter((r) => r.kind === 'product').map((r) => r.id).sort()).toEqual(['LA', 'TL']);
    const { problems, frames } = nameless(workspace);
    expect(frames).toBeGreaterThan(100);
    expect(problems.length, problems.slice(0, 40).join('\n')).toBe(0);
  }, 120_000);
});
