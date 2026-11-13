// The Folder tree read model (LA-EXP-RM02), shaped for the nav, Quick open and the graph's tree: each product's
// folders, Shared (what the product shares) and then each domain's, each with its stages and in each stage one folder per
// kind in the schema's kind order, then the kinds outside the stages (open questions). A stage's folders list the
// records that start a branch of that stage: those whose parent is the domain or product itself, is of another stage,
// or is none (a kind with no owner). What sits under a record in the same stage folds under it (an aggregate's
// entities, commands and events); what sits under it in a later stage is listed in that stage's folder. So every record
// has one place. A stage with only one folder shows that folder's records directly (LA-PAT-APP-UX-R15). Within a kind,
// records with a position come in its order (flow steps path by path, the main path first), then by ID; use cases by
// their group (their result's aggregate or read model: aggregates by ID, then read models by ID), each entry naming
// its group, then by ID; terms bottom-up, each after the terms it builds on. The projection is the only code that reads the source rows
// for the query and the only code that writes the read model's table.
import { termsBottomUp } from '../../domain-modeling/domain/read-model.ts';
import type { ReadView } from '../../platform/data/rules.ts';
import type { Stage } from '../../platform/data/schema.ts';
import { compareGroups, inSpace, placementOf, useCaseGroupOf, type Placed, type UseCaseGroup } from '../placement.ts';
import { groupBy, groupOf } from '../../platform/data/grouped.ts';
import { idOrder } from '../../platform/data/ids.ts';
import { domainOrder } from '../../platform/data/domain-order.ts';
import type { Row } from '../../platform/data/rows.ts';

/** One record in its folder, with the records that fold under it. */
export interface FolderEntry {
  id: string;
  kind: string;
  title: string;
  /** A step's path (a flow's or a journey's), lower case, main when it names none; absent for a record with no path. */
  path?: string;
  /** A use case's group: its result's aggregate or read model, the heading it is listed under; absent for any other record. */
  group?: UseCaseGroup;
  /** What sits under it in its own stage, kind by kind. */
  folded: FolderEntry[];
}

/** One folder: the records of one kind that start a branch here. */
export interface Folder {
  /** A stable key, also the folder's address in the graph's tree: "DM-SHOP/domain-model/aggregate", or "DM-SHOP/question" outside the stages. */
  key: string;
  kind: string;
  entries: FolderEntry[];
  /** How many records start a branch in it. */
  count: number;
}

/** One stage of a domain or of Shared. */
export interface StageFolders {
  /** "DM-SHOP/domain-model". */
  key: string;
  stage: Stage;
  /** One folder per kind of the stage that can start a branch here, in kind order; empty ones too. */
  folders: Folder[];
  /** Whether it shows its one folder's records directly, with no folder level between. */
  direct: boolean;
  count: number;
}

/** A domain's or Shared's stages and folders. */
export interface OwnerFolders {
  /** The domain, or the product for Shared. */
  owner: string;
  stages: StageFolders[];
  /** After the stages: one folder per kind outside every stage that has records, such as open questions. */
  loose: Folder[];
}

/** A product's folder tree. */
export interface FolderTree {
  product: string;
  /** What the product shares. */
  shared: OwnerFolders;
  /** Each domain, by position, with its title. */
  domains: (OwnerFolders & { title: string })[];
}

/** The read model's table, kept in memory: each product's tree, by product. */
export interface FolderTreeTable {
  products: Map<string, FolderTree>;
}

const CONTAINERS: ReadonlySet<string> = new Set(['product', 'domain']);

/** The projection: the read model's table, built from the rows on each read (in memory; nothing keeps it). */
export function folderTreeTableFrom(view: ReadView): FolderTreeTable {
  const { schema } = view;
  const placed = placementOf(view);
  const rank = (k: string) => schema.kinds[k]?.position ?? Number.MAX_SAFE_INTEGER;
  const kinds = Object.keys(schema.kinds).sort((a, b) => rank(a) - rank(b) || a.localeCompare(b));
  const kindRank = new Map(kinds.map((k, i) => [k, i]));
  const stageOf = (kind: string): Stage | null => schema.kinds[kind]?.stage ?? null;
  const children = groupBy([...placed.values()].filter((r) => r.parent), (r) => r.parent);
  const buildsOn = schema.tables.builds_on ? groupBy(view.rows('builds_on'), (l) => l.source_id) : new Map<string, Row[]>();

  const position = (r: Placed) => (typeof r.row.position === 'number' ? r.row.position : Infinity);
  const path = (r: Placed) => (typeof r.row.path === 'string' && r.row.path.trim() ? r.row.path.trim().toLowerCase() : 'main');
  const order = idOrder(placed.keys());
  const pathRank = (a: Placed, b: Placed) => { const pa = path(a); const pb = path(b); return pa === pb ? 0 : pa === 'main' ? -1 : pb === 'main' ? 1 : pa.localeCompare(pb); };
  const useCaseGroup = (r: Placed) => (r.kind === 'use_case' ? useCaseGroupOf(placed, r.id) : null);
  const groupRank = (a: Placed, b: Placed) => {
    const [ga, gb] = [useCaseGroup(a), useCaseGroup(b)];
    return ga && gb ? compareGroups(ga, gb) : Number(!ga) - Number(!gb);
  };
  /** Kind by kind in the schema's order; within a kind by path, then position, then use case group, then ID; terms bottom-up. */
  const sorted = (records: readonly Placed[]): Placed[] => {
    const out = [...records].sort((a, b) => (kindRank.get(a.kind) ?? Infinity) - (kindRank.get(b.kind) ?? Infinity) || (a.kind === b.kind ? pathRank(a, b) || position(a) - position(b) || groupRank(a, b) : 0) || order.get(a.id)! - order.get(b.id)!);
    const first = out.findIndex((r) => r.kind === 'term');
    if (first === -1) return out;
    const terms = out.filter((r) => r.kind === 'term');
    out.splice(first, terms.length, ...termsBottomUp(terms, (id) => groupOf(buildsOn, id).map((l) => String(l.target_id))));
    return out;
  };
  const entry = (r: Placed, seen: Set<string>): FolderEntry => {
    seen.add(r.id);
    const stage = stageOf(r.kind);
    const folded = sorted(groupOf(children, r.id).filter((c) => !seen.has(c.id) && (stage === null || stageOf(c.kind) === stage)));
    const group = useCaseGroup(r);
    return { id: r.id, kind: r.kind, title: r.title, ...('path' in r.row ? { path: path(r) } : {}), ...(group ? { group } : {}), folded: folded.map((c) => entry(c, seen)) };
  };
  const startsBranch = (r: Placed) => {
    if (CONTAINERS.has(r.kind)) return false;
    const parent = r.parent ? placed.get(r.parent) : undefined;
    if (!parent || CONTAINERS.has(parent.kind)) return true;
    return stageOf(parent.kind) !== stageOf(r.kind);
  };
  /** Whether records of a kind can be written into a domain or the product's Shared folder. */
  const canSitIn = (kind: string, owner: string, seen = new Set<string>()): boolean => {
    if (seen.has(kind)) return false;
    seen.add(kind);
    const k = schema.kinds[kind];
    if (!k || kind === 'product' || kind === 'domain') return kind === owner;
    if (k.parents.length === 0) return owner === 'domain' ? k.idScope === 'domain' : k.idScope !== 'domain';
    return k.parents.some((p) => canSitIn(p.kind, owner, seen));
  };
  const canStartIn = (kind: string, owner: string) => {
    const k = schema.kinds[kind];
    if (!k) return false;
    if (k.parents.length === 0) return canSitIn(kind, owner);
    return k.parents.some((p) => p.kind === owner || (!CONTAINERS.has(p.kind) && stageOf(p.kind) !== k.stage && canSitIn(p.kind, owner)));
  };
  const folderOf = (key: string, kind: string, records: Placed[]): Folder => {
    const seen = new Set<string>();
    return { key, kind, entries: sorted(records).map((r) => entry(r, seen)), count: records.length };
  };
  const ownerFolders = (owner: Placed, owned: Placed[]): OwnerFolders => {
    const roots = groupBy(owned.filter(startsBranch), (r) => r.kind);
    const stages = [...schema.stages].sort((a, b) => a.position - b.position).map((s): StageFolders => {
      const key = `${owner.id}/${s.name}`;
      const folders = kinds
        .filter((k) => schema.kinds[k].stage === s.name && !CONTAINERS.has(k))
        .map((k) => folderOf(`${key}/${k}`, k, groupOf(roots, k)))
        // An empty folder only for a kind that can start a branch here.
        .filter((f) => f.count > 0 || canStartIn(f.kind, owner.kind));
      return { key, stage: s.name, folders, direct: folders.length === 1, count: folders.reduce((n, f) => n + f.count, 0) };
    }).filter((s) => s.folders.length > 0);
    const looseKinds = kinds.filter((k) => stageOf(k) === null && roots.has(k));
    return { owner: owner.id, stages, loose: looseKinds.map((k) => folderOf(`${owner.id}/${k}`, k, groupOf(roots, k))) };
  };

  const products = new Map<string, FolderTree>();
  const all = [...placed.values()];
  const domainRank = domainOrder(view.rows('domain'));
  for (const product of all.filter((r) => r.kind === 'product')) {
    const space = all.filter((r) => inSpace(r, product.id));
    const domains = space.filter((r) => r.kind === 'domain' && r.product === product.id).sort((a, b) => domainRank.get(a.id)! - domainRank.get(b.id)!);
    // The space's records by the domain they sit in, grouped once.
    const inDomain = groupBy(space.filter((r) => r.domain !== null), (r) => r.domain);
    products.set(product.id, {
      product: product.id,
      shared: ownerFolders(product, space.filter((r) => r.domain === null && r.kind !== 'product' && r.product === product.id)),
      domains: domains.map((d) => ({ ...ownerFolders(d, groupOf(inDomain, d.id).filter((r) => r.id !== d.id)), title: d.title })),
    });
  }
  return { products };
}
