import type { SpecIndex } from '../specs/data';
import { byIdOrder, kindLabel } from '../specs/data';

// Pure graph logic for the graph view: the ego graph around a record, filters and trace mode.
// Nothing here touches React or the DOM, so it is tested directly.

/** The pseudo-relation between a record and its parent (drawn from parent to child). */
export const PARENT = 'parent';
/** The pseudo-relation from a component or test to the file it names (trace mode only). */
export const NAMES = 'names';
/** The pseudo-kind of a file node in trace mode. */
export const FILE_KIND = 'file';

export interface GraphNode {
  id: string;
  /** Hops from the focused record (0 for the focus). */
  distance: number;
  kind: string;
  title: string;
  /** 'define', 'design', '' for structural kinds, or 'file'. */
  stage: string;
  /** The tier the layout puts this node in (see tierOf). */
  tier: number;
}

/** The hierarchy reads left to right by record level; trace mode reads left to right along the chain. */
export type GraphMode = 'hierarchy' | 'trace';

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  relation: string;
}

export interface Neighbourhood {
  focus: string;
  mode: GraphMode;
  /** In a stable order: the focus first, then by distance, stage, kind and ID. */
  nodes: GraphNode[];
  edges: GraphEdge[];
  /** For each node but the focus, the node it was reached from (a spanning tree rooted at the focus). */
  via: Map<string, string>;
}

export interface Filters {
  hiddenKinds: ReadonlySet<string>;
  hiddenRelations: ReadonlySet<string>;
}

export const NO_FILTERS: Filters = { hiddenKinds: new Set(), hiddenRelations: new Set() };

export const isFiltered = (f: Filters) => f.hiddenKinds.size > 0 || f.hiddenRelations.size > 0;

const edgeId = (e: Omit<GraphEdge, 'id'>) => `${e.source}|${e.relation}|${e.target}`;

/** Every edge touching a record: its links both ways, its parent and its children. */
export function edgesOf(index: SpecIndex, id: string): GraphEdge[] {
  const edges: Omit<GraphEdge, 'id'>[] = [
    ...(index.outgoing.get(id) ?? []),
    ...(index.incoming.get(id) ?? []),
  ].map((l) => ({ source: l.source, target: l.target, relation: l.relation }));
  const record = index.byId.get(id);
  if (record?.parent) edges.push({ source: record.parent, target: id, relation: PARENT });
  for (const child of index.children.get(id) ?? []) edges.push({ source: id, target: child.id, relation: PARENT });
  return edges.filter((e) => index.byId.has(e.source) && index.byId.has(e.target)).map((e) => ({ ...e, id: edgeId(e) }));
}

const STAGE_ORDER: Record<string, number> = { '': 0, define: 1, design: 2, file: 3 };

export const stageOf = (index: SpecIndex, kind: string) => (kind === FILE_KIND ? 'file' : index.kinds.get(kind)?.stage ?? '');

function kindOrder(index: SpecIndex) {
  const order = new Map(index.workspace.kinds.map((k, i) => [k.kind, i]));
  return (kind: string) => order.get(kind) ?? order.size;
}

function sortNodes(index: SpecIndex, nodes: GraphNode[]): GraphNode[] {
  const kindRank = kindOrder(index);
  return [...nodes].sort(
    (a, b) =>
      a.distance - b.distance ||
      STAGE_ORDER[a.stage] - STAGE_ORDER[b.stage] ||
      kindRank(a.kind) - kindRank(b.kind) ||
      byIdOrder(a, b),
  );
}

function recordNode(index: SpecIndex, id: string, distance: number, mode: GraphMode): GraphNode {
  const r = index.byId.get(id)!;
  return { id, distance, kind: r.kind, title: r.title, stage: stageOf(index, r.kind), tier: tierOf(index, r.kind, mode) };
}

/**
 * Tiers of the hierarchy, left to right: product, domain, aggregates and use cases, domain rules
 * and requirements, design records, tests. Open questions sit with the records they are about.
 */
export const HIERARCHY_TIERS: Record<string, number> = {
  product: 0,
  domain: 1,
  fitness: 1,
  aggregate: 2,
  use_case: 2,
  question: 2,
  domain_rule: 3,
  requirement: 3,
  flow: 4,
  view: 4,
  endpoint: 4,
  component: 4,
  test: 5,
  [FILE_KIND]: 6,
};

/** Columns of a trace, left to right: the rule, what fulfills it, components, tests, files. */
export const TRACE_TIERS: Record<string, number> = {
  requirement: 0,
  domain_rule: 0,
  flow: 1,
  view: 1,
  endpoint: 1,
  component: 2,
  test: 3,
  [FILE_KIND]: 4,
};

/**
 * The tier a kind is drawn in. A kind the tables do not know (one a product adds to the
 * meta-model) goes one tier below its highest possible parent, or just below the domain.
 */
export function tierOf(index: SpecIndex, kind: string, mode: GraphMode, seen = new Set<string>()): number {
  const table = mode === 'trace' ? TRACE_TIERS : HIERARCHY_TIERS;
  if (kind in table) return table[kind];
  if (mode === 'trace') return TRACE_TIERS.component;
  const parents = (index.kinds.get(kind)?.parent_kinds ?? []).filter((p) => !seen.has(p));
  if (parents.length === 0) return HIERARCHY_TIERS.aggregate;
  seen.add(kind);
  return Math.min(...parents.map((p) => tierOf(index, p, mode, seen))) + 1;
}

/**
 * A cycle among links between records in the same tier (for example aggregates that relate to
 * each other in a ring), as the IDs around it, or null. Such a graph is not drawn in tiers.
 */
export function sameTierCycle(n: Neighbourhood): string[] | null {
  const tier = new Map(n.nodes.map((x) => [x.id, x.tier]));
  const next = new Map<string, string[]>();
  for (const e of n.edges) {
    if (e.source === e.target || tier.get(e.source) !== tier.get(e.target)) continue;
    next.set(e.source, [...(next.get(e.source) ?? []), e.target]);
  }
  const state = new Map<string, 'open' | 'done'>();
  const path: string[] = [];
  const visit = (id: string): string[] | null => {
    state.set(id, 'open');
    path.push(id);
    for (const to of next.get(id) ?? []) {
      if (state.get(to) === 'open') return path.slice(path.indexOf(to));
      if (!state.has(to)) {
        const found = visit(to);
        if (found) return found;
      }
    }
    path.pop();
    state.set(id, 'done');
    return null;
  };
  for (const node of n.nodes) {
    if (state.has(node.id)) continue;
    const found = visit(node.id);
    if (found) return found;
  }
  return null;
}

/**
 * The focused record and every record within `depth` hops of it, following links both ways and
 * the parent/child relation, with every edge between the records shown. Filters hide kinds and
 * relations, and nothing is reached through a hidden record or relation; the focus is never hidden.
 */
export function neighbourhood(index: SpecIndex, focus: string, depth: number, filters: Filters = NO_FILTERS): Neighbourhood {
  if (!index.byId.has(focus)) return { focus, mode: 'hierarchy', nodes: [], edges: [], via: new Map() };
  const shownRelation = (relation: string) => !filters.hiddenRelations.has(relation);
  const shownKind = (id: string) => id === focus || !filters.hiddenKinds.has(index.byId.get(id)!.kind);

  const distance = new Map([[focus, 0]]);
  const via = new Map<string, string>();
  let frontier = [focus];
  for (let hop = 1; hop <= depth; hop++) {
    const next: string[] = [];
    for (const id of frontier) {
      for (const e of edgesOf(index, id)) {
        if (!shownRelation(e.relation)) continue;
        const other = e.source === id ? e.target : e.source;
        if (distance.has(other) || !shownKind(other)) continue;
        distance.set(other, hop);
        via.set(other, id);
        next.push(other);
      }
    }
    frontier = next.sort((a, b) => a.localeCompare(b, 'en', { numeric: true }));
  }

  const edges = new Map<string, GraphEdge>();
  for (const id of distance.keys()) {
    for (const e of edgesOf(index, id)) {
      if (shownRelation(e.relation) && distance.has(e.source) && distance.has(e.target)) edges.set(e.id, e);
    }
  }
  return {
    focus,
    mode: 'hierarchy',
    nodes: sortNodes(index, [...distance].map(([id, d]) => recordNode(index, id, d, 'hierarchy'))),
    edges: [...edges.values()].sort((a, b) => a.id.localeCompare(b.id)),
    via,
  };
}

/** Trace mode is offered for requirements and domain rules only. */
export const canTrace = (index: SpecIndex, id: string) => {
  const kind = index.byId.get(id)?.kind;
  return kind === 'requirement' || kind === 'domain_rule';
};

export const fileNodeId = (path: string) => `file:${path}`;

/**
 * A requirement or domain rule's traceability chain: the flows, views and endpoints that fulfill
 * it, the components that satisfy it, the tests that prove it, the components that implement
 * those views and endpoints, and the files the components and tests name.
 */
export function traceChain(index: SpecIndex, focus: string, filters: Filters = NO_FILTERS): Neighbourhood {
  if (!canTrace(index, focus)) return { focus, mode: 'trace', nodes: [], edges: [], via: new Map() };
  const shownRelation = (relation: string) => !filters.hiddenRelations.has(relation);
  const shownKind = (kind: string) => !filters.hiddenKinds.has(kind);

  const nodes = new Map<string, GraphNode>([[focus, recordNode(index, focus, 0, 'trace')]]);
  const edges = new Map<string, GraphEdge>();
  const via = new Map<string, string>();
  const add = (source: string, relation: string, target: string, reached: string, from: string, distance: number) => {
    if (!shownRelation(relation)) return false;
    const node = nodes.get(reached) ?? (index.byId.has(reached) ? recordNode(index, reached, distance, 'trace') : null);
    if (!node || !shownKind(node.kind)) return false;
    if (!nodes.has(reached)) { nodes.set(reached, node); via.set(reached, from); }
    const e = { source, relation, target };
    edges.set(edgeId(e), { ...e, id: edgeId(e) });
    return true;
  };

  const direct = (index.incoming.get(focus) ?? []).filter((l) => ['fulfills', 'satisfies', 'proves'].includes(l.relation));
  for (const l of direct) add(l.source, l.relation, l.target, l.source, focus, 1);

  // Components that implement a fulfilling view or endpoint carry the chain on to code.
  for (const l of direct.filter((d) => d.relation === 'fulfills' && nodes.has(d.source))) {
    for (const impl of (index.incoming.get(l.source) ?? []).filter((i) => i.relation === 'implements')) {
      add(impl.source, impl.relation, impl.target, impl.source, l.source, 2);
    }
  }

  // Files named by the components and tests in the chain.
  if (shownRelation(NAMES) && shownKind(FILE_KIND)) {
    for (const node of [...nodes.values()]) {
      const r = index.byId.get(node.id)!;
      const path = r.kind === 'component' ? r.fields.file : r.kind === 'test' ? r.fields.run_by : undefined;
      if (!path) continue;
      const id = fileNodeId(path);
      if (!nodes.has(id)) {
        nodes.set(id, { id, distance: node.distance + 1, kind: FILE_KIND, title: path, stage: 'file', tier: TRACE_TIERS[FILE_KIND] });
        via.set(id, node.id);
      }
      const e = { source: node.id, relation: NAMES, target: id };
      edges.set(edgeId(e), { ...e, id: edgeId(e) });
    }
  }

  return {
    focus,
    mode: 'trace',
    nodes: sortNodes(index, [...nodes.values()]),
    edges: [...edges.values()].sort((a, b) => a.id.localeCompare(b.id)),
    via,
  };
}

/** The relations a person can filter on: every relation in the meta-model, and parent/child. */
export function relationsOf(index: SpecIndex): string[] {
  return [PARENT, ...new Set(index.workspace.relations.map((r) => r.relation))];
}

export const RELATION_LABELS: Record<string, string> = { [PARENT]: 'parent / child', [NAMES]: 'names file' };
export const graphRelationLabel = (relation: string) => RELATION_LABELS[relation] ?? relation.replaceAll('_', ' ');

/** The kinds a person can filter on, grouped by stage in the meta-model's order. */
export function kindGroups(index: SpecIndex): { stage: string; title: string; kinds: { kind: string; label: string }[] }[] {
  const groups = [
    { stage: 'define', title: 'Define' },
    { stage: 'design', title: 'Design' },
    { stage: '', title: 'Structural' },
  ];
  return groups.map((g) => ({
    ...g,
    kinds: index.workspace.kinds.filter((k) => k.stage === g.stage).map((k) => ({ kind: k.kind, label: kindLabel(index, k.kind) })),
  }));
}

/** The relations kept by the "traceability only" preset. */
export const TRACE_RELATIONS = new Set(['satisfies', 'proves', 'fulfills', NAMES]);

/** The coverage gaps recorded for one record (what is missing: 'satisfies' or 'proves'). */
export function gapsFor(index: SpecIndex, id: string): ('satisfies' | 'proves')[] {
  const domain = index.byId.get(id)?.domain;
  if (!domain) return [];
  return (index.coverage.get(domain)?.gaps ?? []).filter((g) => g.id === id).map((g) => g.missing);
}

/** The opening of a record's body as plain text, for the side panel. */
export function summary(body: string, max = 280): string {
  const first = body.split(/\n\s*\n/).map((p) => p.trim()).find((p) => p && !p.startsWith('#') && !p.startsWith('|')) ?? '';
  const text = first.replace(/\s+/g, ' ').replace(/[*_`]/g, '').replace(/\[([^\]]*)\]\([^)]*\)/g, '$1');
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
}

/** Keeps the breadcrumb trail: going back to a record in the trail cuts the trail there. */
export function nextTrail(trail: string[], focus: string, max = 8): string[] {
  const at = trail.indexOf(focus);
  return (at >= 0 ? trail.slice(0, at + 1) : [...trail, focus]).slice(-max);
}
