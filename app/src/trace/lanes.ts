import { byIdOrder, type SpecIndex } from '../specs/data';
import { isTestKind } from '../specs/parts';
import { treeParent } from '../graph/tree';
import type { MapRect } from '../graph/camera';
import { faintest, keptFade, type Fade, type FadeLook } from '../graph/fade';
import { onePerData } from '../graph/one-map';
import { fileKey, obligationsUnder, traceChain, untracedUnder, type GapColumn, type TraceRow } from './chain';

// The Trace stage's map (LA-V98), pure and tested directly: one map per product, laid out once per
// product and data change in map units, left to right, that the stage navigates (LA-PAT-APP-UX-R19).
//
// - On the left the "why" tree, from the product's business outcomes: a capability serving several
//   repeated under each, marked "Also serves" the others, then its use cases; an obligation with no
//   capability hangs from its own parent (an aggregate, a view, a pattern), one with neither from no
//   tree, after the tree. Each parent is as tall as the lanes beneath it (the graph's Tree rule).
// - On the right one lane per obligation in the tree's order: its chain across the columns after it,
//   flow → step → design → build → tests → files, boxes in stage colors and arrows for the chain's
//   actual links (TraceRow.links). Each gap coverage reports (not designed, not built, not proved) is
//   a dashed box in its column. A record held by several lanes is repeated in each, with "In N lanes"
//   on each copy; an obligation whose capability serves several outcomes has a lane under each.
// - At the bottom the Untraced lane: the records coverage reports untraced (record-untraced).
//
// Focusing anything moves the camera to frame it (traceFocus) and fades what is not under it; Gaps
// only fades the complete lanes (traceFade). Nothing here depends on the focus or a filter, so no box
// ever moves. Boxes share one size, a tree box as tall as the lanes beneath it. Columns no box uses
// are left out. The lanes are kept in order, top to bottom, so the canvas finds what is in view by
// halving (visibleIn, lanesIn) and draws only that.

/** The Trace stage's columns, left to right: why, the obligation, then its chain. */
export type LaneColumn = 'outcome' | 'capability' | 'parent' | 'obligation' | 'flow' | 'step' | 'design' | 'build' | 'tests' | 'files';
export const LANE_COLUMNS: readonly LaneColumn[] = ['outcome', 'capability', 'parent', 'obligation', 'flow', 'step', 'design', 'build', 'tests', 'files'];
export const LANE_COLUMN_LABELS: Record<LaneColumn, string> = {
  outcome: 'Outcome', capability: 'Capability', parent: 'Use case or parent', obligation: 'Obligation', flow: 'Flow', step: 'Step', design: 'Design', build: 'Build', tests: 'Tests', files: 'Files',
};

/** A box's size, in map units at text scale 1; the gaps between columns, between boxes stacked in a column, and between lanes. */
export const BOX_W = 250;
export const BOX_H = 76;
export const COLUMN_GAP = 48;
export const ROW_GAP = 12;
export const LANE_GAP = 24;

/** What a box is: a record, a file a record names, a gap, or the Untraced lane's head. */
export type BoxRole = 'record' | 'file' | 'gap' | 'untraced';

export interface TraceBox {
  /** Unique in the map, and its place for the fade (fade.ts): a record repeated in several lanes has a box in each. */
  key: string;
  /** The record it is (every copy shares it), `file:<path>`, `gap:<lane>:<column>`, or `untraced`. */
  id: string;
  role: BoxRole;
  column: LaneColumn;
  /** The lane it sits in, or -1 for a box of the "why" tree, which spans the lanes beneath it. */
  lane: number;
  x: number; y: number; w: number; h: number;
  /** The record a click opens: itself, the first record naming a file; null for a gap or the Untraced head. */
  opens: string | null;
  /** Muted lines after its title: the outcomes a capability serves, how many lanes hold a record. */
  notes: string[];
  /** A file's path, a gap's or the Untraced head's words; a record's come from the record. */
  words?: { title: string; meta: string };
}

/** An arrow between two boxes: the chain's actual link, or a tree's parent line. */
export interface TraceLine {
  key: string;
  /** The ids of its ends (shared by copies), for the hover spotlight. */
  source: string;
  target: string;
  /** The keys of the boxes it joins: its places for the fade. */
  from: string;
  to: string;
  /** A tree's parent line (level and plain) rather than a chain's arrow. */
  tree: boolean;
  points: [{ x: number; y: number }, { x: number; y: number }];
}

export interface TraceLane {
  /** The obligation it traces, or null for the Untraced lane. */
  obligation: string | null;
  top: number;
  height: number;
  /** Where its boxes start and end, left to right: its bar's extent far out. */
  left: number;
  right: number;
  boxes: TraceBox[];
  lines: TraceLine[];
  /** Its gaps (TraceRow's): the columns coverage reports missing. */
  gaps: GapColumn[];
}

/** One product's Trace map. */
export interface TraceMap {
  product: string;
  lanes: TraceLane[];
  /** The "why" tree's boxes and lines, which span lanes. */
  tree: { boxes: TraceBox[]; lines: TraceLine[] };
  /** The columns drawn, left to right, each with its left edge. */
  columns: { column: LaneColumn; x: number }[];
  width: number;
  height: number;
  /** How many obligations it traces, how many of those have a gap, and how many records are untraced. */
  counts: { obligations: number; withGaps: number; untraced: number };
  /** Every box of a record or file, the tree's first, then lane by lane. */
  copies: ReadonlyMap<string, readonly TraceBox[]>;
  /** The lanes of each obligation, in order: several when its capability serves several outcomes. */
  lanesOf: ReadonlyMap<string, readonly number[]>;
  /** Each place's lanes, the first and the last: a lane box's (and a lane's bar, `lane:<n>`) its own; a tree box's those beneath it. */
  places: ReadonlyMap<string, readonly [number, number]>;
}

/** A step of the "why" tree above an obligation, with its notes. */
interface Why { id: string; column: 'outcome' | 'capability' | 'parent'; notes: string[] }

const STRUCTURE: ReadonlySet<string> = new Set(['product', 'domain']);
const linkedOut = (index: SpecIndex, id: string, relation: string) => (index.outgoing.get(id) ?? []).filter((l) => l.relation === relation).map((l) => l.target);
const titleOf = (index: SpecIndex, id: string) => index.byId.get(id)?.title ?? id;

/** Why an obligation is there: its capability and use case, or its parent (an aggregate, a view, a pattern); and the outcomes its capability serves. */
function whyOf(index: SpecIndex, obligation: string): { chain: { id: string; column: 'capability' | 'parent' }[]; outcomes: string[] } {
  const record = index.byId.get(obligation);
  const parent = record?.parent ? index.byId.get(record.parent) : undefined;
  if (!record || !parent || STRUCTURE.has(parent.kind)) return { chain: [], outcomes: [] };
  if (record.kind === 'uc_requirement' && parent.kind === 'use_case') {
    const capability = parent.parent ? index.byId.get(parent.parent) : undefined;
    if (capability?.kind === 'capability') {
      const outcomes = linkedOut(index, capability.id, 'serves').filter((o) => index.byId.has(o)).sort((a, b) => byIdOrder({ id: a }, { id: b }));
      return { chain: [{ id: capability.id, column: 'capability' }, { id: parent.id, column: 'parent' }], outcomes };
    }
  }
  return { chain: [{ id: parent.id, column: 'parent' }], outcomes: [] };
}

/** "Serves Lend more, Keep things": a capability's outcomes as a note on its box. */
const servesNote = (index: SpecIndex, outcomes: readonly string[], also = false) => (outcomes.length === 0 ? [] : [`${also ? 'Also serves' : 'Serves'} ${outcomes.map((o) => titleOf(index, o)).join(', ')}`]);

/**
 * The tree paths above an obligation, from the product's outcomes: one per outcome its capability serves (the
 * capability repeated under each, marked "Also serves" the others); from the capability or its parent when it serves none.
 */
function whyPaths(index: SpecIndex, obligation: string): Why[][] {
  const { chain, outcomes } = whyOf(index, obligation);
  if (outcomes.length === 0) return [chain.map((s) => ({ ...s, notes: [] }))];
  return outcomes.map((o) => [
    { id: o, column: 'outcome' as const, notes: [] },
    ...chain.map((s) => ({ ...s, notes: s.column === 'capability' ? servesNote(index, outcomes.filter((x) => x !== o), true) : [] })),
  ]);
}

/** The column a design, build or test record sits in. */
function columnOf(index: SpecIndex, id: string, fallback: LaneColumn): LaneColumn {
  const kind = index.byId.get(id)?.kind ?? '';
  if (kind === 'flow') return 'flow';
  if (kind === 'flow_step') return 'step';
  if (isTestKind(index, kind)) return 'tests';
  const stage = index.kinds.get(kind)?.stage;
  if (stage === 'technical-specification') return 'build';
  return fallback;
}

/** A gap's words, by its column. */
const GAP_WORDS: Record<GapColumn, string> = { design: 'Not designed', build: 'Not built', tests: 'Not proved' };

/** One lane's boxes before placing: each column's items in order, and its links. */
interface LaneDraft {
  obligation: string | null;
  columns: Map<LaneColumn, { id: string; role: BoxRole; opens: string | null; notes: string[]; words?: { title: string; meta: string } }[]>;
  links: (readonly [string, string])[];
  gaps: GapColumn[];
  /** Its "why" path in the tree, outermost first. */
  path: Why[];
}

const push = (d: LaneDraft, column: LaneColumn, item: LaneDraft['columns'] extends Map<LaneColumn, (infer T)[]> ? T : never) => {
  const list = d.columns.get(column);
  if (!list) d.columns.set(column, [item]);
  else if (!list.some((x) => x.id === item.id)) list.push(item);
};

/** A lane's draft from an obligation's chain: its records by column, its files, a gap box in each column coverage reports missing. */
function laneOf(index: SpecIndex, row: TraceRow, path: Why[]): LaneDraft {
  const d: LaneDraft = { obligation: row.obligation, columns: new Map(), links: [...row.links], gaps: row.gaps, path };
  const record = (id: string) => ({ id, role: 'record' as const, opens: id, notes: [] });
  push(d, 'obligation', record(row.obligation));
  for (const id of row.design) push(d, columnOf(index, id, 'design'), record(id));
  for (const id of row.build) push(d, 'build', record(id));
  for (const id of row.tests) push(d, 'tests', record(id));
  for (const f of row.files) push(d, 'files', { id: fileKey(f.path), role: 'file', opens: f.namedBy[0], notes: [], words: { title: f.path, meta: `File · named by ${f.namedBy.join(', ')}` } });
  const uc = index.byId.get(row.obligation)?.kind === 'uc_requirement';
  for (const gap of d.gaps) {
    const column: LaneColumn = gap === 'design' ? (uc ? 'step' : 'design') : gap;
    push(d, column, { id: `gap:${row.obligation}:${gap}`, role: 'gap', opens: null, notes: [], words: { title: GAP_WORDS[gap], meta: `Gap · ${row.obligation}` } });
  }
  return d;
}

/** The Untraced lane's draft: its head and each record no chain reaches, in its column. */
function untracedLane(index: SpecIndex, ids: readonly string[]): LaneDraft {
  const d: LaneDraft = { obligation: null, columns: new Map(), links: [], gaps: [], path: [] };
  push(d, 'obligation', { id: 'untraced', role: 'untraced', opens: null, notes: [], words: { title: 'Untraced', meta: `${ids.length} ${ids.length === 1 ? 'record' : 'records'} no chain reaches` } });
  for (const id of ids) push(d, columnOf(index, id, 'design'), { id, role: 'record', opens: id, notes: [] });
  return d;
}

/** A product's Trace map, laid out once per product and data change (one-map.ts). */
export const traceMap = onePerData((index: SpecIndex, product: string): TraceMap => {
  const drafts: LaneDraft[] = [];
  for (const o of obligationsUnder(index, product)) for (const path of whyPaths(index, o)) drafts.push(laneOf(index, traceChain(index, o)!, path));
  const ordered = treeOrder(drafts);
  const untraced = untracedUnder(index, product).flatMap((g) => g.ids);
  if (untraced.length > 0) ordered.push(untracedLane(index, untraced));
  return place(product, ordered, untraced.length);
});

/**
 * The drafts in the tree's order: each path's lanes together, the tree's branches in the order they first appear,
 * the roots by their column (the outcomes first, then the capabilities, then the parents).
 */
function treeOrder(drafts: LaneDraft[]): LaneDraft[] {
  interface Node { column: number; children: Map<string, Node>; lanes: LaneDraft[] }
  const root: Node = { column: -1, children: new Map(), lanes: [] };
  for (const d of drafts) {
    let at = root;
    for (const s of d.path) {
      let next = at.children.get(s.id);
      if (!next) { next = { column: LANE_COLUMNS.indexOf(s.column), children: new Map(), lanes: [] }; at.children.set(s.id, next); }
      at = next;
    }
    at.lanes.push(d);
  }
  const out: LaneDraft[] = [];
  // A branch's own lanes after its children's, so lanes with no "why" (an obligation right under its domain) come after the tree.
  const walk = (n: Node) => { for (const c of [...n.children.values()].sort((a, b) => a.column - b.column)) walk(c); out.push(...n.lanes); };
  walk(root);
  return out;
}

/** Places the lanes top to bottom and the tree over them, keeping only the columns some box uses. */
function place(product: string, drafts: LaneDraft[], untracedCount: number): TraceMap {
  const used = new Set<LaneColumn>();
  for (const d of drafts) {
    for (const c of d.columns.keys()) used.add(c);
    for (const s of d.path) used.add(s.column);
  }
  const columns = LANE_COLUMNS.filter((c) => used.has(c)).map((column, i) => ({ column, x: i * (BOX_W + COLUMN_GAP) }));
  const xOf = new Map(columns.map((c) => [c.column, c.x]));

  // How many lanes hold each record: a record in several is marked on each copy.
  const holders = new Map<string, Set<string>>();
  for (const d of drafts) {
    if (!d.obligation) continue;
    for (const [column, items] of d.columns) {
      if (column === 'obligation') continue;
      for (const it of items) if (it.role === 'record') { const s = holders.get(it.id) ?? new Set(); s.add(d.obligation); holders.set(it.id, s); }
    }
  }

  const places = new Map<string, readonly [number, number]>();
  const lanes: TraceLane[] = [];
  let y = 0;
  drafts.forEach((d, lane) => {
    const tallest = Math.max(1, ...[...d.columns.values()].map((items) => items.length));
    const height = tallest * BOX_H + (tallest - 1) * ROW_GAP;
    const boxes: TraceBox[] = [];
    const byId = new Map<string, TraceBox>();
    const at = [lane, lane] as const;
    for (const [column, items] of d.columns) {
      const stack = items.length * BOX_H + (items.length - 1) * ROW_GAP;
      // Each column centered in its lane; the Untraced lane's from its top, where its head sits.
      let top = d.obligation === null ? y : y + (height - stack) / 2;
      for (const it of items) {
        const shared = it.role === 'record' && column !== 'obligation' ? holders.get(it.id)?.size ?? 0 : 0;
        const box: TraceBox = {
          key: `${lane}|${column}|${it.id}`, id: it.id, role: it.role, column, lane, x: xOf.get(column)!, y: top, w: BOX_W, h: BOX_H, opens: it.opens,
          notes: [...it.notes, ...(shared > 1 ? [`In ${shared} lanes`] : [])], words: it.words,
        };
        boxes.push(box);
        byId.set(it.id, box);
        places.set(box.key, at);
        top += BOX_H + ROW_GAP;
      }
    }
    places.set(`lane:${lane}`, at);
    const lines: TraceLine[] = [];
    for (const [from, to] of d.links) {
      const a = byId.get(from);
      const b = byId.get(to);
      if (!a || !b || a === b) continue;
      lines.push({ key: `${lane}|${from}|${to}`, source: from, target: to, from: a.key, to: b.key, tree: false, points: [{ x: a.x + a.w, y: a.y + a.h / 2 }, { x: b.x, y: b.y + b.h / 2 }] });
    }
    const left = Math.min(...boxes.map((b) => b.x));
    const right = Math.max(...boxes.map((b) => b.x + b.w));
    lanes.push({ obligation: d.obligation, top: y, height, left, right, boxes, lines, gaps: d.gaps });
    y += height + LANE_GAP;
  });

  // The "why" tree: a box per path prefix, as tall as the lanes beneath it, each joined to its children by a level line.
  const tree: TraceMap['tree'] = { boxes: [], lines: [] };
  interface Span { why: Why; top: number; bottom: number; children: string[]; first: number; last: number }
  const spans = new Map<string, Span>();
  const order: string[] = [];
  lanes.forEach((l, i) => {
    const path = drafts[i].path;
    let prefix = '';
    path.forEach((s, depth) => {
      const parent = prefix;
      prefix = `${prefix}/${s.id}`;
      let span = spans.get(prefix);
      if (!span) {
        span = { why: s, top: l.top, bottom: l.top + l.height, children: [], first: i, last: i };
        spans.set(prefix, span);
        order.push(prefix);
        if (depth > 0) spans.get(parent)!.children.push(prefix);
      }
      span.bottom = l.top + l.height;
      span.last = i;
      if (depth === path.length - 1 && !span.children.includes(`lane:${i}`)) span.children.push(`lane:${i}`);
    });
  });
  const treeBox = new Map<string, TraceBox>();
  for (const key of order) {
    const s = spans.get(key)!;
    const box: TraceBox = { key: `tree${key}`, id: s.why.id, role: 'record', column: s.why.column, lane: -1, x: xOf.get(s.why.column)!, y: s.top, w: BOX_W, h: s.bottom - s.top, opens: s.why.id, notes: s.why.notes };
    treeBox.set(key, box);
    tree.boxes.push(box);
    places.set(box.key, [s.first, s.last]);
  }
  for (const key of order) {
    const s = spans.get(key)!;
    const p = treeBox.get(key)!;
    for (const child of s.children) {
      const c = child.startsWith('lane:') ? lanes[Number(child.slice(5))].boxes.find((b) => b.column === 'obligation') : treeBox.get(child);
      if (!c) continue;
      const cy = child.startsWith('lane:') ? c.y + c.h / 2 : c.y + Math.min(c.h, BOX_H) / 2;
      tree.lines.push({ key: `tree${key}>${c.key}`, source: p.id, target: c.id, from: p.key, to: c.key, tree: true, points: [{ x: p.x + p.w, y: cy }, { x: c.x, y: cy }] });
    }
  }

  const copies = new Map<string, TraceBox[]>();
  for (const b of [...tree.boxes, ...lanes.flatMap((l) => l.boxes)]) { const list = copies.get(b.id); if (list) list.push(b); else copies.set(b.id, [b]); }
  const lanesOf = new Map<string, number[]>();
  lanes.forEach((l, i) => { if (l.obligation) { const list = lanesOf.get(l.obligation); if (list) list.push(i); else lanesOf.set(l.obligation, [i]); } });
  const traced = lanes.filter((l) => l.obligation !== null);
  return {
    product,
    lanes,
    tree,
    columns,
    width: columns.length > 0 ? columns.length * (BOX_W + COLUMN_GAP) - COLUMN_GAP : 0,
    height: Math.max(0, y - LANE_GAP),
    counts: { obligations: lanesOf.size, withGaps: new Set(traced.filter((l) => l.gaps.length > 0).map((l) => l.obligation)).size, untraced: untracedCount },
    copies,
    lanesOf,
    places,
  };
}

// ---------- Focusing: where the camera goes, and what stays at full strength ----------

/** What focusing a record frames on the map: a rectangle, the box the camera centers on when it is too wide, and the lanes kept at full strength (null for all). */
export interface TraceFocus { rect: MapRect; anchor: MapRect | null; lanes: ReadonlySet<number> | null }

const laneRect = (map: TraceMap, lanes: readonly number[]): MapRect => {
  const top = Math.min(...lanes.map((i) => map.lanes[i].top));
  const bottom = Math.max(...lanes.map((i) => map.lanes[i].top + map.lanes[i].height));
  return { x: 0, y: top, w: map.width, h: bottom - top };
};
const boxRect = (b: TraceBox): MapRect => ({ x: b.x, y: b.y, w: b.w, h: Math.min(b.h, BOX_H) });
const range = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => from + i);

/** Where a record is on the map, or null when it is not drawn and nothing under it is. */
function focusAt(map: TraceMap, index: SpecIndex, focus: string): TraceFocus | null {
  if (focus === map.product) return { rect: { x: 0, y: 0, w: map.width, h: map.height }, anchor: null, lanes: null };
  const copies = map.copies.get(focus) ?? [];
  // A box of the why tree (an outcome, a capability, a use case, an obligation's parent): it and every lane beneath it, from its left edge.
  const tree = copies.filter((b) => b.lane < 0);
  if (tree.length > 0) {
    const first = tree[0];
    const lanes = new Set(tree.flatMap((b) => { const [a, z] = map.places.get(b.key)!; return range(a, z); }));
    return { rect: { x: first.x, y: first.y, w: map.width - first.x, h: first.h }, anchor: null, lanes };
  }
  // An obligation: its first lane, centered on it; every lane of it kept.
  const own = map.lanesOf.get(focus);
  if (own) {
    const box = map.lanes[own[0]].boxes.find((b) => b.column === 'obligation')!;
    return { rect: laneRect(map, [own[0]]), anchor: boxRect(box), lanes: new Set(own) };
  }
  // A record or group with obligations under it (a domain, a stage, a folder): all their lanes, its Untraced records' lane too.
  const under = obligationsUnder(index, focus).flatMap((o) => map.lanesOf.get(o) ?? []);
  if (under.length > 0) {
    const untraced = map.lanes.length - 1;
    const kept = new Set(under);
    if (map.lanes[untraced]?.obligation === null && untracedUnder(index, focus).length > 0) kept.add(untraced);
    return { rect: laneRect(map, under), anchor: null, lanes: kept };
  }
  // A design, build or test record a chain holds, or an untraced one: its first lane (in the Untraced lane, its own row), centered on it; every lane holding a copy kept.
  if (copies.length > 0) {
    const first = copies[0];
    const lane = map.lanes[first.lane];
    const rect = lane.obligation === null ? { x: 0, y: first.y, w: map.width, h: first.h } : laneRect(map, [first.lane]);
    return { rect, anchor: boxRect(first), lanes: new Set(copies.map((b) => b.lane)) };
  }
  return null;
}

/**
 * What focusing a record does on its product's map (LA-V98-R08): the product frames the whole map; a tree box frames
 * itself and its lanes; an obligation, or a record a chain holds, its first lane, centered on its box, every copy kept;
 * a record or group with obligations under it frames all their lanes; any other record frames the nearest container
 * above it that is drawn (an entity its aggregate), and the product when none is.
 */
export function traceFocus(map: TraceMap, index: SpecIndex, focus: string): TraceFocus {
  for (let at: string | null = focus; at !== null; at = treeParent(index, at)) {
    const found = focusAt(map, index, at);
    if (found) return found;
  }
  return focusAt(map, index, map.product)!;
}

/**
 * How strongly each place is drawn (LA-PAT-APP-UX-R19): the focus's lanes and the tree boxes over them at full strength,
 * and under Gaps only the lanes with a gap and the Untraced lane; everything else faded back, never taken out.
 */
export function traceFade(map: TraceMap, lanes: ReadonlySet<number> | null, gapsOnly: boolean, look: Pick<FadeLook, 'focusFade'>): Fade {
  const keeps = (test: (lane: number) => boolean) => {
    const known = new Map<string, boolean>();
    return (place: string) => {
      const seen = known.get(place);
      if (seen !== undefined) return seen;
      const [from, to] = map.places.get(place) ?? [0, -1];
      let kept = false;
      for (let i = from; i <= to && !kept; i++) kept = test(i);
      known.set(place, kept);
      return kept;
    };
  };
  const fades: Fade[] = [];
  if (lanes) fades.push(keptFade(keeps((i) => lanes.has(i)), look));
  if (gapsOnly) fades.push(keptFade(keeps((i) => map.lanes[i].obligation === null || map.lanes[i].gaps.length > 0), look));
  return fades.length === 0 ? () => 1 : faintest(...fades);
}

// ---------- What is in view ----------

/** The first lane that reaches a height, and the lane past the last that starts above another: found by halving. */
function laneRange(map: TraceMap, y0: number, y1: number): [number, number] {
  let lo = 0;
  let hi = map.lanes.length;
  while (lo < hi) { const mid = (lo + hi) >> 1; if (map.lanes[mid].top + map.lanes[mid].height < y0) lo = mid + 1; else hi = mid; }
  let end = lo;
  while (end < map.lanes.length && map.lanes[end].top <= y1) end++;
  return [lo, end];
}

type Rect = { x0: number; y0: number; x1: number; y1: number };
const meets = (r: Rect) => (b: { x: number; y: number; w: number; h: number }) => b.x + b.w >= r.x0 && b.x <= r.x1 && b.y + b.h >= r.y0 && b.y <= r.y1;

/** What a rectangle of the map holds: the tree's boxes and lines that meet it, and the lanes'. */
export function visibleIn(map: TraceMap, r: Rect): { boxes: TraceBox[]; lines: TraceLine[] } {
  const inside = meets(r);
  const boxes = map.tree.boxes.filter(inside);
  const lines = map.tree.lines.filter((l) => l.points[0].y >= r.y0 && l.points[0].y <= r.y1);
  const [lo, hi] = laneRange(map, r.y0, r.y1);
  for (let i = lo; i < hi; i++) {
    const lane = map.lanes[i];
    for (const b of lane.boxes) if (inside(b)) boxes.push(b);
    for (const l of lane.lines) if (Math.max(l.points[0].x, l.points[1].x) >= r.x0 && Math.min(l.points[0].x, l.points[1].x) <= r.x1) lines.push(l);
  }
  return { boxes, lines };
}

/** Far out, what a rectangle holds without its lanes' boxes: the lanes that meet it (each drawn as one bar) and the tree's boxes. */
export function lanesIn(map: TraceMap, r: Rect): { lanes: number[]; tree: TraceBox[] } {
  const [lo, hi] = laneRange(map, r.y0, r.y1);
  const lanes: number[] = [];
  for (let i = lo; i < hi; i++) if (map.lanes[i].right >= r.x0 && map.lanes[i].left <= r.x1) lanes.push(i);
  return { lanes, tree: map.tree.boxes.filter(meets(r)) };
}

/** Every box of the map, the tree's first. */
export const allBoxes = (map: TraceMap): TraceBox[] => [...map.tree.boxes, ...map.lanes.flatMap((l) => l.boxes)];
