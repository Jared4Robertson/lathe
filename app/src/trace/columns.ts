// The barycenter ordering of the Trace stage's columns (LA-V98), pure, run in its worker (order.worker.ts): each
// column's boxes in an order that keeps linked boxes near. A box sits by the weighted median rank of the boxes it is
// linked to in the other columns, swept left to right and back a few times. The boxes under an outcome come first,
// those under none after them. A change moves only what it changed (LA-PAT-APP-UX-R22): given the order shown before,
// every box kept keeps its order and a new one goes in at its barycenter among them; only Tidy up (no order before)
// orders afresh.

/** How many times the order is swept each way. */
const SWEEPS = 4;

/** What the ordering reads: every box by number, its column and whether it is under an outcome, and the links between them. */
export interface OrderInput {
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
}

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
export function orderColumns(input: OrderInput): number[][] {
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
