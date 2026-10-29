import { byIdOrder, type SpecIndex } from '../specs/data';
import { isTestKind } from '../specs/parts';
import { treeChildren, treeGroup, treeParent } from '../graph/tree';
import type { MapRect } from '../graph/camera';
import { faintest, keptFade, type Fade, type FadeLook } from '../graph/fade';
import { onePerData } from '../graph/one-map';
import { fileKey, obligationsUnder, traceChain, untracedUnder, type GapColumn, type TraceRow } from './chain';

// The Trace stage's map (LA-V98), pure and tested directly: one map per product, laid out once per
// product and data change in map units, that the stage navigates (LA-PAT-APP-UX-R19).
//
// - The lanes are grouped in bands, one per part of the product's tree (each domain, and the Shared
//   folder of the product's own records), in the tree's order, the Untraced lane in a band of its
//   own after them. Each band starts with a head, where its label sits, so far out the product reads
//   as a few labeled bands.
// - The bands flow down columns of lanes (segments) side by side, a band continuing at the top of the
//   next column when one is full, so a large product's overview is about as wide as it is tall
//   rather than one thin column. A column's height is worked out from the whole map's area.
// - In each band, on the left the "why" tree, from the product's business outcomes: a capability
//   serving several repeated under each, marked "Also serves" the others, then its use cases; an
//   obligation with no capability hangs from its own parent (an aggregate, a view, a pattern), one
//   with neither from no tree, after the tree. Each parent is as tall as the lanes beneath it (the
//   graph's Tree rule), split at a column's end, its next part marked "Continued".
// - On the right one lane per obligation in the tree's order: its chain across the columns after it,
//   flow → step → design → build → tests → files, boxes in stage colors and arrows for the chain's
//   actual links (TraceRow.links). Each gap coverage reports (not designed, not built, not proved) is
//   a dashed box at the top of its column. A record held by several lanes is repeated in each, with
//   "In N lanes" on each copy; an obligation whose capability serves several outcomes has a lane under
//   each.
// - A lane's column shows at most CELL_SHOWN boxes, then one "+N more" box. Each lane with such a
//   column also has its open form, laid out with the rest: every box of every column, the shown ones
//   where they are and the rest below them. While the lane is open (its obligation or a record in it
//   focused, traceFocus) the canvas draws the open form over the lanes below it, which are left out
//   where it covers them; nothing moves.
//
// Focusing anything moves the camera to frame it (traceFocus) and fades what is not under it; Gaps
// only fades the complete lanes (traceFade). Nothing here depends on the focus or a filter, so no box
// ever moves. Boxes share one size, a tree box as tall as the lanes beneath it. Columns no box uses
// are left out. The lanes are kept in order, top to bottom within each column of lanes, so the canvas
// finds what is in view by halving (visibleIn, lanesIn) and draws only that.

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
/**
 * The most boxes a lane's column shows before one "+N more" box: four, so a lane is at most five boxes tall and frames
 * whole at the zoom labels read at in a laptop's pane. A column of one more shows them all, as its "+1 more" would take
 * the room of the box it hides.
 */
export const CELL_SHOWN = 4;
/** The room above each band's lanes in a column, where its label sits: about a line of the label at the product's overview. */
const BAND_HEAD = 480;
/** The gap between two columns of lanes. */
const SEGMENT_GAP = 480;
/** The more room between a band's first column and the column before, so its label reads beside the one before far out. */
const BAND_GAP = 1200;
/** The overview's aim, width over height: about a pane's. */
const ASPECT = 1.6;
/** The least height of a column of lanes, so a small product's lanes stay in one column. */
const MIN_SEGMENT_H = 12_000;

/** What a box is: a record, a file a record names, a gap, the Untraced lane's head, or a capped column's "+N more". */
export type BoxRole = 'record' | 'file' | 'gap' | 'untraced' | 'more';

export interface TraceBox {
  /** Unique in the map, and its place for the fade (fade.ts): a record repeated in several lanes has a box in each. */
  key: string;
  /** The record it is (every copy shares it), `file:<path>`, `gap:<obligation>:<column>`, `more:<lane>:<column>`, or `untraced`. */
  id: string;
  role: BoxRole;
  column: LaneColumn;
  /** The lane it sits in, or -1 for a box of the "why" tree, which spans the lanes beneath it. */
  lane: number;
  x: number; y: number; w: number; h: number;
  /** The record a click opens: itself, the first record naming a file, a "+N more" box's first hidden record; null for a gap or the Untraced head. */
  opens: string | null;
  /** Muted lines after its title: the outcomes a capability serves, how many lanes hold a record, "Continued". */
  notes: string[];
  /** A file's path, a gap's, a "+N more" box's or the Untraced head's words; a record's come from the record. */
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

/** A lane's open form: every box of every column, and the arrows between them, reaching down to `bottom`. */
export interface OpenLane { boxes: TraceBox[]; lines: TraceLine[]; bottom: number }

export interface TraceLane {
  /** The obligation it traces, or null for the Untraced lane. */
  obligation: string | null;
  /** Its band (TraceMap.bands) and its column of lanes (TraceMap.segments). */
  band: number;
  segment: number;
  top: number;
  height: number;
  /** Where its boxes start and end, left to right: its bar's extent far out. */
  left: number;
  right: number;
  /** Its boxes as drawn while it is not open: each column's first boxes and a "+N more" box for the rest. */
  boxes: TraceBox[];
  lines: TraceLine[];
  /** Its gaps (TraceRow's): the columns coverage reports missing. */
  gaps: GapColumn[];
  /** Its open form, or null when every column shows all its boxes. */
  open: OpenLane | null;
}

/** A band of lanes: a part of the product's tree (a domain, the Shared folder) or the Untraced lane. */
export interface TraceBand {
  /** The tree's node it stands for, or `untraced`. */
  id: string;
  label: string;
  /** Its lanes, the first and the one past the last. */
  from: number;
  to: number;
  /** Where its label sits in each column it runs in: the left and the bottom of its head, just over its first lane there; `continued` past its first column. */
  heads: { x: number; y: number; continued: boolean }[];
}

/** A column of lanes: its left edge, the height it runs over, and its lanes, the first and the one past the last. */
export interface TraceSegment { x: number; top: number; bottom: number; from: number; to: number }

/** One product's Trace map. */
export interface TraceMap {
  product: string;
  lanes: TraceLane[];
  bands: TraceBand[];
  segments: TraceSegment[];
  /** The "why" tree's boxes and lines, which span lanes. */
  tree: { boxes: TraceBox[]; lines: TraceLine[] };
  /** The columns drawn, left to right, each with its left edge from its column of lanes' left edge. */
  columns: { column: LaneColumn; x: number }[];
  /** A column of lanes' width. */
  segmentWidth: number;
  width: number;
  height: number;
  /** How many obligations it traces, how many of those have a gap, and how many records are untraced. */
  counts: { obligations: number; withGaps: number; untraced: number };
  /** Every box of each id (a record, a file, a gap, a "+N more"), the tree's first, then lane by lane, each lane's shown boxes before its open form's others. */
  copies: ReadonlyMap<string, readonly TraceBox[]>;
  /** Every box by its key. */
  byKey: ReadonlyMap<string, TraceBox>;
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

/** The part of the product's tree a record sits in: the node right under the product above it (a domain, the Shared folder), or the product. */
function bandOf(index: SpecIndex, product: string, id: string): string {
  let at = id;
  for (let up = treeParent(index, at); up !== null && up !== product; up = treeParent(index, at)) at = up;
  return treeParent(index, at) === product ? at : product;
}

/** A band's label: its domain's title, its folder's name ("Shared"). */
const bandLabel = (index: SpecIndex, id: string) => index.byId.get(id)?.title ?? treeGroup(index, id)?.label ?? id;

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

/** A column's items, in a lane's draft. */
interface Item { id: string; role: BoxRole; opens: string | null; notes: string[]; words?: { title: string; meta: string } }

/** One lane's boxes before placing: each column's items in order, and its links. */
interface LaneDraft {
  obligation: string | null;
  band: string;
  columns: Map<LaneColumn, Item[]>;
  links: (readonly [string, string])[];
  gaps: GapColumn[];
  /** Its "why" path in the tree, outermost first. */
  path: Why[];
}

const push = (d: LaneDraft, column: LaneColumn, item: Item) => {
  const list = d.columns.get(column);
  if (!list) d.columns.set(column, [item]);
  else if (!list.some((x) => x.id === item.id)) list.push(item);
};

/** A lane's draft from an obligation's chain: its records by column, its files, a gap box at the top of each column coverage reports missing. */
function laneOf(index: SpecIndex, row: TraceRow, path: Why[], band: string): LaneDraft {
  const d: LaneDraft = { obligation: row.obligation, band, columns: new Map(), links: [...row.links], gaps: row.gaps, path };
  const record = (id: string) => ({ id, role: 'record' as const, opens: id, notes: [] });
  push(d, 'obligation', record(row.obligation));
  const uc = index.byId.get(row.obligation)?.kind === 'uc_requirement';
  // The gaps first, so a column's cap never hides one.
  for (const gap of d.gaps) {
    const column: LaneColumn = gap === 'design' ? (uc ? 'step' : 'design') : gap;
    push(d, column, { id: `gap:${row.obligation}:${gap}`, role: 'gap', opens: null, notes: [], words: { title: GAP_WORDS[gap], meta: `Gap · ${row.obligation}` } });
  }
  for (const id of row.design) push(d, columnOf(index, id, 'design'), record(id));
  for (const id of row.build) push(d, 'build', record(id));
  for (const id of row.tests) push(d, 'tests', record(id));
  for (const f of row.files) push(d, 'files', { id: fileKey(f.path), role: 'file', opens: f.namedBy[0], notes: [], words: { title: f.path, meta: `File · named by ${f.namedBy.join(', ')}` } });
  return d;
}

/** The Untraced lane's draft: its head and each record no chain reaches, in its column. */
function untracedLane(index: SpecIndex, ids: readonly string[]): LaneDraft {
  const d: LaneDraft = { obligation: null, band: UNTRACED, columns: new Map(), links: [], gaps: [], path: [] };
  push(d, 'obligation', { id: 'untraced', role: 'untraced', opens: null, notes: [], words: { title: 'Untraced', meta: `${ids.length} ${ids.length === 1 ? 'record' : 'records'} no chain reaches` } });
  for (const id of ids) push(d, columnOf(index, id, 'design'), { id, role: 'record', opens: id, notes: [] });
  return d;
}

/** The Untraced lane's band. */
const UNTRACED = 'untraced';

/** A product's Trace map, laid out once per product and data change (one-map.ts). */
export const traceMap = onePerData((index: SpecIndex, product: string): TraceMap => {
  const byBand = new Map<string, LaneDraft[]>();
  for (const o of obligationsUnder(index, product)) {
    const band = bandOf(index, product, o);
    const list = byBand.get(band) ?? [];
    byBand.set(band, list);
    for (const path of whyPaths(index, o)) list.push(laneOf(index, traceChain(index, o)!, path, band));
  }
  // The bands in the tree's order (the product's Shared folder, its domains), each band's lanes in its tree's order.
  const rank = new Map(treeChildren(index, product).map((id, i) => [id, i]));
  const bands = [...byBand.keys()].sort((a, b) => (rank.get(a) ?? rank.size) - (rank.get(b) ?? rank.size));
  const ordered = bands.flatMap((b) => treeOrder(byBand.get(b)!));
  const untraced = untracedUnder(index, product).flatMap((g) => g.ids);
  if (untraced.length > 0) ordered.push(untracedLane(index, untraced));
  const labels = new Map([...bands.map((b) => [b, bandLabel(index, b)] as const), [UNTRACED, 'Untraced'] as const]);
  return place(product, ordered, labels, untraced.length);
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

/** A stack's height: n boxes and the gaps between them. */
const stackH = (n: number) => n * BOX_H + Math.max(0, n - 1) * ROW_GAP;
/** How many boxes a column shows while its lane is not open: all of them, or CELL_SHOWN and a "+N more". */
const shownOf = (n: number) => (n > CELL_SHOWN + 1 ? CELL_SHOWN + 1 : n);

/** "+12 more" box's words: how many, of what. */
function moreWords(column: LaneColumn, hidden: number, all: number): { title: string; meta: string } {
  return { title: `+${hidden} more`, meta: `${LANE_COLUMN_LABELS[column]} · ${all} in all` };
}

/** Places the bands' lanes down columns of lanes and the tree over them, keeping only the columns some box uses. */
function place(product: string, drafts: LaneDraft[], labels: ReadonlyMap<string, string>, untracedCount: number): TraceMap {
  const used = new Set<LaneColumn>();
  for (const d of drafts) {
    for (const c of d.columns.keys()) used.add(c);
    for (const s of d.path) used.add(s.column);
  }
  const columns = LANE_COLUMNS.filter((c) => used.has(c)).map((column, i) => ({ column, x: i * (BOX_W + COLUMN_GAP) }));
  const xOf = new Map(columns.map((c) => [c.column, c.x]));
  const segmentWidth = columns.length > 0 ? columns.length * (BOX_W + COLUMN_GAP) - COLUMN_GAP : 0;

  // How many lanes hold each record: a record in several is marked on each copy.
  const holders = new Map<string, Set<string>>();
  for (const d of drafts) {
    if (!d.obligation) continue;
    for (const [column, items] of d.columns) {
      if (column === 'obligation') continue;
      for (const it of items) if (it.role === 'record') { const s = holders.get(it.id) ?? new Set(); s.add(d.obligation); holders.set(it.id, s); }
    }
  }

  // Each lane's height while not open: its tallest column, cut to CELL_SHOWN and a "+N more".
  const heights = drafts.map((d) => stackH(Math.max(1, ...[...d.columns.values()].map((items) => shownOf(items.length)))));

  // The columns of lanes: a height worked out from the map's area, so the overview is about a pane's shape; the bands
  // flow down them, each with a head for its label. A band that fits in what is left of a column goes on under the one
  // before; any other starts a column, and one taller than a column goes on at the top of the next when one is full.
  const area = heights.reduce((n, h) => n + h + LANE_GAP, 0) + new Set(drafts.map((d) => d.band)).size * BAND_HEAD;
  const columnH = Math.max(MIN_SEGMENT_H, Math.max(0, ...heights) + BAND_HEAD, Math.sqrt((area * (segmentWidth + SEGMENT_GAP)) / ASPECT));
  const segments: TraceSegment[] = [];
  const bands: TraceBand[] = [];
  const tops: number[] = [];
  const segOf: number[] = [];
  let y = 0;
  /** How tall the band being placed may run down a column: a column, or for a band taller than one, its share of the columns it needs, so its last column is no stub. */
  let limit = columnH;
  drafts.forEach((d, i) => {
    const newBand = i === 0 || d.band !== drafts[i - 1].band;
    const seg = segments.at(-1);
    let need = heights[i];
    if (newBand) {
      let total = BAND_HEAD - LANE_GAP;
      let tallest = 0;
      for (let j = i; j < drafts.length && drafts[j].band === d.band; j++) { total += heights[j] + LANE_GAP; tallest = Math.max(tallest, heights[j]); }
      limit = total <= columnH ? columnH : total / Math.ceil(total / columnH) + BAND_HEAD + tallest;
      if (seg) need = total;
    }
    let head = newBand;
    if (!seg || (seg.to > seg.from && y + need > (newBand ? columnH : limit))) {
      const x = seg ? seg.x + segmentWidth + SEGMENT_GAP + (newBand ? BAND_GAP : 0) : 0;
      if (seg) seg.bottom = y - LANE_GAP;
      segments.push({ x, top: 0, bottom: 0, from: i, to: i });
      y = 0;
      head = true;
    }
    const s = segments.at(-1)!;
    if (newBand) bands.push({ id: d.band, label: labels.get(d.band) ?? d.band, from: i, to: i, heads: [] });
    const band = bands.at(-1)!;
    if (head) { y += BAND_HEAD; band.heads.push({ x: s.x, y: y - LANE_GAP, continued: !newBand }); }
    tops.push(y);
    segOf.push(segments.length - 1);
    s.to = i + 1;
    band.to = i + 1;
    y += heights[i] + LANE_GAP;
  });
  if (segments.length > 0) segments.at(-1)!.bottom = y - LANE_GAP;

  const places = new Map<string, readonly [number, number]>();
  const lanes: TraceLane[] = [];
  drafts.forEach((d, lane) => {
    const top = tops[lane];
    const height = heights[lane];
    const segX = segments[segOf[lane]].x;
    const at = [lane, lane] as const;
    const boxes: TraceBox[] = [];
    const hidden: TraceBox[] = [];
    /** Each id's box while the lane is not open (a hidden one's "+N more"), and while it is. */
    const shownBox = new Map<string, TraceBox>();
    const openBox = new Map<string, TraceBox>();
    for (const [column, items] of d.columns) {
      const shown = shownOf(items.length);
      // Each column centered in its lane; the Untraced lane's from its top, where its head sits.
      const colTop = d.obligation === null ? top : top + (height - stackH(shown)) / 2;
      const capped = shown < items.length;
      let more: TraceBox | null = null;
      items.forEach((it, n) => {
        const shared = it.role === 'record' && column !== 'obligation' ? holders.get(it.id)?.size ?? 0 : 0;
        const box: TraceBox = {
          key: `${lane}|${column}|${it.id}`, id: it.id, role: it.role, column, lane, x: segX + xOf.get(column)!, y: colTop + n * (BOX_H + ROW_GAP), w: BOX_W, h: BOX_H, opens: it.opens,
          notes: [...it.notes, ...(shared > 1 ? [`In ${shared} lanes`] : [])], words: it.words,
        };
        places.set(box.key, at);
        openBox.set(it.id, box);
        if (!capped || n < CELL_SHOWN) { boxes.push(box); shownBox.set(it.id, box); return; }
        hidden.push(box);
        if (!more) {
          const id = `more:${lane}:${column}`;
          more = { key: `${lane}|${column}|${id}`, id, role: 'more', column, lane, x: box.x, y: box.y, w: BOX_W, h: BOX_H, opens: it.opens, notes: [], words: moreWords(column, items.length - CELL_SHOWN, items.length) };
          places.set(more.key, at);
          boxes.push(more);
        }
        shownBox.set(it.id, more);
      });
    }
    places.set(`lane:${lane}`, at);
    /** The arrows between some boxes: one per pair of ends, a hidden record's going to its "+N more". */
    const linesBy = (by: ReadonlyMap<string, TraceBox>) => {
      const lines: TraceLine[] = [];
      const seen = new Set<string>();
      for (const [from, to] of d.links) {
        const a = by.get(from);
        const b = by.get(to);
        if (!a || !b || a === b) continue;
        const key = `${lane}|${a.id}|${b.id}`;
        if (seen.has(key)) continue;
        seen.add(key);
        lines.push({ key, source: a.id, target: b.id, from: a.key, to: b.key, tree: false, points: [{ x: a.x + a.w, y: a.y + a.h / 2 }, { x: b.x, y: b.y + b.h / 2 }] });
      }
      return lines;
    };
    const all = [...boxes.filter((b) => b.role !== 'more'), ...hidden];
    const open: OpenLane | null = hidden.length === 0 ? null : { boxes: all, lines: linesBy(openBox), bottom: Math.max(...hidden.map((b) => b.y + b.h)) };
    const left = Math.min(...boxes.map((b) => b.x));
    const right = Math.max(...boxes.map((b) => b.x + b.w));
    const band = bands.findIndex((b) => lane >= b.from && lane < b.to);
    lanes.push({ obligation: d.obligation, band, segment: segOf[lane], top, height, left, right, boxes, lines: linesBy(shownBox), gaps: d.gaps, open });
  });

  // The "why" tree, each band's in each column of lanes it runs in: a box per path prefix, as tall as the lanes beneath
  // it there, each joined to its children by a level line. A box a column's end splits goes on at the next column's top, "Continued".
  const tree: TraceMap['tree'] = { boxes: [], lines: [] };
  interface Span { why: Why; top: number; bottom: number; children: string[]; first: number; last: number; continued: boolean }
  const spans = new Map<string, Span>();
  const order: string[] = [];
  const begun = new Set<string>();
  lanes.forEach((l, i) => {
    const path = drafts[i].path;
    let prefix = `${l.band}`;
    path.forEach((s, depth) => {
      const parent = prefix;
      prefix = `${prefix}/${s.id}`;
      const key = `${l.segment}:${prefix}`;
      let span = spans.get(key);
      if (!span) {
        span = { why: s, top: l.top, bottom: l.top + l.height, children: [], first: i, last: i, continued: begun.has(prefix) };
        begun.add(prefix);
        spans.set(key, span);
        order.push(key);
        if (depth > 0) spans.get(`${l.segment}:${parent}`)!.children.push(key);
      }
      span.bottom = l.top + l.height;
      span.last = i;
      if (depth === path.length - 1 && !span.children.includes(`lane:${i}`)) span.children.push(`lane:${i}`);
    });
  });
  const treeBox = new Map<string, TraceBox>();
  for (const key of order) {
    const s = spans.get(key)!;
    const x = segments[lanes[s.first].segment].x + xOf.get(s.why.column)!;
    const box: TraceBox = { key: `tree${key}`, id: s.why.id, role: 'record', column: s.why.column, lane: -1, x, y: s.top, w: BOX_W, h: s.bottom - s.top, opens: s.why.id, notes: [...s.why.notes, ...(s.continued ? ['Continued'] : [])] };
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
  const byKey = new Map<string, TraceBox>();
  for (const b of [...tree.boxes, ...lanes.flatMap((l) => [...l.boxes, ...(l.open?.boxes ?? [])])]) {
    if (byKey.has(b.key)) continue;
    byKey.set(b.key, b);
    const list = copies.get(b.id);
    if (list) list.push(b); else copies.set(b.id, [b]);
  }
  const lanesOf = new Map<string, number[]>();
  lanes.forEach((l, i) => { if (l.obligation) { const list = lanesOf.get(l.obligation); if (list) list.push(i); else lanesOf.set(l.obligation, [i]); } });
  const traced = lanes.filter((l) => l.obligation !== null);
  return {
    product,
    lanes,
    bands,
    segments,
    tree,
    columns,
    segmentWidth,
    width: segments.length > 0 ? segments.at(-1)!.x + segmentWidth : 0,
    height: Math.max(0, ...segments.map((s) => s.bottom)),
    counts: { obligations: lanesOf.size, withGaps: new Set(traced.filter((l) => l.gaps.length > 0).map((l) => l.obligation)).size, untraced: untracedCount },
    copies,
    byKey,
    lanesOf,
    places,
  };
}

// ---------- Focusing: where the camera goes, what stays at full strength, and which lane is open ----------

/**
 * What focusing a record does on the map: a rectangle to frame, the box the camera centers on when it is too big, the
 * lanes kept at full strength (null for all), the lane drawn open (null for none), and the focus's own box (null for a
 * product or group, which has none).
 */
export interface TraceFocus { rect: MapRect; anchor: MapRect | null; lanes: ReadonlySet<number> | null; open: number | null; box: TraceBox | null }

/** A lane's bottom: its open form's while it is open. */
const bottomOf = (lane: TraceLane, open: boolean) => (open && lane.open ? Math.max(lane.top + lane.height, lane.open.bottom) : lane.top + lane.height);

/** The rectangle around some lanes, each across its column of lanes, the open one to its open form's bottom. */
function laneRect(map: TraceMap, lanes: readonly number[], open: number | null = null): MapRect {
  const x0 = Math.min(...lanes.map((i) => map.segments[map.lanes[i].segment].x));
  const x1 = Math.max(...lanes.map((i) => map.segments[map.lanes[i].segment].x + map.segmentWidth));
  const y0 = Math.min(...lanes.map((i) => map.lanes[i].top));
  const y1 = Math.max(...lanes.map((i) => bottomOf(map.lanes[i], i === open)));
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}
const boxRect = (b: TraceBox): MapRect => ({ x: b.x, y: b.y, w: b.w, h: Math.min(b.h, BOX_H) });
const range = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => from + i);
/** The lane to open for a box in it: its own, when it has an open form. */
const openFor = (map: TraceMap, lane: number) => (map.lanes[lane]?.open ? lane : null);

/** Where a record is on the map, or null when it is not drawn and nothing under it is. */
function focusAt(map: TraceMap, index: SpecIndex, focus: string, lane: number | null): TraceFocus | null {
  if (focus === map.product) return { rect: { x: 0, y: 0, w: map.width, h: map.height }, anchor: null, lanes: null, open: null, box: null };
  const copies = map.copies.get(focus) ?? [];
  // A box of the why tree (an outcome, a capability, a use case, an obligation's parent): it and every lane beneath it,
  // from its left edge; the copy over the lane arrived from, else the first.
  const tree = copies.filter((b) => b.lane < 0);
  if (tree.length > 0) {
    const over = (b: TraceBox) => { const [a, z] = map.places.get(b.key)!; return lane !== null && lane >= a && lane <= z; };
    const box = tree.find(over) ?? tree[0];
    const lanes = new Set(tree.flatMap((b) => { const [a, z] = map.places.get(b.key)!; return range(a, z); }));
    const right = map.segments[map.lanes[map.places.get(box.key)![0]].segment].x + map.segmentWidth;
    return { rect: { x: box.x, y: box.y, w: right - box.x, h: box.h }, anchor: null, lanes, open: null, box };
  }
  // An obligation: the lane arrived on, else its first, open and centered on it; every lane of it kept.
  const own = map.lanesOf.get(focus);
  if (own) {
    const at = lane !== null && own.includes(lane) ? lane : own[0];
    const box = map.lanes[at].boxes.find((b) => b.column === 'obligation')!;
    const open = openFor(map, at);
    return { rect: laneRect(map, [at], open), anchor: boxRect(box), lanes: new Set(own), open, box };
  }
  // A record or group with obligations under it (a domain, a stage, a folder): all their lanes, its Untraced records' lane too.
  const under = obligationsUnder(index, focus).flatMap((o) => map.lanesOf.get(o) ?? []);
  if (under.length > 0) {
    const untraced = map.lanes.length - 1;
    const kept = new Set(under);
    if (map.lanes[untraced]?.obligation === null && untracedUnder(index, focus).length > 0) kept.add(untraced);
    return { rect: laneRect(map, under), anchor: null, lanes: kept, open: null, box: null };
  }
  // A design, build or test record a chain holds, or an untraced one: the lane arrived on, else its first, open and
  // centered on it (in the Untraced lane, its own row); every lane holding a copy kept.
  if (copies.length > 0) {
    const box = copies.find((b) => b.lane === lane) ?? copies[0];
    const l = map.lanes[box.lane];
    const open = openFor(map, box.lane);
    const segX = map.segments[l.segment].x;
    const rect = l.obligation === null ? { x: segX, y: box.y, w: map.segmentWidth, h: box.h } : laneRect(map, [box.lane], open);
    return { rect, anchor: boxRect(box), lanes: new Set(copies.map((b) => b.lane)), open, box };
  }
  return null;
}

/**
 * What focusing a record does on its product's map (LA-V98-R08): the product frames the whole map; a tree box frames
 * itself and its lanes; an obligation, or a record a chain holds, its lane (the one `lane` names when it is in one, as
 * the arrow keys arrived on it, else its first), open and centered on its box, every copy kept; a record or group with
 * obligations under it frames all their lanes; any other record frames the nearest container above it that is drawn
 * (an entity its aggregate), and the product when none is.
 */
export function traceFocus(map: TraceMap, index: SpecIndex, focus: string, lane: number | null = null): TraceFocus {
  for (let at: string | null = focus; at !== null; at = treeParent(index, at)) {
    const found = focusAt(map, index, at, lane);
    if (found) return found;
  }
  return focusAt(map, index, map.product, null)!;
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

type Rect = { x0: number; y0: number; x1: number; y1: number };
const meets = (r: Rect) => (b: { x: number; y: number; w: number; h: number }) => b.x + b.w >= r.x0 && b.x <= r.x1 && b.y + b.h >= r.y0 && b.y <= r.y1;

/** In each column of lanes a rectangle crosses, the lanes it reaches: found by halving, the lanes being in order down a column. */
function lanesMeeting(map: TraceMap, r: Rect): number[] {
  const out: number[] = [];
  for (const s of map.segments) {
    if (s.x > r.x1 || s.x + map.segmentWidth < r.x0) continue;
    let lo = s.from;
    let hi = s.to;
    while (lo < hi) { const mid = (lo + hi) >> 1; if (map.lanes[mid].top + map.lanes[mid].height < r.y0) lo = mid + 1; else hi = mid; }
    for (let i = lo; i < s.to && map.lanes[i].top <= r.y1; i++) out.push(i);
  }
  return out;
}

/** Whether a lane's box lies under the open lane's open form, which is drawn over it. */
function coveredBy(map: TraceMap, open: number | null): (lane: number, y: number) => boolean {
  const o = open === null ? undefined : map.lanes[open];
  if (!o?.open) return () => false;
  const bottom = o.open.bottom + LANE_GAP / 2;
  return (lane, y) => lane > open! && map.lanes[lane].segment === o.segment && y < bottom;
}

/** A lane's boxes and arrows as drawn: its open form while it is the open one. */
export const drawnLane = (lane: TraceLane, isOpen: boolean): { boxes: readonly TraceBox[]; lines: readonly TraceLine[] } => (isOpen && lane.open ? lane.open : lane);

/**
 * What a rectangle of the map holds, as drawn with the `open` lane open: the tree's boxes and lines that meet it, and
 * the lanes', the open lane's open form instead of its shown boxes and the boxes it covers left out.
 */
export function visibleIn(map: TraceMap, r: Rect, open: number | null = null): { boxes: TraceBox[]; lines: TraceLine[] } {
  const inside = meets(r);
  const covered = coveredBy(map, open);
  const hiddenKeys = new Set<string>();
  const boxes = map.tree.boxes.filter(inside);
  const lanes = lanesMeeting(map, r);
  if (open !== null && map.lanes[open]?.open && !lanes.includes(open) && inside({ x: map.lanes[open].left, y: map.lanes[open].top, w: map.lanes[open].right - map.lanes[open].left, h: bottomOf(map.lanes[open], true) - map.lanes[open].top })) lanes.push(open);
  const lines: TraceLine[] = [];
  for (const i of lanes) {
    const drawn = drawnLane(map.lanes[i], i === open);
    for (const b of drawn.boxes) {
      if (covered(i, b.y)) { hiddenKeys.add(b.key); continue; }
      if (inside(b)) boxes.push(b);
    }
    for (const l of drawn.lines) {
      if (hiddenKeys.has(l.from) || hiddenKeys.has(l.to)) continue;
      if (Math.max(l.points[0].x, l.points[1].x) >= r.x0 && Math.min(l.points[0].x, l.points[1].x) <= r.x1) lines.push(l);
    }
  }
  for (const l of map.tree.lines) {
    if (l.points[0].y < r.y0 || l.points[0].y > r.y1 || l.points[1].x < r.x0 || l.points[0].x > r.x1) continue;
    const to = map.byKey.get(l.to);
    if (to && to.lane >= 0 && covered(to.lane, to.y)) continue;
    lines.push(l);
  }
  return { boxes, lines };
}

/**
 * Far out, what a rectangle holds without its lanes' boxes: the lanes that meet it (each drawn as one bar, the open
 * lane's to its open form's bottom, the lanes it covers left out) and the tree's boxes.
 */
export function lanesIn(map: TraceMap, r: Rect, open: number | null = null): { lanes: { lane: number; x: number; y: number; w: number; h: number }[]; tree: TraceBox[] } {
  const covered = coveredBy(map, open);
  const lanes = lanesMeeting(map, r);
  if (open !== null && map.lanes[open]?.open && !lanes.includes(open)) lanes.push(open);
  const out = [];
  for (const i of lanes) {
    const l = map.lanes[i];
    if (l.right < r.x0 || l.left > r.x1 || covered(i, l.top)) continue;
    out.push({ lane: i, x: l.left, y: l.top, w: l.right - l.left, h: bottomOf(l, i === open) - l.top });
  }
  return { lanes: out, tree: map.tree.boxes.filter(meets(r)) };
}

/** Every box of the map as drawn with no lane open, the tree's first. */
export const allBoxes = (map: TraceMap): TraceBox[] => [...map.tree.boxes, ...map.lanes.flatMap((l) => l.boxes)];
