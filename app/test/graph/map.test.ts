import { describe, expect, it } from 'vitest';
import { contentScale, NODE_HEIGHT, NODE_WIDTH } from '../../src/graph/layout';
import { graphMap, layoutTree, LEVEL_ASPECT, linkEnds, MAX_LEVEL_STEP, MAX_ROOT_STEP, parentLine, typicalHeight, type GraphMap } from '../../src/graph/map';
import { drawnFor, frameOnMap, LABEL_MIN_HEIGHT, LABEL_SCALE, MAX_DRAWN, MIN_DRAWN, textScale, TEXT_ON_SCREEN, viewRect } from '../../src/graph/camera';
import { indexWorkspace } from '../../src/specs/data';
import { groupedWorkspace, manyOfOneKindWorkspace, testIndex } from './workspace';

// The graph is one fixed map of its product's tree (LA-EXP-DR57): each parent exactly as tall as its
// children stacked, each child right beside it, one width per level (LA-EXP-DR58); the camera
// draws only what is in view and big enough to see (LA-EXP-DR60).

const maps = (): GraphMap[] => [graphMap(testIndex(), 'P'), graphMap(indexWorkspace(groupedWorkspace()), 'P'), graphMap(indexWorkspace(manyOfOneKindWorkspace()), 'P')];

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

  it("LA-EXP-T166 Every node in a level has its width, shrinking toward the leaves with the level's typical height, within the caps", () => {
    for (const map of [...maps(), wide(3, 8), wide(1, 30)]) {
      const deepest = map.levels.length - 1;
      for (let l = 0; l <= deepest; l++) {
        for (const n of map.byLevel[l]) expect(n.w).toBe(map.levels[l].width);
        const below = l < deepest ? map.levels[l + 1].width : NODE_WIDTH;
        // Never narrower than the level below, nor more than the step allows.
        expect(map.levels[l].width).toBeGreaterThanOrEqual(below);
        expect(map.levels[l].width).toBeLessThanOrEqual((l === 0 ? MAX_ROOT_STEP : MAX_LEVEL_STEP) * below + 2);
        // In proportion to the level's typical height where no cap applies.
        const wanted = LEVEL_ASPECT * typicalHeight(map.byLevel[l].map((n) => n.h));
        if (wanted > below && wanted < (l === 0 ? MAX_ROOT_STEP : MAX_LEVEL_STEP) * below) expect(Math.abs(map.levels[l].width - wanted)).toBeLessThanOrEqual(2);
      }
      // A level of leaves keeps a leaf's width.
      expect(map.levels[deepest].width).toBe(NODE_WIDTH);
    }
    // The typical height is the median by height: a few tall nodes outweigh many short ones.
    expect(typicalHeight([56, 56, 56, 56, 1000, 1000])).toBe(1000);
    expect(typicalHeight([56, 56, 56])).toBe(56);
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
      // Labeled exactly when the text reads at this zoom.
      expect(b).toEqual({ id: b.id, ...textScale(n.w, n.h, view.zoom) });
      // A box tall and wide enough on screen for a line of text is labeled, whatever its size in the map.
      if (n.h * view.zoom >= 40 && n.w * view.zoom >= 100) expect(b.label, b.id).toBe(true);
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

  it('LA-EXP-T176 A label reads on screen whenever its box has room for it: its text keeps its on-screen size as the camera zooms out', () => {
    // A leaf at its own size: its own scale, labeled.
    expect(textScale(NODE_WIDTH, NODE_HEIGHT, 1)).toEqual({ label: true, text: 1 });
    // A folder 110 by 100 pixels on screen, in a map zoomed to a tenth: its content scale alone would read at 0.58, so its text grows to read.
    const folder = textScale(1100, 1000, 0.1);
    expect(contentScale(1100, 1000) * 0.1).toBeLessThan(LABEL_SCALE);
    expect(folder.label).toBe(true);
    expect(folder.text * 0.1).toBeGreaterThanOrEqual(TEXT_ON_SCREEN);
    // Never more text than the box has room for, and never less than its own scale.
    const narrow = textScale(400, 4000, 0.05);
    expect(narrow.text).toBeLessThanOrEqual(400 / 50 + 1e-9);
    expect(narrow.text).toBeGreaterThanOrEqual(contentScale(400, 4000));
    // Too small on screen: plain.
    expect(textScale(NODE_WIDTH, NODE_HEIGHT, 0.2).label).toBe(false);
    expect(textScale(NODE_WIDTH, NODE_HEIGHT * 3, 0.1).label).toBe(false);
    // Rounded on screen to tenths, so a small zoom keeps the same text on screen.
    expect(textScale(1100, 1000, 0.1004).text * 0.1004).toBeCloseTo(folder.text * 0.1, 6);
    expect(LABEL_MIN_HEIGHT).toBe(18);
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
