import type { ObligationTrace, ProductTraces, TraceGap } from '../../../lathe/src/traceability/trace/read-model';
import { byIdOrder, type SpecIndex, type SpecRecord } from '../specs/data';
import { treeChildren, treeParent } from '../graph/tree';
import { isObligation } from './offer';

// The Trace view's logic (LA-TRC-UC10), pure and tested directly: an obligation's traceability
// chain, and the matrix of every obligation under a record or group.
//
// The engine owns what traces to what (its chains, worked out with coverage) and what is missing (coverage's gaps):
// this only reads them, from the Trace read model (list-traces, LA-TRC-RM11: `ProductTraces`, the product's traces),
// and takes structure, titles and kinds from the index. A chain reads left to right in four columns after
// the obligation: what designs it (for a UC requirement the flow steps that fulfill it, their flows,
// the views they happen in, the commands and queries they invoke and the integrations they exchange
// with; a constraint's value object; an invariant's aggregate; a policy's command; a domain
// service's callers; a specification's checkers and selectors), the technical
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
const GAP_COLUMN: Record<TraceGap, GapColumn> = { designed: 'design', built: 'build', proved: 'tests' };

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
  /** Each obligation's trace, by obligation. */
  traces: Map<string, ObligationTrace>;
  /** The records coverage reports untraced. */
  untraced: Set<string>;
}

const foundCache = new WeakMap<ProductTraces, Found>();
/** The read's traces, indexed once per answer. */
function found(traces: ProductTraces): Found {
  let known = foundCache.get(traces);
  if (known) return known;
  known = { traces: new Map(traces.traces.map((t) => [t.obligation, t])), untraced: new Set(traces.untraced) };
  foundCache.set(traces, known);
  return known;
}

/** Whether coverage reports a record untraced: of a kind a chain reaches, and reached by none. */
export const isUntraced = (traces: ProductTraces, id: string): boolean => found(traces).untraced.has(id);

const chains = new WeakMap<ProductTraces, WeakMap<SpecIndex, Map<string, TraceRow | null>>>();
/** An obligation's chain, or null for any other record, read once per answer and index: the matrix and Untraced share them. */
export function traceChain(index: SpecIndex, traces: ProductTraces, id: string): TraceRow | null {
  let byIndex = chains.get(traces);
  if (!byIndex) { byIndex = new WeakMap(); chains.set(traces, byIndex); }
  let known = byIndex.get(index);
  if (!known) { known = new Map(); byIndex.set(index, known); }
  if (!known.has(id)) known.set(id, rowOf(index, traces, id));
  return known.get(id)!;
}

function rowOf(index: SpecIndex, traces: ProductTraces, id: string): TraceRow | null {
  if (!isObligation(index, id)) return null;
  const trace = found(traces).traces.get(id);
  const files = trace?.files ?? [];
  return {
    obligation: id,
    design: trace?.design ?? [],
    build: trace?.build ?? [],
    tests: trace?.tests ?? [],
    files,
    gaps: (trace?.gaps ?? []).map((m) => GAP_COLUMN[m]),
    proofOnly: trace?.proofOnly ?? false,
    links: [...(trace?.links ?? []), ...files.flatMap((f) => f.namedBy.map((r) => [r, fileKey(f.path)] as const))],
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

const holdersCache = new WeakMap<ProductTraces, WeakMap<SpecIndex, Map<string, string[]>>>();
/** For every record some obligation's chain holds, in the whole space, the obligations whose chains hold it; read once per answer and index. */
function holders(index: SpecIndex, traces: ProductTraces): Map<string, string[]> {
  let byIndex = holdersCache.get(traces);
  if (!byIndex) { byIndex = new WeakMap(); holdersCache.set(traces, byIndex); }
  let known = byIndex.get(index);
  if (known) return known;
  known = new Map();
  for (const chain of found(traces).traces.values()) {
    if (!index.byId.has(chain.obligation)) continue;
    for (const id of new Set([...chain.design, ...chain.build, ...chain.tests])) {
      const by = known.get(id);
      if (by) by.push(chain.obligation); else known.set(id, [chain.obligation]);
    }
  }
  byIndex.set(index, known);
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
export function untracedUnder(index: SpecIndex, traces: ProductTraces, focus: string): UntracedGroup[] {
  const listed: string[] = [];
  const seen = new Set<string>();
  const walk = (id: string) => {
    if (seen.has(id)) return;
    seen.add(id);
    if (isUntraced(traces, id)) listed.push(id);
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
export function traceMatrix(index: SpecIndex, traces: ProductTraces, focus: string): TraceGroup[] {
  return groupRows(index, traces, obligationsUnder(index, focus));
}

// ---------- What the Trace stage shows for any focus ----------
//
// Every stage works on every focus (LA-PAT-APP-UX-R17), so the Trace stage has a shape for each:
// - an obligation: its chain;
// - a record or group with obligations under it: their matrix; a business outcome the obligations under the
//   capabilities serving it, as the stage's tree draws them under it;
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
export const holdersOf = (index: SpecIndex, traces: ProductTraces, id: string): string[] => [...(holders(index, traces).get(id) ?? [])].sort((a, b) => byIdOrder({ id: a }, { id: b }));

/** A business outcome's obligations, as the Trace stage's tree draws them under it: those under each capability serving it, in ID order. */
function obligationsServing(index: SpecIndex, outcome: string): string[] {
  const capabilities = (index.incoming.get(outcome) ?? []).filter((l) => l.relation === 'serves' && index.byId.get(l.source)?.kind === 'capability').map((l) => l.source);
  return capabilities.sort((a, b) => byIdOrder({ id: a }, { id: b })).flatMap((c) => obligationsUnder(index, c));
}

/** The nearest container above a focus in the tree with an obligation under it, or null. */
function nearestWithObligations(index: SpecIndex, focus: string): string | null {
  for (let at = treeParent(index, focus); at !== null; at = treeParent(index, at)) {
    if (obligationsUnder(index, at).length > 0) return at;
  }
  return null;
}

/** What the Trace stage shows for a focus. */
export function traceShape(index: SpecIndex, traces: ProductTraces, focus: string): TraceShape {
  if (isObligation(index, focus)) return { shape: 'chain' };
  const own = index.byId.get(focus)?.kind === 'business_outcome' ? obligationsServing(index, focus) : obligationsUnder(index, focus);
  if (own.length > 0) return { shape: 'matrix', groups: groupRows(index, traces, own) };
  const held = holdersOf(index, traces, focus);
  if (held.length > 0) return { shape: 'rows', groups: groupRows(index, traces, held) };
  const scope = nearestWithObligations(index, focus);
  return { shape: 'context', untraced: isUntraced(traces, focus), scope, groups: scope ? traceMatrix(index, traces, scope) : [] };
}

/** Rows of obligations, grouped by each obligation's parent in the order given. */
function groupRows(index: SpecIndex, traces: ProductTraces, obligations: readonly string[]): TraceGroup[] {
  const groups = new Map<string, TraceGroup>();
  for (const id of obligations) {
    const parentId = index.byId.get(id)?.parent ?? '';
    let group = groups.get(parentId);
    if (!group) { group = { parent: index.byId.get(parentId) ?? null, rows: [] }; groups.set(parentId, group); }
    group.rows.push(traceChain(index, traces, id)!);
  }
  return [...groups.values()];
}
