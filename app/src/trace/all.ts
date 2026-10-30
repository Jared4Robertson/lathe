import type { ProductTraces } from '../../../lathe/src/traceability/trace/read-model';
import { byIdOrder, type RecordIndex } from '../exploring/record-summaries/record-index';
import { onePerData } from '../graph/one-map';
import { traceChain, type GapColumn } from './chain';

// The Trace stage's All-at-once view (LA-V98), pure and tested directly: a product's whole trace as five fixed columns,
// left to right by role, each record once, with its links drawn as lines between them:
//
//   Outcomes → Use cases → Obligations → Built by → Proved by
//
// - Outcomes: the product's business outcomes.
// - Use cases: every use case of its space; a line from each outcome its capability serves (serves).
// - Obligations: every obligation of every kind (UC, view and API requirements, invariants, storage requirements,
//   specifications, policies, domain services, constraints, pattern and standard rules, a product's own kinds); a line
//   from each use case that reaches it by the Serves reach (reaches).
// - Built by: the technical records that build each obligation (its handlers, tables, rules, components…); a line from
//   each obligation they build (built by).
// - Proved by: each obligation's tests; a line from the obligation (proved by), passing behind the Built by column.
//
// A gap coverage reports is a dashed box of its own in the column where its record would be (a missing build, and a
// missing design, which has no column of its own, under Built by; a missing proof under Proved by), linked from its
// obligation. A record no outcome reaches by these links is "not under an outcome": it sits at the bottom of its
// column, under the column's mark. Every link comes from the Trace read model (list-traces, LA-TRC-RM11), the Serves
// links included; the index gives only titles, kinds and stages to draw. Where each box goes is all-layout.ts's.

/** The five columns, left to right. */
export const ALL_COLUMNS = ['outcomes', 'use-cases', 'obligations', 'built', 'proved'] as const;
export type AllColumn = (typeof ALL_COLUMNS)[number];
export const ALL_COLUMN_LABELS: Record<AllColumn, string> = { outcomes: 'Outcomes', 'use-cases': 'Use cases', obligations: 'Obligations', built: 'Built by', proved: 'Proved by' };
const COLUMN: Record<AllColumn, number> = { outcomes: 0, 'use-cases': 1, obligations: 2, built: 3, proved: 4 };

/** A link's kind: an outcome a use case's capability serves, an obligation a use case reaches, a record that builds an obligation, a test that proves one. */
export type LinkKind = 'serves' | 'reaches' | 'built' | 'proved';
export const LINK_KINDS: readonly LinkKind[] = ['serves', 'reaches', 'built', 'proved'];
export const LINK_LABELS: Record<LinkKind, string> = { serves: 'Serves', reaches: 'Reaches', built: 'Built by', proved: 'Proved by' };

/** A gap's words, by what is missing. */
export const GAP_WORDS: Record<GapColumn, string> = { design: 'Not designed', build: 'Not built', tests: 'Not proved' };

/** One box: a record, or a gap of an obligation. */
export interface AllNode {
  /** Its key: the record's ID, or `gap:<obligation>:<missing>` for a gap. */
  key: string;
  role: 'record' | 'gap';
  /** Its column, 0 to 4. */
  column: number;
  /** Whether an outcome reaches it by the links (an outcome always is): false sits it at the bottom of its column, marked. */
  under: boolean;
  /** A gap's obligation and what it misses. */
  gap?: { obligation: string; missing: GapColumn };
}

/** A line: from a box in one column to a box in a column to its right. */
export interface AllLink { from: string; to: string; kind: LinkKind }

/** A product's All-at-once graph, its boxes in their columns by ID (all-layout.ts orders them). */
export interface AllGraph {
  product: string;
  /** Each column's keys, in ID order (gaps after the records). */
  columns: readonly (readonly string[])[];
  nodes: ReadonlyMap<string, AllNode>;
  links: readonly AllLink[];
  /** Each key's links to its right and from its left, as indexes into `links`. */
  out: ReadonlyMap<string, readonly number[]>;
  into: ReadonlyMap<string, readonly number[]>;
  /** The obligations with a gap. */
  gapped: ReadonlySet<string>;
  /** How many obligations, how many of them with a gap, and how many records sit under no outcome. */
  counts: { obligations: number; withGaps: number; outside: number };
}

/** A key's gap: `gap:<obligation>:<missing>`. */
export const gapKey = (obligation: string, missing: GapColumn) => `gap:${obligation}:${missing}`;

function build(index: RecordIndex, traces: ProductTraces, product: string): AllGraph {
  const nodes = new Map<string, AllNode>();
  const links: AllLink[] = [];
  const seenLink = new Set<string>();
  const known = (id: string) => index.byId.has(id);
  const add = (key: string, column: AllColumn, gap?: AllNode['gap']) => {
    if (!nodes.has(key)) nodes.set(key, { key, role: gap ? 'gap' : 'record', column: COLUMN[column], under: column === 'outcomes', ...(gap ? { gap } : {}) });
  };
  const link = (from: string, to: string, kind: LinkKind) => {
    const k = `${from}>${to}`;
    if (seenLink.has(k)) return;
    seenLink.add(k);
    links.push({ from, to, kind });
  };

  for (const o of traces.outcomes) if (known(o)) add(o, 'outcomes');
  for (const u of traces.useCases) {
    if (!known(u.useCase)) continue;
    add(u.useCase, 'use-cases');
    for (const o of u.outcomes) if (nodes.has(o)) link(o, u.useCase, 'serves');
  }
  const obligations = new Set<string>();
  for (const t of traces.traces) if (known(t.obligation)) obligations.add(t.obligation);
  for (const u of traces.useCases) for (const o of u.reaches) if (known(o)) obligations.add(o);
  for (const o of obligations) add(o, 'obligations');
  for (const u of traces.useCases) if (nodes.has(u.useCase)) for (const o of u.reaches) if (nodes.has(o)) link(u.useCase, o, 'reaches');
  const gapped = new Set<string>();
  for (const o of obligations) {
    const row = traceChain(index, traces, o);
    if (!row) continue;
    for (const b of row.build) if (known(b) && !obligations.has(b)) { add(b, 'built'); link(o, b, 'built'); }
    for (const t of row.tests) if (known(t)) { add(t, 'proved'); link(o, t, 'proved'); }
    for (const missing of row.gaps) {
      gapped.add(o);
      const key = gapKey(o, missing);
      add(key, missing === 'tests' ? 'proved' : 'built', { obligation: o, missing });
      link(o, key, missing === 'tests' ? 'proved' : 'built');
    }
  }

  const out = new Map<string, number[]>();
  const into = new Map<string, number[]>();
  links.forEach((l, i) => {
    (out.get(l.from) ?? out.set(l.from, []).get(l.from)!).push(i);
    (into.get(l.to) ?? into.set(l.to, []).get(l.to)!).push(i);
  });
  // Under an outcome: what the links reach from an outcome, left to right.
  const queue = [...nodes.values()].filter((n) => n.under).map((n) => n.key);
  for (let i = 0; i < queue.length; i++) {
    for (const l of out.get(queue[i]) ?? []) {
      const to = nodes.get(links[l].to)!;
      if (to.under) continue;
      to.under = true;
      queue.push(to.key);
    }
  }
  const columns: string[][] = ALL_COLUMNS.map(() => []);
  for (const n of nodes.values()) columns[n.column].push(n.key);
  const rank = (k: string) => (nodes.get(k)!.role === 'gap' ? 1 : 0);
  for (const c of columns) c.sort((a, b) => rank(a) - rank(b) || byIdOrder({ id: a }, { id: b }));
  let outside = 0;
  for (const n of nodes.values()) if (!n.under && n.role === 'record') outside++;
  return { product, columns, nodes, links, out, into, gapped, counts: { obligations: obligations.size, withGaps: gapped.size, outside } };
}

/** Each Trace read's graphs, one per product and data change. */
const graphsOf = new WeakMap<ProductTraces, (index: RecordIndex, product: string) => AllGraph>();

/** A product's All-at-once graph, worked out once per product and data change (one-map.ts) and Trace read answer. */
export function allGraph(index: RecordIndex, traces: ProductTraces, product: string): AllGraph {
  let made = graphsOf.get(traces);
  if (!made) { made = onePerData((i, p) => build(i, traces, p)); graphsOf.set(traces, made); }
  return made(index, product);
}

// ---------- Paths: what a focus lights ----------

/** The keys and links a key's path holds: everything linked to its left, on and on, and to its right, on and on. */
export interface Path { keys: ReadonlySet<string>; links: ReadonlySet<number> }

const pathCache = new WeakMap<AllGraph, Map<string, Path>>();

/**
 * A key's whole path (LA-V98): back along the links to its left to the outcomes it serves, and on along the links to its
 * right to its tests, both ways from the key itself only, so a use case's path is its outcomes, its obligations and
 * what builds and proves them, not the other use cases those obligations have.
 */
export function pathOf(graph: AllGraph, key: string): Path {
  let known = pathCache.get(graph);
  if (!known) { known = new Map(); pathCache.set(graph, known); }
  const cached = known.get(key);
  if (cached) return cached;
  const keys = new Set<string>([key]);
  const lit = new Set<number>();
  const walk = (from: ReadonlyMap<string, readonly number[]>, end: 'from' | 'to') => {
    const queue = [key];
    const seen = new Set(queue);
    for (let i = 0; i < queue.length; i++) {
      for (const l of from.get(queue[i]) ?? []) {
        lit.add(l);
        const next = graph.links[l][end];
        if (seen.has(next)) continue;
        seen.add(next);
        keys.add(next);
        queue.push(next);
      }
    }
  };
  if (graph.nodes.has(key)) { walk(graph.into, 'from'); walk(graph.out, 'to'); }
  const path = { keys, links: lit };
  known.set(key, path);
  return path;
}

const gapsCache = new WeakMap<AllGraph, Path>();
/** What Gaps only keeps: each obligation with a gap and its whole path. */
export function gapsPath(graph: AllGraph): Path {
  const known = gapsCache.get(graph);
  if (known) return known;
  const keys = new Set<string>();
  const links = new Set<number>();
  for (const o of graph.gapped) {
    const p = pathOf(graph, o);
    for (const k of p.keys) keys.add(k);
    for (const l of p.links) links.add(l);
  }
  const path = { keys, links };
  gapsCache.set(graph, path);
  return path;
}

/** What a focus keeps at full strength: its path; null (everything) for a focus with no box. */
export function keptBy(graph: AllGraph, focus: string | null, gapsOnly: boolean): Path | null {
  const own = focus === null ? null : pathOf(graph, focus);
  if (!gapsOnly) return own;
  const gaps = gapsPath(graph);
  if (!own) return gaps;
  return { keys: new Set([...own.keys].filter((k) => gaps.keys.has(k))), links: new Set([...own.links].filter((l) => gaps.links.has(l))) };
}
