import type { TraceObligation, TraceRow, TraceStep, ProductTrace } from '../../../lathe/src/traceability/trace/read-model';
import { kindLabel, type RecordIndex } from '../exploring/record-summaries/record-index';

// The Trace stage (LA-V98), pure and tested directly: one row per use case of a product's space, each
// use case once, across five columns, left to right:
//
//   Outcome | Use case | Design flow | Technical flow | Acceptance test suite
//
// - Outcome: each business outcome once, with a line to every use case its capability serves (serves.ts's reach).
// - Use case: the use case; expanded, its UC requirements, the aggregates its steps change and the read models they read.
// - Design flow: a status ("2 flows · all designed"); expanded, its flows (one per interface), each expanding to its
//   steps, each step to its view (with its view requirements), its endpoints (with their API requirements) and its
//   integrations.
// - Technical flow: a status ("4 handlers · 1 not built"); expanded, the selected step's chain: the UI components it
//   happens in, the endpoints or channels of what it invokes, that command's or query's handler, its repository or
//   reader, their data store, and the adapters of its integrations. Expanded by Expand all, every step's chain, grouped
//   by step.
// - Acceptance test suite: a status ("12 tests · all proved"); expanded, "k of N proved", each UC requirement's use
//   case tests and each flow's flow test (a dashed gap where proof is missing), and Lower tests, expanding to the tests
//   of what they rest on (view and API requirements, invariants, storage requirements).
//
// Each cell is a tree of boxes (`Item`), whatever is open: what shows is each open box's children (`visible`), and a box
// that does not show stands in by its nearest shown parent (`standIn`), so a path through a collapsed cell lights the
// box that holds it. Everything comes from the Trace read model (list-trace-rows, LA-TRC-RM13); the index gives only
// titles, kinds and stages to draw. Where each box goes is layout.ts's.

/** The five columns, left to right. */
export const TRACE_COLUMNS = ['outcome', 'use-case', 'design', 'technical', 'suite'] as const;
export type TraceColumn = (typeof TRACE_COLUMNS)[number];
export const TRACE_COLUMN_LABELS: Record<TraceColumn, string> = { outcome: 'Outcome', 'use-case': 'Use case', design: 'Design flow', technical: 'Technical flow', suite: 'Acceptance test suite' };
/** The columns that expand down, each a stage of every row. */
export const TRACE_STAGES = ['use-case', 'design', 'technical', 'suite'] as const;
export type TraceStage = (typeof TRACE_STAGES)[number];

/** What a box is: a record, a stage's status, a gap (dashed), a heading over a group, or a hint. */
export type ItemRole = 'record' | 'status' | 'gap' | 'heading' | 'hint';

/** One box of the view. */
export interface Item {
  /** Its place: unique in the view (a record shows in a box of each cell it belongs to). */
  key: string;
  /** The record it stands for, or null. */
  id: string | null;
  /** The use case of its row; null for an outcome. */
  row: string | null;
  column: number;
  /** How far in it sits in its cell: 0 for the cell's own box. */
  depth: number;
  /** Its parent box, null for a cell's own box. */
  parent: string | null;
  role: ItemRole;
  /** What a box that is no record says. */
  words?: { kind: string; title: string; meta: string };
  /** The key that opens it, for a box with children. */
  opens?: string;
  /** Its children, in order. */
  children: string[];
  /** For a heading of a step's chain in the Technical flow column: the step. */
  step?: string;
}

/** A link within a row, between two records, or a record and a box (a gap, a link of a step's technical chain): from its left to its right. */
export interface RowLink { from: string; to: string }

/** One row: its use case, its cells' boxes (each cell's own box first) and the links its path walks. */
export interface Row {
  useCase: string;
  data: TraceRow;
  /** Each column's own box, from the Use case column on (index 1 to 4; index 0 unused). */
  cells: string[];
  /** Its records' links, from left to right, for its paths. */
  links: RowLink[];
  /** The steps of its flows, in flow and path order. */
  steps: string[];
}

/** A product's Trace stage. */
export interface TraceGraph {
  product: string;
  /** The outcomes, in ID order. */
  outcomes: readonly string[];
  /** The rows, in ID order (order.ts orders them). */
  rows: readonly Row[];
  rowOf: ReadonlyMap<string, Row>;
  items: ReadonlyMap<string, Item>;
  /** The outcome → use case links, each [outcome, use case]. */
  serves: readonly (readonly [string, string])[];
  /** Each record's boxes, by ID. */
  boxesOf: ReadonlyMap<string, readonly string[]>;
  /** How many rows have a gap in a stage, and how many serve no outcome. */
  counts: { gapped: number; outside: number };
}

/** The key that opens a cell: `<use case>|<stage>`. */
export const cellKey = (row: string, stage: TraceStage) => `${row}|${stage}`;
/** The key that opens a box within a cell: `<use case>|<stage>|<record or name>`. */
export const innerKey = (row: string, stage: TraceStage, what: string) => `${row}|${stage}|${what}`;
/** The key under which a Technical flow cell shows every step's chain (Expand all), not only the selected step's. */
export const everyStepKey = (row: string) => innerKey(row, 'technical', '*');

const n = (k: number, one: string, many = `${one}s`) => `${k} ${k === 1 ? one : many}`;

/** A row's stage status in words, and whether it has a gap: "2 flows · all designed", "No flows". */
export function statusOf(row: TraceRow, stage: Exclude<TraceStage, 'use-case'>): { title: string; gap: boolean } {
  const { design, technical, suite } = row.status;
  switch (stage) {
    case 'design':
      if (design.flows === 0) return { title: 'No flows', gap: true };
      return { title: `${n(design.flows, 'flow')} · ${design.notDesigned === 0 ? 'all designed' : `${n(design.notDesigned, 'requirement')} not designed`}`, gap: design.notDesigned > 0 };
    case 'technical':
      if (technical.handlers === 0) return { title: technical.notBuilt > 0 ? `No handlers · ${technical.notBuilt} not built` : 'No handlers', gap: true };
      return { title: `${n(technical.handlers, 'handler')} · ${technical.notBuilt === 0 ? 'all built' : `${technical.notBuilt} not built`}`, gap: technical.notBuilt > 0 };
    case 'suite':
      if (suite.tests === 0) return { title: 'No tests', gap: true };
      return { title: `${n(suite.tests, 'test')} · ${suite.notProved === 0 ? 'all proved' : `${suite.notProved} not proved`}`, gap: suite.notProved > 0 };
  }
}

/** The Suite's header: "3 of 4 proved". */
export const provedWords = (row: TraceRow) => `${row.status.suite.owed - row.status.suite.notProved} of ${row.status.suite.owed} proved`;

/** The words of a chain's layers, as their headings say them when a layer is missing. */
const MISSING_HANDLER = 'No handler';

function build(index: RecordIndex, trace: ProductTrace): TraceGraph {
  const items = new Map<string, Item>();
  const boxesOf = new Map<string, string[]>();
  const known = (id: string) => index.byId.has(id);
  const add = (item: Omit<Item, 'children'>): string => {
    items.set(item.key, { ...item, children: [] });
    if (item.parent) items.get(item.parent)!.children.push(item.key);
    if (item.id && item.role === 'record') (boxesOf.get(item.id) ?? boxesOf.set(item.id, []).get(item.id)!).push(item.key);
    return item.key;
  };
  const record = (parent: string, id: string, extra: Partial<Item> = {}) => {
    const p = items.get(parent)!;
    return add({ key: `${parent}/${id}`, id, row: p.row, column: p.column, depth: p.depth + 1, parent, role: 'record', ...extra });
  };
  const plain = (parent: string, name: string, role: ItemRole, words: Item['words'], extra: Partial<Item> = {}) => {
    const p = items.get(parent)!;
    return add({ key: `${parent}/${name}`, id: null, row: p.row, column: p.column, depth: p.depth + 1, parent, role, words, ...extra });
  };
  const kindOf = (id: string) => { const r = index.byId.get(id); return r ? kindLabel(index, r.kind) : 'Record'; };
  /** An obligation's tests under a parent box, or a gap where it is not proved. */
  const testsOf = (parent: string, o: TraceObligation) => {
    for (const t of o.tests) if (known(t)) record(parent, t);
    if (o.gaps.includes('proved')) plain(parent, `gap:${o.id}`, 'gap', { kind: 'Gap', title: 'Not proved', meta: `Gap · ${o.id}` }, { id: o.id });
  };

  for (const o of trace.outcomes) if (known(o)) add({ key: `outcome/${o}`, id: o, row: null, column: 0, depth: 0, parent: null, role: 'record' });
  const serves: [string, string][] = [];
  const rows: Row[] = [];
  let gapped = 0;
  let outside = 0;
  for (const data of trace.rows) {
    const u = data.useCase;
    if (!known(u)) continue;
    const links: RowLink[] = [];
    const link = (from: string, to: string) => links.push({ from, to });
    const outcomes = data.outcomes.filter((o) => items.has(`outcome/${o}`));
    for (const o of outcomes) { serves.push([o, u]); link(o, u); }
    if (outcomes.length === 0) outside++;

    // Use case: the use case, then its requirements, what it changes and what it reads.
    const useCase = add({ key: `${u}|use-case`, id: u, row: u, column: 1, depth: 0, parent: null, role: 'record', opens: cellKey(u, 'use-case') });
    for (const r of data.requirements) if (known(r.id)) { record(useCase, r.id); link(u, r.id); }
    for (const a of [...data.changes, ...data.reads]) if (known(a)) { record(useCase, a); link(u, a); }

    // Design flow: its status, then its flows, their steps, and each step's view, endpoints and integrations.
    const design = statusOf(data, 'design');
    const designBox = add({ key: `${u}|design`, id: null, row: u, column: 2, depth: 0, parent: null, role: design.gap ? 'gap' : 'status', words: { kind: 'Design flow', title: design.title, meta: `Design flow · ${u}` }, opens: cellKey(u, 'design') });
    const steps: TraceStep[] = [];
    for (const f of data.flows) {
      if (!known(f.id)) continue;
      const flow = record(designBox, f.id, { opens: innerKey(u, 'design', f.id) });
      link(u, f.id);
      for (const s of f.steps) {
        if (!known(s.id)) continue;
        steps.push(s);
        const has = !!s.view || s.endpoints.length > 0 || s.integrations.length > 0;
        const step = record(flow, s.id, has ? { opens: innerKey(u, 'design', s.id) } : {});
        link(f.id, s.id);
        for (const r of s.fulfills) link(r, s.id);
        if (s.view && known(s.view)) {
          const v = record(step, s.view);
          link(s.id, s.view);
          for (const r of s.viewRequirements) if (known(r.id)) { record(v, r.id); link(s.view, r.id); }
        }
        for (const e of s.endpoints) {
          if (!known(e.id)) continue;
          const ep = record(step, e.id);
          link(s.id, e.id);
          for (const r of e.apiRequirements) if (known(r.id)) { record(ep, r.id); link(e.id, r.id); }
        }
        for (const i of s.integrations) if (known(i)) { record(step, i); link(s.id, i); }
      }
    }

    // Technical flow: its status, then each step's chain under a heading naming the step.
    const technical = statusOf(data, 'technical');
    const techBox = add({ key: `${u}|technical`, id: null, row: u, column: 3, depth: 0, parent: null, role: technical.gap ? 'gap' : 'status', words: { kind: 'Technical flow', title: technical.title, meta: `Technical flow · ${u}` }, opens: cellKey(u, 'technical') });
    plain(techBox, 'hint', 'hint', { kind: 'Hint', title: 'Select a step to show its chain', meta: 'Technical flow' });
    for (const s of steps) {
      const head = plain(techBox, `step:${s.id}`, 'heading', { kind: 'Step', title: index.byId.get(s.id)!.title, meta: `${kindOf(s.id)} · ${s.id}` }, { id: s.id, step: s.id });
      const c = s.chain;
      // The chain, from where the step happens to where its data lives: each layer's boxes linked from the one before
      // it, box to box (a component or a handler several steps share has a box in each step's chain, and a path
      // through one step's chain never runs on through another's).
      const layers = [c.components, c.entries, c.handlers, c.stores, c.dataStores].map((ids) => ids.filter(known));
      let before = [s.id];
      layers.forEach((ids) => {
        if (ids.length === 0) return;
        const keys = ids.map((id) => record(head, id));
        for (const k of keys) for (const b of before) link(b, k);
        before = keys;
      });
      if (s.operation && c.handlers.length === 0) { const gap = plain(head, 'gap:handler', 'gap', { kind: 'Gap', title: MISSING_HANDLER, meta: `Gap · ${s.operation}` }); link(s.id, gap); }
      for (const a of c.adapters.filter(known)) link(s.id, record(head, a));
    }

    // Acceptance test suite: its status, "k of N proved", each requirement's tests, each flow's test, and Lower tests.
    const suite = statusOf(data, 'suite');
    const suiteBox = add({ key: `${u}|suite`, id: null, row: u, column: 4, depth: 0, parent: null, role: suite.gap ? 'gap' : 'status', words: { kind: 'Acceptance test suite', title: suite.title, meta: `Acceptance test suite · ${u}` }, opens: cellKey(u, 'suite') });
    plain(suiteBox, 'proved', 'heading', { kind: 'Proved', title: provedWords(data), meta: 'Use case and flow tests' });
    for (const r of data.requirements) {
      if (!known(r.id)) continue;
      testsOf(suiteBox, r);
      for (const t of r.tests) link(r.id, t);
      if (r.gaps.includes('proved')) link(r.id, `${suiteBox}/gap:${r.id}`);
    }
    for (const f of data.flows) {
      if (!known(f.id)) continue;
      if (f.test && known(f.test)) { record(suiteBox, f.test); link(f.id, f.test); }
      if (!f.proved) { plain(suiteBox, `gap:${f.id}`, 'gap', { kind: 'Gap', title: f.test ? 'Flow test not automated' : 'No flow test', meta: `Gap · ${f.id}` }, { id: f.id }); link(f.id, `${suiteBox}/gap:${f.id}`); }
    }
    if (data.lower.length > 0) {
      const lower = plain(suiteBox, 'lower', 'heading', { kind: 'Lower tests', title: `Lower tests · ${n(data.lower.length, 'obligation')}`, meta: 'What the suite rests on' }, { opens: innerKey(u, 'suite', 'lower') });
      for (const o of data.lower) {
        if (!known(o.id)) continue;
        testsOf(lower, o);
        for (const t of o.tests) link(o.id, t);
        if (o.gaps.includes('proved')) link(o.id, `${lower}/gap:${o.id}`);
      }
    }
    if (design.gap || technical.gap || suite.gap) gapped++;
    rows.push({ useCase: u, data, cells: ['', useCase, designBox, techBox, suiteBox], links, steps: steps.map((s) => s.id) });
  }
  return { product: trace.product, outcomes: trace.outcomes.filter(known), rows, rowOf: new Map(rows.map((r) => [r.useCase, r])), items, serves, boxesOf, counts: { gapped, outside } };
}

const graphs = new WeakMap<ProductTrace, WeakMap<RecordIndex, TraceGraph>>();
/** A product's Trace stage, worked out once per Trace read answer and index. */
export function traceGraph(index: RecordIndex, trace: ProductTrace): TraceGraph {
  let byIndex = graphs.get(trace);
  if (!byIndex) { byIndex = new WeakMap(); graphs.set(trace, byIndex); }
  let graph = byIndex.get(index);
  if (!graph) { graph = build(index, trace); byIndex.set(index, graph); }
  return graph;
}

// ---------- What shows: the open boxes' children ----------

/** What the view opens, and the step whose chain the Technical flow column shows. */
export interface Openness { open: ReadonlySet<string>; step: string | null }

/** Whether a box's children show. */
export function isOpen(item: Item, o: Openness): boolean {
  return !!item.opens && o.open.has(item.opens);
}

/** The children of a box that show: a Technical flow cell shows the selected step's chain (or a hint), or every step's under Expand all. */
export function shownChildren(graph: TraceGraph, item: Item, o: Openness): string[] {
  if (!isOpen(item, o)) return [];
  if (item.column === 3 && item.depth === 0 && item.row) {
    const heads = item.children.filter((k) => graph.items.get(k)!.role === 'heading');
    if (o.open.has(everyStepKey(item.row))) return heads;
    const own = heads.find((k) => graph.items.get(k)!.step === o.step);
    return own ? [own] : item.children.filter((k) => graph.items.get(k)!.role === 'hint');
  }
  return item.children;
}

/**
 * Each cell's boxes that show, top to bottom (the cell's own box first): an open box's children, and always the children
 * of a box that does not open (a view's requirements under it, a step's chain under its heading).
 */
export function visible(graph: TraceGraph, cell: string, o: Openness): string[] {
  const out: string[] = [];
  const walk = (key: string) => {
    out.push(key);
    const item = graph.items.get(key)!;
    for (const c of item.opens ? shownChildren(graph, item, o) : item.children) walk(c);
  };
  walk(cell);
  return out;
}

/** The box that stands in for a box that does not show: its nearest parent that does. */
export function standIn(graph: TraceGraph, key: string, shown: ReadonlySet<string>): string | null {
  for (let at: string | null = key; at; at = graph.items.get(at)?.parent ?? null) if (shown.has(at)) return at;
  return null;
}

// ---------- Paths: what a selection lights ----------

/** What a selection lights in one row: its records (and gaps) and the links between them. */
export interface RowPath { row: string; ids: ReadonlySet<string>; links: readonly RowLink[] }

/**
 * A record's path in a row (LA-V98), from the record and its boxes (`start`): back along the row's links to its
 * outcomes, and on along them to its right, from those only; then the tests of every obligation on it, so a step's path
 * ends at the tests proving the requirements it fulfills: requirement → fulfilling step → its technical chain → the
 * test proving the requirement.
 */
export function rowPath(row: Row, start: readonly string[]): RowPath | null {
  const into = new Map<string, number[]>();
  const out = new Map<string, number[]>();
  row.links.forEach((l, i) => {
    (into.get(l.to) ?? into.set(l.to, []).get(l.to)!).push(i);
    (out.get(l.from) ?? out.set(l.from, []).get(l.from)!).push(i);
  });
  const from = start.filter((k) => into.has(k) || out.has(k));
  if (from.length === 0) return null;
  const ids = new Set(start);
  const lit = new Set<number>();
  const walk = (by: Map<string, number[]>, end: 'from' | 'to', start: readonly string[]) => {
    const queue = [...start];
    const seen = new Set(queue);
    for (let i = 0; i < queue.length; i++) {
      for (const l of by.get(queue[i]) ?? []) {
        lit.add(l);
        const next = row.links[l][end];
        if (seen.has(next)) continue;
        seen.add(next);
        ids.add(next);
        queue.push(next);
      }
    }
  };
  walk(into, 'from', from);
  walk(out, 'to', from);
  // The tests of the obligations on the path: the requirements a step fulfills, its view's and endpoints' requirements.
  const obligations = [...ids].filter((k) => out.get(k)?.some((l) => isTestLink(row, l)));
  for (const o of obligations) for (const l of out.get(o)!) if (isTestLink(row, l)) { lit.add(l); ids.add(row.links[l].to); }
  return { row: row.useCase, ids, links: [...lit].sort((a, b) => a - b).map((l) => row.links[l]) };
}

/** Whether a link ends at a test or a proof's gap: one into the Acceptance test suite column. */
const testLinkCache = new WeakMap<Row, Set<number>>();
function isTestLink(row: Row, l: number): boolean {
  let known = testLinkCache.get(row);
  if (!known) {
    const tests = new Set<string>();
    const proof = (o: TraceObligation) => o.tests.forEach((t) => tests.add(t));
    row.data.requirements.forEach(proof);
    row.data.lower.forEach(proof);
    row.data.flows.forEach((f) => { if (f.test) tests.add(f.test); });
    known = new Set(row.links.map((x, i) => (tests.has(x.to) || x.to.startsWith(`${row.useCase}|suite/`) ? i : -1)).filter((i) => i >= 0));
    testLinkCache.set(row, known);
  }
  return known.has(l);
}

/** The rows a record shows in (each row whose links name it), in the graph's order. */
export function rowsOf(graph: TraceGraph, id: string): Row[] {
  return graph.rows.filter((r) => r.useCase === id || r.links.some((l) => l.from === id || l.to === id));
}
