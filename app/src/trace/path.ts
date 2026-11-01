import type { TraceJourney } from '../../../lathe/src/traceability/trace/read-model';
import { journeyBox, rowPath, standIn, type TraceGraph, type Row } from './trace';
import type { TraceLaid } from './layout';

// What a selection lights on the Trace stage (LA-V98), pure: the record's path in each row it shows in (trace.ts
// rowPath), as the boxes that show it now (a record in a closed box lit by the box standing in for it), the lines
// between them across the columns, and the links to its outcomes and journeys (each journey carrying out a row on the
// path, with its line to that row). A journey (LA-V98-R25) lights its boxes, its outcomes and the use case of each row
// its steps carry out, in its order, with its lines; one of its steps lights the journey, itself and its row. A box that
// is no record (a status, a gap) lights nothing and fades nothing.

/** What a selection lights. */
export interface Lit {
  /** The selection's own box: the one the walk or a click stands on, else its first that shows; null when it shows in none. */
  box: string | null;
  /** The rows it shows in; a journey's, in its order. */
  rows: readonly string[];
  /** The boxes kept at full strength; null keeps every box. */
  keys: ReadonlySet<string> | null;
  /** The lines of its path, each from a box to a box in a column to its right. */
  lines: readonly (readonly [string, string])[];
  /** The links on its path to the left of its rows, as `<from>><to>`: an outcome's to a use case or a journey, a journey's to a use case. */
  links: ReadonlySet<string>;
}

const NOTHING: Lit = { box: null, rows: [], keys: null, lines: [], links: new Set() };

/** What a journey lights, or one of its steps or its test (`focus`): see the header. */
function journeyLit(graph: TraceGraph, laid: TraceLaid, j: TraceJourney, focus: string, at: string | null): Lit {
  const shown = laid.places;
  // The journey itself or its test lights the whole journey; a step, itself and its row.
  const whole = focus === j.id || focus === j.test;
  const carries = graph.carries.filter((c) => c.journey === j.id && (whole || c.step === focus));
  const rows = [...new Set(carries.map((c) => c.useCase))];
  const own = journeyBox(j.id);
  const keys = new Set<string>([own]);
  const walk = (key: string) => {
    const item = graph.items.get(key)!;
    if (shown.has(key) && (whole || item.id === focus)) keys.add(key);
    for (const c of item.children) walk(c);
  };
  walk(own);
  for (const u of rows) keys.add(`${u}|use-case`);
  const links = new Set(rows.map((u) => `${j.id}>${u}`));
  if (whole) for (const o of j.outcomes) if (graph.items.has(`outcome/${o}`)) { keys.add(`outcome/${o}`); links.add(`${o}>${j.id}`); }
  const box = at && shown.has(at) && graph.items.get(at)?.id === focus ? at : (graph.boxesOf.get(focus) ?? []).find((k) => shown.has(k)) ?? (shown.has(own) ? own : null);
  if (box) keys.add(box);
  return { box, rows, keys, lines: [], links };
}

/** Each row's boxes by record (and a gap by its key), in the row's order, whatever shows. */
const boxesCache = new WeakMap<Row, Map<string, string[]>>();
function rowBoxes(graph: TraceGraph, row: Row): Map<string, string[]> {
  let known = boxesCache.get(row);
  if (known) return known;
  known = new Map();
  const add = (k: string, key: string) => (known!.get(k) ?? known!.set(k, []).get(k)!).push(key);
  const walk = (key: string) => {
    const item = graph.items.get(key)!;
    add(key, key);
    // A step's heading over its chain is the step's second box: lit with it, never where its lines start or end.
    if (item.id && item.role === 'heading') add(`heading:${item.id}`, key);
    else if (item.id && item.role !== 'hint') add(item.id, key);
    for (const c of item.children) walk(c);
  };
  for (const cell of row.cells) if (cell) walk(cell);
  boxesCache.set(row, known);
  return known;
}

/** What a record (or the box `at`) lights, on a layout. */
export function litBy(graph: TraceGraph, laid: TraceLaid, focus: string, at: string | null): Lit {
  const shown = laid.places;
  const atItem = at && shown.has(at) ? graph.items.get(at) : undefined;
  // A box that is no record (a status, a gap, a heading of no record) stands on its own.
  if (atItem && (atItem.id === null || (atItem.role === 'gap' && atItem.id !== focus))) return { ...NOTHING, box: at, rows: atItem.row ? [atItem.row] : [] };
  const outcome = `outcome/${focus}`;
  if (graph.items.has(outcome)) {
    const served = graph.serves.filter(([o]) => o === focus).map(([, u]) => u);
    const journeys = graph.journeyServes.filter(([o]) => o === focus).map(([, j]) => j);
    const keys = new Set([outcome, ...served.map((u) => `${u}|use-case`), ...journeys.map(journeyBox)]);
    return { box: shown.has(outcome) ? outcome : null, rows: served, keys, lines: [], links: new Set([...served, ...journeys].map((x) => `${focus}>${x}`)) };
  }
  const journey = graph.journeyOf.get(focus);
  if (journey) return journeyLit(graph, laid, journey, focus, at);
  const rows = graph.rows.filter((r) => rowBoxes(graph, r).has(focus));
  if (rows.length === 0) return NOTHING;
  const has = { has: (k: string) => shown.has(k) };
  const keys = new Set<string>();
  const lines: [string, string][] = [];
  const seenLine = new Set<string>();
  const links = new Set<string>();
  let box: string | null = atItem && atItem.id === focus ? at : null;
  for (const row of rows) {
    const boxes = rowBoxes(graph, row);
    const path = rowPath(row, [focus, ...[...(boxes.get(focus) ?? []), ...(boxes.get(`heading:${focus}`) ?? [])].filter((k) => k !== focus)]);
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
    box ??= shownOf(focus)[0] ?? boxes.get(`heading:${focus}`)?.find((k) => shown.has(k)) ?? null;
    for (const k of on) {
      if (graph.items.has(`outcome/${k}`)) { keys.add(`outcome/${k}`); links.add(`${k}>${row.useCase}`); continue; }
      for (const key of shownOf(k)) keys.add(key);
      for (const key of boxes.get(`heading:${k}`) ?? []) if (shown.has(key)) keys.add(key);
    }
    // Each journey carrying out the row's use case, when it is on the path: its box, the steps' boxes that show, its line.
    if (on.has(row.useCase)) for (const c of graph.carries) {
      if (c.useCase !== row.useCase) continue;
      keys.add(journeyBox(c.journey));
      for (const key of graph.boxesOf.get(c.step) ?? []) if (shown.has(key)) keys.add(key);
      links.add(`${c.journey}>${c.useCase}`);
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
  return { box, rows: rows.map((r) => r.useCase), keys, lines, links };
}
