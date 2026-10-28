import { byIdOrder, kindLabel, type SpecIndex } from '../specs/data';
import { isTestKind } from '../specs/parts';
import { fileKey, gapColumns, holdersOf, obligationsUnder, traceChain, traceShape, untracedUnder, type TraceColumn, type TraceRow } from './chain';

// The Trace stage's picture (LA-V98), pure and tested directly: what it draws for a focus, laid out
// once in map units, left to right.
//
// - One obligation: its chain, exactly as the graph's trace mode drew it, "why" columns included:
//   the business outcomes its capability serves → the capability → the use case (or the
//   obligation's parent) → the obligation → flow → step → design → build → tests → files, boxes in
//   stage colors and arrows for the chain's actual links (TraceRow.links).
// - Anything above obligations: a "why" tree on the left and one lane per obligation on the right.
//   The tree fans out from the focus (a product from its business outcomes, a capability that serves
//   several repeated under each and marked "also serves"; a domain from its capabilities, their
//   outcomes as notes on the capability's box; a capability, a use case or a parent from itself),
//   each parent as tall as its children (the graph's Tree rule). Each lane is an obligation's chain
//   across the columns after it; an owed column left empty is a gap, a dashed empty box in its
//   column. A record held by several lanes is repeated in each, with "in N lanes" on each copy. The
//   design, build and test records no chain reaches sit in an Untraced lane at the bottom.
// - A record that is no obligation: the lanes that hold it, the record marked as the focus; a record
//   nothing traces to (or any other record) the lanes of the nearest container with obligations,
//   the record in the Untraced lane when it is untraced.
//
// Boxes share one size at text scale 1, a tree box as tall as the lanes beneath it. Columns no box
// uses are left out, so a trace with no flows has no flow column. The picture keeps its lanes in
// order, top to bottom, so the canvas finds what is in view by halving (visibleIn) and draws only that.

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
  /** Unique in the picture: a record repeated in several lanes has a box in each. */
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
  /** A tree's parent line (level and plain) rather than a chain's arrow. */
  tree: boolean;
  points: [{ x: number; y: number }, { x: number; y: number }];
}

export interface TraceLane {
  /** The obligation it traces, or null for the Untraced lane. */
  obligation: string | null;
  top: number;
  height: number;
  boxes: TraceBox[];
  lines: TraceLine[];
  /** Its gaps (TraceRow's): the columns it owes and nothing fills. */
  gaps: TraceColumn[];
}

/** What the picture is of, for the header strip and the note over it. */
export type PictureShape = 'chain' | 'lanes' | 'rows' | 'context';

export interface TracePicture {
  shape: PictureShape;
  /** Whether the focus is a design, build or test record nothing traces to (the context shape). */
  untraced: boolean;
  /** The container whose lanes the context shape shows, or null. */
  scope: string | null;
  lanes: TraceLane[];
  /** The "why" tree's boxes and lines, which span lanes. */
  tree: { boxes: TraceBox[]; lines: TraceLine[] };
  /** The columns drawn, left to right, each with its left edge. */
  columns: { column: LaneColumn; x: number }[];
  width: number;
  height: number;
  /** How many lanes trace an obligation, how many of those have a gap, and how many records are untraced. */
  counts: { obligations: number; withGaps: number; untraced: number };
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
 * The tree paths above an obligation, from the focus: one path, or on a product's picture one per outcome its
 * capability serves (the capability repeated under each, marked "also serves" the others).
 */
export function whyPaths(index: SpecIndex, focus: string, obligation: string): Why[][] {
  const { chain, outcomes } = whyOf(index, obligation);
  const steps = (from: number, tags: boolean): Why[] => chain.slice(from).map((s) => ({ ...s, notes: tags && s.column === 'capability' ? servesNote(index, outcomes) : [] }));
  const at = chain.findIndex((s) => s.id === focus);
  if (at >= 0) return [steps(at, true)];
  const fromOutcomes = index.byId.get(focus)?.kind === 'product' && outcomes.length > 0;
  if (!fromOutcomes) return [steps(0, true)];
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
const GAP_WORDS: Record<TraceColumn, string> = { design: 'Not designed', build: 'Not built', tests: 'No tests', files: 'No files' };

/** One lane's boxes before placing: each column's items in order, and its links. */
interface LaneDraft {
  obligation: string | null;
  columns: Map<LaneColumn, { id: string; role: BoxRole; opens: string | null; notes: string[]; words?: { title: string; meta: string } }[]>;
  links: (readonly [string, string])[];
  gaps: TraceColumn[];
  /** Its "why" path in the tree (lanes mode), outermost first. */
  path: Why[];
}

const push = (d: LaneDraft, column: LaneColumn, item: LaneDraft['columns'] extends Map<LaneColumn, (infer T)[]> ? T : never) => {
  const list = d.columns.get(column);
  if (!list) d.columns.set(column, [item]);
  else if (!list.some((x) => x.id === item.id)) list.push(item);
};

/** A lane's draft from an obligation's chain: its records by column, its files, a gap box in each owed empty column. */
function laneOf(index: SpecIndex, row: TraceRow, path: Why[]): LaneDraft {
  const d: LaneDraft = { obligation: row.obligation, columns: new Map(), links: [...row.links], gaps: gapColumns(row), path };
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

/** The chain of one obligation as one lane, its "why" columns in it: the outcomes stacked, each leading to the capability. */
function chainLane(index: SpecIndex, obligation: string): LaneDraft {
  const d = laneOf(index, traceChain(index, obligation)!, []);
  const { chain, outcomes } = whyOf(index, obligation);
  const record = (id: string) => ({ id, role: 'record' as const, opens: id, notes: [] });
  const cap = chain.find((s) => s.column === 'capability');
  for (const o of cap ? outcomes : []) { push(d, 'outcome', record(o)); d.links.push([o, cap!.id]); }
  chain.forEach((s, i) => { push(d, s.column, record(s.id)); d.links.push([s.id, chain[i + 1]?.id ?? obligation]); });
  return d;
}

/** Everything the Trace stage draws for a focus, laid out; `gapsOnly` keeps only the lanes with a gap (and the Untraced lane). */
export function tracePicture(index: SpecIndex, focus: string, { gapsOnly = false }: { gapsOnly?: boolean } = {}): TracePicture {
  const shape = traceShape(index, focus);
  let drafts: LaneDraft[] = [];
  let untraced: string[] = [];
  let scope: string | null = null;
  let isUntraced = false;
  if (shape.shape === 'chain') {
    drafts = [chainLane(index, focus)];
  } else {
    let obligations: string[];
    let start = focus;
    let untracedOf: string | null = null;
    if (shape.shape === 'matrix') { obligations = obligationsUnder(index, focus); untracedOf = focus; }
    else if (shape.shape === 'rows') { obligations = holdersOf(index, focus); start = ''; }
    else {
      scope = shape.scope;
      isUntraced = shape.untraced;
      obligations = scope ? obligationsUnder(index, scope) : [];
      start = scope ?? '';
      untracedOf = scope;
    }
    for (const o of obligations) for (const path of whyPaths(index, start, o)) drafts.push(laneOf(index, traceChain(index, o)!, path));
    if (gapsOnly) drafts = drafts.filter((d) => d.gaps.length > 0);
    drafts = treeOrder(drafts);
    if (untracedOf) untraced = untracedUnder(index, untracedOf).flatMap((g) => g.ids);
    if (isUntraced && !untraced.includes(focus)) untraced.push(focus);
    if (untraced.length > 0) drafts.push(untracedLane(index, untraced));
  }
  return place(shape.shape === 'matrix' ? 'lanes' : shape.shape, drafts, { untraced: isUntraced, scope, untracedCount: untraced.length });
}

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
function place(shape: PictureShape, drafts: LaneDraft[], info: { untraced: boolean; scope: string | null; untracedCount: number }): TracePicture {
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

  const lanes: TraceLane[] = [];
  let y = 0;
  drafts.forEach((d, lane) => {
    const tallest = Math.max(1, ...[...d.columns.values()].map((items) => items.length));
    const height = tallest * BOX_H + (tallest - 1) * ROW_GAP;
    const boxes: TraceBox[] = [];
    const byId = new Map<string, TraceBox>();
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
        top += BOX_H + ROW_GAP;
      }
    }
    const lines: TraceLine[] = [];
    for (const [from, to] of d.links) {
      const a = byId.get(from);
      const b = byId.get(to);
      if (!a || !b || a === b) continue;
      lines.push({ key: `${lane}|${from}|${to}`, source: from, target: to, tree: false, points: [{ x: a.x + a.w, y: a.y + a.h / 2 }, { x: b.x, y: b.y + b.h / 2 }] });
    }
    lanes.push({ obligation: d.obligation, top: y, height, boxes, lines, gaps: d.gaps });
    y += height + LANE_GAP;
  });

  // The "why" tree: a box per path prefix, as tall as the lanes beneath it, each joined to its children by a level line.
  const tree: TracePicture['tree'] = { boxes: [], lines: [] };
  interface Span { why: Why; top: number; bottom: number; children: string[]; firstLane: number }
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
        span = { why: s, top: l.top, bottom: l.top + l.height, children: [], firstLane: i };
        spans.set(prefix, span);
        order.push(prefix);
        if (depth > 0) spans.get(parent)!.children.push(prefix);
      }
      span.bottom = l.top + l.height;
      if (depth === path.length - 1 && !span.children.includes(`lane:${i}`)) span.children.push(`lane:${i}`);
    });
  });
  const treeBox = new Map<string, TraceBox>();
  for (const key of order) {
    const s = spans.get(key)!;
    const box: TraceBox = { key: `tree${key}`, id: s.why.id, role: 'record', column: s.why.column, lane: -1, x: xOf.get(s.why.column)!, y: s.top, w: BOX_W, h: s.bottom - s.top, opens: s.why.id, notes: s.why.notes };
    treeBox.set(key, box);
    tree.boxes.push(box);
  }
  for (const key of order) {
    const s = spans.get(key)!;
    const p = treeBox.get(key)!;
    for (const child of s.children) {
      const c = child.startsWith('lane:') ? lanes[Number(child.slice(5))].boxes.find((b) => b.column === 'obligation') : treeBox.get(child);
      if (!c) continue;
      const cy = child.startsWith('lane:') ? c.y + c.h / 2 : c.y + Math.min(c.h, BOX_H) / 2;
      tree.lines.push({ key: `tree${key}>${c.key}`, source: p.id, target: c.id, tree: true, points: [{ x: p.x + p.w, y: cy }, { x: c.x, y: cy }] });
    }
  }

  const traced = lanes.filter((l) => l.obligation !== null);
  return {
    shape,
    untraced: info.untraced,
    scope: info.scope,
    lanes,
    tree,
    columns,
    width: columns.length > 0 ? columns.length * (BOX_W + COLUMN_GAP) - COLUMN_GAP : 0,
    height: Math.max(0, y - LANE_GAP),
    counts: { obligations: new Set(traced.map((l) => l.obligation)).size, withGaps: new Set(traced.filter((l) => l.gaps.length > 0).map((l) => l.obligation)).size, untraced: info.untracedCount },
  };
}

/** What a rectangle of the picture holds: the tree's boxes and lines that meet it, and the lanes' (found by halving, lanes being in order). */
export function visibleIn(p: TracePicture, r: { x0: number; y0: number; x1: number; y1: number }): { boxes: TraceBox[]; lines: TraceLine[] } {
  const meets = (b: { x: number; y: number; w: number; h: number }) => b.x + b.w >= r.x0 && b.x <= r.x1 && b.y + b.h >= r.y0 && b.y <= r.y1;
  const boxes = p.tree.boxes.filter(meets);
  const lines = p.tree.lines.filter((l) => l.points[0].y >= r.y0 && l.points[0].y <= r.y1);
  let lo = 0;
  let hi = p.lanes.length;
  while (lo < hi) { const mid = (lo + hi) >> 1; if (p.lanes[mid].top + p.lanes[mid].height < r.y0) lo = mid + 1; else hi = mid; }
  for (let i = lo; i < p.lanes.length && p.lanes[i].top <= r.y1; i++) {
    const lane = p.lanes[i];
    for (const b of lane.boxes) if (meets(b)) boxes.push(b);
    for (const l of lane.lines) if (Math.max(l.points[0].x, l.points[1].x) >= r.x0 && Math.min(l.points[0].x, l.points[1].x) <= r.x1) lines.push(l);
  }
  return { boxes, lines };
}

/** Every box of the picture, the tree's first. */
export const allBoxes = (p: TracePicture): TraceBox[] => [...p.tree.boxes, ...p.lanes.flatMap((l) => l.boxes)];

/** A box's accessible kind word, for a box that is no record. */
export const roleLabel = (index: SpecIndex, b: TraceBox): string => (b.role === 'record' ? kindLabel(index, index.byId.get(b.id)?.kind ?? '') : b.role === 'file' ? 'File' : b.role === 'gap' ? 'Gap' : 'Untraced');
