import { plural } from '../plural';
import { textOf, byIdOrder, kindLabel, type SpecIndex, type SpecRecord, type Stage } from './data';

// The folders a product's records are read in: the five stages (domain model, use cases, interaction
// design, technical specification, test plan) from the schema, and in each stage one folder per kind,
// in the schema's kind order. A domain has its stages; the product has its own for what sits at
// product level (value objects, patterns, views, integrations, UI components, standards and what sits
// under them). Kinds outside the stages (open questions) follow the stages.
//
// A stage's folders list the records that start a branch of that stage: those whose parent is the
// domain or product itself, is of another stage, or is none (a kind with no owner). What sits under a
// record in the same stage folds under it (an aggregate's entities, commands and events; a command's
// policies; a use case's UC requirements); what sits under it in a later stage is listed in that
// stage's folder (a command's endpoint in Interaction design, its handler in Technical specification,
// a policy's test in Test plan). So every record has one place. The side nav, the domain and product
// pages, the group pages and the graph's tree all read this one model, so they name and order things
// the same way.

export interface Folder {
  /** A stable key, also the folder's address in the graph's tree: "DM-SHOP/domain-model/aggregate", or "DM-SHOP/question" outside the stages. */
  key: string;
  /** The kind the folder holds. */
  kind: string;
  /** The kind's label in the plural: "Aggregates". */
  label: string;
  description: string;
  /** Its records: capabilities and flow steps in their order, the rest by ID. */
  records: SpecRecord[];
  count: number;
}

export interface StageFolders {
  /** "DM-SHOP/domain-model". */
  key: string;
  stage: Stage;
  label: string;
  description: string;
  /** One folder per kind of the stage, in kind order; empty ones too. */
  folders: Folder[];
  /** The records in all its folders. */
  count: number;
}

export interface OwnerFolders {
  /** The five stages, in order. */
  stages: StageFolders[];
  /** After the stages: one folder per kind outside every stage that has records, such as open questions. */
  loose: Folder[];
}

/** A stage's label, from the schema ("Domain model"), or its name in words when the schema has no such stage. */
export const stageLabel = (index: SpecIndex, stage: string) =>
  index.workspace.stages.find((s) => s.stage === stage)?.label ?? stage.replaceAll('-', ' ');

/** The stage a kind sits in, or null for a kind outside the stages (the product, an open question). */
export const stageOfKind = (index: SpecIndex, kind: string): Stage | null => index.kinds.get(kind)?.stage ?? null;

/** Where a kind sits, as a heading: ["Use cases"], or [] for a kind outside the stages. */
export function folderPath(index: SpecIndex, kind: string): string[] {
  const stage = stageOfKind(index, kind);
  return stage ? [stageLabel(index, stage)] : [];
}

const order = (r: SpecRecord) => { const n = Number(textOf(r.row, 'position')); return Number.isInteger(n) ? n : Infinity; };
/** A flow step's path ranks main first, then the others by name; other kinds have no path. */
const pathRank = (a: SpecRecord, b: SpecRecord) => {
  const pa = textOf(a.row, 'path').trim().toLowerCase() || 'main';
  const pb = textOf(b.row, 'path').trim().toLowerCase() || 'main';
  return pa === pb ? 0 : pa === 'main' ? -1 : pb === 'main' ? 1 : pa.localeCompare(pb);
};
const kindRank = (index: SpecIndex) => {
  const ranks = new Map(index.workspace.kinds.map((k, i) => [k.kind, i]));
  return (kind: string) => ranks.get(kind) ?? Infinity;
};

/**
 * Records kind by kind in the schema's order; within a kind, those with a position in their order (capabilities, and
 * flow steps path by path, the main path first), then by ID.
 */
export function sortRecords(index: SpecIndex, records: readonly SpecRecord[]): SpecRecord[] {
  const rank = kindRank(index);
  return [...records].sort((a, b) => rank(a.kind) - rank(b.kind) || (a.kind === b.kind ? pathRank(a, b) || order(a) - order(b) : 0) || byIdOrder(a, b));
}

const CONTAINERS: ReadonlySet<string> = new Set(['product', 'domain']);

/**
 * Whether a record starts a branch of its stage: it has a stage, and its parent is a product or domain, is of
 * another stage, or is none.
 */
export function startsBranch(index: SpecIndex, record: SpecRecord): boolean {
  if (CONTAINERS.has(record.kind)) return false;
  const stage = stageOfKind(index, record.kind);
  const parent = record.parent ? index.byId.get(record.parent) : undefined;
  if (!parent || CONTAINERS.has(parent.kind)) return true;
  return stageOfKind(index, parent.kind) !== stage;
}

/**
 * A record's children that fold under it: those of its own stage (the rest are listed in their own stage's
 * folder), kind by kind. A record outside the stages folds all its children.
 */
export function foldedChildren(index: SpecIndex, record: SpecRecord): SpecRecord[] {
  if (CONTAINERS.has(record.kind)) return [];
  const stage = stageOfKind(index, record.kind);
  const kids = (index.children.get(record.id) ?? []).filter((c) => stage === null || stageOfKind(index, c.kind) === stage);
  return sortRecords(index, kids);
}

/** The records that belong to a domain (its own records), or to a product at product level (in no domain). */
function ownedBy(index: SpecIndex, owner: SpecRecord): SpecRecord[] {
  if (owner.kind === 'domain') return index.workspace.records.filter((r) => r.domain === owner.id && r.id !== owner.id);
  return index.workspace.records.filter((r) => r.product === owner.id && r.domain === null && r.kind !== 'product');
}

const folderOf = (index: SpecIndex, key: string, kind: string, records: SpecRecord[]): Folder => ({
  key,
  kind,
  label: plural(kindLabel(index, kind)),
  description: index.kinds.get(kind)?.description ?? '',
  records: sortRecords(index, records),
  count: records.length,
});

/**
 * What one index gives for each key, worked out once: an index never changes (a reload makes a new
 * one), and the nav, the branch of the current page and the graph's tree ask for an owner's folders
 * on every move (LA-PAT-APP-UX-R11).
 */
function perIndex<T>(compute: (index: SpecIndex, key: string) => T): (index: SpecIndex, key: string) => T {
  const cache = new WeakMap<SpecIndex, Map<string, T>>();
  return (index, key) => {
    let known = cache.get(index);
    if (!known) cache.set(index, (known = new Map()));
    if (!known.has(key)) known.set(key, compute(index, key));
    return known.get(key)!;
  };
}

/**
 * A domain's or a product's stages and folders: every stage with a folder for each kind of the stage (empty ones
 * too; a product's own kinds of no stage among the loose), then its records outside every stage. A product's
 * folders hold what sits at product level, never its domains' records. Worked out once per index.
 */
export const ownerFolders = perIndex((index: SpecIndex, ownerId: string): OwnerFolders => {
  const owner = index.byId.get(ownerId);
  if (!owner) return { stages: [], loose: [] };
  const roots = ownedBy(index, owner).filter((r) => startsBranch(index, r));
  const stages = index.workspace.stages.map((s) => {
    const key = `${ownerId}/${s.stage}`;
    const folders = index.workspace.kinds
      .filter((k) => k.stage === s.stage && !CONTAINERS.has(k.kind))
      .map((k) => folderOf(index, `${key}/${k.kind}`, k.kind, roots.filter((r) => r.kind === k.kind)))
      // An empty folder only for a kind that can start a branch here: a domain's stages leave out what sits at
      // product level, and neither lists a kind that always folds under another (an entity under its aggregate).
      .filter((f) => f.count > 0 || canStartIn(index, f.kind, owner.kind));
    return { key, stage: s.stage, label: s.label, description: s.description, folders, count: folders.reduce((n, f) => n + f.count, 0) };
  });
  const looseKinds = [...new Set(roots.filter((r) => stageOfKind(index, r.kind) === null).map((r) => r.kind))].sort((a, b) => kindRank(index)(a) - kindRank(index)(b));
  const loose = looseKinds.map((kind) => folderOf(index, `${ownerId}/${kind}`, kind, roots.filter((r) => r.kind === kind)));
  return { stages, loose };
});

/**
 * Whether records of a kind can belong to a domain (`domain`) or sit at product level (`product`): a kind with no
 * owner by its IDs' scope, any other by where its parents can be.
 */
function canSitIn(index: SpecIndex, kind: string, owner: string, seen = new Set<string>()): boolean {
  if (seen.has(kind)) return false;
  seen.add(kind);
  const described = index.kinds.get(kind);
  if (!described || kind === 'product' || kind === 'domain') return kind === owner;
  if (described.parent_kinds.length === 0) return owner === 'domain' ? described.id_scope === 'domain' : described.id_scope !== 'domain';
  return described.parent_kinds.some((p) => canSitIn(index, p, owner, seen));
}

/** Whether a record of a kind can start a branch of its stage in a domain or at product level (see startsBranch). */
function canStartIn(index: SpecIndex, kind: string, owner: string): boolean {
  const described = index.kinds.get(kind);
  if (!described) return false;
  if (described.parent_kinds.length === 0) return canSitIn(index, kind, owner);
  return described.parent_kinds.some((p) => p === owner || (!CONTAINERS.has(p) && stageOfKind(index, p) !== described.stage && canSitIn(index, p, owner)));
}

/** A domain's stages and folders. */
export const domainFolders = (index: SpecIndex, domainId: string): OwnerFolders => ownerFolders(index, domainId);

/** A product's own stages and folders: what sits at product level. */
export const productFolders = (index: SpecIndex, productId: string): OwnerFolders => ownerFolders(index, productId);

/** Every folder of an owner, the stages' then the loose ones. */
export const allFolders = (folders: OwnerFolders): Folder[] => [...folders.stages.flatMap((s) => s.folders), ...folders.loose];

/**
 * The keys of the nav rows that hold a record, from the outside in: its domain (for a record in a domain), its
 * stage and its folder, so the current page's branch can open itself. A record folded under another (a command under
 * its aggregate) opens the branch of the one listed.
 */
export function branchOf(index: SpecIndex, id: string): string[] {
  const record = index.byId.get(id);
  if (!record || record.kind === 'product') return [];
  if (record.kind === 'domain') return [`domain:${record.id}`];
  const owner = record.domain ?? record.product;
  if (!owner) return [];
  const folders = ownerFolders(index, owner);
  const seen = new Set<string>();
  for (let r: SpecRecord | undefined = record; r && !seen.has(r.id); r = r.parent ? index.byId.get(r.parent) : undefined) {
    seen.add(r.id);
    const stage = folders.stages.find((s) => s.folders.some((f) => f.records.some((x) => x.id === r!.id)));
    const head = record.domain ? [`domain:${record.domain}`] : [];
    if (stage) return [...head, stage.key, stage.folders.find((f) => f.records.some((x) => x.id === r!.id))!.key];
    const loose = folders.loose.find((f) => f.records.some((x) => x.id === r!.id));
    if (loose) return [...head, loose.key];
  }
  return record.domain ? [`domain:${record.domain}`] : [];
}
