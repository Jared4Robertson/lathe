import type { FolderEntry, FolderTree, Folder as TreeFolder, OwnerFolders as TreeOwner } from '../../../../lathe/src/exploring/folder-tree/read-model';
import type { Stage } from '../../../../lathe/src/platform/data/schema';
import type { UseCaseGroup } from '../../../../lathe/src/exploring/placement';
import { plural } from '../../plural';
import { kindLabel, type RecordIndex, type RecordSummary } from '../record-summaries/record-index';

// The folders a product's records are read in, as the Folder tree read (LA-EXP-RM02, get-folder-tree) gives them: the
// six stages, in each one folder per kind, the records that start a branch of the stage, and what folds under each.
// The side nav, the domain and product pages, the group pages, Quick open and the graph's tree all read this one tree,
// so they name and order things the same way. Here it is looked up: the records of a folder as their summaries, a
// stage and a folder named by the meta model, a record's folded children, a domain's use cases under their groups (the
// aggregate or read model of each one's result), and the branch of the nav a record sits in.

/** A run of a folder's records listed under one use case group: the aggregate or read model of their results. */
export interface FolderGroup {
  /** The aggregate or read model, with its kind and title; null for use cases whose result is neither. */
  group: UseCaseGroup | null;
  records: RecordSummary[];
}

export interface Folder {
  /** A stable key, also the folder's address in the graph's tree: "DM-SHOP/domain-model/aggregate", or "DM-SHOP/question" outside the stages. */
  key: string;
  kind: string;
  /** The kind's label in the plural: "Aggregates". */
  label: string;
  description: string;
  records: RecordSummary[];
  /** Its records under their use case groups, in the tree's order, for a folder of use cases; null for any other folder. */
  groups: FolderGroup[] | null;
  count: number;
}

export interface StageFolders {
  key: string;
  stage: Stage;
  label: string;
  description: string;
  folders: Folder[];
  /** Its one folder when it shows that folder's records directly, with no folder level between; null otherwise. */
  direct: Folder | null;
  count: number;
}

export interface OwnerFolders {
  stages: StageFolders[];
  loose: Folder[];
}

/** One owner looked up: its folders, and the folded children of each record in them. */
interface Looked {
  folders: OwnerFolders;
  folded: Map<string, RecordSummary[]>;
  /** The IDs of every record its folders hold, folded ones too. */
  ids: Set<string>;
  /** The records it reads, each as it was (null where the index held none and a summary stood in): it stands while they do. */
  read: [id: string, record: RecordSummary | null][];
  /** The records' lookups it was found to stand for. */
  holds: WeakSet<RecordIndex['byId']>;
}

// Each owner (Shared, a domain) is looked up once per its part of the tree answer and the meta model, and stands for
// any index whose records it reads are the very ones it was looked up with: a reload that changed one domain looks up
// that domain alone (the space's index worker sends the owners that did not change as they were), and an index that
// differs only in its problems or coverage shares every owner.
const owners = new WeakMap<TreeOwner, { meta: RecordIndex['meta']; looked: Looked }>();

function lookOwner(index: RecordIndex, owner: TreeOwner): Looked {
  const known = owners.get(owner);
  if (known && known.meta === index.meta) {
    const { looked } = known;
    if (looked.holds.has(index.byId)) return looked;
    if (looked.read.every(([id, record]) => (record ? index.byId.get(id) === record : !index.byId.has(id)))) {
      looked.holds.add(index.byId);
      return looked;
    }
  }
  const folded = new Map<string, RecordSummary[]>();
  const read: Looked['read'] = [];
  const ids = new Set<string>();
  const summaryOf = (e: FolderEntry): RecordSummary => {
    const record = index.byId.get(e.id);
    ids.add(e.id);
    read.push([e.id, record ?? null]);
    return record ?? { id: e.id, kind: e.kind, title: e.title, parent: null, product: index.product, domain: null, group: null, testState: null, names: null, level: null, file: '', line: 0, digest: '' };
  };
  const walk = (e: FolderEntry) => {
    if (e.folded.length > 0) folded.set(e.id, e.folded.map(summaryOf));
    e.folded.forEach(walk);
  };
  const folderOf = (f: TreeFolder): Folder => {
    f.entries.forEach(walk);
    const records = f.entries.map(summaryOf);
    return { key: f.key, kind: f.kind, label: plural(kindLabel(index, f.kind)), description: index.meta.kinds.get(f.kind)?.description ?? '', records, groups: groupsOf(f.entries, records), count: f.count };
  };
  const folders: OwnerFolders = {
    stages: owner.stages.map((s) => {
      const inStage = s.folders.map(folderOf);
      const stage = index.meta.stages.find((m) => m.stage === s.stage);
      return { key: s.key, stage: s.stage, label: stage?.label ?? s.stage.replaceAll('-', ' '), description: stage?.description ?? '', folders: inStage, direct: s.direct ? inStage[0] : null, count: s.count };
    }),
    loose: owner.loose.map(folderOf),
  };
  const looked: Looked = { folders, folded, ids, read, holds: new WeakSet([index.byId]) };
  owners.set(owner, { meta: index.meta, looked });
  return looked;
}

/** A folder's records in runs by the use case group the tree lists each under (the entries come sorted by it); null when no entry names one. */
function groupsOf(entries: readonly FolderEntry[], records: readonly RecordSummary[]): FolderGroup[] | null {
  if (!entries.some((e) => e.group)) return null;
  const runs: FolderGroup[] = [];
  entries.forEach((e, at) => {
    const group = e.group ?? null;
    const last = runs.at(-1);
    if (last && last.group?.id === group?.id) last.records.push(records[at]);
    else runs.push({ group, records: [records[at]] });
  });
  return runs;
}

/** Each owner of a tree answer by its ID. */
const ownersOf = new WeakMap<FolderTree, Map<string, TreeOwner>>();
function byOwner(tree: FolderTree): Map<string, TreeOwner> {
  let known = ownersOf.get(tree);
  if (!known) {
    known = new Map([[tree.shared.owner, tree.shared], ...tree.domains.map((d) => [d.owner, d] as const)]);
    ownersOf.set(tree, known);
  }
  return known;
}

const NONE: OwnerFolders = { stages: [], loose: [] };

/** A domain's or a product's (its Shared) stages and folders. */
export function ownerFolders(index: RecordIndex, owner: string): OwnerFolders {
  const found = byOwner(index.folders).get(owner);
  return found ? lookOwner(index, found).folders : NONE;
}

/**
 * A record's children that fold under it: those of its own stage, kind by kind. They are looked up in its domain's folders
 * (Shared's for a record of no domain), where the tree places it; a record found elsewhere, or nowhere, in every owner's.
 */
export function foldedChildren(index: RecordIndex, record: { id: string }): RecordSummary[] {
  const owners = byOwner(index.folders);
  const r = index.byId.get(record.id);
  const own = r ? owners.get(r.domain ?? r.product ?? index.product) : undefined;
  for (const owner of own ? [own, ...owners.values()] : owners.values()) {
    const looked = lookOwner(index, owner);
    if (looked.ids.has(record.id)) return looked.folded.get(record.id) ?? [];
  }
  return [];
}

/** The use case groups of the folder with this key, or of the stage with this key that shows its one folder directly; null for any other. */
export function folderGroups(index: RecordIndex, owner: string, key: string): FolderGroup[] | null {
  const { stages, loose } = ownerFolders(index, owner);
  const stage = stages.find((s) => s.key === key);
  if (stage) return stage.direct?.groups ?? null;
  return [...stages.flatMap((s) => s.folders), ...loose].find((f) => f.key === key)?.groups ?? null;
}

/** The key of the nav row that heads a use case group, the aggregate or read model with this ID: "group:DM-SHOP-A1". */
export const navGroupKey = (id: string) => `group:${id}`;

/** Every folder of an owner, the stages' then the loose ones. */
export const allFolders = (folders: OwnerFolders): Folder[] => [...folders.stages.flatMap((s) => s.folders), ...folders.loose];

/** The key, and graph address, of the folder holding a product's own stages, what it shares: "TL/shared". */
export const sharedKey = (productId: string) => `${productId}/shared`;

/** A stage's label, from the meta model ("Domain model"). */
export const stageLabel = (index: RecordIndex, stage: string) => index.meta.stages.find((s) => s.stage === stage)?.label ?? stage.replaceAll('-', ' ');

/** The stage a kind sits in, or null for a kind outside the stages (the product, an open question). */
export const stageOfKind = (index: RecordIndex, kind: string): Stage | null => index.meta.kinds.get(kind)?.stage ?? null;

/** Where a kind sits, as a heading: ["Use cases"], or [] for a kind outside the stages. */
export function folderPath(index: RecordIndex, kind: string): string[] {
  const stage = stageOfKind(index, kind);
  return stage ? [stageLabel(index, stage)] : [];
}

/**
 * The keys of the nav rows that hold a record, from the outside in: its domain (for a record in a domain), its stage
 * and its folder (none for a stage that shows its records directly), and for a use case the heading of its aggregate or
 * read model. A record folded under another opens the branch of the one listed.
 */
export function branchOf(index: RecordIndex, id: string): string[] {
  const record = index.byId.get(id);
  if (!record || record.kind === 'product') return [];
  if (record.kind === 'domain') return [`domain:${record.id}`];
  const owner = record.domain ?? record.product;
  if (!owner) return [];
  const folders = ownerFolders(index, owner);
  const head = record.domain ? [`domain:${record.domain}`] : [sharedKey(owner)];
  const seen = new Set<string>();
  for (let r: RecordSummary | undefined = record; r && !seen.has(r.id); r = r.parent ? index.byId.get(r.parent) : undefined) {
    seen.add(r.id);
    const at = r.id;
    const stage = folders.stages.find((s) => s.folders.some((f) => f.records.some((x) => x.id === at)));
    if (stage) {
      const folder = stage.folders.find((f) => f.records.some((x) => x.id === at))!;
      const group = folder.groups?.find((g) => g.records.some((x) => x.id === at))?.group;
      return [...head, stage.key, ...(stage.direct ? [] : [folder.key]), ...(group ? [navGroupKey(group.id)] : [])];
    }
    const loose = folders.loose.find((f) => f.records.some((x) => x.id === at));
    if (loose) return [...head, loose.key];
  }
  return record.domain ? [`domain:${record.domain}`] : [];
}
