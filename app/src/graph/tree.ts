import { kindLabel, type RecordIndex, type RecordSummary } from '../exploring/record-summaries/record-index';
import { foldedChildren, ownerFolders, sharedKey, type Folder } from '../exploring/folder-tree/folders';
import { plural } from '../plural';
import { mapChange, patchMap, sameItems, type MapChange } from '../exploring/record-summaries/map-change';

// The graph's tree is the nav's tree: a product holds its Shared folder (its own stages, what it shares),
// its domains, then its open questions; a domain holds its stages, then the folders outside every
// stage (open questions); a stage holds one folder per kind, or the records of its only folder itself; a folder holds the records that start a
// branch of the stage, by the same folder model the nav, the domain page and the group pages read
// (the Folder tree read, exploring/folder-tree/folders.ts). Every stage and folder shown is a level of the tree, like a file explorer, and is a
// group node in the graph with an address of its own ("DM-SHOP/domain-model",
// "DM-SHOP/domain-model/aggregate"). A record's children of its own stage fold under it, through one
// group per kind when they are of more than one kind ("DM-SHOP-A1/command"); its children of a
// later stage are listed in that stage's folder.
//
// The tree is built once per index (it is pure data) and every lookup is a map read.

export interface TreeGroup {
  /** The name, as the nav shows it: "Domain model", "Aggregates", "Commands". */
  label: string;
  /** The kind of its records for a folder or a kind group (what hiding a kind hides), or null for a stage. */
  kind: string | null;
  /** How many records it shows, as the nav counts them. */
  count: number;
  /** Its records at the first record level beneath it: what its marks and its page list. */
  members: RecordSummary[];
  /** The nearest record above it (its domain, product or parent record). */
  owner: string;
  /**
   * 'shared' (a product's Shared folder, holding its own stages), 'stage', 'folder' (a stage's folder of one kind) or
   * 'kind' (a record's group of one kind of child, or a folder outside the stages).
   */
  role: 'shared' | 'stage' | 'folder' | 'kind';
}

export interface Tree {
  parent: Map<string, string>;
  children: Map<string, string[]>;
  groups: Map<string, TreeGroup>;
}

/** The schema's order of kinds, read once per index (a tree of thousands of records sorts kinds at each). */
const ranksOf = new WeakMap<RecordIndex, (kind: string) => number>();
const kindRank = (index: RecordIndex) => {
  let rank = ranksOf.get(index);
  if (!rank) {
    const ranks = new Map(index.meta.kindList.map((k, i) => [k.kind, i]));
    rank = (kind: string) => ranks.get(kind) ?? ranks.size;
    ranksOf.set(index, rank);
  }
  return rank;
};

/** The kinds of some records, in the schema's order. */
function kindsOf(index: RecordIndex, records: readonly RecordSummary[]): string[] {
  const rank = kindRank(index);
  return [...new Set(records.map((r) => r.kind))].sort((a, b) => rank(a) - rank(b));
}

// Built once per tree answer and the records and meta model it was built with, as the nav's folders are
// (exploring/folder-tree/folders.ts): an index that differs only in its problems or coverage, which come after the records
// on every reload, shares it, so a reload builds a large product's tree once, not once per read that answers.
const cache = new WeakMap<RecordIndex['folders'], { byId: RecordIndex['byId']; meta: RecordIndex['meta']; tree: Tree }>();

/** The whole tree of an index, built once. */
export function treeOf(index: RecordIndex): Tree {
  const known = cache.get(index.folders);
  if (known && known.byId === index.byId && known.meta === index.meta) return known.tree;
  const tree: Tree = { parent: new Map(), children: new Map(), groups: new Map() };
  cache.set(index.folders, { byId: index.byId, meta: index.meta, tree });
  const visited = new Set<string>();
  const add = (parent: string, child: string) => {
    if (tree.parent.has(child) || child === parent) return false;
    tree.parent.set(child, parent);
    const list = tree.children.get(parent);
    if (list) list.push(child); else tree.children.set(parent, [child]);
    return true;
  };
  const group = (id: string, g: TreeGroup) => { if (!tree.groups.has(id)) tree.groups.set(id, g); };

  const addRecord = (r: RecordSummary) => {
    if (visited.has(r.id)) return;
    visited.add(r.id);
    const kids = foldedChildren(index, r);
    const kinds = kindsOf(index, kids);
    if (kinds.length > 1) {
      for (const kind of kinds) {
        const gid = `${r.id}/${kind}`;
        const members = kids.filter((c) => c.kind === kind);
        add(r.id, gid);
        group(gid, { label: plural(kindLabel(index, kind)), kind, count: members.length, members, owner: r.id, role: 'kind' });
        for (const m of members) { if (add(gid, m.id)) addRecord(m); }
      }
    } else {
      for (const c of kids) { if (add(r.id, c.id)) addRecord(c); }
    }
  };

  const addFolder = (parent: string, folder: Folder, owner: string, role: TreeGroup['role']) => {
    add(parent, folder.key);
    group(folder.key, { label: folder.label, kind: folder.kind, count: folder.count, members: folder.records, owner, role });
    for (const r of folder.records) { if (add(folder.key, r.id)) addRecord(r); }
  };

  /** A domain's or a product's stages with records, each with its folders with records, under `under` (the owner, or the product's Shared folder). */
  const addStages = (ownerId: string, under = ownerId) => {
    const { stages } = ownerFolders(index, ownerId);
    for (const stage of stages) {
      if (stage.count === 0) continue;
      add(under, stage.key);
      const shown = stage.folders.filter((f) => f.count > 0);
      group(stage.key, { label: stage.label, kind: null, count: stage.count, members: shown.flatMap((f) => f.records), owner: ownerId, role: 'stage' });
      // A stage with one folder holds that folder's records itself, the folder no level of the tree.
      if (stage.direct) for (const r of stage.direct.records) { if (add(stage.key, r.id)) addRecord(r); }
      else for (const f of shown) addFolder(stage.key, f, ownerId, 'folder');
    }
  };
  const addLoose = (ownerId: string) => {
    for (const f of ownerFolders(index, ownerId).loose) addFolder(ownerId, f, ownerId, 'kind');
  };

  // The space's product: the index is one product's space.
  for (const product of [index.byId.get(index.product)].filter((p): p is RecordSummary => !!p)) {
    visited.add(product.id);
    // What the product shares, its stages in one group (Shared), so the product splits its height between it and its
    // domains rather than among every stage and domain.
    const own = ownerFolders(index, product.id).stages.filter((s) => s.count > 0);
    if (own.length > 0) {
      const shared = sharedKey(product.id);
      add(product.id, shared);
      group(shared, { label: 'Shared', kind: null, count: own.reduce((n, s) => n + s.count, 0), members: own.flatMap((s) => s.folders.flatMap((f) => f.records)), owner: product.id, role: 'shared' });
      addStages(product.id, shared);
    }
    for (const d of index.domains) {
      if (!add(product.id, d.id)) continue;
      visited.add(d.id);
      addStages(d.id);
      addLoose(d.id);
    }
    addLoose(product.id);
  }
  // Anything no product reaches (a record whose parent is missing) hangs from its own parent, as stored.
  for (const r of index.byId.values()) {
    if (visited.has(r.id)) continue;
    if (r.parent && index.byId.has(r.parent) && !tree.parent.has(r.id)) add(r.parent, r.id);
    addRecord(r);
  }
  return tree;
}

/**
 * A tree's change from the tree before, entry by entry (map-change.ts), as the space's index worker sends it: a group's
 * members by ID, or whole where the index holds no record of that ID (a record the folder tree names that the records
 * miss), so the page puts in its own records.
 */
export interface TreeChange {
  parent: MapChange<string>;
  children: MapChange<string[]>;
  groups: MapChange<SentGroup>;
}
type SentGroup = Omit<TreeGroup, 'members'> & { members: (string | RecordSummary)[] };

const sameGroup = (a: TreeGroup, b: TreeGroup) => a.label === b.label && a.kind === b.kind && a.count === b.count && a.owner === b.owner && a.role === b.role && sameItems(a.members, b.members);

/** What changed from `before` to `next`, a tree of the records `byId` (which name the members). */
export function treeChange(before: Tree, next: Tree, byId: ReadonlyMap<string, RecordSummary>): TreeChange {
  return {
    parent: mapChange(before.parent, next.parent, (a, b) => a === b, (v) => v),
    children: mapChange(before.children, next.children, sameItems, (v) => v),
    groups: mapChange(before.groups, next.groups, sameGroup, (g) => ({ ...g, members: g.members.map((m) => (byId.get(m.id) === m ? m.id : m)) })),
  };
}

/** The tree before with a change put in, its groups' members the records `byId`. */
export function patchTree(before: Tree, change: TreeChange, byId: ReadonlyMap<string, RecordSummary>): Tree {
  return {
    parent: patchMap(before.parent, change.parent, (v) => v) as Map<string, string>,
    children: patchMap(before.children, change.children, (v) => v) as Map<string, string[]>,
    groups: patchMap(before.groups, change.groups, (g): TreeGroup => ({ ...g, members: g.members.map((m) => (typeof m === 'string' ? byId.get(m)! : m)) })) as Map<string, TreeGroup>,
  };
}

/** The empty tree, what the first change is from. */
export const emptyTree = (): Tree => ({ parent: new Map(), children: new Map(), groups: new Map() });

/** Keeps a tree worked out elsewhere (the space's index worker's, put in by its change) as the tree of `index`. */
export function keepTree(index: RecordIndex, tree: Tree) {
  cache.set(index.folders, { byId: index.byId, meta: index.meta, tree });
}

/** A node's parent in the tree, or null at the top (a product). */
export const treeParent = (index: RecordIndex, id: string): string | null => treeOf(index).parent.get(id) ?? null;

/** A node's children in the tree, in the nav's order. */
export const treeChildren = (index: RecordIndex, id: string): readonly string[] => treeOf(index).children.get(id) ?? [];

/** The stage, folder or kind group the tree has at an ID, or undefined. */
export const treeGroup = (index: RecordIndex, id: string): TreeGroup | undefined => treeOf(index).groups.get(id);
