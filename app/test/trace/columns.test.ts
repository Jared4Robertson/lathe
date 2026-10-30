import { describe, expect, it } from 'vitest';
import { modelIndex } from '../fixtures/model';
import { traceMap } from '../../src/trace/tree';
import { tracesOf } from './traces';
import {
  BOX_HEIGHT, COLUMN_WIDTH, columnBoxes, columnHeight, columnLefts, columnScrolls, columnSizes, columnsView, COLUMNS_PAD, COMPACT_HEIGHT, COMPACT_WIDTH, holds, rowTop, traceColumns,
} from '../../src/trace/columns';
import { UNTRACED } from '../../src/trace/top';

// The Trace stage's column layout (app/src/trace/columns.ts): the product's tree as columns along the focus's path, the
// focus's parent's, own and children's columns full width with every box one size, the columns above them compact, a
// count of what each box holds, each column scrolling on its own to show its chosen box.

describe('the Trace stage\'s columns', () => {
  it('LA-V98-R13-T01 A focus deep in a chain: a column for each box on its path down to its children, the box on the path chosen in each, the columns above its parent\'s compact', () => {
    const index = modelIndex();
    const map = traceMap(index, tracesOf(index, 'P'), 'P');
    const step = 'P-D-UC01-R01|P-D-UC01-FL01-S01';
    const columns = traceColumns(map, step);
    expect(columns.map((c) => c.parent)).toEqual(['P', 'outside', 'P-D', 'P-D-UC01', 'P-D-UC01-R01', 'P-D-UC01-R01|P-D-UC01-FL01', step]);
    expect(columns.map((c) => c.chosen)).toEqual(['outside', 'P-D', 'P-D-UC01', 'P-D-UC01-R01', 'P-D-UC01-R01|P-D-UC01-FL01', step, null]);
    // The last column is the focus's children; each column holds its parent's children, in the tree's order.
    expect(columns.at(-1)!.keys.map((k) => map.nodes.get(k)!.id)).toEqual(['P-D-CMD01', 'P-V01']);
    for (const c of columns) expect(c.keys).toEqual(map.map.nodes.get(c.parent)!.children);
    // A focus that holds nothing ends on its own column, chosen there.
    const leaf = traceColumns(map, 'P-D-UC01-R01|file:test/lend.test.ts');
    expect(leaf.at(-1)!.chosen).toBe('P-D-UC01-R01|file:test/lend.test.ts');
    // The step's parent's column (its flow's children), its own and its children's full width; every column above compact.
    const sizes = columnSizes(columns, step);
    expect(sizes.map((s) => s.compact)).toEqual([true, true, true, true, false, false, false]);
    const boxes = columnBoxes(columns, sizes, () => 0);
    expect(new Set(boxes.filter((b) => b.column >= 4).map((b) => `${b.w}x${b.h}`))).toEqual(new Set([`${COLUMN_WIDTH}x${BOX_HEIGHT}`]));
    expect(new Set(boxes.filter((b) => b.column < 4).map((b) => `${b.w}x${b.h}`))).toEqual(new Set([`${COMPACT_WIDTH}x${COMPACT_HEIGHT}`]));
    // Each column to the right of the one before, a gap apart.
    expect(boxes.filter((b) => b.row === 0).map((b) => b.x)).toEqual(columnLefts(sizes));
    expect(columnLefts(sizes)[4]).toBeGreaterThan(columnLefts(sizes)[3] + COMPACT_WIDTH);
    // A focus that holds nothing: its parent's column and its own full width.
    expect(columnSizes(leaf, 'P-D-UC01-R01|file:test/lend.test.ts').map((s) => s.compact)).toEqual([true, true, true, true, false, false]);
  });

  it('LA-V98-R13-T02 A box\'s count is how many boxes it holds', () => {
    const index = modelIndex();
    const map = traceMap(index, tracesOf(index, 'P'), 'P');
    expect(holds(map, 'P-D-UC01')).toBe(2);
    expect(holds(map, 'P-D-UC01-R01')).toBe(map.map.nodes.get('P-D-UC01-R01')!.children.length);
    expect(holds(map, UNTRACED)).toBe(map.counts.untraced);
    expect(holds(map, 'P-D-UC01-R01|file:test/lend.test.ts')).toBe(0);
  });

  it('LA-V98-R13-T03 A column taller than the stage scrolls its chosen box into view; the camera keeps the focus\'s column, its children and the parents that fit', () => {
    const keys = Array.from({ length: 40 }, (_, i) => `k${i}`);
    const view = 5 * BOX_HEIGHT;
    const column = { parent: 'p', keys, chosen: 'k30' };
    // Scrolled from the top just enough to show the chosen box whole at the bottom of the view.
    const full = [{ w: COLUMN_WIDTH, h: BOX_HEIGHT, compact: false }];
    const scroll = columnScrolls([column], full, view, new Map()).get('p')!;
    expect(rowTop(30) - scroll).toBeGreaterThanOrEqual(0);
    expect(rowTop(30) + BOX_HEIGHT - scroll).toBeCloseTo(view);
    // A scroll that already shows it is kept; one past the end is brought back within the column.
    expect(columnScrolls([column], full, view, new Map([['p', rowTop(28)]])).get('p')).toBe(rowTop(28));
    expect(columnScrolls([{ ...column, chosen: null }], full, view, new Map([['p', 1e6]])).get('p')).toBe(columnHeight(40) - view);
    // Only the boxes in view are placed, scrolled.
    const shown = columnBoxes([column], full, () => scroll, { top: 0, bottom: view });
    expect(shown.some((b) => b.key === 'k30' && b.y >= 0 && b.y + b.h <= view + 1e-9)).toBe(true);
    expect(shown.length).toBeLessThan(10);
    // Seven full columns in a frame that holds three: the last one ending at the frame's right, the earlier ones to the left.
    const seven = Array.from({ length: 7 }, () => full[0]);
    const lefts = columnLefts(seven);
    const frame = { x: 100, y: 50, w: lefts[3] + 2 * COLUMNS_PAD, h: 800 };
    const v = columnsView(seven, frame);
    expect((lefts[6] + COLUMN_WIDTH) * v.zoom + v.x).toBe(frame.x + frame.w - COLUMNS_PAD);
    expect(lefts[4] * v.zoom + v.x).toBeGreaterThan(frame.x);
    expect(v).toMatchObject({ y: frame.y + COLUMNS_PAD, zoom: 1 });
    // Columns that all fit start at the frame's left.
    expect(columnsView(seven.slice(0, 2), frame).x).toBe(frame.x + COLUMNS_PAD);
  });

  it('LA-V98-R13-T04 Focusing the product shows its children only', () => {
    const index = modelIndex();
    const map = traceMap(index, tracesOf(index, 'P'), 'P');
    const columns = traceColumns(map, 'P');
    expect(columns).toEqual([{ parent: 'P', keys: map.map.nodes.get('P')!.children, chosen: null }]);
  });
});
