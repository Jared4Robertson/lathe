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
/** The stage of a group node: a folder of one kind of child between a record and its children. */
export const GROUP_STAGE = 'group';

export interface GraphNode {
  id: string;
  /** Hops from the focused record (0 for the focus). */
  distance: number;
  kind: string;
  title: string;
  /** 'define', 'design', '' for structural kinds, 'file', or 'group'. */
  stage: string;
  /** The tier the layout puts this node in (see tierOf); a group sits half a tier before its members. */
  tier: number;
  /** Set on a group node: its parent record, how many members it has, and whether it is open. */
  group?: { parent: string; count: number; open: boolean };
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

const STAGE_ORDER: Record<string, number> = { group: 0, '': 0, define: 1, design: 2, file: 3 };

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
 * The focus (a record or a group) and every record within `depth` hops of it, following links
 * both ways and the parent/child relation, with every edge between the nodes shown. A record
 * whose children are grouped (see isGrouped) reaches them through one group node per child kind:
 * the group is always shown, its members only when it is open. Groups do not count as a hop.
 * Filters hide kinds and relations, and nothing is reached through a hidden record or relation;
 * the focus is never hidden. `open` holds the groups the person has opened or closed; any other
 * group is open when it is the focus or the focus is one of its members.
 */
export function neighbourhood(
  index: SpecIndex,
  focus: string,
  depth: number,
  filters: Filters = NO_FILTERS,
  open: ReadonlyMap<string, boolean> = NO_OPEN,
): Neighbourhood {
  if (!isGraphNode(index, focus)) return { focus, mode: 'hierarchy', nodes: [], edges: [], via: new Map() };
  const shownRelation = (relation: string) => !filters.hiddenRelations.has(relation);
  const kindOfNode = (id: string) => index.byId.get(id)?.kind ?? parseGroupId(id)!.kind;
  const shownKind = (id: string) => id === focus || !filters.hiddenKinds.has(kindOfNode(id));
  const focusRecord = index.byId.get(focus);
  const home = focusRecord?.parent ? groupId(focusRecord.parent, focusRecord.kind) : null;
  const isOpen = (gid: string) => gid === focus || (open.get(gid) ?? gid === home);

  // Steps from a node, counted in half hops: record to record is 2, record to group or group to record is 1.
  type Step = { to: string; cost: number; relation: string };
  const steps = (id: string): Step[] => {
    const group = parseGroupId(id);
    if (group) {
      return [
        { to: group.parent, cost: 1, relation: PARENT },
        ...(isOpen(id) ? groupMembers(index, id).map((m) => ({ to: m.id, cost: 1, relation: PARENT })) : []),
      ];
    }
    const out: Step[] = [];
    for (const e of edgesOf(index, id)) {
      if (e.relation !== PARENT) out.push({ to: e.source === id ? e.target : e.source, cost: 2, relation: e.relation });
    }
    const record = index.byId.get(id)!;
    if (record.parent && index.byId.has(record.parent)) {
      out.push(isGrouped(index, record.parent)
        ? { to: groupId(record.parent, record.kind), cost: 1, relation: PARENT }
        : { to: record.parent, cost: 2, relation: PARENT });
    }
    if (isGrouped(index, id)) {
      for (const kind of childKinds(index, id)) out.push({ to: groupId(id, kind), cost: 1, relation: PARENT });
    } else {
      for (const child of index.children.get(id) ?? []) out.push({ to: child.id, cost: 2, relation: PARENT });
    }
    return out;
  };

  const half = new Map([[focus, 0]]);
  const via = new Map<string, string>();
  const limit = 2 * depth;
  for (let level = 0; level < limit; level++) {
    const frontier = [...half].filter(([, h]) => h === level).map(([id]) => id).sort((a, b) => a.localeCompare(b, 'en', { numeric: true }));
    for (const id of frontier) {
      for (const s of steps(id)) {
        const reached = level + s.cost;
        if (reached > limit || !shownRelation(s.relation) || !shownKind(s.to)) continue;
        const known = half.get(s.to);
        if (known !== undefined && known <= reached) continue;
        half.set(s.to, reached);
        via.set(s.to, id);
      }
    }
  }

  // The spine always runs through the group between a shown parent and a shown child.
  if (shownRelation(PARENT)) {
    for (const id of [...half.keys()]) {
      const record = index.byId.get(id);
      if (!record?.parent || !half.has(record.parent) || !isGrouped(index, record.parent)) continue;
      const gid = groupId(record.parent, record.kind);
      if (half.has(gid)) continue;
      half.set(gid, Math.max(half.get(id)!, half.get(record.parent)!) + 1);
      via.set(gid, id);
    }
  }

  const edges = new Map<string, GraphEdge>();
  const addParentEdge = (source: string, target: string) => {
    const e = { source, relation: PARENT, target };
    edges.set(edgeId(e), { ...e, id: edgeId(e) });
  };
  for (const id of half.keys()) {
    const group = parseGroupId(id);
    if (group) {
      if (half.has(group.parent) && shownRelation(PARENT)) addParentEdge(group.parent, id);
      continue;
    }
    for (const e of edgesOf(index, id)) {
      if (e.relation !== PARENT && shownRelation(e.relation) && half.has(e.source) && half.has(e.target)) edges.set(e.id, e);
    }
    const record = index.byId.get(id)!;
    if (!record.parent || !shownRelation(PARENT)) continue;
    const gid = groupId(record.parent, record.kind);
    if (half.has(gid)) addParentEdge(gid, id);
    else if (half.has(record.parent) && !isGrouped(index, record.parent)) addParentEdge(record.parent, id);
  }

  const nodes = [...half].map(([id, h]) =>
    parseGroupId(id) ? groupNode(index, id, Math.ceil(h / 2), isOpen(id)) : recordNode(index, id, Math.ceil(h / 2), 'hierarchy'),
  );
  return {
    focus,
    mode: 'hierarchy',
    nodes: sortNodes(index, nodes),
    edges: [...edges.values()].sort((a, b) => a.id.localeCompare(b.id)),
    via,
  };
}

// ---- Group nodes: a folder per kind of child between a record and its children ----

/** A record with more children than this, all of one kind, has them grouped. */
export const GROUP_HANDFUL = 5;
export const NO_OPEN: ReadonlyMap<string, boolean> = new Map();

/** A group's ID: its parent's ID and the kind of its members. Record IDs never contain a slash. */
export const groupId = (parent: string, kind: string) => `${parent}/${kind}`;

/** The parent and member kind of a group ID, or null for any other ID. */
export function parseGroupId(id: string): { parent: string; kind: string } | null {
  if (id.startsWith('file:')) return null;
  const at = id.indexOf('/');
  if (at <= 0 || at === id.length - 1 || id.indexOf('/', at + 1) >= 0) return null;
  return { parent: id.slice(0, at), kind: id.slice(at + 1) };
}

/** The kinds of a record's children, in the meta-model's order. */
export function childKinds(index: SpecIndex, id: string): string[] {
  const rank = kindOrder(index);
  return [...new Set((index.children.get(id) ?? []).map((c) => c.kind))].sort((a, b) => rank(a) - rank(b));
}

/** Whether a record's children are drawn through groups: more than one kind of child, or more than a handful of one kind. */
export function isGrouped(index: SpecIndex, id: string): boolean {
  return childKinds(index, id).length > 1 || (index.children.get(id) ?? []).length > GROUP_HANDFUL;
}

/** The records in a group: the parent's children of the group's kind, in ID order. */
export function groupMembers(index: SpecIndex, gid: string) {
  const g = parseGroupId(gid);
  return g ? (index.children.get(g.parent) ?? []).filter((c) => c.kind === g.kind) : [];
}

/** Whether an ID names a group that exists: a record with at least one child of that kind. */
export const isGroup = (index: SpecIndex, id: string) => groupMembers(index, id).length > 0;

/** Whether the graph can centre on an ID: a record or a group. */
export const isGraphNode = (index: SpecIndex, id: string) => index.byId.has(id) || isGroup(index, id);

/** A kind's label in the plural: "Use cases", "Open questions", "Fitness". */
export function pluralLabel(index: SpecIndex, kind: string): string {
  const label = kindLabel(index, kind);
  if (/s$/i.test(label)) return label;
  if (/[^aeiou]y$/i.test(label)) return `${label.slice(0, -1)}ies`;
  return `${label}s`;
}

/** A group's label with its count, such as "Use cases (5)". */
export const groupLabel = (index: SpecIndex, gid: string) => `${pluralLabel(index, parseGroupId(gid)!.kind)} (${groupMembers(index, gid).length})`;

/** The problems and coverage gaps of a group's members and everything beneath them, summed for the group's mark. */
export function groupMarks(index: SpecIndex, gid: string): { errors: number; warnings: number; gaps: ('satisfies' | 'proves')[] } {
  let errors = 0;
  let warnings = 0;
  const gaps = new Set<'satisfies' | 'proves'>();
  const visit = (id: string) => {
    for (const p of index.problemsFor.get(id) ?? []) if (p.severity === 'error') errors++; else warnings++;
    for (const g of gapsFor(index, id)) gaps.add(g);
    for (const c of index.children.get(id) ?? []) visit(c.id);
  };
  for (const m of groupMembers(index, gid)) visit(m.id);
  return { errors, warnings, gaps: [...gaps].sort() };
}

function groupNode(index: SpecIndex, id: string, distance: number, open: boolean): GraphNode {
  const g = parseGroupId(id)!;
  return {
    id,
    distance,
    kind: g.kind,
    title: groupLabel(index, id),
    stage: GROUP_STAGE,
    tier: tierOf(index, g.kind, 'hierarchy') - 0.5,
    group: { parent: g.parent, count: groupMembers(index, id).length, open },
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
