import { byIdOrder, textOf, type SpecIndex, type SpecRecord } from '../specs/data';
import { designersOf } from '../specs/trace';
import { treeChildren } from '../graph/tree';

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
}

/** The kinds designed before the technical specification: a step, a value object, an aggregate. */
const DESIGNED_KINDS: ReadonlySet<string> = new Set(['uc_requirement', 'constraint', 'invariant']);
/** The kinds that are proved only (LA-TRC-UC14): nothing designs or builds a pattern rule. */
const PROVED_ONLY: ReadonlySet<string> = new Set(['pattern_rule']);

/** An obligation: a constraint, invariant, specification, policy, domain service, UC, view or API requirement, pattern or standard rule, or a product's own obligation kind. */
export const isObligation = (index: SpecIndex, id: string): boolean => {
  const kind = index.byId.get(id)?.kind;
  return !!kind && !!index.kinds.get(kind)?.obligation;
};

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

/** An obligation's chain, or null for any other record. */
export function traceChain(index: SpecIndex, id: string): TraceRow | null {
  if (!isObligation(index, id)) return null;
  const record = index.byId.get(id)!;
  const design = new Set<string>();
  const build = new Set<string>();
  const technical = (of: string) => { for (const t of childrenIn(index, of, 'technical-specification')) build.add(t.id); };

  if (record.kind === 'uc_requirement') {
    // The steps that fulfill it, each with its flow, the views it happens in and what it invokes; that operation's handler builds it.
    for (const step of linked(index, id, 'fulfills', 'in')) {
      design.add(step);
      const flow = index.byId.get(step)?.parent;
      if (flow && index.byId.get(flow)?.kind === 'flow') design.add(flow);
      for (const view of linked(index, step, 'happens_in', 'out')) design.add(view);
      for (const op of linked(index, step, 'invokes', 'out')) { design.add(op); technical(op); }
    }
  }
  if ((record.kind === 'constraint' || record.kind === 'invariant') && record.parent && index.byId.has(record.parent)) {
    // Its value object (and the value type that implements it), or its aggregate (and the aggregate's repository).
    design.add(record.parent);
    technical(record.parent);
  }
  if (record.kind === 'invariant') {
    // Each table whose unique key enforces it.
    for (const table of enforcing(index).get(id) ?? []) build.add(table);
  }
  technical(id);
  // What specifies its implementation as coverage counts it: the components rendering a view requirement's view, an API
  // requirement's endpoint handler, what meets a standard rule.
  for (const d of designersOf(index, record)) if (stageOf(index, d) === 'technical-specification') build.add(d);
  const tests = childrenIn(index, id, 'test-plan').map((t) => t.id);

  const files = new Map<string, string[]>();
  const builders = inKindOrder(index, build);
  const proofs = inKindOrder(index, tests);
  for (const named of [...builders, ...proofs]) {
    const path = textOf(index.byId.get(named)!.row, 'file').trim();
    if (!path) continue;
    const by = files.get(path);
    if (by) by.push(named); else files.set(path, [named]);
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

/** Whether the Trace view has something to show: the focus is an obligation, or one sits under it. Stops at the first. */
export function hasTrace(index: SpecIndex, focus: string): boolean {
  const seen = new Set<string>();
  const find = (id: string): boolean => {
    if (seen.has(id)) return false;
    seen.add(id);
    return isObligation(index, id) || treeChildren(index, id).some(find);
  };
  return find(focus);
}

/** A matrix's rows under one parent: a use case's requirements, an aggregate's invariants, a pattern's rules. */
export interface TraceGroup {
  parent: SpecRecord | null;
  rows: TraceRow[];
}

/** The traceability matrix of a record or group: one row per obligation under it, grouped by its parent, in the tree's order. */
export function traceMatrix(index: SpecIndex, focus: string): TraceGroup[] {
  const groups = new Map<string, TraceGroup>();
  for (const id of obligationsUnder(index, focus)) {
    const parentId = index.byId.get(id)?.parent ?? '';
    let group = groups.get(parentId);
    if (!group) { group = { parent: index.byId.get(parentId) ?? null, rows: [] }; groups.set(parentId, group); }
    group.rows.push(traceChain(index, id)!);
  }
  return [...groups.values()];
}
