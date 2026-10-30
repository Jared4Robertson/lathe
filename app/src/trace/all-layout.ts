// Where each box of the All-at-once view goes (LA-V98), pure, run in its worker (all-layout.worker.ts) or, where there is
// none, on the page: one order per column and one place per box, every box the same size.
//
// Order: each column's boxes in an order that keeps linked boxes near (barycenter ordering): a box sits by the median
// rank of the boxes it is linked to in the other columns, swept left to right and back a few times. The boxes under an
// outcome come first, those under none after them.
//
// Places: the tallest column is packed from the top; every other column, from the columns next to it already placed,
// puts each box at the median height of the boxes it is linked to, never closer than a row to the box above it, so a box
// sits beside what it links to. The boxes under no outcome are placed the same way below a gap, from one top line
// shared by every column, under the mark "Not under an outcome".
//
// A change moves only what it changed (LA-PAT-APP-UX-R22): given the places shown before (`kept`), every box kept keeps
// its exact place; a new one goes in the nearest free gap in its column beside what it links to, if one lies within a
// few rows, else at the bottom of its column, its lines drawn to it; a removed one leaves its gap. Only when a new box at
// the bottom of a column under an outcome reaches the boxes under none are those pushed down, all together, by as much
// as it now overlaps them. Everything goes to its proper place only on Tidy up (no `kept`).

/** A box's width and height, the gap between two rows and the room between two columns, where the links run, at zoom 1. */
export const BOX_WIDTH = 272;
export const BOX_HEIGHT = 84;
export const ROW_GAP = 8;
export const LINK_GAP = 120;
/** The gap above the boxes under no outcome, which holds their mark. */
export const OUTSIDE_GAP = 96;
const PITCH = BOX_HEIGHT + ROW_GAP;
/** How many times the order is swept each way. */
const SWEEPS = 4;

/** The columns each column's links reach: outcomes to use cases, use cases to obligations, obligations to what builds and proves them. */
const LINKED: readonly (readonly number[])[] = [[1], [0, 2], [1, 3, 4], [2], [2]];

/** A column's left edge. */
export const columnLeft = (column: number) => column * (BOX_WIDTH + LINK_GAP);

/** What the layout reads: every box by number, its column and whether it is under an outcome, and the links between them. */
export interface LayoutInput {
  /** Each column's boxes by number, in their base order (ID order). */
  columns: number[][];
  /** Each box's column. */
  columnOf: Int32Array;
  /** 1 for a box under an outcome. */
  under: Uint8Array;
  /** The links, two numbers each: from, to. */
  links: Int32Array;
  /** The order shown before, by box number, each column's boxes top to bottom; null orders afresh. */
  previous: number[][] | null;
  /** The places shown before: each box's top (NaN for a box not shown before, or shown in another column or section) and the top of the boxes under no outcome; null (Tidy up) places afresh. */
  kept?: { y: Float64Array; outsideTop: number | null } | null;
}

/** Where each box goes: each column's boxes top to bottom, each box's top, the top of the boxes under no outcome (null when there are none), and the whole height. */
export interface LayoutResult { order: number[][]; y: Float64Array; outsideTop: number | null; height: number }

/**
 * The weighted median of some values, each [value, weight]: a box sits by most of what it links to, not pulled off by a
 * few far ones, and a box linked to many (a rule every use case reaches) weighs less than one linked to it alone (its
 * own requirement), so a use case sits by its own requirements.
 */
function median(values: [number, number][]): number {
  values.sort((a, b) => a[0] - b[0]);
  const half = values.reduce((s, v) => s + v[1], 0) / 2;
  let run = 0;
  for (const [v, w] of values) { run += w; if (run >= half - 1e-12) return v; }
  return values[values.length - 1][0];
}

/** Each box's neighbors in the other columns, by number. */
function neighborsOf(n: number, links: Int32Array): number[][] {
  const out: number[][] = Array.from({ length: n }, () => []);
  for (let i = 0; i < links.length; i += 2) { out[links[i]].push(links[i + 1]); out[links[i + 1]].push(links[i]); }
  return out;
}

/** Sorts a column by a value per box, the boxes under an outcome first, stable for equal values. */
function sortBy(column: readonly number[], value: Float64Array, under: Uint8Array): number[] {
  return column.map((b, i) => ({ b, i })).sort((a, z) => under[z.b] - under[a.b] || value[a.b] - value[z.b] || a.i - z.i).map((x) => x.b);
}

/** The order of every column. */
export function orderColumns(input: LayoutInput): number[][] {
  const n = input.columnOf.length;
  const near = neighborsOf(n, input.links);
  const rank = new Float64Array(n);
  const place = (order: readonly (readonly number[])[]) => order.forEach((c) => c.forEach((b, i) => { rank[b] = (i + 0.5) / c.length; }));
  const bary = new Float64Array(n);
  /** Each box's barycenter over its neighbors in the columns `from` takes, or its own rank when it has none there. */
  const center = (column: readonly number[], from: (c: number) => boolean) => {
    for (const b of column) {
      const values: [number, number][] = [];
      for (const m of near[b]) if (from(input.columnOf[m])) values.push([rank[m], 1 / near[m].length]);
      bary[b] = values.length > 0 ? median(values) : rank[b];
    }
  };

  if (input.previous) {
    // Every box kept keeps its order; a new one goes in at its barycenter among them, in its section.
    const kept = input.columns.map((column, c) => {
      const present = new Set(column);
      const was = (input.previous![c] ?? []).filter((b) => present.has(b) && input.columnOf[b] === c);
      const at = new Float64Array(n);
      was.forEach((b, i) => { at[b] = i; });
      return sortBy(was, at, input.under);
    });
    place(kept);
    return input.columns.map((column, c) => {
      const own = new Set(kept[c]);
      const added = column.filter((b) => !own.has(b));
      if (added.length === 0) return kept[c];
      center(added, (cc) => cc !== c);
      const fresh = sortBy(added, bary, input.under);
      // Merged by section, then by the kept boxes' ranks against the new boxes' barycenters.
      const out: number[] = [];
      let i = 0;
      let j = 0;
      const before = (k: number, a: number) => input.under[k] > input.under[a] || (input.under[k] === input.under[a] && rank[k] <= bary[a]);
      while (i < kept[c].length || j < fresh.length) {
        if (j >= fresh.length || (i < kept[c].length && before(kept[c][i], fresh[j]))) out.push(kept[c][i++]);
        else out.push(fresh[j++]);
      }
      return out;
    });
  }

  let order = input.columns.map((c) => sortBy(c, new Float64Array(n), input.under));
  place(order);
  const last = order.length - 1;
  for (let s = 0; s < SWEEPS; s++) {
    for (let c = 1; c <= last; c++) { center(order[c], (cc) => cc < c); order[c] = sortBy(order[c], bary, input.under); place(order); }
    for (let c = last - 1; c >= 0; c--) { center(order[c], (cc) => cc > c); order[c] = sortBy(order[c], bary, input.under); place(order); }
  }
  // A last pass over every column by all its neighbors, so a column between two settles between them.
  order = order.map((c, i) => { center(c, (cc) => cc !== i); return sortBy(c, bary, input.under); });
  return order;
}

/** Each box's top, from the order. */
export function placeColumns(input: LayoutInput, order: readonly (readonly number[])[]): Omit<LayoutResult, 'order'> {
  const n = input.columnOf.length;
  const near = neighborsOf(n, input.links);
  const y = new Float64Array(n);
  const placed = new Uint8Array(n);
  const columns = order.length;
  /** Places one section (under an outcome, or not) of every column from a top line. */
  const section = (under: 0 | 1, top: number): number => {
    const parts = order.map((c) => c.filter((b) => input.under[b] === under));
    if (parts.every((p) => p.length === 0)) return top;
    // The tallest column first, packed; then outward from it to its neighbors, each from those already placed.
    let first = 0;
    parts.forEach((p, c) => { if (p.length > parts[first].length) first = c; });
    const done = new Set<number>();
    const queue = [first];
    let bottom = top;
    while (queue.length > 0 || done.size < columns) {
      const c = queue.length > 0 ? queue.shift()! : [...Array(columns).keys()].find((x) => !done.has(x))!;
      if (done.has(c)) continue;
      done.add(c);
      let at = top - PITCH;
      for (const b of parts[c]) {
        const values: [number, number][] = [];
        if (c !== first) for (const m of near[b]) if (placed[m] && input.under[m] === under) values.push([y[m], 1 / near[m].length]);
        const want = values.length > 0 ? median(values) : at + PITCH;
        at = Math.max(want, at + PITCH, top);
        y[b] = at;
        placed[b] = 1;
      }
      if (parts[c].length > 0) bottom = Math.max(bottom, at + BOX_HEIGHT);
      // The columns linked to it next.
      for (const next of LINKED[c] ?? []) if (next < columns && !done.has(next)) queue.push(next);
    }
    return bottom;
  };
  const end = section(1, 0);
  const anyOutside = order.some((c) => c.some((b) => input.under[b] === 0));
  const outsideTop = anyOutside ? (end > 0 ? end + OUTSIDE_GAP : OUTSIDE_GAP) : null;
  const height = outsideTop === null ? end : section(0, outsideTop);
  return { y, outsideTop, height };
}

/** How many rows from where it would sit beside what it links to a new box looks for a free gap, before it goes to the bottom of its column. */
export const NEAR_ROWS = 3;

/**
 * Each box's top, keeping every box shown before at its place (`input.kept`): a new box in the nearest free gap of its
 * column beside what it links to, within NEAR_ROWS rows, else at the bottom of its column in its section. New boxes are
 * placed column by column in `order`, each by the boxes already placed. The boxes under no outcome move only when a
 * new box under one now overlaps them, all by the same amount. The order returned is each column's boxes top to bottom.
 */
export function placeKept(input: LayoutInput, order: readonly (readonly number[])[]): LayoutResult {
  const kept = input.kept!;
  const n = input.columnOf.length;
  const near = neighborsOf(n, input.links);
  const y = new Float64Array(n);
  const placed = new Uint8Array(n);
  const isKept = (b: number) => Number.isFinite(kept.y[b]);
  // The bottom of the boxes under an outcome as they were (what the boxes under none sat below).
  let underEnd = 0;
  for (let b = 0; b < n; b++) if (isKept(b) && input.under[b] === 1) underEnd = Math.max(underEnd, kept.y[b] + BOX_HEIGHT);
  if (kept.outsideTop !== null) underEnd = Math.max(underEnd, kept.outsideTop - OUTSIDE_GAP);
  for (let b = 0; b < n; b++) if (isKept(b)) { y[b] = kept.y[b]; placed[b] = 1; }

  /** Places one section's new boxes between `top` and `bottom` (where a column's own bottom may run past). */
  const section = (under: 0 | 1, top: number, bottom: number) => {
    order.forEach((column, c) => {
      const tops = column.filter((b) => placed[b] && input.under[b] === under).map((b) => y[b]);
      for (const b of column) {
        if (placed[b] || input.under[b] !== under) continue;
        const values: [number, number][] = [];
        for (const m of near[b]) if (placed[m] && input.under[m] === under && input.columnOf[m] !== c) values.push([y[m], 1 / near[m].length]);
        const free = (at: number) => at >= top && at + BOX_HEIGHT <= bottom && tops.every((t) => Math.abs(t - at) >= PITCH - 1e-9);
        let at: number | null = null;
        if (values.length > 0) {
          const want = Math.max(top, median(values));
          // The nearest free place to `want`: itself, or a row's pitch off a box of the column.
          const candidates = [want, ...tops.flatMap((t) => [t - PITCH, t + PITCH])]
            .filter((v) => Math.abs(v - want) <= NEAR_ROWS * PITCH + 1e-9 && free(v))
            .sort((p, q) => Math.abs(p - want) - Math.abs(q - want) || p - q);
          at = candidates[0] ?? null;
        } else if (tops.length === 0 && bottom - top >= BOX_HEIGHT) at = top;
        // Else the bottom of its column in its section.
        if (at === null) at = tops.length === 0 ? top : Math.max(...tops) + PITCH;
        y[b] = at;
        placed[b] = 1;
        tops.push(at);
      }
    });
    let end = top;
    for (let b = 0; b < n; b++) if (input.under[b] === under) end = Math.max(end, y[b] + BOX_HEIGHT);
    return end;
  };

  const end = Math.max(section(1, 0, underEnd), underEnd);
  const anyOutside = order.some((c) => c.some((b) => input.under[b] === 0));
  let outsideTop: number | null = null;
  let height = end;
  if (anyOutside) {
    const wasTop = kept.outsideTop ?? end + OUTSIDE_GAP;
    // A new box under an outcome that now reaches the boxes under none pushes them down together, by as much as it overlaps.
    const shift = Math.max(0, end + OUTSIDE_GAP - wasTop);
    for (let b = 0; b < n; b++) if (placed[b] && input.under[b] === 0) y[b] += shift;
    outsideTop = wasTop + shift;
    let outsideEnd = outsideTop;
    for (let b = 0; b < n; b++) if (placed[b] && input.under[b] === 0) outsideEnd = Math.max(outsideEnd, y[b] + BOX_HEIGHT);
    height = Math.max(end, section(0, outsideTop, outsideEnd));
  }
  const byTop = order.map((c) => [...c].sort((a, b) => input.under[b] - input.under[a] || y[a] - y[b]));
  return { order: byTop, y, outsideTop, height };
}

/** The whole layout: the order (kept from `previous` when given), then the places (kept from `kept` when given). */
export function layOutColumns(input: LayoutInput): LayoutResult {
  const order = orderColumns(input);
  if (input.kept && input.kept.y.some((v) => Number.isFinite(v))) return placeKept(input, order);
  return { order, ...placeColumns(input, order) };
}
