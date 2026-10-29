import type { ProductTraces } from '../../../lathe/src/traceability/trace/read-model';
import type { SpecIndex } from '../specs/data';
import { layoutTree, type GraphMap } from '../graph/map';
import { treeChildren, treeParent } from '../graph/tree';
import { treeLabel, type MapLabel } from '../graph/text';
import { faintest, keptFade, type Fade, type FadeLook } from '../graph/fade';
import { onePerData } from '../graph/one-map';
import { fileKey, traceChain, untracedUnder, type GapColumn } from './chain';
import { OUTSIDE, traceTop, UNTRACED } from './top';

// The Trace stage's map (LA-V98), pure and tested directly: one tree per product, laid out once per product and data
// change by the Graph's own Tree layout (graph/map.ts layoutTree), so it sizes, paints and moves as the Graph's Tree
// does (LA-EXP-DS06, LA-PAT-APP-UX-R19). Only the children rule differs: branches follow trace links, not stages and
// folders, so each trace reads left to right from a business outcome to its tests.
//
// - The top (top.ts): the product, its business outcomes each holding the use cases of the capabilities serving it and
//   the record tree down to their requirements, then Not under an outcome holding every obligation no outcome reaches by
//   domain, and the Untraced mark last. A use case's kind line names its capability, which is not drawn.
// - Below an obligation, first a dashed gap box for each gap coverage reports (not designed, not built, not proved),
//   then its chain to the right by the chain's actual links (TraceRow.links): flow step, flow, view, command, technical
//   record, test, file. A record reached by several links of one chain sits under the first; a record of the chain no
//   link reaches hangs from the obligation. A record several places hold (a use case under two outcomes and all under it,
//   a command several chains hold) is repeated in each, every copy noting in how many places it is.
// - The Untraced mark holds each record coverage reports untraced, in the schema's kind order.
//
// Every node has a key unique in the map: a record above the chains as top.ts keys it (`<outcome>|<id>` under an
// outcome, its ID under Not under an outcome), a chain's record `<obligation key>|<id>`, a file `<obligation
// key>|file:<path>`, a gap `gap:<obligation key>:<column>`, an untraced record `untraced|<id>`, the branch and the mark
// their own. A node's `id` is the record it stands for (shared by every copy), or its key when it is none.

/** What a node is: a record, a file a record names, a gap, the Not under an outcome branch, or the Untraced mark. */
export type TraceRole = 'record' | 'file' | 'gap' | 'outside' | 'untraced';

export interface TraceNode {
  key: string;
  /** The record it is (every copy shares it); its key for a node that is no record. */
  id: string;
  role: TraceRole;
  /** The record a click or Enter opens: itself, a file's first naming record; null for a gap, the branch or the mark. */
  opens: string | null;
  /** The key of the obligation whose chain it sits in (its own for an obligation), or null above the chains and under Untraced. */
  chain: string | null;
  /** Its words when it is no record: a file's path, a gap's, the branch's, the mark's. */
  words?: { title: string; meta: string };
  /** A note after its kind and ID line: a use case's capability, how many places hold a record. */
  note?: string;
}

/** One product's Trace map: the Graph's Tree map of its tree, and what each node is. */
export interface TraceMap {
  product: string;
  map: GraphMap;
  nodes: ReadonlyMap<string, TraceNode>;
  /** Every node of each record ID, in the tree's order. */
  copies: ReadonlyMap<string, readonly string[]>;
  /** The keys whose line from their parent is a link of a chain (drawn as an arrow) rather than the tree's. */
  links: ReadonlySet<string>;
  /** The obligations' keys with a gap, and the keys above them: what Gaps only keeps. */
  gapped: ReadonlySet<string>;
  above: ReadonlySet<string>;
  /** How many obligations it traces, how many of those have a gap, and how many records are untraced (each counted once). */
  counts: { obligations: number; withGaps: number; untraced: number };
}

/** A gap's words, by its column. */
const GAP_WORDS: Record<GapColumn, string> = { design: 'Not designed', build: 'Not built', tests: 'Not proved' };

/** A product's tree: each key's children and what it is. */
interface Built { children: Map<string, string[]>; nodes: Map<string, TraceNode>; links: Set<string>; gapped: Set<string>; obligations: number; withGaps: number; untraced: number }

function build(index: SpecIndex, traces: ProductTraces, product: string): Built {
  const untracedIds = untracedUnder(index, traces, product).flatMap((g) => g.ids);
  const top = traceTop(index, product, untracedIds.length > 0);
  const children = new Map<string, string[]>();
  const nodes = new Map<string, TraceNode>();
  const links = new Set<string>();
  const gapped = new Set<string>();
  const add = (parent: string, child: string) => { const list = children.get(parent); if (list) { if (!list.includes(child)) list.push(child); } else children.set(parent, [child]); };
  const record = (key: string, id: string, chain: string | null) => {
    if (!nodes.has(key)) nodes.set(key, { key, id, role: 'record', opens: id, chain });
  };

  // The top: the product down to each obligation.
  for (const [key, kids] of top.children) for (const k of kids) add(key, k);
  for (const [key, id] of top.ids) record(key, id, null);
  if (top.children.has(OUTSIDE)) {
    nodes.set(OUTSIDE, { key: OUTSIDE, id: OUTSIDE, role: 'outside', opens: null, chain: null, words: { title: 'Not under an outcome', meta: `${top.outside} ${top.outside === 1 ? 'obligation' : 'obligations'} no outcome reaches` } });
  }

  // Each obligation's gaps and chain, in each place it sits.
  const gappedIds = new Set<string>();
  for (const { key: o, id } of top.obligations) {
    const row = traceChain(index, traces, id)!;
    nodes.get(o)!.chain = o;
    if (row.gaps.length > 0) { gapped.add(o); gappedIds.add(id); }
    for (const gap of row.gaps) {
      const key = `gap:${o}:${gap}`;
      add(o, key);
      nodes.set(key, { key, id: key, role: 'gap', opens: null, chain: o, words: { title: GAP_WORDS[gap], meta: `Gap · ${id}` } });
    }
    // The chain by its links, breadth first from the obligation: each record once, under the first record linking to it.
    const keyOf = (r: string) => (r === id ? o : `${o}|${r}`);
    const out = new Map<string, string[]>();
    for (const [from, to] of row.links) { const list = out.get(from); if (list) list.push(to); else out.set(from, [to]); }
    const placed = new Set([id]);
    const queue = [id];
    const place = (from: string, r: string, linked: boolean) => {
      if (placed.has(r)) return;
      placed.add(r);
      queue.push(r);
      const key = keyOf(r);
      add(keyOf(from), key);
      if (linked) links.add(key);
      if (r.startsWith('file:')) {
        const file = row.files.find((f) => fileKey(f.path) === r)!;
        nodes.set(key, { key, id: r, role: 'file', opens: file.namedBy[0], chain: o, words: { title: file.path, meta: `File · named by ${file.namedBy.join(', ')}` } });
      } else record(key, r, o);
    };
    for (let i = 0; i < queue.length; i++) for (const to of out.get(queue[i]) ?? []) place(queue[i], to, true);
    for (const r of [...row.design, ...row.build, ...row.tests, ...row.files.map((f) => fileKey(f.path))]) place(id, r, false);
  }

  if (untracedIds.length > 0) {
    nodes.set(UNTRACED, { key: UNTRACED, id: UNTRACED, role: 'untraced', opens: null, chain: null, words: { title: 'Untraced', meta: `${untracedIds.length} ${untracedIds.length === 1 ? 'record' : 'records'} no chain reaches` } });
    for (const id of untracedIds) { const key = `${UNTRACED}|${id}`; add(UNTRACED, key); record(key, id, null); }
  }
  const obligations = new Set(top.obligations.map((p) => p.id)).size;
  return { children, nodes, links, gapped, obligations, withGaps: gappedIds.size, untraced: untracedIds.length };
}

/** A use case's capability, named on its kind line as the tree draws no capability. */
function capabilityNote(index: SpecIndex, id: string): string | undefined {
  const record = index.byId.get(id);
  if (record?.kind !== 'use_case' || !record.parent) return undefined;
  const capability = index.byId.get(record.parent);
  return capability?.kind === 'capability' ? capability.title : undefined;
}

/** A node's label on its box: its words when it is no record, else the record's as the Graph's Tree labels it, with its note. */
export function nodeLabel(index: SpecIndex, n: TraceNode): MapLabel {
  if (n.words) return { ...n.words, shape: 'box' };
  const label = treeLabel(index, n.id);
  return n.note ? { ...label, meta: `${label.meta} · ${n.note}` } : label;
}

/** Each Trace read's layouts, one per product and data change. */
const mapsOf = new WeakMap<ProductTraces, (index: SpecIndex, product: string) => TraceMap>();

/**
 * A product's Trace map, laid out once per product and data change (one-map.ts) by the Graph's Tree layout, and again
 * for each answer of its Trace read (list-traces), which follows each data change.
 */
export function traceMap(index: SpecIndex, traces: ProductTraces, product: string): TraceMap {
  let layout = mapsOf.get(traces);
  if (!layout) { layout = onePerData((i, p) => layOut(i, traces, p)); mapsOf.set(traces, layout); }
  return layout(index, product);
}

function layOut(index: SpecIndex, traces: ProductTraces, product: string): TraceMap {
  const built = build(index, traces, product);
  const { nodes, children } = built;
  // Every copy of each record, in the tree's order: depth first from the product.
  const copies = new Map<string, string[]>();
  const visit = (key: string) => {
    const n = nodes.get(key)!;
    const list = copies.get(n.id);
    if (list) list.push(key); else copies.set(n.id, [key]);
    for (const c of children.get(key) ?? []) visit(c);
  };
  visit(product);
  for (const n of nodes.values()) {
    if (n.role !== 'record') continue;
    const count = copies.get(n.id)!.length;
    const note = [capabilityNote(index, n.id), count > 1 ? `in ${count} places` : undefined].filter(Boolean).join(' · ');
    if (note) n.note = note;
  }
  const map = layoutTree([product], (key) => children.get(key) ?? [], (key) => nodeLabel(index, nodes.get(key)!));
  // The keys above an obligation with a gap.
  const above = new Set<string>();
  for (const o of built.gapped) for (let up = map.nodes.get(o)?.parent ?? null; up !== null && !above.has(up); up = map.nodes.get(up)?.parent ?? null) above.add(up);
  return {
    product, map, nodes, copies, links: built.links, gapped: built.gapped, above,
    counts: { obligations: built.obligations, withGaps: built.withGaps, untraced: built.untraced },
  };
}

// ---------- Focusing ----------

/**
 * The node a focus stands on (LA-V98-R08): the product's root; a record's copy the walk or a click arrived on (`at`),
 * else its first; a capability, which the tree does not draw, the first copy of its first use case drawn; for anything
 * else (an entity, a stage, a folder, a domain with nothing under Not under an outcome) the nearest record above it in
 * the record tree that the map draws, and the product when none is.
 */
export function focusKey(map: TraceMap, index: SpecIndex, focus: string, at: string | null = null): string {
  if (focus === map.product) return map.product;
  for (let id: string | null = focus; id !== null; id = treeParent(index, id)) {
    const keys = map.copies.get(id);
    if (keys) return at && keys.includes(at) ? at : keys[0];
    if (index.byId.get(id)?.kind === 'capability') {
      const first = treeChildren(index, id).find((c) => map.copies.has(c));
      if (first) return map.copies.get(first)![0];
    }
  }
  return map.product;
}

/** A record's copy in the chain of an obligation's node (its key), when that chain holds it. */
export const copyInChain = (map: TraceMap, id: string, chain: string | null): string | undefined =>
  chain === null ? undefined : map.copies.get(id)?.find((k) => map.nodes.get(k)!.chain === chain);

/** Whether a key lies under (or is) one of some keys. */
function under(map: TraceMap, key: string, tops: ReadonlySet<string>): boolean {
  for (let at: string | null = key; at !== null; at = map.map.nodes.get(at)?.parent ?? null) if (tops.has(at)) return true;
  return false;
}

/**
 * How strongly each place is drawn (LA-PAT-APP-UX-R19), as the Graph's Tree fades (graph/fade.ts): the focus's node and
 * everything under it at full strength, every copy of a record the focus is; under Gaps only, the obligations with a
 * gap, their chains and the branches above them, and the Untraced mark with what it holds; everything else faded back,
 * never taken out.
 */
export function traceFade(map: TraceMap, kept: ReadonlySet<string> | null, gapsOnly: boolean, look: Pick<FadeLook, 'focusFade'>): Fade {
  const memo = (test: (key: string) => boolean) => { const known = new Map<string, boolean>(); return (key: string) => { let v = known.get(key); if (v === undefined) { v = test(key); known.set(key, v); } return v; }; };
  const fades: Fade[] = [];
  if (kept) fades.push(keptFade(memo((key) => under(map, key, kept)), look));
  if (gapsOnly) {
    const tops = new Set([...map.gapped, UNTRACED]);
    fades.push(keptFade(memo((key) => map.above.has(key) || under(map, key, tops)), look));
  }
  return fades.length === 0 ? () => 1 : faintest(...fades);
}

/** The keys a focus keeps at full strength: the product keeps everything (null); a record every copy of it; anything else its node. */
export function keptFor(map: TraceMap, focus: string, key: string): ReadonlySet<string> | null {
  if (key === map.product) return null;
  const node = map.nodes.get(key)!;
  return new Set(node.id === focus ? map.copies.get(focus) ?? [key] : [key]);
}

/** The key of a parent's line to a child: `<parent>><child>`. */
export const lineKey = (parent: string, child: string) => `${parent}>${child}`;

/** The lines touching some keys: each one's line from its parent and to each child. */
export function linesAt(map: TraceMap, keys: readonly string[]): { key: string; from: string; to: string }[] {
  const out: { key: string; from: string; to: string }[] = [];
  for (const k of keys) {
    const n = map.map.nodes.get(k);
    if (!n) continue;
    if (n.parent !== null) out.push({ key: lineKey(n.parent, k), from: n.parent, to: k });
    for (const c of n.children) out.push({ key: lineKey(k, c), from: k, to: c });
  }
  return out;
}
