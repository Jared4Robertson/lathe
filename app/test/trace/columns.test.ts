import { describe, expect, it } from 'vitest';
import { modelIndex } from '../fixtures/model';
import { traceMap } from '../../src/trace/tree';
import {
  BOX_HEIGHT, columnBoxes, columnHeight, columnLeft, columnScrolls, columnsThatFit, columnsView, COLUMNS_PAD, holds, rowTop, traceColumns,
} from '../../src/trace/columns';
import { UNTRACED } from '../../src/trace/top';

// The Trace stage's column layout (app/src/trace/columns.ts): the product's tree as columns along the focus's path, every
// box the same size, a count of what each holds, each column scrolling on its own to show its chosen box.

describe('the Trace stage\'s columns', () => {
  it('LA-V98-R13-T01 A focus deep in a chain: a column for each box on its path down to its children, the box on the path chosen in each', () => {
    const map = traceMap(modelIndex(), 'P');
    const step = 'P-D-UC01-R01|P-D-UC01-FL01-S01';
    const columns = traceColumns(map, step);
    expect(columns.map((c) => c.parent)).toEqual(['P', 'P-D', 'P-D-CAP01', 'P-D-UC01', 'P-D-UC01-R01', 'P-D-UC01-R01|P-D-UC01-FL01', step]);
    expect(columns.map((c) => c.chosen)).toEqual(['P-D', 'P-D-CAP01', 'P-D-UC01', 'P-D-UC01-R01', 'P-D-UC01-R01|P-D-UC01-FL01', step, null]);
    // The last column is the focus's children; each column holds its parent's children, in the tree's order.
    expect(columns.at(-1)!.keys.map((k) => map.nodes.get(k)!.id)).toEqual(['P-D-CMD01', 'P-V01']);
    for (const c of columns) expect(c.keys).toEqual(map.map.nodes.get(c.parent)!.children);
    // A focus that holds nothing ends on its own column, chosen there.
    const leaf = traceColumns(map, 'P-D-UC01-R01|file:test/lend.test.ts');
    expect(leaf.at(-1)!.chosen).toBe('P-D-UC01-R01|file:test/lend.test.ts');
    // Every box the same size, each column the same width and the next one to its right.
    const boxes = columnBoxes(columns, () => 0);
    expect(new Set(boxes.map((b) => `${b.w}x${b.h}`)).size).toBe(1);
    expect(boxes.filter((b) => b.row === 0).map((b) => b.x)).toEqual(columns.map((_, i) => columnLeft(i)));
  });

  it('LA-V98-R13-T02 A box\'s count is how many boxes it holds', () => {
    const map = traceMap(modelIndex(), 'P');
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
    const scroll = columnScrolls([column], view, new Map()).get('p')!;
    expect(rowTop(30) - scroll).toBeGreaterThanOrEqual(0);
    expect(rowTop(30) + BOX_HEIGHT - scroll).toBeCloseTo(view);
    // A scroll that already shows it is kept; one past the end is brought back within the column.
    expect(columnScrolls([column], view, new Map([['p', rowTop(28)]])).get('p')).toBe(rowTop(28));
    expect(columnScrolls([{ ...column, chosen: null }], view, new Map([['p', 1e6]])).get('p')).toBe(columnHeight(40) - view);
    // Only the boxes in view are placed, scrolled.
    const shown = columnBoxes([column], () => scroll, { top: 0, bottom: view });
    expect(shown.some((b) => b.key === 'k30' && b.y >= 0 && b.y + b.h <= view + 1e-9)).toBe(true);
    expect(shown.length).toBeLessThan(10);
    // Seven columns in a frame that holds three: the last three in view, the first of them at the frame's left.
    const frame = { x: 100, y: 50, w: columnLeft(3) + 2 * COLUMNS_PAD, h: 800 };
    expect(columnsThatFit(frame.w)).toBe(3);
    const v = columnsView(7, frame);
    expect(columnLeft(4) * v.zoom + v.x).toBe(frame.x + COLUMNS_PAD);
    expect(v).toMatchObject({ y: frame.y + COLUMNS_PAD, zoom: 1 });
    // Columns that all fit start at the frame's left.
    expect(columnsView(2, frame).x).toBe(frame.x + COLUMNS_PAD);
  });

  it('LA-V98-R13-T04 Focusing the product shows its children only', () => {
    const map = traceMap(modelIndex(), 'P');
    const columns = traceColumns(map, 'P');
    expect(columns).toEqual([{ parent: 'P', keys: map.map.nodes.get('P')!.children, chosen: null }]);
  });
});
