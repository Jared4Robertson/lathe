import { byIdOrder, textOf, type SpecIndex, type SpecRecord } from '../specs/data';
import { designersOf } from '../specs/trace';
import { isTestKind } from '../specs/parts';
import { treeChildren, treeParent } from '../graph/tree';
import { isObligation } from './offer';

// The Trace view's logic (LA-TRC-UC10), pure and tested directly: an obligation's traceability
// chain, and the matrix of every obligation under a record or group.
//
// A chain reads left to right in four columns after the obligation: what designs it (for a UC
// requirement the flow steps that fulfill it, their flows, the views they happen in and the commands
// and queries they invoke; a constraint's value object; an invariant's aggregate), the technical
// records that build it, the tests that prove it, and the files those name. A matrix is one chain
// per obligation under the focus, in the tree's order (graph/tree.ts, the nav's tree), grouped by
// each obligation's parent (a use case, an aggregate, a view, a pattern). An applicable cell left
// empty is a gap.

/** The columns after the obligation, left to right. */
export type TraceColumn = 'design' | 'build' | 'tests' | 'files';
export const TRACE_COLUMNS: readonly TraceColumn[] = ['design', 'build', 'tests', 'files'];
export const TRACE_COLUMN_LABELS: Record<TraceColumn, string> = { design: 'Design', build: 'Build', tests: 'Tests', files: 'Files' };

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
  /** The columns its kind does not owe: a pattern rule is proved only; most kinds are designed by their technical records. */
  notOwed: ReadonlySet<TraceColumn>;
  /**
   * The chain's actual links, each from the record nearer the obligation to the one it leads to, left to right: the
   * obligation to a step's flow (or the step), a flow to its step, a step to where it happens and what it invokes, an
   * operation or a design record to what builds it, the obligation to its tests, and a record to a file it names
   * (`file:<path>`, fileKey). What the Trace stage draws its arrows from.
   */
  links: readonly (readonly [string, string])[];
}

/** A file's key among a chain's links and the Trace stage's boxes. */
export const fileKey = (path: string) => `file:${path}`;

/** The kinds designed before the technical specification: a step, a value object, an aggregate. */
const DESIGNED_KINDS: ReadonlySet<string> = new Set(['uc_requirement', 'constraint', 'invariant']);
/** The kinds that are proved only (LA-TRC-UC14): nothing designs or builds a pattern rule. */
const PROVED_ONLY: ReadonlySet<string> = new Set(['pattern_rule']);

const stageOf = (index: SpecIndex, id: string) => index.kinds.get(index.byId.get(id)?.kind ?? '')?.stage ?? null;
/** A record's children of one stage. */
const childrenIn = (index: SpecIndex, id: string, stage: string) => (index.children.get(id) ?? []).filter((c) => index.kinds.get(c.kind)?.stage === stage);
const linked = (index: SpecIndex, id: string, relation: string, way: 'out' | 'in') =>
  (way === 'out' ? index.outgoing.get(id) ?? [] : index.incoming.get(id) ?? []).filter((l) => l.relation === relation).map((l) => (way === 'out' ? l.target : l.source));

const kindRanks = new WeakMap<SpecIndex, Map<string, number>>();
/** IDs in the schema's kind order, then by ID, each once. */
function inKindOrder(index: SpecIndex, ids: Iterable<string>): string[] {
  let rank = kindRanks.get(index);
  if (!rank) { rank = new Map(index.workspace.kinds.map((k, i) => [k.kind, i])); kindRanks.set(index, rank); }
  const ranks = rank;
  const of = (id: string) => ranks.get(index.byId.get(id)?.kind ?? '') ?? ranks.size;
  return [...new Set(ids)].filter((id) => index.byId.has(id)).sort((a, b) => of(a) - of(b) || byIdOrder({ id: a }, { id: b }));
}

const enforcers = new WeakMap<SpecIndex, Map<string, string[]>>();
/** The tables whose unique key enforces each invariant, read once per index. */
function enforcing(index: SpecIndex): Map<string, string[]> {
  let known = enforcers.get(index);
  if (known) return known;
  known = new Map();
  for (const p of index.workspace.parts) {
    if (p.table !== 'table_key' || typeof p.row.invariant_id !== 'string') continue;
    const tables = known.get(p.row.invariant_id);
    if (tables) tables.push(p.owner); else known.set(p.row.invariant_id, [p.owner]);
  }
  enforcers.set(index, known);
  return known;
}

const chains = new WeakMap<SpecIndex, Map<string, TraceRow | null>>();
/** An obligation's chain, or null for any other record, worked out once per index: the matrix and Untraced share them. */
export function traceChain(index: SpecIndex, id: string): TraceRow | null {
  let known = chains.get(index);
  if (!known) { known = new Map(); chains.set(index, known); }
  if (!known.has(id)) known.set(id, chainOf(index, id));
  return known.get(id)!;
}

function chainOf(index: SpecIndex, id: string): TraceRow | null {
  if (!isObligation(index, id)) return null;
  const record = index.byId.get(id)!;
  const design = new Set<string>();
  const build = new Set<string>();
  const links = new Map<string, readonly [string, string]>();
  const link = (from: string, to: string) => { links.set(`${from}\n${to}`, [from, to]); };
  const technical = (of: string) => { for (const t of childrenIn(index, of, 'technical-specification')) { build.add(t.id); link(of, t.id); } };

  if (record.kind === 'uc_requirement') {
    // The steps that fulfill it, each with its flow, the views it happens in and what it invokes; that operation's handler builds it.
    for (const step of linked(index, id, 'fulfills', 'in')) {
      design.add(step);
      const flow = index.byId.get(step)?.parent;
      if (flow && index.byId.get(flow)?.kind === 'flow') { design.add(flow); link(id, flow); link(flow, step); } else link(id, step);
      for (const view of linked(index, step, 'happens_in', 'out')) { design.add(view); link(step, view); }
      for (const op of linked(index, step, 'invokes', 'out')) { design.add(op); link(step, op); technical(op); }
    }
  }
  if ((record.kind === 'constraint' || record.kind === 'invariant') && record.parent && index.byId.has(record.parent)) {
    // Its value object (and the value type that implements it), or its aggregate (and the aggregate's repository).
    design.add(record.parent);
    link(id, record.parent);
    technical(record.parent);
  }
  if (record.kind === 'invariant') {
    // Each table whose unique key enforces it.
    for (const table of enforcing(index).get(id) ?? []) { build.add(table); link(id, table); }
  }
  technical(id);
  // What specifies its implementation as coverage counts it: the components rendering a view requirement's view, an API
  // requirement's endpoint handler, what meets a standard rule.
  for (const d of designersOf(index, record)) if (stageOf(index, d) === 'technical-specification') { build.add(d); link(id, d); }
  const tests = childrenIn(index, id, 'test-plan').map((t) => t.id);
  for (const t of tests) link(id, t);

  const files = new Map<string, string[]>();
  const builders = inKindOrder(index, build);
  const proofs = inKindOrder(index, tests);
  for (const named of [...builders, ...proofs]) {
    const path = textOf(index.byId.get(named)!.row, 'file').trim();
    if (!path) continue;
    const by = files.get(path);
    if (by) by.push(named); else files.set(path, [named]);
    link(named, fileKey(path));
  }
  const notOwed = new Set<TraceColumn>();
  if (PROVED_ONLY.has(record.kind)) { notOwed.add('design'); notOwed.add('build'); }
  else if (!DESIGNED_KINDS.has(record.kind)) notOwed.add('design');
  return {
    obligation: id,
    design: inKindOrder(index, design),
    build: builders,
    tests: proofs,
    files: [...files].map(([path, namedBy]) => ({ path, namedBy })).sort((a, b) => a.path.localeCompare(b.path)),
    notOwed,
    links: [...links.values()],
  };
}

/** The columns of a row that are owed and empty: its gaps. */
export const gapColumns = (row: TraceRow): TraceColumn[] =>
  TRACE_COLUMNS.filter((c) => !row.notOwed.has(c) && (c === 'files' ? row.files.length === 0 : row[c].length === 0));

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

// ---------- Untraced: what no obligation's chain reaches ----------
//
// The engine's coverage has no record-level "untraced" gap (its only untraced gap, code-file-untraced, is about source
// files), so this mirrors the relations coverage judges designed, built and proved by (specs/trace.ts designersOf and
// buildersOf, as traceChain reads them): a record is traced when some obligation's chain, anywhere in the space, holds
// it. Only the kinds a chain links by a trace relation are listed (a flow step fulfills, a command or query is invoked,
// its handler builds, a UI component renders a view requirement's view, a test proves its parent); containers and
// folders (a flow, a view, an aggregate, a stage) and kinds with no trace relation at all never are. A flow test proves
// its flow, not an obligation, so it is never untraced either.

/** The kinds a chain links by a trace relation, besides the tests. */
const TRACED_KINDS: ReadonlySet<string> = new Set(['flow_step', 'command', 'query', 'command_handler', 'query_handler', 'ui_component']);

const holdersCache = new WeakMap<SpecIndex, Map<string, string[]>>();
/** For every record some obligation's chain holds, in the whole space, the obligations whose chains hold it; worked out once per index. */
function holders(index: SpecIndex): Map<string, string[]> {
  let known = holdersCache.get(index);
  if (known) return known;
  known = new Map();
  for (const r of index.workspace.records) {
    const row = traceChain(index, r.id);
    if (!row) continue;
    for (const id of new Set([...row.design, ...row.build, ...row.tests])) {
      const by = known.get(id);
      if (by) by.push(r.id); else known.set(id, [r.id]);
    }
  }
  holdersCache.set(index, known);
  return known;
}

/** Whether a record is of a kind a chain reaches by a trace relation (a test that proves an obligation included). */
function traceable(index: SpecIndex, record: SpecRecord): boolean {
  if (TRACED_KINDS.has(record.kind)) return true;
  if (!isTestKind(index, record.kind) || record.kind === 'flow_test') return false;
  return true;
}

/** A kind's untraced records under the focus. */
export interface UntracedGroup { kind: string; ids: string[] }

/** The design, build and test records under a record or group that no obligation's chain reaches, by kind in the schema's order. */
export function untracedUnder(index: SpecIndex, focus: string): UntracedGroup[] {
  const reach = holders(index);
  const found: string[] = [];
  const seen = new Set<string>();
  const walk = (id: string) => {
    if (seen.has(id)) return;
    seen.add(id);
    const record = index.byId.get(id);
    if (record && traceable(index, record) && !reach.has(id)) found.push(id);
    for (const c of treeChildren(index, id)) walk(c);
  };
  walk(focus);
  const byKind = new Map<string, string[]>();
  for (const id of inKindOrder(index, found)) {
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
// - a design, build or test record some chain holds: the rows it belongs to, each obligation whose
//   chain holds it, with the record marked in its cell;
// - a design, build or test record no chain holds: the untraced state, with the matrix of the
//   nearest container with obligations below it for context, the record marked;
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
  const record = index.byId.get(focus);
  const scope = nearestWithObligations(index, focus);
  return { shape: 'context', untraced: !!record && traceable(index, record), scope, groups: scope ? traceMatrix(index, scope) : [] };
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
