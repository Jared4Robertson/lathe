import { plural } from '../plural';
import type { SpecIndex, SpecRecord, Stage } from '../specs/data';
import { textOf, byIdOrder, gapsOf, kindLabel } from '../specs/data';
import { treeChildren, treeGroup, treeOf, treeParent } from './tree';
import { linkLabel, relationLabelOf } from '../specs/labels';

// Pure graph logic for the graph view: the picture the camera frames around a record or group, by
// levels of the nav's tree (tree.ts), the Links switch, filters and trace mode. The map it sits in
// is map.ts. Nothing here touches React or the DOM, so it is tested directly.

/** The pseudo-relation between a record and its parent (drawn from parent to child). */
export const PARENT = 'parent';
/** The pseudo-relation from a component or test to the file it names (trace mode only). */
export const NAMES = 'names';
/** The pseudo-relation from a table to the invariant one of its unique keys enforces (trace mode only). */
export const ENFORCES = 'enforces';
/** The pseudo-kind of a file node in trace mode. */
export const FILE_KIND = 'file';
/** The stage of a group node: a folder of one kind of child between a record and its children. */
export const GROUP_STAGE = 'group';

export interface GraphNode {
  id: string;
  /** Levels from the focus in the tree (0 for the focus; 1 for a record linked to it). */
  distance: number;
  kind: string;
  title: string;
  /** The kind's stage (domain-model … test-plan), '' for structural kinds (product, open question), 'file' or 'group'. */
  stage: Stage | '' | 'file' | 'group';
  /**
   * The column the layout puts this node in, counted from 0 at the left. In the hierarchy it is the
   * node's depth in the parent/child tree (see treeColumns); in trace mode it comes from TRACE_COLUMNS.
   */
  column: number;
  /** The node's place within its column, from the top (0 first). */
  row: number;
  /**
   * Set on a group node (a stage, a folder or a group of one kind): the node above it in the tree,
   * the nearest record above it (its owner), and how many records it shows.
   */
  group?: { parent: string; owner: string; count: number };
}

/** The hierarchy reads left to right by depth in the parent/child tree; trace mode reads left to right along the chain. */
export type GraphMode = 'hierarchy' | 'trace';

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  relation: string;
}

export interface Neighborhood {
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

/** A node's stage's place in the sort: groups and structural records first, then the six stages in order, files last. */
function stageRank(index: SpecIndex, stage: GraphNode['stage']): number {
  if (stage === GROUP_STAGE || stage === '') return 0;
  if (stage === 'file') return index.workspace.stages.length + 1;
  return index.workspace.stages.findIndex((s) => s.stage === stage) + 1;
}

/** A kind's stage as the graph colors it: its stage, '' for one outside the stages (structural), 'file' for a file. */
export const stageOf = (index: SpecIndex, kind: string): GraphNode['stage'] => (kind === FILE_KIND ? 'file' : index.kinds.get(kind)?.stage ?? '');

function kindOrder(index: SpecIndex) {
  const order = new Map(index.workspace.kinds.map((k, i) => [k.kind, i]));
  return (kind: string) => order.get(kind) ?? order.size;
}

function sortNodes(index: SpecIndex, nodes: GraphNode[]): GraphNode[] {
  const kindRank = kindOrder(index);
  return [...nodes].sort(
    (a, b) =>
      a.distance - b.distance ||
      stageRank(index, a.stage) - stageRank(index, b.stage) ||
      kindRank(a.kind) - kindRank(b.kind) ||
      byIdOrder(a, b),
  );
}

function recordNode(index: SpecIndex, id: string, distance: number, mode: GraphMode): GraphNode {
  const r = index.byId.get(id)!;
  const column = mode === 'trace' ? (distance === 0 ? 0 : traceColumn(index, r.kind)) : 0;
  return { id, distance, kind: r.kind, title: r.title, stage: stageOf(index, r.kind), column, row: 0 };
}

/**
 * Columns of a trace, left to right: why a UC requirement is there (the business outcomes its capability serves, the
 * capability, the use case); the obligation; the flow and the step that fulfill it; what designs it (the
 * views a step happens in, the commands and queries it invokes, the value object or aggregate the obligation sits
 * in); the technical records that implement it; the tests that prove it; the files they name.
 */
export const TRACE_COLUMNS = { outcome: -3, capability: -2, useCase: -1, obligation: 0, flow: 1, step: 1.5, design: 2, technical: 3, test: 4, file: 5 } as const;

/** The trace column of a kind, by its stage: a flow and a step, the design kinds, the technical kinds, the tests, a file. */
export function traceColumn(index: SpecIndex, kind: string): number {
  if (kind === FILE_KIND) return TRACE_COLUMNS.file;
  if (kind === 'flow') return TRACE_COLUMNS.flow;
  if (kind === 'flow_step') return TRACE_COLUMNS.step;
  if (kind === 'business_outcome') return TRACE_COLUMNS.outcome;
  if (kind === 'capability') return TRACE_COLUMNS.capability;
  if (kind === 'use_case') return TRACE_COLUMNS.useCase;
  const stage = index.kinds.get(kind)?.stage;
  if (stage === 'technical-specification') return TRACE_COLUMNS.technical;
  if (stage === 'test-plan') return TRACE_COLUMNS.test;
  return TRACE_COLUMNS.design;
}

/**
 * The column of every node in the hierarchy: its depth in the parent/child tree around the focus.
 * The tree is made of the parent lines shown (record to group, group to member, or record to child),
 * so every node with the same parent is in the same column, whatever its kind, and a group sits in
 * its own column between its parent and its members. The focus's tree is placed first, the focus's
 * ancestors to its left and its descendants to its right. A record reached only by a cross-link
 * (fulfills, invokes, raises and the rest) goes one column after the node it was reached from on the
 * shortest path from the focus, and the rest of its own tree is placed around it. A record in a tree
 * that is already placed keeps its tree position. Columns are shifted so the leftmost is 0.
 *
 * `order` lists the nodes nearest the focus first (the walk's order); `via` is the node each was reached from.
 */
export function treeColumns(
  focus: string,
  order: readonly string[],
  edges: readonly GraphEdge[],
  via: ReadonlyMap<string, string>,
): Map<string, number> {
  const parentOf = new Map<string, string>();
  const childrenOf = new Map<string, string[]>();
  for (const e of edges) {
    if (e.relation !== PARENT) continue;
    parentOf.set(e.target, e.source);
    childrenOf.set(e.source, [...(childrenOf.get(e.source) ?? []), e.target]);
  }
  const column = new Map<string, number>();
  const placeTree = (anchor: string, at: number) => {
    column.set(anchor, at);
    const queue = [anchor];
    while (queue.length > 0) {
      const id = queue.shift()!;
      const c = column.get(id)!;
      const near: [string, number][] = (childrenOf.get(id) ?? []).map((k) => [k, c + 1]);
      const parent = parentOf.get(id);
      if (parent !== undefined) near.push([parent, c - 1]);
      for (const [next, nc] of near) {
        if (column.has(next)) continue;
        column.set(next, nc);
        queue.push(next);
      }
    }
  };
  placeTree(focus, 0);
  for (const id of order) {
    if (column.has(id)) continue;
    const from = via.get(id);
    placeTree(id, (from !== undefined ? column.get(from) ?? 0 : 0) + 1);
  }
  const min = Math.min(...column.values());
  for (const [id, c] of column) column.set(id, c - min);
  return column;
}

/**
 * The place of each hierarchy node within its column, top to bottom: by the place of the node that
 * put it there (its tree parent, or the record it was reached from when that sits to its left), then
 * its place among its parent's children in the nav's order, then kind order, groups
 * before records, then ID. So a parent's children stay together, in the same order as their parents
 * and as the nav lists them, and re-centering is predictable.
 */
function rowsByPlacer(index: SpecIndex, nodes: GraphNode[], edges: readonly GraphEdge[], via: ReadonlyMap<string, string>): Map<string, number> {
  const kindRank = kindOrder(index);
  const parentOf = new Map(edges.filter((e) => e.relation === PARENT).map((e) => [e.target, e.source]));
  const columnOf = new Map(nodes.map((n) => [n.id, n.column]));
  const sibling = new Map<string, number>();
  for (const n of nodes) {
    const parent = parentOf.get(n.id);
    if (parent !== undefined) {
      const at = nodeChildren(index, parent).indexOf(n.id);
      sibling.set(n.id, at < 0 ? Number.MAX_SAFE_INTEGER - 1 : at);
    }
  }
  const siblingRank = (n: GraphNode) => sibling.get(n.id) ?? 0;
  const placer = (n: GraphNode) => {
    const parent = parentOf.get(n.id);
    if (parent !== undefined) return parent;
    const from = via.get(n.id);
    return from !== undefined && (columnOf.get(from) ?? Infinity) < n.column ? from : undefined;
  };
  const row = new Map<string, number>();
  const columns = [...new Set(nodes.map((n) => n.column))].sort((a, b) => a - b);
  for (const c of columns) {
    const rank = (n: GraphNode) => {
      const p = placer(n);
      return p === undefined ? -1 : row.get(p) ?? -1;
    };
    const inColumn = nodes.filter((n) => n.column === c).sort(
      (a, b) =>
        rank(a) - rank(b) ||
        siblingRank(a) - siblingRank(b) ||
        kindRank(a.kind) - kindRank(b.kind) ||
        Number(!a.group) - Number(!b.group) ||
        byIdOrder(a, b),
    );
    inColumn.forEach((n, i) => row.set(n.id, i));
  }
  return row;
}

/** Trace rows: the order the chain's nodes are sorted in (distance, stage, kind, ID), counted within each column. */
function rowsInOrder(nodes: GraphNode[]): Map<string, number> {
  const next = new Map<number, number>();
  const row = new Map<string, number>();
  for (const n of nodes) {
    const r = next.get(n.column) ?? 0;
    row.set(n.id, r);
    next.set(n.column, r + 1);
  }
  return row;
}

/** What the graph adds to the tree: the focused record's cross-links. */
export interface NeighborhoodOptions {
  /** The Links switch: the records the focused record links to and from, one hop. Off by default. */
  links?: boolean;
}

/** The parent of a node in the graph's tree (see tree.ts), or null at the top. */
export const nodeParent = (index: SpecIndex, id: string): string | null => treeParent(index, id);

/** The children of a node in the graph's tree, in the nav's order. */
export const nodeChildren = (index: SpecIndex, id: string): readonly string[] => treeChildren(index, id);

/** The kind a node is filtered by: a record's kind, a kind group's kind, or null for a stage or a mixed folder (never hidden). */
export function filterKind(index: SpecIndex, id: string): string | null {
  const record = index.byId.get(id);
  if (record) return record.kind;
  return treeGroup(index, id)?.kind ?? null;
}

/**
 * The picture the camera frames around a focus (a record or a group), by levels of the graph's tree
 * (see tree.ts), a level being any node: a record, a stage, a folder or a group. It is the focus's
 * parent, kept at the left edge for context, the focus, and its descendants down to `depth` levels
 * below it (LA-EXP-DS09); the rest of the map stays where it is around it. With `options.links`,
 * the records the focused record links to and from (fulfills, invokes, raises and the rest) join, one
 * hop, with the links between them and the focus.
 *
 * Filters hide kinds and relations, and nothing is reached through a hidden record; hiding the
 * parent/child relation leaves no tree. The focus is never hidden. The result is the same for the
 * same input.
 */
export function neighborhood(
  index: SpecIndex,
  focus: string,
  depth: number,
  filters: Filters = NO_FILTERS,
  options: NeighborhoodOptions = {},
): Neighborhood {
  if (!isGraphNode(index, focus)) return { focus, mode: 'hierarchy', nodes: [], edges: [], via: new Map() };
  const levels = Math.max(1, Math.floor(depth));
  const shownRelation = (relation: string) => !filters.hiddenRelations.has(relation);
  const shownKind = (id: string) => {
    if (id === focus) return true;
    const kind = filterKind(index, id);
    return kind === null || !filters.hiddenKinds.has(kind);
  };
  const isGroupNode = (id: string) => !index.byId.has(id);

  const distance = new Map<string, number>([[focus, 0]]);
  const via = new Map<string, string>();
  const spine = new Map<string, GraphEdge>();
  const addSpine = (source: string, target: string) => {
    const e = { source, relation: PARENT, target };
    spine.set(edgeId(e), { ...e, id: edgeId(e) });
  };
  const reach = (id: string, from: string, d: number) => { distance.set(id, d); via.set(id, from); };

  if (shownRelation(PARENT)) {
    // The parent, one level up.
    const up = nodeParent(index, focus);
    if (up !== null && shownKind(up)) { reach(up, focus, 1); addSpine(up, focus); }
    // The descendants, level by level.
    let frontier = [focus];
    for (let level = 1; level <= levels && frontier.length > 0; level++) {
      const next: string[] = [];
      for (const id of frontier) {
        for (const c of nodeChildren(index, id)) {
          if (distance.has(c) || !shownKind(c)) continue;
          reach(c, id, level);
          addSpine(id, c);
          next.push(c);
        }
      }
      frontier = next;
    }
  }

  // The Links switch: the focused record's own links, one hop.
  const links = new Map<string, GraphEdge>();
  if (options.links && index.byId.has(focus)) {
    for (const e of edgesOf(index, focus)) {
      if (e.relation === PARENT || !shownRelation(e.relation)) continue;
      const other = e.source === focus ? e.target : e.source;
      if (!shownKind(other)) continue;
      if (!distance.has(other) || distance.get(other)! > 1) reach(other, focus, 1);
      links.set(e.id, e);
    }
  }

  // Parent lines between nodes in the picture the walk did not join (a linked record whose parent is in it).
  if (shownRelation(PARENT)) {
    for (const id of distance.keys()) {
      const up = nodeParent(index, id);
      if (up !== null && distance.has(up)) addSpine(up, id);
    }
  }

  const edgeList = [...spine.values(), ...links.values()].sort((a, b) => a.id.localeCompare(b.id));
  const walkOrder = [...distance].sort(([a, ha], [b, hb]) => ha - hb || a.localeCompare(b, 'en', { numeric: true })).map(([id]) => id);
  const columns = treeColumns(focus, walkOrder, edgeList, via);
  const nodes = [...distance].map(([id, d]) => {
    const node: GraphNode = isGroupNode(id) ? groupNode(index, id, d) : recordNode(index, id, d, 'hierarchy');
    return { ...node, column: columns.get(id)! };
  });
  const rows = rowsByPlacer(index, nodes, edgeList, via);
  return {
    focus,
    mode: 'hierarchy',
    nodes: sortNodes(index, nodes.map((node) => ({ ...node, row: rows.get(node.id)! }))),
    edges: edgeList,
    via,
  };
}

// ---- Group nodes: a folder per kind of child between a record and its children ----

/** The parent, member kind and any further parts of a group ID, or null for an ID that cannot be a group. */
export function parseGroupId(id: string): { parent: string; kind: string; path: string[] } | null {
  if (id.startsWith('file:') || id.startsWith('bar:')) return null;
  const parts = id.split('/');
  if (parts.length < 2 || parts.some((p) => p === '')) return null;
  return { parent: parts[0], kind: parts[1], path: parts.slice(2) };
}

/** The kinds of a record's children, in the meta-model's order. */
export function childKinds(index: SpecIndex, id: string): string[] {
  const rank = kindOrder(index);
  return [...new Set((index.children.get(id) ?? []).map((c) => c.kind))].sort((a, b) => rank(a) - rank(b));
}

/** The records in a group at the first record level, however deep its groups, as the nav lists them (none for an ID that is no group). */
export const groupMembers = (index: SpecIndex, gid: string): SpecRecord[] => treeGroup(index, gid)?.members ?? [];

/** Whether an ID names a group of the graph's tree: a stage, a folder or a kind group. */
export const isGroup = (index: SpecIndex, id: string) => treeOf(index).groups.has(id);

/** Whether the graph can center on an ID: a record or a group. */
export const isGraphNode = (index: SpecIndex, id: string) => index.byId.has(id) || isGroup(index, id);

/** A kind's label in the plural: "Use cases", "Open questions", "Capabilities". */
export function pluralLabel(index: SpecIndex, kind: string): string {
  return plural(kindLabel(index, kind));
}

/** A group's label with its count, such as "Use cases (5)". */
export const groupLabel = (index: SpecIndex, gid: string) => `${groupName(index, gid)} (${treeGroup(index, gid)?.count ?? 0})`;

/** A group's name without its count, as the nav names it: "Domain model", "Aggregates", "Commands". */
export const groupName = (index: SpecIndex, gid: string) => treeGroup(index, gid)?.label ?? gid;

/** The nearest record above a group: the domain of a stage or folder, the record of a kind group. */
export const groupOwner = (index: SpecIndex, gid: string) => treeGroup(index, gid)?.owner ?? parseGroupId(gid)?.parent ?? gid;

/** What a group is, as its box's kind line names it: "Folder" (a product's Shared folder), "Stage", or a folder of its kind ("Aggregate folder", "Command folder"). */
export function groupKindLabel(index: SpecIndex, gid: string): string {
  const g = treeGroup(index, gid);
  if (g?.role === 'shared') return 'Folder';
  if (g?.role === 'stage') return 'Stage';
  return g?.kind ? `${kindLabel(index, g.kind)} folder` : 'Folder';
}

/** The problems and coverage gaps of a group's members and everything beneath them, summed for the group's mark. */
export function groupMarks(index: SpecIndex, gid: string): { errors: number; warnings: number; gaps: string[] } {
  let errors = 0;
  let warnings = 0;
  const gaps = new Set<string>();
  const visit = (id: string) => {
    for (const p of index.problemsFor.get(id) ?? []) if (p.severity === 'error') errors++; else warnings++;
    for (const g of gapsOf(index, id)) gaps.add(g);
    for (const c of index.children.get(id) ?? []) visit(c.id);
  };
  for (const m of groupMembers(index, gid)) visit(m.id);
  return { errors, warnings, gaps: [...gaps].sort() };
}

/** The kind a group shows as: its records' kind when they are of one kind, or 'folder' for a stage or a mixed folder. */
const groupKind = (index: SpecIndex, gid: string) => treeGroup(index, gid)?.kind ?? 'folder';

function groupNode(index: SpecIndex, id: string, distance: number): GraphNode {
  return {
    id,
    distance,
    kind: groupKind(index, id),
    title: groupLabel(index, id),
    stage: GROUP_STAGE,
    column: 0,
    row: 0,
    group: { parent: nodeParent(index, id) ?? groupOwner(index, id), owner: groupOwner(index, id), count: treeGroup(index, id)?.count ?? 0 },
  };
}

/** Trace mode is offered for every obligation: a constraint, invariant, specification, policy, domain service, UC, view or API requirement, pattern or standard rule, or a product's own obligation kind. */
export const canTrace = (index: SpecIndex, id: string) => {
  const kind = index.byId.get(id)?.kind;
  return !!kind && !!index.kinds.get(kind)?.obligation;
};

export const fileNodeId = (path: string) => `file:${path}`;

const stageOfRecord = (index: SpecIndex, id: string) => index.kinds.get(index.byId.get(id)?.kind ?? '')?.stage ?? null;
/** A record's children of one stage, in ID order. */
const childrenIn = (index: SpecIndex, id: string, stage: string) =>
  (index.children.get(id) ?? []).filter((c) => index.kinds.get(c.kind)?.stage === stage).sort(byIdOrder);

/**
 * An obligation's traceability chain, left to right:
 * - why it is there: for a UC requirement, its use case, the use case's capability and the business outcomes that
 *   capability serves, so the trace runs from an outcome to the code and tests;
 * - what designs it: for a UC requirement, the flow steps that fulfill it, each with its flow and the views it
 *   happens in and the commands and queries it invokes; for a constraint, its value object; for an invariant, its
 *   aggregate;
 * - the technical records that implement it: its own technical children (a policy's event handler, a
 *   specification's predicate, a domain service's service, a product kind's), a constraint's value object's value
 *   type, an invariant's aggregate's repository and the tables whose unique key enforces it, a step's invoked
 *   operation's handler, and for a standard rule what meets it;
 * - the tests that prove it: its children in the test plan;
 * - the files the technical records and tests name.
 */
export function traceChain(index: SpecIndex, focus: string, filters: Filters = NO_FILTERS): Neighborhood {
  if (!canTrace(index, focus)) return { focus, mode: 'trace', nodes: [], edges: [], via: new Map() };
  const shownRelation = (relation: string) => !filters.hiddenRelations.has(relation);
  const shownKind = (kind: string) => !filters.hiddenKinds.has(kind);
  const record = index.byId.get(focus)!;

  const nodes = new Map<string, GraphNode>([[focus, recordNode(index, focus, 0, 'trace')]]);
  const edges = new Map<string, GraphEdge>();
  const via = new Map<string, string>();
  const add = (source: string, relation: string, target: string, reached: string, from: string) => {
    if (!shownRelation(relation)) return false;
    const distance = (nodes.get(from)?.distance ?? 0) + 1;
    const node = nodes.get(reached) ?? (index.byId.has(reached) ? recordNode(index, reached, distance, 'trace') : null);
    if (!node || !shownKind(node.kind)) return false;
    if (!nodes.has(reached)) { nodes.set(reached, node); via.set(reached, from); }
    const e = { source, relation, target };
    edges.set(edgeId(e), { ...e, id: edgeId(e) });
    return true;
  };
  /** A record's technical children, each drawn from it. */
  const technical = (id: string) => {
    for (const t of childrenIn(index, id, 'technical-specification')) add(id, PARENT, t.id, t.id, id);
  };

  if (record.kind === 'uc_requirement' && record.parent) {
    // Its use case, the capability the use case sits in, and the outcomes that capability serves.
    const useCase = index.byId.get(record.parent);
    if (useCase && add(useCase.id, PARENT, focus, useCase.id, focus) && useCase.parent && add(useCase.parent, PARENT, useCase.id, useCase.parent, useCase.id)) {
      for (const l of (index.outgoing.get(useCase.parent) ?? []).filter((x) => x.relation === 'serves')) add(l.source, l.relation, l.target, l.target, l.source);
    }
  }
  if (record.kind === 'uc_requirement') {
    // The steps that fulfill it, each with its flow, where it happens and what it invokes, and that operation's handler.
    for (const l of (index.incoming.get(focus) ?? []).filter((x) => x.relation === 'fulfills')) {
      if (!add(l.source, l.relation, l.target, l.source, focus)) continue;
      const step = index.byId.get(l.source)!;
      if (step.parent && index.byId.get(step.parent)?.kind === 'flow') add(step.parent, PARENT, step.id, step.parent, step.id);
      for (const out of (index.outgoing.get(step.id) ?? []).filter((x) => x.relation === 'happens_in' || x.relation === 'invokes')) {
        if (add(out.source, out.relation, out.target, out.target, step.id) && out.relation === 'invokes') technical(out.target);
      }
    }
  }
  if (record.kind === 'constraint' && record.parent) {
    // Its value object, and the value type that implements the value object and so its constraints.
    if (add(record.parent, PARENT, focus, record.parent, focus)) technical(record.parent);
  }
  if (record.kind === 'invariant' && record.parent) {
    // Its aggregate, the aggregate's repository, and each table whose unique key enforces it.
    if (add(record.parent, PARENT, focus, record.parent, focus)) technical(record.parent);
    const tables = new Set(index.workspace.parts.filter((p) => p.table === 'table_key' && p.row.invariant_id === focus).map((p) => p.owner));
    for (const t of [...tables].sort()) add(t, ENFORCES, focus, t, focus);
  }
  technical(focus);
  // What meets a standard rule implements it.
  for (const l of (index.incoming.get(focus) ?? []).filter((x) => x.relation === 'meets')) add(l.source, l.relation, l.target, l.source, focus);
  // The tests that prove it.
  for (const t of childrenIn(index, focus, 'test-plan')) add(focus, PARENT, t.id, t.id, focus);

  // Files named by the technical records and tests in the chain.
  if (shownRelation(NAMES) && shownKind(FILE_KIND)) {
    for (const node of [...nodes.values()]) {
      const stage = stageOfRecord(index, node.id);
      if (stage !== 'technical-specification' && stage !== 'test-plan') continue;
      const path = textOf(index.byId.get(node.id)!.row, 'file');
      if (!path) continue;
      const id = fileNodeId(path);
      if (!nodes.has(id)) {
        nodes.set(id, { id, distance: node.distance + 1, kind: FILE_KIND, title: path, stage: 'file', column: TRACE_COLUMNS.file, row: 0 });
        via.set(id, node.id);
      }
      const e = { source: node.id, relation: NAMES, target: id };
      edges.set(edgeId(e), { ...e, id: edgeId(e) });
    }
  }

  const sorted = sortNodes(index, [...nodes.values()]);
  const rows = rowsInOrder(sorted);
  return {
    focus,
    mode: 'trace',
    nodes: sorted.map((node) => ({ ...node, row: rows.get(node.id)! })),
    edges: [...edges.values()].sort((a, b) => a.id.localeCompare(b.id)),
    via,
  };
}

/** The relations a person can filter on: every relation in the meta-model, and parent/child. */
export function relationsOf(index: SpecIndex): string[] {
  return [PARENT, ...new Set(index.workspace.relations.map((r) => r.relation))];
}

export const RELATION_LABELS: Record<string, string> = { [PARENT]: 'parent / child', [NAMES]: 'names file', [ENFORCES]: 'enforces (unique key)' };
/** A relation's label by its code (legends, filters), from the meta-model's labels (LA-V92-R07). */
export const graphRelationLabel = (relation: string, index?: SpecIndex) => RELATION_LABELS[relation] ?? relationLabelOf(index?.workspace.relations ?? [], relation);
/** One edge's label, read from its source, or from its target with `from`. */
export const graphEdgeLabel = (index: SpecIndex, e: { source: string; relation: string; target: string }, from: 'source' | 'target' = 'source') =>
  RELATION_LABELS[e.relation] ?? linkLabel(index, e, from);

/** The kinds a person can filter on, grouped by the six stages in order, then the structural kinds (product, open question). */
export function kindGroups(index: SpecIndex): { stage: Stage | ''; title: string; kinds: { kind: string; label: string }[] }[] {
  const groups: { stage: Stage | ''; title: string }[] = [
    ...index.workspace.stages.map((s) => ({ stage: s.stage, title: s.label })),
    { stage: '', title: 'Structural' },
  ];
  return groups.map((g) => ({
    ...g,
    kinds: index.workspace.kinds.filter((k) => (k.stage ?? '') === g.stage).map((k) => ({ kind: k.kind, label: kindLabel(index, k.kind) })),
  }));
}

/** The relations kept by the "traceability only" preset: what a trace draws. */
export const TRACE_RELATIONS = new Set([PARENT, 'serves', 'fulfills', 'invokes', 'happens_in', 'meets', ENFORCES, NAMES]);


/** Keeps the breadcrumb trail: going back to a record in the trail cuts the trail there. */
export function nextTrail(trail: string[], focus: string, max = 8): string[] {
  const at = trail.indexOf(focus);
  return (at >= 0 ? trail.slice(0, at + 1) : [...trail, focus]).slice(-max);
}
