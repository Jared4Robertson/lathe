import { recordIndexOf } from '../read-view';
// @vitest-environment node
import { beforeAll, describe, expect, it } from 'vitest';
import { repoData } from '../fixtures/repo';
import { CHILD_MIN_H, CHILD_MIN_W, childZoom, drawnFor, drawnNested, FRAME_PADDING, frameGround, frameNested, frameOnMap, maxZoomFor, MIN_ZOOM, type Drawn, type Viewport } from '../../src/graph/camera';
import { treeText, type GraphMap, type PlacedMap } from '../../src/graph/map';
import { BORDER, labelHeight, labelLines, mapLabel, TITLE_FONT } from '../../src/graph/text';
import { treeOf } from '../../src/graph/tree';
import type { RecordIndex } from '../../src/exploring/record-summaries/record-index';
import type { ServedData } from '../read-view';
import { siblingGroups } from './workspace';
import { plateOf, type Plate, type PlateSource } from '../../src/graph/plate';
import { isBlock, labelPlate, READABLE_PX } from '../../src/graph/paint';
import type { GroundNode } from '../../src/graph/ground';
import type { NestedNode } from '../../src/graph/nested';
import { graphMap, groundMap, nestedMap } from './maps';

/** The scene's check (the canvas draws a box's plate, plate.ts): every line of its label lies whole inside the box. */
function plateOutside(p: Plate): string | null {
  const eps = 1e-6 * Math.max(1, p.w);
  for (const l of p.lines) {
    const corners = [[l.x, l.top], [l.x + l.width, l.top], [l.x, l.top + l.height], [l.x + l.width, l.top + l.height]] as const;
    if (corners.some(([x, y]) => x < p.x - eps || x > p.x + p.w + eps || y < p.y - eps || y > p.y + p.h + eps)) return `"${l.text}" lies outside its box`;
  }
  return null;
}
const sourceOf = (map: PlacedMap, id: string): PlateSource => {
  const n = map.nodes.get(id)!;
  return map.view === 'tree' ? { view: 'tree', node: n } : { view: 'nested', node: n as NestedNode };
};

// Every drawn box shows its name (LA-PAT-APP-UX-R12): in every layout of the graph, at every focus
// and depth, each box the camera draws carries its label, its title and its eyebrow in the
// lines the page draws, siblings are the same size with one text scale (LA-EXP-DS06), and the label
// fits its box at its scale, so nothing is clipped. The sweep frames every domain, stage and folder
// group of every product in Lathe's own spec and the Tool Library's (data/ and examples/tool-library/data/),
// with the real camera, in two panes, at depths 1 to 3, and checks each drawn box's label as the
// canvas places it (its plate) lies whole inside the box.

const PANES = [[770, 640], [1200, 800]] as const;
const DEPTHS = [1, 2, 3] as const;

/** A layout of the graph: its map of a product, its camera for a focus, what that camera draws at a depth, how tall each box's label is with its border, and each box's size (what siblings share). */
interface Layout {
  name: string;
  map: (index: RecordIndex, root: string) => PlacedMap;
  frame: (map: PlacedMap, focus: string, w: number, h: number) => Viewport;
  drawn: (map: PlacedMap, v: Viewport, focus: string, depth: number, w: number, h: number) => Drawn;
  height: (map: PlacedMap, id: string) => number;
  size: (map: PlacedMap, id: string) => number;
}
const LAYOUTS: Layout[] = [
  {
    name: 'Tree',
    map: graphMap,
    frame: (map, focus, w, h) => frameOnMap(map as GraphMap, focus, w, h, maxZoomFor(map)),
    drawn: (map, v, focus, depth, w, h) => drawnFor(map as GraphMap, v, w, h, [focus], map.nodes.get(focus)!.level + depth),
    height: (map, id) => { const n = map.nodes.get(id)!; return n.text * (labelHeight(n.lines) + 2 * BORDER); },
    size: (map, id) => map.nodes.get(id)!.h },
  {
    name: 'Nested',
    map: nestedMap,
    frame: (map, focus, w, h) => frameNested(map, focus, w, h, maxZoomFor(map)),
    drawn: (map, v, focus, _depth, w, h) => drawnNested(map, v, w, h, [focus]),
    height: (map, id) => { const n = map.nodes.get(id)!; return n.text * labelHeight(n.lines); },
    size: (map, id) => map.nodes.get(id)!.w },
];

/** Every drawn box with no name, or whose label does not fit it, named with its layout, focus, depth, pane and size on screen. */
function nameless(spaces: Map<string, RecordIndex>): { problems: string[]; frames: number } {
  const problems: string[] = [];
  let frames = 0;
  for (const [id, index] of spaces) {
    const product = { id };
    const foci = [
      ...index.domains.map((r) => r.id),
      ...[...treeOf(index).groups].filter(([, g]) => g.role === 'stage' || g.role === 'folder').map(([id]) => id),
    ];
    for (const layout of LAYOUTS) {
      const map = layout.map(index, product.id);
      const plates = new Map<string, string | null>();
      // Siblings are the same size, with one text scale (LA-EXP-DS06): equal boxes in the Tree and Nested maps.
      for (const group of siblingGroups(map)) {
        const sizes = group.map((n) => layout.size(map, n.id));
        const spread = Math.max(...sizes) / Math.min(...sizes) - 1;
        if (spread > 0) problems.push(`${layout.name} ${product.id}: ${group[0].parent}'s children differ in size by ${(spread * 100).toFixed(1)}%`);
        // In the Nested map the leaves among them share one scale and the parents another (LA-EXP-DS07).
        for (const kin of layout.name === 'Nested' ? [group.filter((n) => n.children.length === 0), group.filter((n) => n.children.length > 0)] : [group]) {
          if (new Set(kin.map((n) => n.text)).size > 1) problems.push(`${layout.name} ${product.id}: ${group[0].parent}'s children have ${new Set(kin.map((n) => n.text)).size} text scales`);
        }
      }
      for (const focus of foci) {
        if (!map.nodes.has(focus)) continue;
        for (const [w, h] of PANES) for (const depth of DEPTHS) {
          frames++;
          const v = layout.frame(map, focus, w, h);
          for (const b of layout.drawn(map, v, focus, depth, w, h).boxes) {
            const n = map.nodes.get(b.id)!;
            // Its name as its layout gives it: in Nested, its kind word left out under a folder of its kind (text.ts mapLabel).
            const { title, meta } = layout.name === 'Nested' ? mapLabel(index, b.id, n.parent) : labelLines(index, b.id);
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
  // One index of the repo's data for every test, so each product's maps are laid out once (they are kept per index)
  // and the tests only frame and read them.
  let spaces: Map<string, RecordIndex>;
  beforeAll(async () => {
    const data: ServedData = await repoData();
    spaces = new Map(['LA', 'TL'].map((product) => [product, recordIndexOf(data, product)]));
    for (const [product, index] of spaces) for (const layout of LAYOUTS) layout.map(index, product);
  }, 60_000);

  it('LA-PAT-APP-UX-R12-T01 In the Tree and Nested layouts, at every domain, stage and folder of every product, at depths 1 to 3 in two panes, siblings share one size and text scale and every drawn box shows its name', () => {
    expect([...spaces.keys()].sort()).toEqual(['LA', 'TL']);
    const { problems, frames } = nameless(spaces);
    expect(frames).toBeGreaterThan(100);
    expect(problems.length, problems.slice(0, 40).join('\n')).toBe(0);
  }, 120_000);

  it("LA-EXP-DS06-T12 LA-EXP-DS09-T13 A framed box's header reads at about the same size on screen at every depth, and the camera can frame the deepest leaf", () => {
    for (const product of ['LA', 'TL']) {
      const index = spaces.get(product)!;
      for (const layout of LAYOUTS) {
        const map = layout.map(index, product);
        // The title's size on screen, framed in a 770 by 640 pane. In the Tree, of each box whose text its column sets (not one
        // whose siblings' labels need less, in boxes much wider than tall) and whose frame its width sets (not a box whose height
        // caps the zoom, which reads smaller, nor one whose children set it, LA-V93-R77, which reads larger).
        const sizes = new Map<number, number[]>();
        const leaves: number[] = [];
        for (const n of map.nodes.values()) {
          const v = layout.frame(map, n.id, 770, 640);
          expect(v.zoom, `${layout.name} ${n.id}`).toBeLessThanOrEqual(maxZoomFor(map));
          expect(v.zoom, `${layout.name} ${n.id}`).toBeGreaterThanOrEqual(MIN_ZOOM);
          if (layout.name === 'Tree' && (n.text < treeText(n.w) * (1 - 1e-9) || v.zoom >= (640 - 2 * FRAME_PADDING) / n.h * (1 - 1e-9) || v.zoom <= childZoom(map, n.id) * (1 + 1e-9))) continue;
          // A framed Nested leaf has no header: its label, centered, is at most a tenth of its side on screen (LA-EXP-DS07).
          if (layout.name === 'Nested' && n.children.length === 0) {
            const px = n.text * v.zoom * TITLE_FONT;
            expect(px, `${layout.name} ${n.id}`).toBeLessThanOrEqual(n.w * v.zoom / 10 * (1 + 1e-9));
            leaves.push(px);
            continue;
          }
          (sizes.get(n.level) ?? sizes.set(n.level, []).get(n.level)!).push(n.text * v.zoom * TITLE_FONT);
        }
        // The middle size, or the mean of the two middle ones when there is an even number (not the larger of them).
        const median = (xs: number[]) => {
          const sorted = [...xs].sort((a, b) => a - b);
          const mid = Math.floor(sorted.length / 2);
          return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
        };
        const medians = [...sizes.values()].map(median);
        // Within a half: the Tree, whose focus shares the width with its children's column (wider the fewer they are) and
        // a leaf fills FOCUS_SHARE; Nested, whose headers a long title fits to its band.
        const [lo, hi] = [Math.min(...medians), Math.max(...medians)];
        expect(hi / lo, `${product} ${layout.name}: ${medians.map((m) => m.toFixed(1)).join(', ')}`).toBeLessThan(1.5);
        // Readable: at least 9 pixels; at most 36, a focus filling FOCUS_SHARE of the pane reading large but not huge.
        for (const m of medians) { expect(m).toBeGreaterThanOrEqual(9); expect(m).toBeLessThanOrEqual(36 * (1 + 1e-9)); }
        if (leaves.length > 0) expect(median(leaves), `${product} ${layout.name} leaves`).toBeGreaterThanOrEqual(9);
        // The camera frames even the deepest, smallest leaf without reaching its zoom limit.
        const smallest = [...map.nodes.values()].reduce((a, b) => (Math.min(b.w, b.h) < Math.min(a.w, a.h) ? b : a));
        expect(layout.frame(map, smallest.id, 770, 640).zoom, `${layout.name} ${smallest.id}`).toBeLessThan(maxZoomFor(map));
      }
    }
  }, 120_000);

  it('LA-EXP-DS12-T05 On the Map, a framed group\'s records read at the readable size or more, or are plain blocks, and a group of a dozen records or fewer reads', () => {
    const unreadable: string[] = [];
    let small = 0;
    for (const [product, index] of spaces) {
      const ground = groundMap(index);
      for (const n of ground.nodes.values()) {
        if (n.role === 'record' && n.children.length === 0) continue;
        for (const [w, h] of PANES) {
          const v = frameGround(ground, n.id, w, h, maxZoomFor(ground));
          const leaves: GroundNode[] = [];
          const walk = (id: string) => { const c = ground.nodes.get(id)!; if (c.role === 'record' && c.children.length === 0) leaves.push(c); else c.children.forEach(walk); };
          walk(n.id);
          for (const leaf of leaves) {
            const p = plateOf(index, leaf.id, { view: 'map', node: leaf });
            const px = labelPlate(p, v.zoom).text * TITLE_FONT * v.zoom;
            if (!isBlock(p, v.zoom) && px < READABLE_PX) unreadable.push(`${product} ${n.id} in ${w}x${h}: ${leaf.id} at ${px.toFixed(1)} px`);
          }
          // A group of a dozen records or fewer, framed in the smaller pane (as beside an open card), draws every one of them with its title.
          if (w === 770 && leaves.length > 0 && leaves.length <= 12 && n.role !== 'record') {
            small++;
            for (const leaf of leaves) if (isBlock(plateOf(index, leaf.id, { view: 'map', node: leaf }), v.zoom)) unreadable.push(`${product} ${n.id} (${leaves.length} records) in ${w}x${h}: ${leaf.id} drawn as a block at zoom ${v.zoom.toFixed(2)}`);
          }
        }
      }
    }
    expect(small).toBeGreaterThan(10);
    expect(unreadable.length, unreadable.slice(0, 20).join('\n')).toBe(0);
  }, 120_000);

  it('LA-EXP-DS09-T16 LA-V93-R77-T03 In the Tree, Nested and Map layouts, every box of every product, framed as the focus in two panes, is whole on screen, or its children read and the first of them is whole', () => {
    const cut: string[] = [];
    let frames = 0;
    let shown = 0;
    const check = (name: string, map: PlacedMap, n: { id: string; x: number; y: number; w: number; h: number; children: readonly string[] }, v: Viewport, w: number, h: number) => {
      frames++;
      const box = (b: { x: number; y: number; w: number; h: number }) => [b.x * v.zoom + v.x, b.y * v.zoom + v.y, (b.x + b.w) * v.zoom + v.x, (b.y + b.h) * v.zoom + v.y];
      const inside = ([x0, y0, x1, y1]: number[]) => x0 >= -0.5 && y0 >= -0.5 && x1 <= w + 0.5 && y1 <= h + 0.5;
      // Every child reads (LA-V93-R77): at least CHILD_MIN_W by CHILD_MIN_H on screen, unless the camera's zoom limit stops it.
      for (const c of n.children) {
        const child = map.nodes.get(c)!;
        if ((child.w * v.zoom < CHILD_MIN_W - 1e-6 || child.h * v.zoom < CHILD_MIN_H - 1e-6) && v.zoom < maxZoomFor(map) * (1 - 1e-9)) cut.push(`${name} ${n.id} in ${w}x${h}: its child ${c} is ${Math.round(child.w * v.zoom)} x ${Math.round(child.h * v.zoom)} px`);
      }
      if (inside(box(n))) return;
      // Cut only where its children could not read with it whole: then zoomed in no further than they need, the first of
      // them on screen from its top left corner, whole unless it is bigger than the pane (a Map's district or area).
      shown++;
      const first = n.children.length > 0 ? map.nodes.get(n.children[0])! : null;
      const [x0, y0, x1, y1] = first ? box(first) : [];
      const onScreen = first && x0 >= -0.5 && y0 >= -0.5 && (x1 <= w + 0.5 || x1 - x0 > w - 2 * FRAME_PADDING) && (y1 <= h + 0.5 || y1 - y0 > h - 2 * FRAME_PADDING);
      if (!onScreen || v.zoom > childZoom(map, n.id) * (1 + 1e-9)) cut.push(`${name} ${n.id} in ${w}x${h}: ${box(n).map(Math.round).join(', ')}, its first child ${first ? box(first).map(Math.round).join(', ') : 'none'}`);
    };
    for (const [product, index] of spaces) {
      for (const layout of LAYOUTS) {
        const map = layout.map(index, product);
        for (const n of map.nodes.values()) for (const [w, h] of PANES) check(layout.name, map, n, layout.frame(map, n.id, w, h), w, h);
      }
      const ground = groundMap(index);
      for (const n of ground.nodes.values()) for (const [w, h] of PANES) check('Map', ground, n, frameGround(ground, n.id, w, h, maxZoomFor(ground)), w, h);
    }
    expect(frames).toBeGreaterThan(1000);
    expect(shown).toBeGreaterThan(0);
    expect(cut.length, cut.slice(0, 20).join('\n')).toBe(0);
  }, 120_000);
});
