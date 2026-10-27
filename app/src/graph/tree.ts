import type { SpecIndex, SpecRecord } from '../specs/data';
import { kindLabel } from '../specs/data';
import { foldedChildren, ownerFolders, productLevelKey, type Folder } from '../specs/folders';
import { plural } from '../plural';

// The graph's tree is the nav's tree: a product holds its Product level (its own stages, what sits at product level),
// its domains, then its open questions; a domain holds its stages, then the folders outside every
// stage (open questions); a stage holds one folder per kind; a folder holds the records that start a
// branch of the stage, by the same folder model the nav, the domain page and the group pages read
// (specs/folders.ts). Every stage and folder is a level of the tree, like a file explorer, and is a
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
  members: SpecRecord[];
  /** The nearest record above it (its domain, product or parent record). */
  owner: string;
  /**
   * 'level' (a product's Product level, holding its own stages), 'stage', 'folder' (a stage's folder of one kind) or
   * 'kind' (a record's group of one kind of child, or a folder outside the stages).
   */
  role: 'level' | 'stage' | 'folder' | 'kind';
}

export interface Tree {
  parent: Map<string, string>;
  children: Map<string, string[]>;
  groups: Map<string, TreeGroup>;
}

const kindRank = (index: SpecIndex) => {
  const ranks = new Map(index.workspace.kinds.map((k, i) => [k.kind, i]));
  return (kind: string) => ranks.get(kind) ?? ranks.size;
};

/** The kinds of some records, in the schema's order. */
function kindsOf(index: SpecIndex, records: readonly SpecRecord[]): string[] {
  const rank = kindRank(index);
  return [...new Set(records.map((r) => r.kind))].sort((a, b) => rank(a) - rank(b));
}

const cache = new WeakMap<SpecIndex, Tree>();

/** The whole tree of an index, built once. */
export function treeOf(index: SpecIndex): Tree {
  const known = cache.get(index);
  if (known) return known;
  const tree: Tree = { parent: new Map(), children: new Map(), groups: new Map() };
  cache.set(index, tree);
  const visited = new Set<string>();
  const add = (parent: string, child: string) => {
    if (tree.parent.has(child) || child === parent) return false;
    tree.parent.set(child, parent);
    const list = tree.children.get(parent);
    if (list) list.push(child); else tree.children.set(parent, [child]);
    return true;
  };
  const group = (id: string, g: TreeGroup) => { if (!tree.groups.has(id)) tree.groups.set(id, g); };

  const addRecord = (r: SpecRecord) => {
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

  /** A domain's or a product's stages with records, each with its folders with records, under `under` (the owner, or the product's Product level). */
  const addStages = (ownerId: string, under = ownerId) => {
    const { stages } = ownerFolders(index, ownerId);
    for (const stage of stages) {
      if (stage.count === 0) continue;
      add(under, stage.key);
      const shown = stage.folders.filter((f) => f.count > 0);
      group(stage.key, { label: stage.label, kind: null, count: stage.count, members: shown.flatMap((f) => f.records), owner: ownerId, role: 'stage' });
      for (const f of shown) addFolder(stage.key, f, ownerId, 'folder');
    }
  };
  const addLoose = (ownerId: string) => {
    for (const f of ownerFolders(index, ownerId).loose) addFolder(ownerId, f, ownerId, 'kind');
  };

  for (const product of index.products) {
    visited.add(product.id);
    // What sits at product level, its stages in one group, so the product splits its height between it and its
    // domains rather than among every stage and domain.
    const own = ownerFolders(index, product.id).stages.filter((s) => s.count > 0);
    if (own.length > 0) {
      const level = productLevelKey(product.id);
      add(product.id, level);
      group(level, { label: 'Product level', kind: null, count: own.reduce((n, s) => n + s.count, 0), members: own.flatMap((s) => s.folders.flatMap((f) => f.records)), owner: product.id, role: 'level' });
      addStages(product.id, level);
    }
    for (const d of index.domainsOf.get(product.id) ?? []) {
      if (!add(product.id, d.id)) continue;
      visited.add(d.id);
      addStages(d.id);
      addLoose(d.id);
    }
    addLoose(product.id);
  }
  // Anything no product reaches (a record whose parent is missing) hangs from its own parent, as stored.
  for (const r of index.workspace.records) {
    if (visited.has(r.id)) continue;
    if (r.parent && index.byId.has(r.parent) && !tree.parent.has(r.id)) add(r.parent, r.id);
    addRecord(r);
  }
  return tree;
}

/** A node's parent in the tree, or null at the top (a product). */
export const treeParent = (index: SpecIndex, id: string): string | null => treeOf(index).parent.get(id) ?? null;

/** A node's children in the tree, in the nav's order. */
export const treeChildren = (index: SpecIndex, id: string): readonly string[] => treeOf(index).children.get(id) ?? [];

/** The stage, folder or kind group the tree has at an ID, or undefined. */
export const treeGroup = (index: SpecIndex, id: string): TreeGroup | undefined => treeOf(index).groups.get(id);
