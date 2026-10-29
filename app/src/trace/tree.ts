import type { SpecIndex } from '../specs/data';
import { layoutTree, type GraphMap } from '../graph/map';
import { treeParent } from '../graph/tree';
import { treeLabel, type MapLabel } from '../graph/text';
import { faintest, keptFade, type Fade, type FadeLook } from '../graph/fade';
import { onePerData } from '../graph/one-map';
import { fileKey, obligationsUnder, traceChain, untracedUnder, type GapColumn } from './chain';
import { linkTarget, pathOf, traceTop, UNTRACED } from './top';

// The Trace stage's map (LA-V98), pure and tested directly: one tree per product, laid out once per product and data
// change by the Graph's own Tree layout (graph/map.ts layoutTree), so it sizes, paints and moves as the Graph's Tree
// does (LA-EXP-DS06, LA-PAT-APP-UX-R19). Only the children rule differs: branches follow trace links, not stages and
// folders.
//
// - The top (top.ts): the product, its outcomes with a link to each capability serving them, its domains holding their
//   obligations' parents side by side, the parents of its own obligations, and the Untraced mark last.
// - Below a parent, the record tree down to each obligation (a capability's use cases, their requirements; an
//   aggregate's invariants; a view's requirements), only the branches that lead to one.
// - Below an obligation, first a dashed gap box for each gap coverage reports (not designed, not built, not proved),
//   then its chain to the right by the chain's actual links (TraceRow.links): flow step, flow, view, command, technical
//   record, test, file. A record reached by several links of one chain sits under the first; a record of the chain no
//   link reaches hangs from the obligation. A record several chains hold is repeated in each, every copy noting in how
//   many places it is.
// - The Untraced mark holds each record coverage reports untraced, in the schema's kind order.
//
// Every node has a key unique in the map: a record on the path to an obligation (and the product, an outcome, a domain)
// by its ID, a chain's record `<obligation>|<id>`, a file `<obligation>|file:<path>`, a gap `gap:<obligation>:<column>`,
// a link `link:<outcome>:<capability>`, an untraced record `untraced|<id>`. A node's `id` is the record it stands for
// (shared by every copy), or its key when it is none.

/** What a node is: a record, a file a record names, a gap, a link to a capability, or the Untraced mark. */
export type TraceRole = 'record' | 'file' | 'gap' | 'link' | 'untraced';

export interface TraceNode {
  key: string;
  /** The record it is (every copy shares it); its key for a node that is no record. */
  id: string;
  role: TraceRole;
  /** The record a click or Enter opens: itself, a link's capability, a file's first naming record; null for a gap or the mark. */
  opens: string | null;
  /** The obligation whose chain it sits in (itself for an obligation), or null above the chains and under Untraced. */
  chain: string | null;
  /** Its words when it is no record: a file's path, a gap's, a link's capability, the mark's. */
  words?: { title: string; meta: string };
  /** A note after its kind and ID line: the outcomes a capability serves, how many places hold a record. */
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
  /** The obligations with a gap, and the keys above them: what Gaps only keeps. */
  gapped: ReadonlySet<string>;
  above: ReadonlySet<string>;
  /** How many obligations it traces, how many of those have a gap, and how many records are untraced. */
  counts: { obligations: number; withGaps: number; untraced: number };
}

/** A gap's words, by its column. */
const GAP_WORDS: Record<GapColumn, string> = { design: 'Not designed', build: 'Not built', tests: 'Not proved' };

/** A product's tree: each key's children and what it is. */
interface Built { children: Map<string, string[]>; nodes: Map<string, TraceNode>; links: Set<string>; gapped: Set<string>; untraced: number }

function build(index: SpecIndex, product: string): Built {
  const untracedIds = untracedUnder(index, product).flatMap((g) => g.ids);
  const top = traceTop(index, product, untracedIds.length > 0);
  const children = new Map<string, string[]>();
  const nodes = new Map<string, TraceNode>();
  const links = new Set<string>();
  const gapped = new Set<string>();
  const add = (parent: string, child: string) => { const list = children.get(parent); if (list) { if (!list.includes(child)) list.push(child); } else children.set(parent, [child]); };
  const record = (key: string, id: string, chain: string | null, extra: Partial<TraceNode> = {}) => {
    if (!nodes.has(key)) nodes.set(key, { key, id, role: 'record', opens: id, chain, ...extra });
  };

  record(product, product, null);
  for (const [key, kids] of top) {
    if (key !== UNTRACED && index.byId.has(key)) record(key, key, null);
    for (const k of kids) {
      add(key, k);
      const capability = linkTarget(k);
      if (capability) {
        const title = index.byId.get(capability)?.title ?? capability;
        nodes.set(k, { key: k, id: k, role: 'link', opens: capability, chain: null, words: { title, meta: `Link · ${capability}` } });
      } else if (k !== UNTRACED) record(k, k, null);
    }
  }

  // The record tree from each parent down to its obligations, then each obligation's gaps and chain.
  for (const o of obligationsUnder(index, product)) {
    const { owner, path } = pathOf(index, o);
    if (owner === null || !top.has(owner) || path.length === 0) continue;
    for (let i = 1; i < path.length; i++) { add(path[i - 1], path[i]); record(path[i], path[i], null); }
    const row = traceChain(index, o)!;
    nodes.get(o)!.chain = o;
    if (row.gaps.length > 0) gapped.add(o);
    for (const gap of row.gaps) {
      const key = `gap:${o}:${gap}`;
      add(o, key);
      nodes.set(key, { key, id: key, role: 'gap', opens: null, chain: o, words: { title: GAP_WORDS[gap], meta: `Gap · ${o}` } });
    }
    // The chain by its links, breadth first from the obligation: each record once, under the first record linking to it.
    const keyOf = (id: string) => (id === o ? o : `${o}|${id}`);
    const out = new Map<string, string[]>();
    for (const [from, to] of row.links) { const list = out.get(from); if (list) list.push(to); else out.set(from, [to]); }
    const placed = new Set([o]);
    const queue = [o];
    const place = (from: string, id: string, linked: boolean) => {
      if (placed.has(id)) return;
      placed.add(id);
      queue.push(id);
      const key = keyOf(id);
      add(keyOf(from), key);
      if (linked) links.add(key);
      if (id.startsWith('file:')) {
        const file = row.files.find((f) => fileKey(f.path) === id)!;
        nodes.set(key, { key, id, role: 'file', opens: file.namedBy[0], chain: o, words: { title: file.path, meta: `File · named by ${file.namedBy.join(', ')}` } });
      } else record(key, id, o);
    };
    for (let i = 0; i < queue.length; i++) for (const to of out.get(queue[i]) ?? []) place(queue[i], to, true);
    for (const id of [...row.design, ...row.build, ...row.tests, ...row.files.map((f) => fileKey(f.path))]) place(o, id, false);
  }

  if (untracedIds.length > 0) {
    nodes.set(UNTRACED, { key: UNTRACED, id: UNTRACED, role: 'untraced', opens: null, chain: null, words: { title: 'Untraced', meta: `${untracedIds.length} ${untracedIds.length === 1 ? 'record' : 'records'} no chain reaches` } });
    for (const id of untracedIds) { const key = `${UNTRACED}|${id}`; add(UNTRACED, key); record(key, id, null); }
  }
  return { children, nodes, links, gapped, untraced: untracedIds.length };
}

/** "Serves LA-BO01, LA-BO04": the outcomes a capability serves, as the note on its box. */
function servesNote(index: SpecIndex, id: string): string | undefined {
  if (index.byId.get(id)?.kind !== 'capability') return undefined;
  const outcomes = (index.outgoing.get(id) ?? []).filter((l) => l.relation === 'serves' && index.byId.has(l.target)).map((l) => l.target);
  return outcomes.length > 0 ? `serves ${outcomes.join(', ')}` : undefined;
}

/** A product's Trace map, laid out once per product and data change (one-map.ts) by the Graph's Tree layout. */
export const traceMap = onePerData((index: SpecIndex, product: string): TraceMap => {
  const built = build(index, product);
  const { nodes, children } = built;
  const copies = new Map<string, string[]>();
  for (const n of nodes.values()) { const list = copies.get(n.id); if (list) list.push(n.key); else copies.set(n.id, [n.key]); }
  for (const n of nodes.values()) {
    if (n.role === 'record') n.note = servesNote(index, n.id);
    const count = copies.get(n.id)!.length;
    if (n.role === 'record' && count > 1) n.note = [n.note, `in ${count} places`].filter(Boolean).join(' · ');
  }
  const labelOf = (key: string): MapLabel => {
    const n = nodes.get(key)!;
    if (n.words) return { ...n.words, shape: 'box' };
    const label = treeLabel(index, n.id);
    return n.note ? { ...label, meta: `${label.meta} · ${n.note}` } : label;
  };
  const map = layoutTree([product], (key) => children.get(key) ?? [], labelOf);
  // The keys above an obligation with a gap.
  const above = new Set<string>();
  for (const o of built.gapped) for (let up = map.nodes.get(o)?.parent ?? null; up !== null && !above.has(up); up = map.nodes.get(up)?.parent ?? null) above.add(up);
  const obligations = [...nodes.values()].filter((n) => n.chain === n.key).length;
  return {
    product, map, nodes, copies, links: built.links, gapped: built.gapped, above,
    counts: { obligations, withGaps: built.gapped.size, untraced: built.untraced },
  };
});

// ---------- Focusing ----------

/**
 * The node a focus stands on (LA-V98-R08): the product's root; a record's copy the walk or a click arrived on (`at`),
 * else its first; for anything else (an entity, a stage, a folder) the nearest record above it in the record tree that
 * the map draws, and the product when none is.
 */
export function focusKey(map: TraceMap, index: SpecIndex, focus: string, at: string | null = null): string {
  if (focus === map.product) return map.product;
  for (let id: string | null = focus; id !== null; id = treeParent(index, id)) {
    const keys = map.copies.get(id);
    if (!keys) continue;
    return at && keys.includes(at) ? at : keys[0];
  }
  return map.product;
}

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

/** Every key of a parent's line to a child: `<parent>>child`. */
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
