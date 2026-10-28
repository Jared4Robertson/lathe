import { byIdOrder, type SpecIndex, type SpecRecord } from '../specs/data';
import { treeChildren, treeParent } from '../graph/tree';
import { isObligation } from './offer';

// The Trace view's logic (LA-TRC-UC10), pure and tested directly: an obligation's traceability
// chain, and the matrix of every obligation under a record or group.
//
// The engine owns what traces to what (Workspace.chains, worked out with coverage) and what is
// missing (Coverage.gaps): this only reads them. A chain reads left to right in four columns after
// the obligation: what designs it (for a UC requirement the flow steps that fulfill it, their flows,
// the views they happen in, the commands and queries they invoke and the integrations they exchange
// with; a constraint's value object; an invariant's aggregate; a policy's command), the technical
// records that build it, its tests, and the files those name. Its gaps are coverage's: not
// designed, not built, not proved. A record of a kind a chain reaches that no chain does is
// coverage's record-untraced gap. A matrix is one chain per obligation under the focus, in the
// tree's order (graph/tree.ts, the nav's tree), grouped by each obligation's parent.

/** The columns after the obligation, left to right. */
export type TraceColumn = 'design' | 'build' | 'tests' | 'files';
export const TRACE_COLUMNS: readonly TraceColumn[] = ['design', 'build', 'tests', 'files'];
export const TRACE_COLUMN_LABELS: Record<TraceColumn, string> = { design: 'Design', build: 'Build', tests: 'Tests', files: 'Files' };

/** The columns a coverage gap falls in: not designed, not built, not proved. */
export type GapColumn = 'design' | 'build' | 'tests';
const GAP_COLUMN: Record<string, GapColumn> = { designed: 'design', built: 'build', proved: 'tests' };

/** A file a technical record or a test names, with the records that name it. */
export interface TraceFile {
  path: string;
  namedBy: string[];
}

/** One obligation's chain: a matrix row, or the Trace view's columns for one obligation. */
export interface TraceRow {
  obligation: string;
  design: string[];
  build: string[];
  tests: string[];
  files: TraceFile[];
  /** Its gaps, as coverage reports them wherever it is owed, in column order. */
  gaps: GapColumn[];
  /** Whether only proof is asked of its kind (a pattern rule), as coverage says: its design and build are not owed. */
  proofOnly: boolean;
  /**
   * The chain's links, each from the record nearer the obligation to the one it leads to, left to right, as the engine
   * gives them, and from each build or test record to a file it names (`file:<path>`, fileKey). What the Trace stage
   * draws its arrows from.
   */
  links: readonly (readonly [string, string])[];
}

/** A file's key among a chain's links and the Trace stage's boxes. */
export const fileKey = (path: string) => `file:${path}`;

interface Found {
  /** Each obligation's coverage gaps, by what it misses, over every scope that owes it. */
  missing: Map<string, Set<string>>;
  /** The records coverage reports untraced. */
  untraced: Set<string>;
  /** The kinds whose obligations owe only proof. */
  proofOnly: Set<string>;
}

const foundCache = new WeakMap<SpecIndex, Found>();
/** What coverage reports, read once per index. */
function found(index: SpecIndex): Found {
  let known = foundCache.get(index);
  if (known) return known;
  known = { missing: new Map(), untraced: new Set(), proofOnly: new Set() };
  for (const c of index.coverage.values()) {
    for (const o of c.obligations) if (o.proof_only) known.proofOnly.add(o.kind);
    for (const g of c.gaps) {
      if (g.missing === 'record-untraced') { known.untraced.add(g.id); continue; }
      if (!GAP_COLUMN[g.missing]) continue;
      const set = known.missing.get(g.id);
      if (set) set.add(g.missing); else known.missing.set(g.id, new Set([g.missing]));
    }
  }
  foundCache.set(index, known);
  return known;
}

/** Whether coverage reports a record untraced: of a kind a chain reaches, and reached by none. */
export const isUntraced = (index: SpecIndex, id: string): boolean => found(index).untraced.has(id);

const chains = new WeakMap<SpecIndex, Map<string, TraceRow | null>>();
/** An obligation's chain, or null for any other record, read once per index: the matrix and Untraced share them. */
export function traceChain(index: SpecIndex, id: string): TraceRow | null {
  let known = chains.get(index);
  if (!known) { known = new Map(); chains.set(index, known); }
  if (!known.has(id)) known.set(id, rowOf(index, id));
  return known.get(id)!;
}

function rowOf(index: SpecIndex, id: string): TraceRow | null {
  if (!isObligation(index, id)) return null;
  const chain = index.chains.get(id);
  const files = (chain?.files ?? []).map((f) => ({ path: f.path, namedBy: f.named_by }));
  const missing = found(index).missing.get(id) ?? new Set<string>();
  return {
    obligation: id,
    design: chain?.design ?? [],
    build: chain?.build ?? [],
    tests: chain?.tests ?? [],
    files,
    gaps: (['designed', 'built', 'proved'] as const).filter((m) => missing.has(m)).map((m) => GAP_COLUMN[m]),
    proofOnly: found(index).proofOnly.has(index.byId.get(id)!.kind),
    links: [...(chain?.links ?? []), ...files.flatMap((f) => f.namedBy.map((r) => [r, fileKey(f.path)] as const))],
  };
}

/** Every obligation under a record or group in the tree (itself, when it is one), in the tree's order. */
export function obligationsUnder(index: SpecIndex, focus: string): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const walk = (id: string) => {
    if (seen.has(id)) return;
    seen.add(id);
    if (isObligation(index, id)) out.push(id);
    for (const c of treeChildren(index, id)) walk(c);
  };
  walk(focus);
  return out;
}

// ---------- Untraced: what no obligation's chain reaches, as coverage reports it ----------

const holdersCache = new WeakMap<SpecIndex, Map<string, string[]>>();
/** For every record some obligation's chain holds, in the whole space, the obligations whose chains hold it; read once per index. */
function holders(index: SpecIndex): Map<string, string[]> {
  let known = holdersCache.get(index);
  if (known) return known;
  known = new Map();
  for (const chain of index.chains.values()) {
    if (!index.byId.has(chain.obligation)) continue;
    for (const id of new Set([...chain.design, ...chain.build, ...chain.tests])) {
      const by = known.get(id);
      if (by) by.push(chain.obligation); else known.set(id, [chain.obligation]);
    }
  }
  holdersCache.set(index, known);
  return known;
}

const kindRanks = new WeakMap<SpecIndex, Map<string, number>>();
/** IDs in the schema's kind order, then by ID. */
function inKindOrder(index: SpecIndex, ids: readonly string[]): string[] {
  let rank = kindRanks.get(index);
  if (!rank) { rank = new Map(index.workspace.kinds.map((k, i) => [k.kind, i])); kindRanks.set(index, rank); }
  const ranks = rank;
  const of = (id: string) => ranks.get(index.byId.get(id)?.kind ?? '') ?? ranks.size;
  return [...ids].sort((a, b) => of(a) - of(b) || byIdOrder({ id: a }, { id: b }));
}

/** A kind's untraced records under the focus. */
export interface UntracedGroup { kind: string; ids: string[] }

/** The records under a record or group that coverage reports untraced, by kind in the schema's order. */
export function untracedUnder(index: SpecIndex, focus: string): UntracedGroup[] {
  const listed: string[] = [];
  const seen = new Set<string>();
  const walk = (id: string) => {
    if (seen.has(id)) return;
    seen.add(id);
    if (isUntraced(index, id)) listed.push(id);
    for (const c of treeChildren(index, id)) walk(c);
  };
  walk(focus);
  const byKind = new Map<string, string[]>();
  for (const id of inKindOrder(index, listed)) {
    const kind = index.byId.get(id)!.kind;
    const ids = byKind.get(kind);
    if (ids) ids.push(id); else byKind.set(kind, [id]);
  }
  return [...byKind].map(([kind, ids]) => ({ kind, ids }));
}

/** A matrix's rows under one parent: a use case's requirements, an aggregate's invariants, a pattern's rules. */
export interface TraceGroup {
  parent: SpecRecord | null;
  rows: TraceRow[];
}

/** The traceability matrix of a record or group: one row per obligation under it, grouped by its parent, in the tree's order. */
export function traceMatrix(index: SpecIndex, focus: string): TraceGroup[] {
  return groupRows(index, obligationsUnder(index, focus));
}

// ---------- What the Trace stage shows for any focus ----------
//
// Every stage works on every focus (LA-PAT-APP-UX-R17), so the Trace stage has a shape for each:
// - an obligation: its chain;
// - a record or group with obligations under it: their matrix;
// - a record some chain holds: the rows it belongs to, each obligation whose chain holds it, with
//   the record marked in its cell;
// - a record coverage reports untraced: the untraced state, with the matrix of the nearest
//   container with obligations below it for context, the record marked;
// - any other record (an entity, a value object, a term): the matrix of the nearest container with
//   obligations (its aggregate, its domain, its product), the record marked.

export type TraceShape =
  | { shape: 'chain' }
  | { shape: 'matrix'; groups: TraceGroup[] }
  | { shape: 'rows'; groups: TraceGroup[] }
  | { shape: 'context'; untraced: boolean; scope: string | null; groups: TraceGroup[] };

/** The obligations whose chains hold a record, in ID order; empty when none does. */
export const holdersOf = (index: SpecIndex, id: string): string[] => [...(holders(index).get(id) ?? [])].sort((a, b) => byIdOrder({ id: a }, { id: b }));

/** The nearest container above a focus in the tree with an obligation under it, or null. */
function nearestWithObligations(index: SpecIndex, focus: string): string | null {
  for (let at = treeParent(index, focus); at !== null; at = treeParent(index, at)) {
    if (obligationsUnder(index, at).length > 0) return at;
  }
  return null;
}

/** What the Trace stage shows for a focus. */
export function traceShape(index: SpecIndex, focus: string): TraceShape {
  if (isObligation(index, focus)) return { shape: 'chain' };
  const own = obligationsUnder(index, focus);
  if (own.length > 0) return { shape: 'matrix', groups: groupRows(index, own) };
  const held = holdersOf(index, focus);
  if (held.length > 0) return { shape: 'rows', groups: groupRows(index, held) };
  const scope = nearestWithObligations(index, focus);
  return { shape: 'context', untraced: isUntraced(index, focus), scope, groups: scope ? traceMatrix(index, scope) : [] };
}

/** Rows of obligations, grouped by each obligation's parent in the order given. */
function groupRows(index: SpecIndex, obligations: readonly string[]): TraceGroup[] {
  const groups = new Map<string, TraceGroup>();
  for (const id of obligations) {
    const parentId = index.byId.get(id)?.parent ?? '';
    let group = groups.get(parentId);
    if (!group) { group = { parent: index.byId.get(parentId) ?? null, rows: [] }; groups.set(parentId, group); }
    group.rows.push(traceChain(index, id)!);
  }
  return [...groups.values()];
}
