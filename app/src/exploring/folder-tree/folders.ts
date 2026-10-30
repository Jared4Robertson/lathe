import type { FolderEntry, FolderTree, Folder as TreeFolder, OwnerFolders as TreeOwner } from '../../../../lathe/src/exploring/folder-tree/read-model';
import type { Stage } from '../../../../lathe/src/platform/data/schema';
import { plural } from '../../plural';
import { kindLabel, type RecordIndex, type RecordSummary } from '../record-summaries/record-index';

export type { FolderTree };

// The folders a product's records are read in, as the Folder tree read (LA-EXP-RM02, get-folder-tree) gives them: the
// six stages, in each one folder per kind, the records that start a branch of the stage, and what folds under each.
// The side nav, the domain and product pages, the group pages, Quick open and the graph's tree all read this one tree,
// so they name and order things the same way. Here it is looked up: the records of a folder as their summaries, a
// stage and a folder named by the meta model, a record's folded children, and the branch of the nav a record sits in.

export interface Folder {
  /** A stable key, also the folder's address in the graph's tree: "DM-SHOP/domain-model/aggregate", or "DM-SHOP/question" outside the stages. */
  key: string;
  kind: string;
  /** The kind's label in the plural: "Aggregates". */
  label: string;
  description: string;
  records: RecordSummary[];
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

/** The tree looked up: each owner's folders and each record's folded children, worked out once per index. */
interface Looked {
  owners: Map<string, OwnerFolders>;
  folded: Map<string, RecordSummary[]>;
}

const cache = new WeakMap<RecordIndex, Looked>();

function look(index: RecordIndex): Looked {
  const known = cache.get(index);
  if (known) return known;
  const folded = new Map<string, RecordSummary[]>();
  const summaryOf = (e: FolderEntry): RecordSummary =>
    index.byId.get(e.id) ?? { id: e.id, kind: e.kind, title: e.title, parent: null, product: index.product, domain: null, group: null, testState: null, file: '', line: 0, digest: '' };
  const walk = (e: FolderEntry) => {
    if (e.folded.length > 0) folded.set(e.id, e.folded.map(summaryOf));
    e.folded.forEach(walk);
  };
  const folderOf = (f: TreeFolder): Folder => {
    f.entries.forEach(walk);
    return { key: f.key, kind: f.kind, label: plural(kindLabel(index, f.kind)), description: index.meta.kinds.get(f.kind)?.description ?? '', records: f.entries.map(summaryOf), count: f.count };
  };
  const ownerOf = (o: TreeOwner): OwnerFolders => ({
    stages: o.stages.map((s) => {
      const folders = s.folders.map(folderOf);
      const stage = index.meta.stages.find((m) => m.stage === s.stage);
      return { key: s.key, stage: s.stage, label: stage?.label ?? s.stage.replaceAll('-', ' '), description: stage?.description ?? '', folders, direct: s.direct ? folders[0] : null, count: s.count };
    }),
    loose: o.loose.map(folderOf),
  });
  const owners = new Map<string, OwnerFolders>();
  owners.set(index.folders.shared.owner, ownerOf(index.folders.shared));
  for (const d of index.folders.domains) owners.set(d.owner, ownerOf(d));
  const looked = { owners, folded };
  cache.set(index, looked);
  return looked;
}

const NONE: OwnerFolders = { stages: [], loose: [] };

/** A domain's or a product's (its Shared) stages and folders. */
export const ownerFolders = (index: RecordIndex, owner: string): OwnerFolders => look(index).owners.get(owner) ?? NONE;
export const domainFolders = ownerFolders;
export const productFolders = ownerFolders;

/** A record's children that fold under it: those of its own stage, kind by kind. */
export const foldedChildren = (index: RecordIndex, record: { id: string }): RecordSummary[] => look(index).folded.get(record.id) ?? [];

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
 * and its folder (none for a stage that shows its records directly). A record folded under another opens the branch
 * of the one listed.
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
    if (stage) return stage.direct ? [...head, stage.key] : [...head, stage.key, stage.folders.find((f) => f.records.some((x) => x.id === at))!.key];
    const loose = folders.loose.find((f) => f.records.some((x) => x.id === at));
    if (loose) return [...head, loose.key];
  }
  return record.domain ? [`domain:${record.domain}`] : [];
}
