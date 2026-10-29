import { plural } from '../plural';
import type { SpecIndex, SpecRecord, Stage } from '../specs/data';
import { byIdOrder, gapsOf, kindLabel } from '../specs/data';
import { treeChildren, treeGroup, treeOf, treeParent } from './tree';

// Pure graph logic for the graph view: the picture the camera frames around a record or group, by
// levels of the nav's tree (tree.ts) and the kind filters. The map it sits in
// is map.ts. Nothing here touches React or the DOM, so it is tested directly.

/** The pseudo-relation between a record and its parent (drawn from parent to child). */
export const PARENT = 'parent';
/** The stage of a group node: a folder of one kind of child between a record and its children. */
export const GROUP_STAGE = 'group';

export interface GraphNode {
  id: string;
  /** Levels from the focus in the tree (0 for the focus; 1 for its parent and its children). */
  distance: number;
  kind: string;
  title: string;
  /** The kind's stage (domain-model … test-plan), '' for structural kinds (product, open question), or 'group'. */
  stage: Stage | '' | 'group';
  /** The column the layout puts this node in, counted from 0 at the left: its depth in the parent/child tree (see treeColumns). */
  column: number;
  /** The node's place within its column, from the top (0 first). */
  row: number;
  /**
   * Set on a group node (a stage, a folder or a group of one kind): the node above it in the tree,
   * the nearest record above it (its owner), and how many records it shows.
   */
  group?: { parent: string; owner: string; count: number };
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  relation: string;
}

export interface Neighborhood {
  focus: string;
  /** In a stable order: the focus first, then by distance, stage, kind and ID. */
  nodes: GraphNode[];
  /** The parent lines between them. */
  edges: GraphEdge[];
}

export interface Filters {
  hiddenKinds: ReadonlySet<string>;
}

export const NO_FILTERS: Filters = { hiddenKinds: new Set() };

export const isFiltered = (f: Filters) => f.hiddenKinds.size > 0;

const edgeId = (e: Omit<GraphEdge, 'id'>) => `${e.source}|${e.relation}|${e.target}`;

/** A node's stage's place in the sort: groups and structural records first, then the six stages in order. */
function stageRank(index: SpecIndex, stage: GraphNode['stage']): number {
  if (stage === GROUP_STAGE || stage === '') return 0;
  return index.workspace.stages.findIndex((s) => s.stage === stage) + 1;
}

/** A kind's stage as the graph colors it: its stage, or '' for one outside the stages (structural). */
export const stageOf = (index: SpecIndex, kind: string): GraphNode['stage'] => index.kinds.get(kind)?.stage ?? '';

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

function recordNode(index: SpecIndex, id: string, distance: number): GraphNode {
  const r = index.byId.get(id)!;
  return { id, distance, kind: r.kind, title: r.title, stage: stageOf(index, r.kind), column: 0, row: 0 };
}

/**
 * The column of every node in the hierarchy: its depth in the parent/child tree around the focus.
 * The tree is made of the parent lines shown (record to group, group to member, or record to child),
 * so every node with the same parent is in the same column, whatever its kind, and a group sits in
 * its own column between its parent and its members: the focus's ancestors to its left and its
 * descendants to its right. Columns are shifted so the leftmost is 0.
 */
export function treeColumns(focus: string, edges: readonly GraphEdge[]): Map<string, number> {
  const parentOf = new Map<string, string>();
  const childrenOf = new Map<string, string[]>();
  for (const e of edges) {
    if (e.relation !== PARENT) continue;
    parentOf.set(e.target, e.source);
    childrenOf.set(e.source, [...(childrenOf.get(e.source) ?? []), e.target]);
  }
  const column = new Map<string, number>([[focus, 0]]);
  const queue = [focus];
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
  const min = Math.min(...column.values());
  for (const [id, c] of column) column.set(id, c - min);
  return column;
}

/**
 * The place of each hierarchy node within its column, top to bottom: by the place of its tree
 * parent, then its place among its parent's children in the nav's order, then kind order, groups
 * before records, then ID. So a parent's children stay together, in the same order as their parents
 * and as the nav lists them, and re-centering is predictable.
 */
function rowsByParent(index: SpecIndex, nodes: GraphNode[], edges: readonly GraphEdge[]): Map<string, number> {
  const kindRank = kindOrder(index);
  const parentOf = new Map(edges.filter((e) => e.relation === PARENT).map((e) => [e.target, e.source]));
  const sibling = new Map<string, number>();
  for (const n of nodes) {
    const parent = parentOf.get(n.id);
    if (parent !== undefined) {
      const at = nodeChildren(index, parent).indexOf(n.id);
      sibling.set(n.id, at < 0 ? Number.MAX_SAFE_INTEGER - 1 : at);
    }
  }
  const siblingRank = (n: GraphNode) => sibling.get(n.id) ?? 0;
  const row = new Map<string, number>();
  const columns = [...new Set(nodes.map((n) => n.column))].sort((a, b) => a - b);
  for (const c of columns) {
    const rank = (n: GraphNode) => {
      const p = parentOf.get(n.id);
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
 * below it (LA-EXP-DS09), with the parent lines between them; the rest of the map stays where it is
 * around it.
 *
 * The kind filters hide kinds, and nothing is reached through a hidden record. The focus is never
 * hidden. The result is the same for the same input.
 */
export function neighborhood(index: SpecIndex, focus: string, depth: number, filters: Filters = NO_FILTERS): Neighborhood {
  if (!isGraphNode(index, focus)) return { focus, nodes: [], edges: [] };
  const levels = Math.max(1, Math.floor(depth));
  const shownKind = (id: string) => {
    if (id === focus) return true;
    const kind = filterKind(index, id);
    return kind === null || !filters.hiddenKinds.has(kind);
  };
  const isGroupNode = (id: string) => !index.byId.has(id);

  const distance = new Map<string, number>([[focus, 0]]);
  const spine = new Map<string, GraphEdge>();
  const addSpine = (source: string, target: string) => {
    const e = { source, relation: PARENT, target };
    spine.set(edgeId(e), { ...e, id: edgeId(e) });
  };

  // The parent, one level up.
  const up = nodeParent(index, focus);
  if (up !== null && shownKind(up)) { distance.set(up, 1); addSpine(up, focus); }
  // The descendants, level by level.
  let frontier = [focus];
  for (let level = 1; level <= levels && frontier.length > 0; level++) {
    const next: string[] = [];
    for (const id of frontier) {
      for (const c of nodeChildren(index, id)) {
        if (distance.has(c) || !shownKind(c)) continue;
        distance.set(c, level);
        addSpine(id, c);
        next.push(c);
      }
    }
    frontier = next;
  }

  const edgeList = [...spine.values()].sort((a, b) => a.id.localeCompare(b.id));
  const columns = treeColumns(focus, edgeList);
  const nodes = [...distance].map(([id, d]) => {
    const node: GraphNode = isGroupNode(id) ? groupNode(index, id, d) : recordNode(index, id, d);
    return { ...node, column: columns.get(id)! };
  });
  const rows = rowsByParent(index, nodes, edgeList);
  return {
    focus,
    nodes: sortNodes(index, nodes.map((node) => ({ ...node, row: rows.get(node.id)! }))),
    edges: edgeList,
  };
}

// ---- Group nodes: a folder per kind of child between a record and its children ----

/** The parent, member kind and any further parts of a group ID, or null for an ID that cannot be a group. */
export function parseGroupId(id: string): { parent: string; kind: string; path: string[] } | null {
  if (id.startsWith('bar:')) return null;
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
