import type { SpecIndex, SpecRecord } from '../specs/data';
import { byIdOrder } from '../specs/data';
import { domainFolders, productFolderKinds, productFolders, sectionOfKind, ungrouped, type Folder, type FolderGroup } from '../specs/folders';
import { plural } from '../plural';
import { kindLabel } from '../specs/data';

// The graph's tree is the nav's tree (brief 56): a product holds its Shared folder, its domains,
// then its open questions and fitness; a domain holds its stages (Define, Design) and the folders
// outside every stage (open questions); a stage holds its folders; a folder holds its records, by
// the same folder model the nav, the domain page and the group pages read (specs/folders.ts).
// Every stage and folder is a level of the tree, like a file explorer, and is a group node in the
// graph with an address of its own ("DM-SHOP/define", "DM-SHOP/design/technical-specification").
//
// The one-kind rule: a folder that mixes kinds the nav lists side by side (Interaction design:
// flows, views, endpoints) splits into one group per kind; a folder of one kind does not, and nor
// does one that lists containers and then the records outside any (Capabilities: capabilities, then
// use cases outside any; Technical specification: layers, then components outside any). A record's
// own children are drawn through one group per kind when they are of more than one kind, as before;
// a capability's flows and tests are listed in Interaction design and Test plan, as the nav lists
// them, so a capability's children are its use cases.
//
// The tree is built once per index (it is pure data) and every lookup is a map read.

export interface TreeGroup {
  /** The name, as the nav shows it: "Define", "Technical specification", "Flows", "Acceptance tests". */
  label: string;
  /** The kind of its records for a kind group or a test-plan group (what hiding a kind hides), or null for a stage or a named folder. */
  kind: string | null;
  /** How many records it shows, as the nav counts them. */
  count: number;
  /** Its records at the first record level beneath it, however deep its groups: what its marks and its page list. */
  members: SpecRecord[];
  /** The nearest record above it (its domain, product or parent record). */
  owner: string;
  /** 'stage', 'folder', 'kind' (a folder split by kind, or a record's kind group) or 'tests' (a test-plan group). */
  role: 'stage' | 'folder' | 'kind' | 'tests';
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

/** The kinds of some records, in the meta-model's order. */
function kindsOf(index: SpecIndex, records: readonly SpecRecord[]): string[] {
  const rank = kindRank(index);
  return [...new Set(records.map((r) => r.kind))].sort((a, b) => rank(a) - rank(b));
}

/**
 * Whether a folder's records split into one group per kind: they are of more than one kind, and
 * not every kind after the first can sit inside another kind in the folder (the nav's "capabilities,
 * then use cases outside any capability" is one list, not two).
 */
export function splitsByKind(index: SpecIndex, kinds: readonly string[]): boolean {
  if (kinds.length <= 1) return false;
  // A kind sits inside another when the meta-model says it may, or when the specs already put one there.
  const inside = (k: string) =>
    (index.kinds.get(k)?.parent_kinds ?? []).some((p) => p !== k && kinds.includes(p)) ||
    index.workspace.records.some((r) => r.kind === k && r.parent !== null && kinds.includes(index.byId.get(r.parent)?.kind ?? '') && index.byId.get(r.parent)!.kind !== k);
  return !kinds.slice(1).every(inside);
}

/**
 * Whether a record's child is listed elsewhere in the nav: a capability's flows and tests sit in
 * Interaction design and Test plan, not under the capability (specs/folders.ts domainRecords).
 */
function listedElsewhere(index: SpecIndex, parent: SpecRecord, child: SpecRecord): boolean {
  if (parent.kind !== 'capability') return false;
  const above = parent.parent ? index.byId.get(parent.parent) : undefined;
  if (above?.kind !== 'domain') return false;
  const section = (kind: string) => sectionOfKind(index, kind)?.section ?? `kind:${kind}`;
  return section(child.kind) !== section(parent.kind);
}

/** A record's children in the tree: its children the nav lists under it, kind by kind, in ID order within a kind. */
export function recordTreeChildren(index: SpecIndex, record: SpecRecord): SpecRecord[] {
  const rank = kindRank(index);
  const order = (r: SpecRecord) => { const n = Number(r.fields.order); return Number.isInteger(n) ? n : Infinity; };
  return (index.children.get(record.id) ?? [])
    .filter((c) => !listedElsewhere(index, record, c))
    .sort((a, b) => rank(a.kind) - rank(b.kind) || (a.kind === b.kind ? order(a) - order(b) : 0) || byIdOrder(a, b));
}

const deepRecords = (g: FolderGroup): SpecRecord[] => [...g.records, ...g.groups.flatMap(deepRecords)];

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
    const kids = recordTreeChildren(index, r);
    const kinds = kindsOf(index, kids);
    if (kinds.length > 1) {
      for (const kind of kinds) {
        const gid = `${r.id}/${kind}`;
        const members = kids.filter((c) => c.kind === kind);
        add(r.id, gid);
        group(gid, { label: plural(kindLabel(index, kind)), kind, count: members.length, members, owner: r.id, role: 'kind' });
        for (const m of members) { add(gid, m.id); addRecord(m); }
      }
    } else {
      for (const c of kids) { add(r.id, c.id); addRecord(c); }
    }
  };

  const addRecords = (parent: string, records: readonly SpecRecord[]) => {
    for (const r of records) { if (add(parent, r.id)) addRecord(r); }
  };

  /** A test-plan group (computed, not a record) and what is within it. */
  const addTestGroup = (parent: string, g: FolderGroup, owner: string) => {
    add(parent, g.key);
    group(g.key, { label: g.label, kind: 'test', count: g.count, members: deepRecords(g).sort(byIdOrder), owner, role: 'tests' });
    for (const inner of g.groups) addTestGroup(g.key, inner, owner);
    addRecords(g.key, g.records);
  };

  /** A folder's contents: its groups (layers, test-plan groups) and records, split by kind when the one-kind rule asks. */
  const addFolder = (parent: string, id: string, folder: Folder, owner: string, label = folder.label) => {
    add(parent, id);
    const members = folder.groups.length > 0 && !folder.kinds.includes('layer')
      ? [...folder.groups.flatMap(deepRecords), ...ungrouped(folder)].sort(byIdOrder)
      : folder.records;
    const kinds = kindsOf(index, folder.records);
    // A folder of a kind in no known section (open questions) is a group of that kind; a named folder has no kind of its own.
    const ofKind = folder.section.startsWith('kind:');
    group(id, { label, kind: ofKind ? folder.section.slice('kind:'.length) : null, count: folder.count, members, owner, role: ofKind ? 'kind' : 'folder' });
    if (folder.groups.length > 0 && folder.kinds.includes('layer')) {
      // Layers are records: each layer, in order, then the components outside any layer, straight in the folder.
      for (const g of folder.groups) {
        if (g.record) addRecords(id, [g.record]);
        else addRecords(id, g.records);
      }
      addRecords(id, ungrouped(folder));
      return;
    }
    if (folder.groups.length > 0) {
      for (const g of folder.groups) addTestGroup(id, g, owner);
      addRecords(id, ungrouped(folder));
      return;
    }
    if (splitsByKind(index, kinds)) {
      for (const kind of kinds) {
        const kid = `${id}/${kind}`;
        const records = folder.records.filter((r) => r.kind === kind);
        add(id, kid);
        group(kid, { label: plural(kindLabel(index, kind)), kind, count: records.length, members: records, owner, role: 'kind' });
        addRecords(kid, records);
      }
      return;
    }
    addRecords(id, folder.records);
  };

  const addDomain = (d: SpecRecord) => {
    visited.add(d.id);
    const { stages, loose } = domainFolders(index, d.id);
    for (const stage of stages) {
      if (stage.count === 0) continue;
      add(d.id, stage.key);
      const shown = stage.folders.filter((f) => f.records.length > 0);
      group(stage.key, { label: stage.label, kind: null, count: stage.count, members: shown.flatMap((f) => f.records), owner: d.id, role: 'stage' });
      for (const f of shown) addFolder(stage.key, f.key, f, d.id);
    }
    // A folder outside every stage of one kind (open questions) is the domain's group of that kind, at its usual address.
    for (const f of loose) {
      const id = f.section.startsWith('kind:') ? `${d.id}/${f.section.slice('kind:'.length)}` : f.key;
      addFolder(d.id, id, f, d.id);
    }
  };

  for (const product of index.products) {
    visited.add(product.id);
    for (const f of productFolders(index, product.id)) {
      if (f.records.length > 0) addFolder(product.id, f.key, f, product.id);
    }
    for (const d of index.domainsOf.get(product.id) ?? []) { if (add(product.id, d.id)) addDomain(d); }
    // The product's other children, by kind, as the nav's groups: open questions, fitness.
    const folderKinds = productFolderKinds(index);
    const rest = (index.children.get(product.id) ?? []).filter((c) => c.kind !== 'domain' && !folderKinds.has(c.kind));
    for (const kind of kindsOf(index, rest)) {
      const gid = `${product.id}/${kind}`;
      const members = rest.filter((c) => c.kind === kind);
      add(product.id, gid);
      group(gid, { label: plural(kindLabel(index, kind)), kind, count: members.length, members, owner: product.id, role: 'kind' });
      addRecords(gid, members);
    }
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
