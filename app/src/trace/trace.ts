import type { TraceObligation, TraceRow, ProductTrace, TraceJourney, TraceJourneyStep } from '../../../lathe/src/traceability/trace/read-model';
import { kindLabel, type RecordIndex } from '../exploring/record-summaries/record-index';

// The Trace stage (LA-V98), pure and tested directly: one row per use case of a product's space, each
// use case once, across six columns, left to right:
//
//   Outcome | Journey | Use case | Design flow | Technical flow | Acceptance test suite
//
// - Outcome: each business outcome once, with a line to every use case its capability serves (serves.ts's reach) and
//   to every journey serving it.
// - Journey: each journey of the product once, beside the rows, not in them (rows stay one per use case), with a line
//   to each use case row its steps carry out, labeled with the steps' numbers ("1", "3, alt 2"). Closed, its proof
//   ("3 steps · 2 proved · test ✓"); open, its steps in order (main path first, each alternate path under a
//   heading naming it), a handoff a step of its own with its policy's proof, and its journey test (a dashed gap with none).
// - Use case: the use case; expanded, its UC requirements, the aggregates its steps change and the read models they read.
// - Design flow: its status as its title ("2 interfaces · all designed"); expanded, its flow (one per use case, the same through
//   every interface), expanding to a box per interface that offers the use case, each opening that interface's version
//   of the flow (derived): its steps, each to where it is carried out there (the views that present what it invokes,
//   with their view requirements; the endpoints that expose it, with their API requirements; or the product's own
//   records) and its integrations, and a dashed gap under a step the interface cannot reach. A flow no interface
//   offers opens to its steps as written.
// - Technical flow: its status as its title ("4 handlers · 1 not built"); expanded, the selected step's chain: the UI components
//   rendering the views that present what it invokes, the endpoints or channels of what it invokes, that command's or query's handler, its repository or
//   reader, their data store, and the adapters of its integrations. Expanded by Expand all, every step's chain, grouped
//   by step.
// - Acceptance test suite: its status as its title ("12 tests · all proved"); expanded, "k of N proved", each UC requirement's use
//   case tests and each flow's flow test (a dashed gap where proof is missing), and Lower tests, expanding to the tests
//   of what they rest on (view and API requirements, invariants, storage requirements).
//
// Each cell is a tree of boxes (`Item`), whatever is open: what shows is each open box's children (`visible`), and a box
// that does not show stands in by its nearest shown parent (`standIn`), so a path through a collapsed cell lights the
// box that holds it. Everything comes from the Trace read model (list-traced-use-cases, LA-TRC-RM13); the index gives only
// titles, kinds and stages to draw. Where each box goes is layout.ts's.

/** The six columns, left to right. */
export const TRACE_COLUMNS = ['outcome', 'journey', 'use-case', 'design', 'technical', 'suite'] as const;
export type TraceColumn = (typeof TRACE_COLUMNS)[number];
export const TRACE_COLUMN_LABELS: Record<TraceColumn, string> = { outcome: 'Outcome', journey: 'Journey', 'use-case': 'Use case', design: 'Design flow', technical: 'Technical flow', suite: 'Acceptance test suite' };
/** The columns that expand down, each a stage of every row. */
export const TRACE_STAGES = ['use-case', 'design', 'technical', 'suite'] as const;
export type TraceStage = (typeof TRACE_STAGES)[number];
/** The columns beside the rows: the outcomes and the journeys. */
export const OUTCOME_COLUMN = 0;
export const JOURNEY_COLUMN = 1;
/** Each stage's column: a row's cells, from the Use case column on. */
export const STAGE_COLUMN: Readonly<Record<TraceStage, number>> = { 'use-case': 2, design: 3, technical: 4, suite: 5 };
/** The stage of a row's column, or null for the outcomes' and journeys'. */
export const stageOfColumn = (column: number): TraceStage | null => TRACE_STAGES.find((s) => STAGE_COLUMN[s] === column) ?? null;

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
  /**
   * What a box that is no record says: its kind, its title, its eyebrow, and any status in words under its title, at the
   * node text scale's status level (graph/text.ts NODE_TEXT). A Design flow, Technical flow or Acceptance test suite cell's
   * title is its status ("2 interfaces · all designed", LA-PAT-APP-UX-R24), with no line under it, and `of` names the use
   * case of its row by title, for its accessible name.
   */
  words?: { kind: string; title: string; meta: string; status?: string; of?: string };
  /** A record box's status line under its title: a journey's proof, a step's number and what it carries out, a test's proof. */
  status?: string;
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
  /** Each column's own box, from the Use case column on (STAGE_COLUMN: index 2 to 5; 0 and 1 unused). */
  cells: string[];
  /** Its records' links, from left to right, for its paths. */
  links: RowLink[];
  /** The steps of its flow, in path order. */
  steps: string[];
}

/** A journey step carrying out a use case with a row: the line from the journey to that row, labeled with its number. */
export interface Carry { journey: string; step: string; useCase: string; label: string }

/** A product's Trace stage. */
export interface TraceGraph {
  product: string;
  /** The outcomes, in ID order. */
  outcomes: readonly string[];
  /** The journeys, in ID order (order.ts orders them), each with its proof. */
  journeys: readonly TraceJourney[];
  /** The journey of each journey, journey step and journey test the view draws, by ID. */
  journeyOf: ReadonlyMap<string, TraceJourney>;
  /** The outcome → journey links, each [outcome, journey]. */
  journeyServes: readonly (readonly [string, string])[];
  /** The journey → use case links, one per step carrying out a use case with a row, in each journey's order. */
  carries: readonly Carry[];
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
/** A journey's box, and the key that opens it. */
export const journeyBox = (journey: string) => `journey/${journey}`;
export const journeyKey = (journey: string) => `journey|${journey}`;

/** A box's words as its accessible name says them: its title, any status line, and a stage cell's use case by title. */
export const wordsName = (w: NonNullable<Item['words']>) => [w.title, w.status, w.of].filter(Boolean).join(', ');

const n = (k: number, one: string, many = `${one}s`) => `${k} ${k === 1 ? one : many}`;

/** A row's stage status in words, and whether it has a gap: "2 interfaces · all designed", "No flow". */
export function statusOf(row: TraceRow, stage: Exclude<TraceStage, 'use-case'>): { title: string; gap: boolean } {
  const { design, technical, suite } = row.status;
  switch (stage) {
    case 'design':
      if (!row.flow) return { title: 'No flow', gap: true };
      return { title: `${n(design.interfaces, 'interface')} · ${design.notDesigned === 0 ? 'all designed' : `${n(design.notDesigned, 'requirement')} not designed`}`, gap: design.notDesigned > 0 || design.interfaces === 0 };
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

const isMain = (path: string) => path.trim().toLowerCase() === 'main';

/** A journey step's number, as the line to its row says it: "3" on the main path, "alt 2" on another. */
export const stepNumber = (s: Pick<TraceJourneyStep, 'path' | 'position'>) => (isMain(s.path) ? String(s.position) : `alt ${s.position}`);

/** A journey's proof in words, as its box's status line says it: "3 steps · 2 proved · test ✓". */
export function journeyWords(j: TraceJourney): string {
  const { steps, unlinked, stepsProved } = j.status;
  const test = !j.test ? 'no test' : j.testProved ? 'test ✓' : 'test ✗';
  return [n(steps, 'step'), ...(unlinked > 0 ? [`${unlinked} unlinked`] : []), `${stepsProved} proved`, test].join(' · ');
}

/** A journey step in words: its number, what it carries out (a handoff its policy) and whether that is proved (✓ or ✗). */
export function stepWords(s: TraceJourneyStep): string {
  if (s.carriesOut === null) return `Step ${s.position} · No use case yet`;
  return [`Step ${s.position}`, s.kind === 'policy' ? `Handoff ${s.carriesOut}` : s.carriesOut, s.proved ? '✓' : '✗'].join(' · ');
}

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

  for (const o of trace.outcomes) if (known(o)) add({ key: `outcome/${o}`, id: o, row: null, column: OUTCOME_COLUMN, depth: 0, parent: null, role: 'record' });
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
    const useCase = add({ key: `${u}|use-case`, id: u, row: u, column: STAGE_COLUMN['use-case'], depth: 0, parent: null, role: 'record', opens: cellKey(u, 'use-case') });
    for (const r of data.requirements) if (known(r.id)) { record(useCase, r.id); link(u, r.id); }
    for (const a of [...data.changes, ...data.reads]) if (known(a)) { record(useCase, a); link(u, a); }

    // Design flow: its status, then its flow, a box per interface that offers it, and each interface's version: its
    // steps, each with where it is carried out there and its integrations, a gap under a step it cannot reach.
    const design = statusOf(data, 'design');
    const f = data.flow && known(data.flow.id) ? data.flow : null;
    /** A stage cell's title is its status; it names its row's use case for its accessible name (LA-PAT-APP-UX-R24). */
    const of = index.byId.get(u)!.title;
    const designBox = add({ key: `${u}|design`, id: null, row: u, column: STAGE_COLUMN.design, depth: 0, parent: null, role: design.gap ? 'gap' : 'status', words: { kind: 'Design flow', title: design.title, meta: `Design flow · ${u}`, of }, opens: cellKey(u, 'design') });
    const steps = f ? f.steps.filter((s) => known(s.id)) : [];
    if (f) {
      const flow = record(designBox, f.id, { opens: innerKey(u, 'design', f.id) });
      link(u, f.id);
      const written = new Map(steps.map((s) => [s.id, s]));
      for (const s of steps) for (const r of s.fulfills) link(r, s.id);
      const integrations = (parent: string, id: string) => { for (const i of written.get(id)!.integrations) if (known(i)) { record(parent, i); link(id, i); } };
      const faces = f.through.filter((t) => known(t.interface));
      if (faces.length === 0) {
        // No interface offers it: the flow opens to its steps as written.
        for (const s of steps) {
          const step = record(flow, s.id, s.integrations.length > 0 ? { opens: innerKey(u, 'design', s.id) } : {});
          link(f.id, s.id);
          integrations(step, s.id);
        }
      }
      for (const t of faces) {
        const face = record(flow, t.interface, { opens: innerKey(u, 'design', t.interface) });
        link(f.id, t.interface);
        for (const s of t.steps) {
          if (!written.has(s.id)) continue;
          const views = s.views.filter((v) => known(v.id));
          const endpoints = s.endpoints.filter((e) => known(e.id));
          const entries = s.entries.filter(known);
          const has = views.length + endpoints.length + entries.length + written.get(s.id)!.integrations.length > 0;
          const step = record(face, s.id, has ? { opens: innerKey(u, 'design', `${t.interface}/${s.id}`) } : {});
          link(t.interface, s.id);
          if (s.unreached) plain(step, 'gap:unreached', 'gap', { kind: 'Gap', title: 'Not reached', meta: `Gap · ${s.id} through ${t.interface}` }, { id: s.id });
          for (const v of views) {
            const box = record(step, v.id);
            link(s.id, v.id);
            for (const r of v.requirements) if (known(r.id)) { record(box, r.id); link(v.id, r.id); }
          }
          for (const e of endpoints) {
            const box = record(step, e.id);
            link(s.id, e.id);
            for (const r of e.apiRequirements) if (known(r.id)) { record(box, r.id); link(e.id, r.id); }
          }
          for (const e of entries) { record(step, e); link(s.id, e); }
          integrations(step, s.id);
        }
      }
    }

    // Technical flow: its status, then each step's chain under a heading naming the step.
    const technical = statusOf(data, 'technical');
    const techBox = add({ key: `${u}|technical`, id: null, row: u, column: STAGE_COLUMN.technical, depth: 0, parent: null, role: technical.gap ? 'gap' : 'status', words: { kind: 'Technical flow', title: technical.title, meta: `Technical flow · ${u}`, of }, opens: cellKey(u, 'technical') });
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
    const suiteBox = add({ key: `${u}|suite`, id: null, row: u, column: STAGE_COLUMN.suite, depth: 0, parent: null, role: suite.gap ? 'gap' : 'status', words: { kind: 'Acceptance test suite', title: suite.title, meta: `Acceptance test suite · ${u}`, of }, opens: cellKey(u, 'suite') });
    plain(suiteBox, 'proved', 'heading', { kind: 'Proved', title: 'Use case and flow tests', meta: '', status: provedWords(data) });
    for (const r of data.requirements) {
      if (!known(r.id)) continue;
      testsOf(suiteBox, r);
      for (const t of r.tests) link(r.id, t);
      if (r.gaps.includes('proved')) link(r.id, `${suiteBox}/gap:${r.id}`);
    }
    if (f) {
      if (f.test && known(f.test)) { record(suiteBox, f.test); link(f.id, f.test); }
      if (!f.proved) { plain(suiteBox, `gap:${f.id}`, 'gap', { kind: 'Gap', title: f.test ? 'Flow test not automated' : 'No flow test', meta: `Gap · ${f.id}` }, { id: f.id }); link(f.id, `${suiteBox}/gap:${f.id}`); }
    }
    if (data.lower.length > 0) {
      const lower = plain(suiteBox, 'lower', 'heading', { kind: 'Lower tests', title: 'Lower tests', meta: '', status: `${n(data.lower.length, 'obligation')} the suite rests on` }, { opens: innerKey(u, 'suite', 'lower') });
      for (const o of data.lower) {
        if (!known(o.id)) continue;
        testsOf(lower, o);
        for (const t of o.tests) link(o.id, t);
        if (o.gaps.includes('proved')) link(o.id, `${lower}/gap:${o.id}`);
      }
    }
    if (design.gap || technical.gap || suite.gap) gapped++;
    rows.push({ useCase: u, data, cells: ['', '', useCase, designBox, techBox, suiteBox], links, steps: steps.map((s) => s.id) });
  }
  const rowOf = new Map(rows.map((r) => [r.useCase, r]));

  // Journey: each journey's box, opening to its steps (each alternate path under a heading), its journey test or a gap;
  // a line from each outcome it serves, and to each use case row a step carries out.
  const journeys = trace.journeys.filter((j) => known(j.id));
  const journeyOf = new Map<string, TraceJourney>();
  const journeyServes: [string, string][] = [];
  const carries: Carry[] = [];
  for (const j of journeys) {
    journeyOf.set(j.id, j);
    const box = add({ key: journeyBox(j.id), id: j.id, row: null, column: JOURNEY_COLUMN, depth: 0, parent: null, role: 'record', opens: journeyKey(j.id), status: journeyWords(j) });
    const paths = new Map<string, string>();
    for (const s of j.steps) {
      if (!known(s.id)) continue;
      journeyOf.set(s.id, j);
      let parent = box;
      if (!isMain(s.path)) {
        const name = s.path.trim();
        parent = paths.get(name.toLowerCase()) ?? plain(box, `path:${name}`, 'heading', { kind: 'Path', title: name, meta: `Alternate path · ${j.id}` });
        paths.set(name.toLowerCase(), parent);
      }
      record(parent, s.id, { status: stepWords(s) });
      if (s.kind === 'use_case' && s.carriesOut && rowOf.has(s.carriesOut)) carries.push({ journey: j.id, step: s.id, useCase: s.carriesOut, label: stepNumber(s) });
    }
    if (j.test && known(j.test)) { journeyOf.set(j.test, j); record(box, j.test, { status: j.testProved ? 'Proved' : 'Not proved' }); }
    else plain(box, 'gap:test', 'gap', { kind: 'Gap', title: 'No journey test', meta: `Gap · ${j.id}` }, { id: j.id });
    for (const o of j.outcomes) if (items.has(`outcome/${o}`)) journeyServes.push([o, j.id]);
  }
  return { product: trace.product, outcomes: trace.outcomes.filter(known), journeys, journeyOf, journeyServes, carries, rows, rowOf, items, serves, boxesOf, counts: { gapped, outside } };
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

/**
 * What the view opens, the step whose chain the Technical flow column shows, and the journey shown open while one of its
 * steps is the focus (as a focused flow step shows its chain).
 */
export interface Openness { open: ReadonlySet<string>; step: string | null; journey?: string | null }

/** Whether a box's children show. */
export function isOpen(item: Item, o: Openness): boolean {
  return !!item.opens && (o.open.has(item.opens) || (!!o.journey && item.opens === journeyKey(o.journey)));
}

/** The children of a box that show: a Technical flow cell shows the selected step's chain (or a hint), or every step's under Expand all. */
export function shownChildren(graph: TraceGraph, item: Item, o: Openness): string[] {
  if (!isOpen(item, o)) return [];
  if (item.column === STAGE_COLUMN.technical && item.depth === 0 && item.row) {
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
  // The tests of the obligations on the path: the requirements a step fulfills, its views' and endpoints' requirements.
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
    if (row.data.flow?.test) tests.add(row.data.flow.test);
    known = new Set(row.links.map((x, i) => (tests.has(x.to) || x.to.startsWith(`${row.useCase}|suite/`) ? i : -1)).filter((i) => i >= 0));
    testLinkCache.set(row, known);
  }
  return known.has(l);
}

/** The rows a record shows in (each row whose links name it), in the graph's order. */
export function rowsOf(graph: TraceGraph, id: string): Row[] {
  return graph.rows.filter((r) => r.useCase === id || r.links.some((l) => l.from === id || l.to === id));
}
