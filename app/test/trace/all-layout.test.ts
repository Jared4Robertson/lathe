import { describe, expect, it } from 'vitest';
import { BOX_HEIGHT, layOutColumns, NEAR_ROWS, OUTSIDE_GAP, ROW_GAP, type LayoutInput, type LayoutResult } from '../../src/trace/all-layout';

// Where the All-at-once view's boxes go (app/src/trace/all-layout.ts): an order per column that keeps linked boxes near,
// a place per box beside what it links to, the boxes under no outcome below the rest, and an order kept from the layout
// before (layout stability, principle P6).

/** An input from columns of names, the names under no outcome, and links "a>b". */
function input(columns: string[][], links: string[], outside: string[] = [], previous: string[][] | null = null): { input: LayoutInput; names: string[] } {
  const names = columns.flat();
  const at = (n: string) => names.indexOf(n);
  const columnOf = new Int32Array(names.length);
  columns.forEach((c, i) => c.forEach((n) => { columnOf[at(n)] = i; }));
  const under = new Uint8Array(names.map((n) => (outside.includes(n) ? 0 : 1)));
  const pairs = new Int32Array(links.flatMap((l) => l.split('>').map(at)));
  return { names, input: { columns: columns.map((c) => c.map(at)), columnOf, under, links: pairs, previous: previous ? previous.map((c) => c.map(at)) : null } };
}
/** The links that cross, between two adjacent columns, in an order. */
function crossings(order: number[][], links: Int32Array, columnOf: Int32Array): number {
  const rank = new Map<number, number>();
  order.forEach((c) => c.forEach((b, i) => rank.set(b, i)));
  const pairs: [number, number][] = [];
  for (let i = 0; i < links.length; i += 2) if (columnOf[links[i + 1]] - columnOf[links[i]] === 1) pairs.push([links[i], links[i + 1]]);
  let n = 0;
  for (const [a, b] of pairs) for (const [c, d] of pairs) if (columnOf[a] === columnOf[c] && (rank.get(a)! - rank.get(c)!) * (rank.get(b)! - rank.get(d)!) < 0) n++;
  return n / 2;
}

const COLUMNS = [['O1', 'O2'], ['U1', 'U2', 'U3'], ['R1', 'R2', 'R3', 'R4', 'R5', 'R6'], ['B1', 'B2'], ['T1', 'T2', 'T3', 'T4']];
// Each outcome's use cases and each use case's requirements far apart in ID order.
const LINKS = ['O1>U3', 'O2>U1', 'O2>U2', 'U1>R6', 'U1>R5', 'U2>R4', 'U3>R1', 'U3>R2', 'U2>R3', 'R6>B1', 'R1>B2', 'R6>T1', 'R5>T2', 'R1>T3', 'R2>T4'];

describe('the All-at-once layout', () => {
  it('LA-V98-R02-T04 orders each column to keep linked boxes near, places no two boxes of a column closer than a row, and puts what no outcome reaches below the rest', () => {
    const { input: base } = input(COLUMNS, LINKS);
    const laid = layOutColumns(base);
    expect(crossings(laid.order, base.links, base.columnOf)).toBeLessThan(crossings(base.columns, base.links, base.columnOf));
    expect(crossings(laid.order, base.links, base.columnOf)).toBe(0);
    for (const c of laid.order) for (let i = 1; i < c.length; i++) expect(laid.y[c[i]] - laid.y[c[i - 1]]).toBeGreaterThanOrEqual(BOX_HEIGHT + ROW_GAP - 1e-9);
    // A box sits beside what it links to: the outcome by its use cases, a requirement by its test.
    const { names, input: withOutside } = input([...COLUMNS.slice(0, 2), [...COLUMNS[2], 'R9'], ...COLUMNS.slice(3)], [...LINKS], ['R9']);
    const more = layOutColumns(withOutside);
    const y = (n: string) => more.y[names.indexOf(n)];
    expect(y('R6')).toBeCloseTo(y('T1'), 5);
    // R9, under no outcome, below every box under one, under the mark's gap.
    expect(more.outsideTop).not.toBeNull();
    expect(y('R9')).toBeGreaterThanOrEqual(more.outsideTop!);
    for (const n of names.filter((x) => x !== 'R9')) expect(y(n) + BOX_HEIGHT).toBeLessThan(more.outsideTop!);
    expect(more.order[2].at(-1)).toBe(names.indexOf('R9'));
    expect(laid.outsideTop).toBeNull();
  });

  it('LA-V98-R12-T02 given the order before, every box kept keeps its order and a new one goes in by what it links to; with none, the columns are ordered afresh', () => {
    const { names, input: first } = input(COLUMNS, LINKS);
    const before = layOutColumns(first).order.map((c) => c.map((b) => names[b]));
    // The order before, its tests' column turned round, as an earlier layout might have left it: kept as it was.
    const shown = before.map((c, i) => (i === 4 ? [...c].reverse() : c));
    // A new requirement of U3's, linked to its test.
    const columns = [...COLUMNS.slice(0, 2), [...COLUMNS[2], 'R7'], ...COLUMNS.slice(3)];
    const { names: now, input: next } = input(columns, [...LINKS, 'U3>R7'], [], shown);
    const kept = layOutColumns(next).order.map((c) => c.map((b) => now[b]));
    expect(kept[2].filter((n) => n !== 'R7')).toEqual(shown[2]);
    for (const i of [0, 1, 3, 4]) expect(kept[i]).toEqual(shown[i]);
    expect(kept[4]).not.toEqual(before[4]);
    // R7 goes in among U3's own requirements.
    const at = kept[2].indexOf('R7');
    expect(['R1', 'R2']).toContain(kept[2][at - 1] ?? kept[2][at + 1]);
    // Tidy up: no order before, the columns ordered afresh.
    const { names: fresh, input: tidy } = input(columns, [...LINKS, 'U3>R7']);
    const afresh = layOutColumns(tidy).order.map((c) => c.map((b) => fresh[b]));
    expect(afresh[4]).not.toEqual(kept[4]);
  });

  /** An input laid out after a layout of `names` before: every box kept at its top there, by name. */
  const after = (columns: string[][], links: string[], outside: string[], names: string[], was: LayoutResult) => {
    const made = input(columns, links, outside, was.order.map((c) => c.map((b) => names[b]).filter((n) => columns.flat().includes(n))));
    const y = new Float64Array(made.names.length).fill(NaN);
    made.names.forEach((n, i) => { const at = names.indexOf(n); if (at >= 0) y[i] = was.y[at]; });
    made.input.kept = { y, outsideTop: was.outsideTop };
    return { ...made, laid: layOutColumns(made.input) };
  };

  it('LA-V98-R12-T04 a change keeps every other box at its place: a new box in the nearest free gap beside what it links to, else at the bottom of its column; a removed one leaves its gap; Tidy up lays out afresh', () => {
    const { names, input: first } = input(COLUMNS, LINKS);
    const was = layOutColumns(first);
    const top = (laid: LayoutResult, all: string[], n: string) => laid.y[all.indexOf(n)];
    const still = (laid: LayoutResult, all: string[], except: string[] = []) => names.filter((n) => all.includes(n) && !except.includes(n) && top(laid, all, n) !== top(was, names, n));

    // Removing T2: every other box keeps its place, T2's gap left open.
    const removed = COLUMNS.map((c) => c.filter((n) => n !== 'T2'));
    const gone = after(removed, LINKS.filter((l) => !l.includes('T2')), [], names, was);
    expect(still(gone.laid, gone.names)).toEqual([]);

    // Then a new test of R5's: it takes T2's gap, beside R5, and nothing else moves.
    const back = after([...removed.slice(0, 4), [...removed[4], 'T9']], [...LINKS.filter((l) => !l.includes('T2')), 'R5>T9'], [], gone.names, gone.laid);
    expect(still(back.laid, back.names, ['T9'])).toEqual([]);
    expect(top(back.laid, back.names, 'T9')).toBe(top(was, names, 'T2'));

    // A new requirement of U1's where its column has no free gap near: at the bottom of its column, its line drawn.
    const full = after([...COLUMNS.slice(0, 2), [...COLUMNS[2], 'R7'], ...COLUMNS.slice(3)], [...LINKS, 'U1>R7'], [], names, was);
    expect(still(full.laid, full.names, ['R7'])).toEqual([]);
    const r = COLUMNS[2].map((n) => top(was, names, n));
    expect(top(full.laid, full.names, 'R7')).toBe(Math.max(...r) + BOX_HEIGHT + ROW_GAP);
    expect(Math.abs(top(full.laid, full.names, 'R7') - top(was, names, 'U1'))).toBeGreaterThan(NEAR_ROWS * (BOX_HEIGHT + ROW_GAP) - 1);

    // A new box under an outcome that reaches the boxes under none pushes them down together, by as much as it overlaps.
    const withOutside = [...COLUMNS.slice(0, 2), [...COLUMNS[2], 'R9'], ...COLUMNS.slice(3)];
    const { names: n2, input: i2 } = input(withOutside, LINKS, ['R9']);
    const was2 = layOutColumns(i2);
    const pushed = after([...withOutside.slice(0, 2), [...withOutside[2], 'R7'], ...withOutside.slice(3)], [...LINKS, 'U1>R7'], ['R9'], n2, was2);
    const r7 = top(pushed.laid, pushed.names, 'R7');
    expect(pushed.laid.outsideTop).toBe(Math.max(was2.outsideTop!, r7 + BOX_HEIGHT + OUTSIDE_GAP));
    expect(top(pushed.laid, pushed.names, 'R9') - top(was2, n2, 'R9')).toBe(pushed.laid.outsideTop! - was2.outsideTop!);

    // Tidy up: no places before, the columns laid out afresh.
    const fresh = input([...COLUMNS.slice(0, 2), [...COLUMNS[2], 'R7'], ...COLUMNS.slice(3)], [...LINKS, 'U1>R7']);
    expect(layOutColumns(fresh.input).y[fresh.names.indexOf('R7')]).not.toBe(top(full.laid, full.names, 'R7'));
  });
});
