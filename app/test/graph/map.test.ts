import { recordIndexOf } from '../read-view';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { COLUMN_GAP_SHARE, graphMap, groupWidth, layoutTree, MAP_SIZE, MAX_ASPECT, MAX_COLUMN_SHARE, parentLine, ROOT_WIDTH, ROW_GAP_SHARE, treeText, type GraphMap, type MapNode } from '../../src/graph/map';
import { drawnFor, frameOnMap, MAX_DRAWN, MIN_DRAWN, MIN_ZOOM, viewRect } from '../../src/graph/camera';
import { shapeOf, SHAPES } from '../../src/graph/shapes';
import { BADGE_ROOM, BORDER, LABEL_PAD, labelHeight, largestFit, metaWidth, MARK_ROOM, narrowestWidth, TITLE_FONT, titleWidth, treeLabel, wrapLabel, wrapText, type MapLabel } from '../../src/graph/text';
import type { RecordIndex } from '../../src/exploring/record-summaries/record-index';
import { groupedWorkspace, manyOfOneKindWorkspace, siblingGroups, testIndex } from './workspace';

// The graph is one fixed map of its product's tree (LA-EXP-DS05), laid out top-down from the
// product's fixed box by one rule (LA-EXP-DS06): siblings are the same size, with the same text.
// Each parent spans its children stacked, an equal part each; every box in a column has its
// column's width; the camera draws only what is in view and big enough to see (LA-EXP-DS10).

/** The test workspaces' indexes, built once, so a map found by its index is the one the test laid out. */
let built: RecordIndex[] | null = null;
const indexes = (): RecordIndex[] => (built ??= [testIndex(), recordIndexOf(groupedWorkspace()), recordIndexOf(manyOfOneKindWorkspace())]);
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
const long = 'A title with a word too wide for its column: Extraordinarilylongunbrokenidentifierthatnoboxcanholdonlineandthatkeepsongoingwellpastanyboxwidth';
const busyAndQuiet = () => layoutTree(['p'], (id) => (id === 'p' ? ['busy', 'quiet'] : id === 'busy' ? Array.from({ length: 30 }, (_, i) => `b${i}`) : id === 'quiet' ? ['q0'] : []), (id) => ({ title: id === 'q0' ? long : id, meta: '' }));
const all = (): GraphMap[] => [...maps(), wide(3, 8), wide(1, 30), busyAndQuiet()];

/** A box's label as its map was given it: the real index's, or a synthetic tree's (its lines joined). */
function labelOf(map: GraphMap, n: MapNode): MapLabel {
  for (const index of indexes()) if (graphMap(index, 'P') === map) return treeLabel(index, n.id);
  return { title: n.lines.title.join(''), meta: n.lines.meta.join('') };
}
const eps = 1e-9;

describe('the one map', () => {
  it('LA-EXP-DS05-T11 LA-V93-R29-T01 A parent spans its children stacked, an equal part each, from its top edge to its bottom edge, each child beside it, nothing overlapping', () => {
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
    expect(map.nodes.get('P-D')!.children).toEqual(['P-D/domain-model', 'P-D/use-cases', 'P-D/interaction-design', 'P-D/technical-specification', 'P-D/test-plan', 'P-D/question']);
    expect(map.roots).toEqual(['P']);
  });
});

describe('columns and text', () => {
  it('LA-EXP-DS06-T02 A column narrows with how many children share it: siblings take MAX_COLUMN_SHARE of their parent\'s width, at most MAX_ASPECT times their height, so no box is flatter than MAX_ASPECT to 1, each column a gap after its parent', () => {
    for (const map of all()) {
      for (const r of map.roots) expect([map.nodes.get(r)!.x, map.nodes.get(r)!.w]).toEqual([0, MAP_SIZE * ROOT_WIDTH]);
      for (const node of map.nodes.values()) {
        // No box is flatter than MAX_ASPECT to 1.
        expect(node.w / node.h, node.id).toBeLessThanOrEqual(MAX_ASPECT + eps);
        if (node.children.length === 0) continue;
        const kids = node.children.map((c) => map.nodes.get(c)!);
        // Siblings share one width: MAX_COLUMN_SHARE of their parent's, narrowed to MAX_ASPECT times their height; their column starts a gap after the parent.
        const w = Math.min(MAX_COLUMN_SHARE * node.w, MAX_ASPECT * kids[0].h);
        expect(groupWidth(node.w, kids[0].h)).toBe(w);
        for (const k of kids) {
          expect(k.w, k.id).toBeCloseTo(w, 9);
          expect(k.x, k.id).toBeCloseTo(node.x + node.w + COLUMN_GAP_SHARE * w, 9);
        }
      }
      expect(map.width).toBeCloseTo(Math.max(...[...map.nodes.values()].map((n) => n.x + n.w)), 6);
    }
    // The rule itself: the more children share a parent, the narrower their column; a single child takes MAX_COLUMN_SHARE of its parent's width.
    const lop = busyAndQuiet();
    const [busy, quiet, b0, q0] = ['busy', 'quiet', 'b0', 'q0'].map((id) => lop.nodes.get(id)!);
    expect(b0.w).toBeLessThan(q0.w);
    expect(b0.w).toBeCloseTo(MAX_ASPECT * b0.h, 9);
    expect(q0.w).toBeCloseTo(MAX_COLUMN_SHARE * quiet.w, 9);
    expect(b0.x).toBeLessThan(q0.x);
    expect(busy.w).toBe(quiet.w);
  });

  it("LA-EXP-DS06-T06 Siblings share one text scale: their column's width over TEXT_SIZE, or the largest at which every sibling's whole label fits its box", () => {
    for (const map of all()) {
      for (const group of siblingGroups(map)) {
        const { w, h, text } = group[0];
        for (const n of group) expect([n.w, n.h, n.text], n.id).toEqual([w, h, text]);
        const border = (s: number) => BORDER * s;
        expect(text).toBeGreaterThan(0);
        expect(text).toBeCloseTo(Math.min(...group.map((n) => largestFit(labelOf(map, n), true, w, h, treeText(w), border))), 9);
      }
    }
    // A title too long for its box at the size share lowers its siblings' text with its own, never its cousins'.
    const lop = busyAndQuiet();
    const quiet = lop.nodes.get('q0')!;
    expect(quiet.text).toBeLessThan(treeText(quiet.w));
    expect(lop.nodes.get('busy')!.text).toBe(lop.nodes.get('quiet')!.text);
  });

  it('LA-EXP-DS06-T06 Every label fits its box: every line within its width, no word broken, its lines no taller than the box', () => {
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
        for (const line of n.lines.title) expect(titleWidth(line.trimEnd()), n.id).toBeLessThanOrEqual(inner + 1e-6);
        const meta = inner - (label.marks ?? 0) * MARK_ROOM - (label.marked ? 2 * BADGE_ROOM : 0);
        for (const line of n.lines.meta) expect(metaWidth(line.trimEnd()), n.id).toBeLessThanOrEqual(meta + 1e-6);
        expect(n.text * labelHeight(n.lines) + 2 * border, n.id).toBeLessThanOrEqual(n.h * (1 + eps));
        expect(n.centered).toBe(true);
      }
    }
    // The plain measure (no canvas, in the tests): a title is at least its characters at 0.45 em, and a kind and ID line 0.6 em a character.
    expect(titleWidth('Capabilities')).toBeGreaterThan(12 * 0.45 * TITLE_FONT);
    expect(metaWidth('Use case · LA-EXP-UC03')).toBeGreaterThanOrEqual(22 * 0.6 * 10.5);
    // Wrapping breaks only after a space; a word too wide for a line breaks after a hyphen, then between characters.
    const chars = (s: string) => s.length;
    expect(wrapText('walk the model as a graph', 10, chars)).toEqual(['walk the ', 'model as a ', 'graph']);
    expect(wrapText('a well-formed step', 10, chars, '-')).toEqual(['a ', 'well-', 'formed ', 'step']);
    expect(wrapText('a well-formed', 13, chars, '-')).toEqual(['a well-formed']);
    expect(wrapText('abcdefghijkl', 5, chars)).toEqual(['abcde', 'fghij', 'kl']);
    expect(wrapText('app/src/graph/text.ts', 10, chars, '/')).toEqual(['app/src/', 'graph/', 'text.ts']);
    // A code identifier too wide for a line breaks after its punctuation, or between its camelCase words.
    expect(wrapText("Store.set('product_setting')", 12, chars, '-._:/(', true)).toEqual(['Store.set(', "'product_", "setting')"]);
    expect(wrapText('optOutOfWindowRestoration', 12, chars, '-._:/(', true)).toEqual(['optOutOf', 'Window', 'Restoration']);
    // A longer title takes more lines; the badge's room and a shape's room leave less room on a line, and a shape's room above and below makes the box taller.
    const lines = { title: 'Walk the model as a graph', meta: 'Use case · LA-EXP-UC03' };
    expect(wrapLabel({ ...lines, title: `${lines.title} and on through every group in it` }).title.length).toBeGreaterThan(wrapLabel(lines).title.length);
    expect(wrapLabel(lines, { marked: true, centered: true }).meta).toEqual(['Use case · ', 'LA-EXP-UC03']);
    // An ID is never broken across lines: too narrow a box keeps it whole on its own line (LA-EXP-DS06).
    expect(wrapLabel(lines, { width: 2 * LABEL_PAD + metaWidth('LA-EXP') }).meta).toEqual(['Use ', 'case · ', 'LA-EXP-UC03']);
    // With `whole` a word too wide for a line stays whole.
    expect(wrapText('a well-formed step', 6, chars, '-', false, true)).toEqual(['a ', 'well-formed ', 'step']);
    expect(wrapLabel(lines).meta).toEqual(['Use case · LA-EXP-UC03']);
    expect(BADGE_ROOM).toBe(30);
    expect(labelHeight(wrapLabel(lines, { shape: 'hexagon', marked: true, centered: true }))).toBeGreaterThan(labelHeight(wrapLabel(lines)));
    expect(labelHeight(wrapLabel(lines, { shape: 'window' }))).toBe(labelHeight(wrapLabel(lines)) + SHAPES.window.room.t);
  });

  it('LA-EXP-DS06-T06 An ID is never broken across lines: a label fitted at its widest word, the ID, keeps it whole at every room', () => {
    const label: MapLabel = { title: 'Record ID', meta: 'Value object · LA-V001', shape: 'box', marks: 1, marked: true };
    for (let w = 20; w < 400; w += 0.37) {
      for (const h of [80, 300]) {
        const s = largestFit(label, true, w, h, 4);
        if (s <= 0) continue;
        const lines = wrapLabel(label, { shape: label.shape, marks: label.marks, marked: label.marked, centered: true, width: w / s });
        expect(lines.meta.flatMap((l) => l.trim().split(/\s+/)), `w ${w}`).toContain('LA-V001');
      }
    }
  });

  it("LA-EXP-DS05-T12 A parent line runs level from the parent's right edge to the child's left edge, at the child's middle", () => {
    const map = graphMap(testIndex(), 'P');
    for (const n of map.nodes.values()) {
      if (n.parent === null) continue;
      const p = map.nodes.get(n.parent)!;
      const [a, b] = parentLine(p, n);
      expect(a).toEqual({ x: p.x + p.w, y: n.y + n.h / 2 });
      expect(b).toEqual({ x: n.x, y: n.y + n.h / 2 });
    }
  });
});

describe('the level of detail', () => {
  const map = graphMap(testIndex(), 'P');

  it('LA-EXP-DS10-T02 LA-PAT-APP-UX-R11-T02 Only boxes in view and big enough are drawn, each with its label, with bars for children too small, within a budget', () => {
    // Framed on the domain: the domain and its stages are drawn; nothing outside the view.
    const view = frameOnMap(map, 'P-D', 1, 1000, 800);
    const d = drawnFor(map, view, 1000, 800);
    const drawn = new Set(d.boxes.map((b) => b.id));
    expect(drawn).toContain('P-D');
    expect(drawn).toContain('P-D/domain-model');
    const rect = viewRect(view, 1000, 800);
    for (const b of d.boxes) {
      const n = map.nodes.get(b.id)!;
      expect(n.x + n.w >= rect.x0 && n.x <= rect.x1 && n.y + n.h >= rect.y0 && n.y <= rect.y1, b.id).toBe(true);
      expect(n.h * view.zoom).toBeGreaterThanOrEqual(MIN_DRAWN);
      // Always with its label; a drawn box carries no text size of its own.
      expect(b).toEqual({ id: b.id });
    }
    // Zoomed far out, the leaves are too small: they are not drawn, and each run of them is one bar in its parent's children's column.
    const far = { x: 0, y: 0, zoom: MIN_ZOOM };
    const small = drawnFor(map, far, 1000, 800);
    expect(small.boxes.some((b) => map.nodes.get(b.id)!.h * far.zoom < MIN_DRAWN)).toBe(false);
    expect(small.bars.length).toBeGreaterThan(0);
    for (const bar of small.bars) {
      const p = map.nodes.get(bar.parent)!;
      // In its parent's children's column.
      const kid = map.nodes.get(p.children[0])!;
      expect([bar.x, bar.w]).toEqual([kid.x, kid.w]);
      // Within its parent, give or take the doubles' last digit.
      expect(bar.y).toBeGreaterThanOrEqual(p.y - 1e-9 * p.h);
      expect(bar.y + bar.h).toBeLessThanOrEqual(p.y + p.h + 1e-9 * p.h);
    }
    // Some boxes are drawn whatever their size: the focus, the linked records.
    expect(drawnFor(map, far, 1000, 800, ['P-D-UC01-R01']).boxes.map((b) => b.id)).toContain('P-D-UC01-R01');
    // The same view always draws the same.
    expect(drawnFor(map, view, 1000, 800)).toEqual(d);
  });

  it('LA-EXP-DS06-T04 LA-EXP-DS10-T04 A label keeps its size in the map: the camera never changes it', () => {
    // The text scale is the map's: a column's width over TEXT_SIZE at most, whatever the camera.
    for (const n of map.nodes.values()) expect(n.text).toBeLessThanOrEqual(treeText(n.w));
    // Every zoom draws each box with the same text scale, the map's, and its label: zooming never changes a label's size.
    const view = frameOnMap(map, 'P-D', 2, 1000, 800);
    for (const zoom of [view.zoom / 4, view.zoom, view.zoom * 4]) {
      for (const b of drawnFor(map, { ...view, zoom }, 1000, 800).boxes) {
        expect(Object.keys(b)).toEqual(['id']);
      }
    }
  });

  it('LA-EXP-DS10-T02 A product of thousands of records stays within the drawing budget at every zoom', () => {
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
  /** Every record of Lathe's own spec and the Tool Library's, read from their data folders: each row with an ID and a title. */
  const records = (dir: string): { title: string; kind: string; file?: string }[] =>
    readdirSync(dir).filter((f) => f.endsWith('.jsonl')).flatMap((f) =>
      readFileSync(path.join(dir, f), 'utf8').split('\n').filter(Boolean).flatMap((line) => {
        const row = JSON.parse(line) as Record<string, unknown>;
        if (typeof row.id !== 'string' || typeof row.title !== 'string') return [];
        return [{ title: row.title, kind: f.slice(0, -'.jsonl'.length), file: typeof row.file === 'string' ? row.file : undefined }];
      }));

  it("LA-EXP-DS06-T10 Every title in Lathe's spec and the Tool Library wraps on whole words, an identifier too wide for a line only at its punctuation or camelCase words", () => {
    const repo = path.resolve(import.meta.dirname, '../../..');
    for (const product of ['lathe', 'tool-library']) {
      const all = records(path.join(repo, product === 'lathe' ? 'data' : 'examples/tool-library/data'));
      expect(all.length, product).toBeGreaterThan(product === 'lathe' ? 1000 : 50);
      for (const r of all) {
        // As its box breaks it: its kind's shape keeps room clear (the badge's room is beside the kind and ID line, not the title).
        const title = wrapLabel({ title: r.title, meta: '' }, { shape: shapeOf(r.kind).shape }).title;
        expect(title.join(''), r.title).toBe(r.title);
        // Every line but the last ends after a space or, inside one word too wide for a line, after a hyphen, a code
        // identifier's punctuation, or between the words of a camelCase identifier.
        title.slice(0, -1).forEach((line, i) => {
          const inWord = !/\s/.test(line) && (/[-._:/(]$/.test(line) || (/[a-z0-9]$/.test(line) && /^[A-Z]/.test(title[i + 1])));
          expect(/\s$/.test(line) || inWord, `${r.title}: "${line}"`).toBe(true);
        });
      }
    }
  });
});
