import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseRecordFile } from '../../../lathe/src/parse';
import { COLUMN_GAP_SHARE, COLUMN_RATIO, graphMap, layoutTree, linkEnds, MAP_SIZE, parentLine, ROOT_WIDTH, ROW_GAP_SHARE, sizeText, type GraphMap, type MapNode } from '../../src/graph/map';
import { drawnFor, frameOnMap, MAX_DRAWN, MIN_DRAWN, MIN_ZOOM, viewRect } from '../../src/graph/camera';
import { shapeOf, SHAPES } from '../../src/graph/shapes';
import { BADGE_ROOM, BORDER, LABEL_PAD, labelHeight, largestFit, metaWidth, MARK_ROOM, narrowestWidth, TITLE_FONT, titleWidth, treeLabel, WIDTH_MARGIN, wrapLabel, wrapText, type MapLabel } from '../../src/graph/text';
import { indexWorkspace, type SpecIndex } from '../../src/specs/data';
import { groupedWorkspace, manyOfOneKindWorkspace, siblingGroups, testIndex } from './workspace';

// The graph is one fixed map of its product's tree (LA-EXP-DR57), laid out top-down from the
// product's fixed box by one rule (LA-EXP-DR58): siblings are the same size, with the same text.
// Each parent spans its children stacked, an equal part each; every box in a column has its
// column's width; the camera draws only what is in view and big enough to see (LA-EXP-DR60).

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
/** A product with a busy part (thirty leaves) and a quiet one (one leaf, its title with a word too wide for its column at its size share). */
const long = 'A title with a word too wide for its column: Extraordinarilylongunbrokenidentifierthatnoboxcanholdonline';
const busyAndQuiet = () => layoutTree(['p'], (id) => (id === 'p' ? ['busy', 'quiet'] : id === 'busy' ? Array.from({ length: 30 }, (_, i) => `b${i}`) : id === 'quiet' ? ['q0'] : []), (id) => ({ title: id === 'q0' ? long : id, meta: '' }));
const all = (): GraphMap[] => [...maps(), wide(3, 8), wide(1, 30), busyAndQuiet()];

/** A box's label as its map was given it: the real index's, or a synthetic tree's (its lines joined). */
function labelOf(map: GraphMap, n: MapNode): MapLabel {
  for (const index of indexes()) if (graphMap(index, 'P') === map) return treeLabel(index, n.id);
  return { title: n.lines.title.join(''), meta: n.lines.meta.join('') };
}
const eps = 1e-9;

describe('the one map', () => {
  it('LA-EXP-T165 A parent spans its children stacked, an equal part each, from its top edge to its bottom edge, each child beside it, nothing overlapping', () => {
    for (const map of all()) {
      for (const r of map.roots) expect(map.nodes.get(r)!.h).toBe(MAP_SIZE);
      for (const node of map.nodes.values()) {
        if (node.children.length === 0) continue;
        const kids = node.children.map((c) => map.nodes.get(c)!);
        const gap = (ROW_GAP_SHARE * node.h) / kids.length;
        // The stack starts at the parent's top and ends at its bottom, equal parts a gap apart.
        expect(kids[0].y).toBeCloseTo(node.y, 6);
        expect(kids.at(-1)!.y + kids.at(-1)!.h).toBeCloseTo(node.y + node.h, 6);
        for (const k of kids) expect(k.h).toBe(kids[0].h);
        for (let i = 1; i < kids.length; i++) expect(kids[i].y - (kids[i - 1].y + kids[i - 1].h)).toBeCloseTo(gap, 6);
        // Each child right beside its parent, in the next level.
        for (const k of kids) {
          expect(k.level).toBe(node.level + 1);
          expect(k.x).toBeGreaterThan(node.x + node.w);
        }
      }
      // Nothing overlaps.
      for (const level of map.byLevel) for (let i = 1; i < level.length; i++) expect(level[i].y).toBeGreaterThanOrEqual(level[i - 1].y + level[i - 1].h);
    }
    // Record counts size nothing: the busy part and the quiet one are equal; the busy one's children are smaller.
    const lop = busyAndQuiet();
    expect(lop.nodes.get('busy')!.h).toBe(lop.nodes.get('quiet')!.h);
    expect(lop.nodes.get('b0')!.h).toBeLessThan(lop.nodes.get('q0')!.h);
    // The tree is the nav's: a domain spans its stages, the product its domain.
    const map = graphMap(testIndex(), 'P');
    expect(map.nodes.get('P-D')!.children).toEqual(['P-D/define', 'P-D/design', 'P-D/question']);
    expect(map.roots).toEqual(['P']);
  });
});

describe('columns and text', () => {
  it('LA-EXP-T166 Every box in a column has its width, each column a fixed fraction of the one before, a gap before it', () => {
    for (const map of all()) {
      map.levels.forEach((level, l) => {
        expect(level.width).toBeCloseTo(MAP_SIZE * ROOT_WIDTH * COLUMN_RATIO ** l, 6);
        if (l > 0) expect(level.x - (map.levels[l - 1].x + map.levels[l - 1].width)).toBeCloseTo(COLUMN_GAP_SHARE * level.width, 6);
        for (const n of map.byLevel[l]) expect([n.x, n.w]).toEqual([level.x, level.width]);
      });
      expect(map.width).toBeCloseTo(map.levels.at(-1)!.x + map.levels.at(-1)!.width, 6);
    }
  });

  it("LA-EXP-T182 Siblings share one text scale: their column's width over TEXT_SIZE, or the largest at which every sibling's whole label fits its box", () => {
    for (const map of all()) {
      for (const group of siblingGroups(map)) {
        const { w, h, text } = group[0];
        for (const n of group) expect([n.w, n.h, n.text], n.id).toEqual([w, h, text]);
        const border = (s: number) => BORDER * s;
        expect(text).toBeGreaterThan(0);
        expect(text).toBeCloseTo(Math.min(...group.map((n) => largestFit(labelOf(map, n), true, w, h, sizeText(w), border))), 9);
      }
    }
    // A title too long for its box at the size share lowers its siblings' text with its own, never its cousins'.
    const lop = busyAndQuiet();
    const quiet = lop.nodes.get('q0')!;
    expect(quiet.text).toBeLessThan(sizeText(quiet.w));
    expect(lop.nodes.get('busy')!.text).toBe(lop.nodes.get('quiet')!.text);
  });

  it('LA-EXP-T182 Every label fits its box: every line within its width, no word broken, its lines no taller than the box', () => {
    for (const map of all()) {
      for (const n of map.nodes.values()) {
        const label = labelOf(map, n);
        const border = BORDER * n.text;
        const room = label.shape ? SHAPES[label.shape].room : { l: 0, r: 0 };
        const across = (n.w - 2 * border) / n.text;
        expect(across, n.id).toBeGreaterThanOrEqual(narrowestWidth(label, true) - 1e-6);
        expect(n.lines.title.join(''), n.id).toBe(label.title);
        expect(n.lines.meta.join(''), n.id).toBe(label.meta);
        const inner = across - 2 * LABEL_PAD - room.l - room.r;
        for (const line of n.lines.title) expect((label.file ? metaWidth(line.trimEnd(), 11) : titleWidth(line.trimEnd())) * WIDTH_MARGIN, n.id).toBeLessThanOrEqual(inner + 1e-6);
        const meta = inner - (label.marks ?? 0) * MARK_ROOM - (label.marked ? 2 * BADGE_ROOM : 0);
        for (const line of n.lines.meta) expect(metaWidth(line.trimEnd()) * WIDTH_MARGIN, n.id).toBeLessThanOrEqual(meta + 1e-6);
        expect(n.text * labelHeight(n.lines) + 2 * border, n.id).toBeLessThanOrEqual(n.h * (1 + eps));
        expect(n.centered).toBe(true);
      }
    }
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
    const far = { x: 0, y: 0, zoom: MIN_ZOOM };
    const small = drawnFor(map, far, 1000, 800);
    expect(small.boxes.some((b) => map.nodes.get(b.id)!.h * far.zoom < MIN_DRAWN)).toBe(false);
    expect(small.bars.length).toBeGreaterThan(0);
    for (const bar of small.bars) {
      const p = map.nodes.get(bar.parent)!;
      expect(bar.level).toBe(p.level + 1);
      // Within its parent, give or take the doubles' last digit.
      expect(bar.y).toBeGreaterThanOrEqual(p.y - 1e-9 * p.h);
      expect(bar.y + bar.h).toBeLessThanOrEqual(p.y + p.h + 1e-9 * p.h);
    }
    // Some boxes are drawn whatever their size: the focus, the linked records.
    expect(drawnFor(map, far, 1000, 800, ['P-D-UC01-R01']).boxes.map((b) => b.id)).toContain('P-D-UC01-R01');
    // The same view always draws the same.
    expect(drawnFor(map, view, 1000, 800)).toEqual(d);
  });

  it('LA-EXP-T176 A label keeps its size in the map: the camera never changes it', () => {
    // The text scale is the map's: a column's width over TEXT_SIZE at most, whatever the camera.
    for (const n of map.nodes.values()) expect(n.text).toBeLessThanOrEqual(sizeText(n.w));
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
