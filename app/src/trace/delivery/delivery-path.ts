import { rowPath, standIn, type DeliveryGraph, type Row } from './delivery';
import type { DeliveryLaid } from './delivery-layout';

// What a selection lights in the Delivery view (LA-V98), pure: the record's path in each row it shows in (delivery.ts
// rowPath), as the boxes that show it now (a record in a closed box lit by the box standing in for it), the lines
// between them across the columns, and the serves links to its outcomes. A box that is no record (a status, a gap)
// lights nothing and fades nothing.

/** What a selection lights. */
export interface Lit {
  /** The selection's own box: the one the walk or a click stands on, else its first that shows; null when it shows in none. */
  box: string | null;
  /** The rows it shows in. */
  rows: readonly string[];
  /** The boxes kept at full strength; null keeps every box. */
  keys: ReadonlySet<string> | null;
  /** The lines of its path, each from a box to a box in a column to its right. */
  lines: readonly (readonly [string, string])[];
  /** The serves links on its path, as `<outcome>>`<use case>`. */
  serves: ReadonlySet<string>;
}

const NOTHING: Lit = { box: null, rows: [], keys: null, lines: [], serves: new Set() };

/** Each row's boxes by record (and a gap by its key), in the row's order, whatever shows. */
const boxesCache = new WeakMap<Row, Map<string, string[]>>();
function rowBoxes(graph: DeliveryGraph, row: Row): Map<string, string[]> {
  let known = boxesCache.get(row);
  if (known) return known;
  known = new Map();
  const add = (k: string, key: string) => (known!.get(k) ?? known!.set(k, []).get(k)!).push(key);
  const walk = (key: string) => {
    const item = graph.items.get(key)!;
    add(key, key);
    if (item.id && item.role !== 'hint') add(item.id, key);
    for (const c of item.children) walk(c);
  };
  for (const cell of row.cells) if (cell) walk(cell);
  boxesCache.set(row, known);
  return known;
}

/** What a record (or the box `at`) lights, on a layout. */
export function litBy(graph: DeliveryGraph, laid: DeliveryLaid, focus: string, at: string | null): Lit {
  const shown = laid.places;
  const atItem = at && shown.has(at) ? graph.items.get(at) : undefined;
  // A box that is no record (a status, a gap, a heading of no record) stands on its own.
  if (atItem && (atItem.id === null || (atItem.role === 'gap' && atItem.id !== focus))) return { ...NOTHING, box: at, rows: atItem.row ? [atItem.row] : [] };
  const outcome = `outcome/${focus}`;
  if (graph.items.has(outcome)) {
    const served = graph.serves.filter(([o]) => o === focus).map(([, u]) => u);
    const keys = new Set([outcome, ...served.map((u) => `${u}|use-case`)]);
    return { box: shown.has(outcome) ? outcome : null, rows: served, keys, lines: [], serves: new Set(served.map((u) => `${focus}>${u}`)) };
  }
  const rows = graph.rows.filter((r) => rowBoxes(graph, r).has(focus));
  if (rows.length === 0) return NOTHING;
  const has = { has: (k: string) => shown.has(k) };
  const keys = new Set<string>();
  const lines: [string, string][] = [];
  const seenLine = new Set<string>();
  const serves = new Set<string>();
  let box: string | null = atItem && atItem.id === focus ? at : null;
  for (const row of rows) {
    const boxes = rowBoxes(graph, row);
    const path = rowPath(row, [focus, ...(boxes.get(focus) ?? []).filter((k) => k !== focus)]);
    const on = path?.ids ?? new Set([focus]);
    /**
     * A record's (or a box's) boxes that show; or, when none does, the boxes standing in for them that are on the path
     * themselves (a step's view stands in by that step, not by another step in the same view), else the first.
     */
    const shownOf = (k: string): string[] => {
      const all = boxes.get(k) ?? [];
      const own = all.filter((key) => shown.has(key));
      if (own.length > 0) return own;
      const reps = [...new Set(all.map((key) => standIn(graph, key, has as ReadonlySet<string>)).filter((r): r is string => r !== null))];
      const onPath = reps.filter((r) => on.has(r) || on.has(graph.items.get(r)!.id ?? ''));
      return onPath.length > 0 ? onPath : reps.slice(0, 1);
    };
    box ??= shownOf(focus)[0] ?? null;
    for (const k of on) {
      if (graph.items.has(`outcome/${k}`)) { keys.add(`outcome/${k}`); serves.add(`${k}>${row.useCase}`); continue; }
      for (const key of shownOf(k)) keys.add(key);
    }
    // Each link from a box of its left end to a box of its right end in a column to the right, the nearest.
    for (const l of path?.links ?? []) {
      if (graph.items.has(`outcome/${l.from}`)) continue;
      let best: [string, string] | null = null;
      let span = Infinity;
      for (const a of shownOf(l.from)) for (const b of shownOf(l.to)) {
        const d = graph.items.get(b)!.column - graph.items.get(a)!.column;
        if (d > 0 && d < span) { span = d; best = [a, b]; }
      }
      if (!best) continue;
      const id = `${best[0]}>${best[1]}`;
      if (seenLine.has(id)) continue;
      seenLine.add(id);
      lines.push(best);
    }
  }
  if (box) keys.add(box);
  return { box, rows: rows.map((r) => r.useCase), keys, lines, serves };
}
