import { describe, expect, it } from 'vitest';
import { contentScale, NODE_HEIGHT, NODE_WIDTH } from '../../src/graph/layout';
import { graphMap, layoutTree, LEVEL_ASPECT, linkEnds, MAX_LEVEL_STEP, MAX_ROOT_STEP, parentLine, typicalHeight, type GraphMap } from '../../src/graph/map';
import { drawnFor, frameOnMap, MAX_DRAWN, MIN_DRAWN, viewRect } from '../../src/graph/camera';
import { hasMarks, labelLines, labelShown, labelWidth, metaWidth, MIN_LABEL_PX, textScaleOf, TITLE_FONT, titleWidth } from '../../src/graph/text';
import { indexWorkspace, type SpecIndex } from '../../src/specs/data';
import { groupedWorkspace, manyOfOneKindWorkspace, testIndex } from './workspace';

// The graph is one fixed map of its product's tree (LA-EXP-DR57): each parent exactly as tall as its
// children stacked, each child right beside it, one width per level (LA-EXP-DR58); the camera
// draws only what is in view and big enough to see (LA-EXP-DR60).

const indexes = (): SpecIndex[] => [testIndex(), indexWorkspace(groupedWorkspace()), indexWorkspace(manyOfOneKindWorkspace())];
const maps = (): GraphMap[] => indexes().map((index) => graphMap(index, 'P'));

/** A synthetic tree: `n` roots, each with `k` children, each with `k` leaves. */
function wide(n: number, k: number): GraphMap {
  const kids = (id: string): string[] => {
    const depth = id.split('.').length;
    return depth >= 3 ? [] : Array.from({ length: k }, (_, i) => `${id}.${i}`);
  };
  return layoutTree(Array.from({ length: n }, (_, i) => `r${i}`), kids);
}

describe('the one map', () => {
  it('LA-EXP-T165 A parent is as tall as its children stacked, starting at its top, each child beside it, nothing overlapping', () => {
    for (const map of maps()) {
      for (const node of map.nodes.values()) {
        if (node.children.length === 0) { expect(node.h).toBe(NODE_HEIGHT); continue; }
        const kids = node.children.map((c) => map.nodes.get(c)!);
        // The stack starts at the parent's top and ends at its bottom, the gaps between included.
        expect(kids[0].y).toBe(node.y);
        expect(kids.at(-1)!.y + kids.at(-1)!.h).toBe(node.y + node.h);
        for (let i = 1; i < kids.length; i++) expect(kids[i].y).toBe(kids[i - 1].y + kids[i - 1].h + map.levels[node.level + 1].rowGap);
        // Each child right beside its parent, in the next level.
        for (const k of kids) {
          expect(k.level).toBe(node.level + 1);
          expect(k.x).toBeGreaterThan(node.x + node.w);
        }
      }
      // Nothing overlaps.
      for (const level of map.byLevel) for (let i = 1; i < level.length; i++) expect(level[i].y).toBeGreaterThanOrEqual(level[i - 1].y + level[i - 1].h);
    }
    // The tree is the nav's: a domain spans its stages, the product its domain.
    const map = graphMap(testIndex(), 'P');
    expect(map.nodes.get('P-D')!.children).toEqual(['P-D/define', 'P-D/design', 'P-D/question']);
    expect(map.roots).toEqual(['P']);
  });
});

describe('levels and content', () => {
  it("LA-EXP-T166 grows by the smaller of its width and height over a leaf's, never below 1", () => {
    expect(contentScale(NODE_WIDTH, NODE_HEIGHT)).toBe(1);
    expect(contentScale(NODE_WIDTH, NODE_HEIGHT / 2)).toBe(1);
    // Limited by the shorter way.
    expect(contentScale(NODE_WIDTH * 1.5, NODE_HEIGHT * 10)).toBe(1.5);
    expect(contentScale(NODE_WIDTH * 2, NODE_HEIGHT * 1.25)).toBe(1.25);
    // A tall node in a leaf-wide level does not grow.
    expect(contentScale(NODE_WIDTH, NODE_HEIGHT * 10)).toBe(1);
  });

  it("LA-EXP-T166 Every node in a level has its width: in proportion to the level's typical height within the caps, or wider for its widest label", () => {
    for (const map of [...maps(), wide(3, 8), wide(1, 30)]) {
      const deepest = map.levels.length - 1;
      for (let l = 0; l <= deepest; l++) {
        const level = map.levels[l];
        for (const n of map.byLevel[l]) expect(n.w).toBe(level.width);
        const below = l < deepest ? map.levels[l + 1].proportional : NODE_WIDTH;
        // The proportional width: never narrower than the level below's, nor more than the step allows.
        expect(level.proportional).toBeGreaterThanOrEqual(below);
        expect(level.proportional).toBeLessThanOrEqual((l === 0 ? MAX_ROOT_STEP : MAX_LEVEL_STEP) * below + 2);
        // In proportion to the level's typical height where no cap applies.
        const wanted = LEVEL_ASPECT * typicalHeight(map.byLevel[l].map((n) => n.h));
        if (wanted > below && wanted < (l === 0 ? MAX_ROOT_STEP : MAX_LEVEL_STEP) * below) expect(Math.abs(level.proportional - wanted)).toBeLessThanOrEqual(2);
        // The width is the proportional width or, when wider, the widest label at its box's text scale.
        expect(level.width).toBeGreaterThanOrEqual(level.proportional);
      }
    }
    // A synthetic tree's labels are a leaf wide: a level of leaves keeps a leaf's width, and a level is as wide as its tallest box's label.
    for (const map of [wide(3, 8), wide(1, 30)]) {
      map.levels.forEach((level, l) => {
        const widest = Math.max(...map.byLevel[l].map((n) => n.text * NODE_WIDTH));
        expect(level.width).toBe(Math.max(level.proportional, 2 * Math.ceil(widest / 2)));
      });
      expect(map.levels.at(-1)!.width).toBe(NODE_WIDTH);
    }
    // The typical height is the median by height: a few tall nodes outweigh many short ones.
    expect(typicalHeight([56, 56, 56, 56, 1000, 1000])).toBe(1000);
    expect(typicalHeight([56, 56, 56])).toBe(56);
  });

  it('LA-EXP-T182 Every level is wide enough for each label in it on one line at its fixed text scale, so no title is cut off', () => {
    for (const index of indexes()) {
      const map = graphMap(index, 'P');
      for (const n of map.nodes.values()) {
        // The text scale is the box's height over a leaf's, fixed by the map.
        expect(n.text).toBe(Math.max(1, n.h / NODE_HEIGHT));
        const lines = labelLines(index, n.id);
        expect(n.w, n.id).toBeGreaterThanOrEqual(n.text * labelWidth(lines, { hexagon: index.byId.get(n.id)?.kind === 'domain', marked: hasMarks(index, n.id) }) - 1);
      }
    }
    // The estimate errs wide: a title is at least its characters at 0.45 em, and a kind and ID line 0.6 em a character.
    expect(titleWidth("Capabilities")).toBeGreaterThan(12 * 0.45 * TITLE_FONT);
    expect(metaWidth('Use case · LA-EXP-UC03')).toBeGreaterThanOrEqual(22 * 0.6 * 10.5);
    // A wider title needs a wider box; the badge's room and a hexagon's chamfer add to it.
    const lines = { title: 'Walk the model as a graph', meta: 'Use case · LA-EXP-UC03' };
    expect(labelWidth({ ...lines, title: lines.title + ' and more' })).toBeGreaterThan(labelWidth(lines));
    expect(labelWidth(lines, { marked: true })).toBeGreaterThanOrEqual(labelWidth(lines));
    expect(labelWidth(lines, { hexagon: true })).toBeGreaterThan(labelWidth(lines));
  });

  it("LA-EXP-T167 A parent line runs level from the parent's right edge to the child's left edge, at the child's middle", () => {
    const map = graphMap(testIndex(), 'P');
    for (const n of map.nodes.values()) {
      if (n.parent === null) continue;
      const p = map.nodes.get(n.parent)!;
      const [a, b] = parentLine(p, n);
      expect(a).toEqual({ x: p.x + p.w, y: n.y + n.h / 2 });
      expect(b).toEqual({ x: n.x, y: n.y + n.h / 2 });
    }
    // A cross-link leaves each box on the side facing the other, at its middle.
    const s = { x: 0, y: 0, w: 100, h: 40 };
    expect(linkEnds(s, { x: 300, y: 100, w: 100, h: 40 })).toEqual([{ x: 100, y: 20 }, { x: 300, y: 120 }]);
    expect(linkEnds(s, { x: -300, y: 100, w: 100, h: 40 })).toEqual([{ x: 0, y: 20 }, { x: -200, y: 120 }]);
  });
});

describe('the level of detail', () => {
  const map = graphMap(testIndex(), 'P');

  it('LA-EXP-T170 Only boxes in view and big enough are drawn, labeled when their text reads, with bars for children too small, within a budget', () => {
    // Framed on the domain: the domain and its stages are drawn; nothing outside the view.
    const view = frameOnMap(map, 'P-D', 1, 1000, 800);
    const d = drawnFor(map, view, 1000, 800);
    const drawn = new Set(d.boxes.map((b) => b.id));
    expect(drawn).toContain('P-D');
    expect(drawn).toContain('P-D/define');
    const rect = viewRect(view, 1000, 800);
    for (const b of d.boxes) {
      const n = map.nodes.get(b.id)!;
      expect(n.x + n.w >= rect.x0 && n.x <= rect.x1 && n.y + n.h >= rect.y0 && n.y <= rect.y1, b.id).toBe(true);
      expect(n.h * view.zoom).toBeGreaterThanOrEqual(MIN_DRAWN);
      // Labeled exactly when its title is MIN_LABEL_PX or more on screen; a drawn box carries no text size of its own.
      expect(b).toEqual({ id: b.id, label: labelShown(n.text, view.zoom) });
      if (n.h * view.zoom >= 40) expect(b.label, b.id).toBe(true);
    }
    // Zoomed far out, the leaves are too small: they are not drawn, and each run of them is one bar in its parent's next level.
    const far = { x: 0, y: 0, zoom: 0.02 };
    const small = drawnFor(map, far, 1000, 800);
    expect(small.boxes.some((b) => map.nodes.get(b.id)!.h * far.zoom < MIN_DRAWN)).toBe(false);
    expect(small.bars.length).toBeGreaterThan(0);
    for (const bar of small.bars) {
      const p = map.nodes.get(bar.parent)!;
      expect(bar.level).toBe(p.level + 1);
      expect(bar.y).toBeGreaterThanOrEqual(p.y);
      expect(bar.y + bar.h).toBeLessThanOrEqual(p.y + p.h);
    }
    // Some boxes are drawn whatever their size: the focus, the linked records.
    expect(drawnFor(map, far, 1000, 800, ['P-D-UC01-R01']).boxes.map((b) => b.id)).toContain('P-D-UC01-R01');
    // The same view always draws the same.
    expect(drawnFor(map, view, 1000, 800)).toEqual(d);
  });

  it('LA-EXP-T176 A label keeps its size in the map: the camera only shows or hides it, by its size on screen', () => {
    // The text scale is the box's height over a leaf's: a leaf's is 1, a box ten leaves tall has ten.
    expect(textScaleOf(NODE_HEIGHT)).toBe(1);
    expect(textScaleOf(NODE_HEIGHT * 10)).toBe(10);
    // Shown exactly when the title is MIN_LABEL_PX or more on screen: a leaf at its own size, not at a fifth of it.
    expect(MIN_LABEL_PX).toBe(7);
    expect(labelShown(textScaleOf(NODE_HEIGHT), 1)).toBe(true);
    expect(labelShown(textScaleOf(NODE_HEIGHT), MIN_LABEL_PX / TITLE_FONT)).toBe(true);
    expect(labelShown(textScaleOf(NODE_HEIGHT), MIN_LABEL_PX / TITLE_FONT - 0.01)).toBe(false);
    expect(labelShown(textScaleOf(NODE_HEIGHT * 10), 0.06)).toBe(true);
    expect(labelShown(textScaleOf(NODE_HEIGHT * 10), 0.05)).toBe(false);
    // Every zoom draws each box with the same text scale, the map's: zooming changes what is labeled, never a label's size.
    const view = frameOnMap(map, 'P-D', 2, 1000, 800);
    for (const zoom of [view.zoom / 4, view.zoom, view.zoom * 4]) {
      for (const b of drawnFor(map, { ...view, zoom }, 1000, 800).boxes) {
        expect(Object.keys(b).sort()).toEqual(['id', 'label']);
        const n = map.nodes.get(b.id)!;
        expect(b.label).toBe(TITLE_FONT * n.text * zoom >= MIN_LABEL_PX);
      }
    }
  });

  it('LA-EXP-T170 A product of thousands of records stays within the drawing budget at every zoom', () => {
    const big = wide(4, 30);
    expect(big.nodes.size).toBeGreaterThan(3000);
    for (const zoom of [0.001, 0.01, 0.05, 0.2, 1]) {
      for (const y of [0, big.height / 3, big.height / 2]) {
        const d = drawnFor(big, { x: 0, y: -y * zoom, zoom }, 1440, 900);
        expect(d.boxes.length).toBeLessThanOrEqual(MAX_DRAWN);
        expect(d.bars.length).toBeLessThanOrEqual(MAX_DRAWN);
      }
    }
  });
});
