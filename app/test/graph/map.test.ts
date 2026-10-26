import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseRecordFile } from '../../../lathe/src/parse';
import { contentScale, NODE_HEIGHT, NODE_WIDTH } from '../../src/graph/layout';
import { graphMap, layoutTree, LEVEL_ASPECT, linkEnds, MAX_LEVEL_STEP, MAX_ROOT_STEP, parentLine, typicalHeight, type GraphMap } from '../../src/graph/map';
import { drawnFor, frameOnMap, MAX_DRAWN, MIN_DRAWN, viewRect } from '../../src/graph/camera';
import { nodeShape, shapeOf, SHAPES } from '../../src/graph/shapes';
import { BADGE_ROOM, isCentered, LABEL_PAD, labelFor, labelLines, labelHeight, metaWidth, textScaleOf, TITLE_FONT, titleWidth, WIDTH_MARGIN, wrapLabel, wrapText } from '../../src/graph/text';
import { indexWorkspace, type SpecIndex } from '../../src/specs/data';
import { groupedWorkspace, manyOfOneKindWorkspace, testIndex } from './workspace';

// The graph is one fixed map of its product's tree (LA-EXP-DR57): each parent exactly as tall as its
// children stacked, each child right beside it, one width and one text scale per level, each leaf
// tall enough for its wrapped label (LA-EXP-DR58); the camera
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
        // A leaf is a leaf high, or taller for its label (LA-EXP-T182).
        if (node.children.length === 0) { expect(node.h).toBeGreaterThanOrEqual(NODE_HEIGHT); continue; }
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
    // A synthetic tree's labels need no room: every leaf is a leaf high.
    for (const n of wide(3, 8).nodes.values()) if (n.children.length === 0) expect(n.h).toBe(NODE_HEIGHT);
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

  it("LA-EXP-T166 Every node in a level has its width, in proportion to the level's typical height within the caps", () => {
    for (const map of [...maps(), wide(3, 8), wide(1, 30)]) {
      const deepest = map.levels.length - 1;
      for (let l = 0; l <= deepest; l++) {
        const level = map.levels[l];
        for (const n of map.byLevel[l]) expect(n.w).toBe(level.width);
        const below = l < deepest ? map.levels[l + 1].width : NODE_WIDTH;
        const cap = (l === 0 ? MAX_ROOT_STEP : MAX_LEVEL_STEP) * below;
        // Never narrower than the level below, nor more than the step allows.
        expect(level.width).toBeGreaterThanOrEqual(below);
        expect(level.width).toBeLessThanOrEqual(cap + 2);
        // In proportion to the level's typical height where no cap applies.
        const wanted = LEVEL_ASPECT * typicalHeight(map.byLevel[l].map((n) => n.h));
        if (wanted > below && wanted < cap) expect(Math.abs(level.width - wanted)).toBeLessThanOrEqual(2);
      }
    }
    // A level of leaves keeps a leaf's width.
    for (const map of [wide(3, 8), wide(1, 30)]) expect(map.levels.at(-1)!.width).toBe(NODE_WIDTH);
    // The typical height is the median by height: a few tall nodes outweigh many short ones.
    expect(typicalHeight([56, 56, 56, 56, 1000, 1000])).toBe(1000);
    expect(typicalHeight([56, 56, 56])).toBe(56);
  });

  it("LA-EXP-T182 Every box in a level has its level's text scale, and every box is tall enough for its label wrapped on whole words", () => {
    for (const index of indexes()) {
      const map = graphMap(index, 'P');
      for (const n of map.nodes.values()) {
        // The text scale is the level's width over a leaf's, fixed by the map.
        expect(n.text).toBe(map.levels[n.level].width / NODE_WIDTH);
        expect(n.text).toBe(map.levels[n.level].text);
        // Every box is tall enough for its wrapped label at that scale: a leaf grows for it, a parent's stack holds it.
        const label = labelFor(index, n.id, isCentered(n.text, n.children.length > 0));
        expect(n.h, n.id).toBeGreaterThanOrEqual(n.text * labelHeight(label) - 1);
        // The lines give the text back, and each fits a leaf's width at text scale 1, so at every scale.
        expect(label.title.join('')).toBe(labelLines(index, n.id).title);
        const { room } = SHAPES[nodeShape(index, n.id).shape];
        for (const line of label.title) expect(titleWidth(line.trimEnd()) * WIDTH_MARGIN).toBeLessThanOrEqual(NODE_WIDTH - 2 * LABEL_PAD - room.l - room.r);
      }
    }
    // A parent whose own label needs more than its stack passes the difference to its last leaf: the stack still fills it.
    const tall = layoutTree(['r'], (id) => (id === 'r' ? ['a', 'b'] : []), (id) => (id === 'r' ? 400 : 40));
    const r = tall.nodes.get('r')!;
    expect(r.h).toBeGreaterThanOrEqual(r.text * 400);
    expect(tall.nodes.get('b')!.y + tall.nodes.get('b')!.h).toBe(r.y + r.h);
    expect(tall.nodes.get('a')!.h).toBe(NODE_HEIGHT);
    // The estimate errs wide: a title is at least its characters at 0.45 em, and a kind and ID line 0.6 em a character.
    expect(titleWidth('Capabilities')).toBeGreaterThan(12 * 0.45 * TITLE_FONT);
    expect(metaWidth('Use case · LA-EXP-UC03')).toBeGreaterThanOrEqual(22 * 0.6 * 10.5);
    // Wrapping breaks only after a space; a word too wide for a line breaks after a hyphen, then between characters.
    const chars = (s: string) => s.length;
    expect(wrapText('walk the model as a graph', 10, chars)).toEqual(['walk the ', 'model as a ', 'graph']);
    expect(wrapText('a well-formed step', 10, chars, '-')).toEqual(['a ', 'well-', 'formed ', 'step']);
    expect(wrapText('a well-formed', 13, chars, '-')).toEqual(['a well-formed']);
    expect(wrapText('abcdefghijkl', 5, chars)).toEqual(['abcde', 'fghij', 'kl']);
    expect(wrapText('app/src/graph/text.ts', 10, chars, '/')).toEqual(['app/src/', 'graph/', 'text.ts']);
    // A longer title takes more lines; the badge's room and a shape's room leave less room on a line, and a shape's room above and below makes the box taller.
    const lines = { title: 'Walk the model as a graph', meta: 'Use case · LA-EXP-UC03' };
    expect(wrapLabel({ ...lines, title: `${lines.title} and on through every group in it` }).title.length).toBeGreaterThan(wrapLabel(lines).title.length);
    expect(wrapLabel(lines, { marked: true, centered: true }).meta).toEqual(['Use case · ', 'LA-EXP-UC03']);
    expect(wrapLabel(lines).meta).toEqual(['Use case · LA-EXP-UC03']);
    expect(BADGE_ROOM).toBe(30);
    expect(labelHeight(wrapLabel(lines, { shape: 'hexagon', marked: true, centered: true }))).toBeGreaterThan(labelHeight(wrapLabel(lines)));
    expect(labelHeight(wrapLabel(lines, { shape: 'window' }))).toBe(labelHeight(wrapLabel(lines)) + SHAPES.window.room.t);
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

  it('LA-EXP-T170 Only boxes in view and big enough are drawn, each with its label, with bars for children too small, within a budget', () => {
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
      // Always with its label; a drawn box carries no text size of its own.
      expect(b).toEqual({ id: b.id });
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

  it('LA-EXP-T176 A label keeps its size in the map: the camera never changes it', () => {
    // The text scale is the level's width over a leaf's: a leaf level's is 1, a level ten leaves wide has ten.
    expect(textScaleOf(NODE_WIDTH)).toBe(1);
    expect(textScaleOf(NODE_WIDTH * 10)).toBe(10);
    // Every zoom draws each box with the same text scale, the map's, and its label: zooming never changes a label's size.
    const view = frameOnMap(map, 'P-D', 2, 1000, 800);
    for (const zoom of [view.zoom / 4, view.zoom, view.zoom * 4]) {
      for (const b of drawnFor(map, { ...view, zoom }, 1000, 800).boxes) {
        expect(Object.keys(b)).toEqual(['id']);
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

describe('real titles', () => {
  /** Every record of Lathe's own spec and the Tool Library's, read from the spec folders. */
  const records = (dir: string): { title: string; kind: string; file?: string }[] =>
    readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
      const at = path.join(dir, e.name);
      if (e.isDirectory()) return records(at);
      if (!e.name.endsWith('.md')) return [];
      const parsed = parseRecordFile(readFileSync(at, 'utf8'));
      return parsed.ok ? [{ title: parsed.record.title, kind: parsed.record.kind, file: parsed.record.fields.file }] : [];
    });

  it("LA-EXP-T190 Every title in Lathe's spec and the Tool Library wraps on whole words, none broken inside a word", () => {
    const specs = path.resolve(import.meta.dirname, '../../../specs');
    for (const product of ['lathe', 'tool-library']) {
      const all = records(path.join(specs, product));
      expect(all.length, product).toBeGreaterThan(product === 'lathe' ? 1000 : 50);
      for (const r of all) {
        // As its box breaks it: its kind's shape keeps room clear (the badge's room is beside the kind and ID line, not the title).
        const title = wrapLabel({ title: r.title, meta: '' }, { shape: shapeOf(r.kind).shape }).title;
        expect(title.join(''), r.title).toBe(r.title);
        // Every line but the last ends after a space, or after a hyphen inside one word too wide for a line.
        for (const line of title.slice(0, -1)) expect(/\s$/.test(line) || (line.endsWith('-') && !/\s/.test(line)), `${r.title}: "${line}"`).toBe(true);
        // A file's path breaks only after a slash or a hyphen.
        if (r.file) for (const line of wrapLabel({ title: r.file, meta: '' }, { file: true }).title.slice(0, -1)) expect(/[\s/-]$/.test(line), `${r.file}: "${line}"`).toBe(true);
      }
    }
  });
});
