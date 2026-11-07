import type { RecordSummary, SummaryLink } from '../../../../lathe/src/exploring/record-summaries/read-model';
import type { FolderTree, OwnerFolders } from '../../../../lathe/src/exploring/folder-tree/read-model';
import type { StoreProblem } from '../../../../lathe/src/server/contract';
import type { MetaModel } from '../../platform/meta-model/reads';
import { emptyTree, keepTree, patchTree, type Tree, type TreeChange } from '../../graph/tree';
import type { InputChange, MapInput } from '../../graph/layout-input';
import { coverageOf, problemsOf, type ListedProblem, type RecordIndex, type Records } from './record-index';
import type { ScopeCoverage } from '../../../../lathe/src/traceability/coverage/read-model';
import { mapChange, patchMap, sameItems, type MapChange } from './map-change';

// The space's index worked out off the page's main thread (LA-STD-EXPERIENCE-R02, LA-PAT-APP-UX-R11): the space's index
// worker (space-index.worker.ts) reads the record summaries and the folder tree, works out the records, the graph's
// tree and each map's layout input from them, and sends the page only what changed since what the page holds, so the
// page puts a change in (its mirror, below) and never parses, diffs or builds a large product's lookups whole while
// the camera moves. Where there is no worker (the unit tests, in jsdom) the same builder runs on the page's thread and
// the page puts its changes in the same way: one way to build the index, whatever thread builds it.

/** The records' change from the records the page holds: what the records' lookups put in or take out. */
export interface RecordsChange {
  /** The records new or changed since. */
  put: RecordSummary[];
  /** Every record's ID in order, when records came or went or moved in it; else null (the order stands). */
  order: string[] | null;
  children: MapChange<string[]>;
  outgoing: MapChange<SummaryLink[]>;
  incoming: MapChange<SummaryLink[]>;
  /** The domains' IDs, when they changed. */
  domains: string[] | null;
}

/** The folder tree's change: the owners that changed, each other one as its place in the tree the page holds. */
export interface FoldersChange {
  shared: OwnerFolders | null;
  domains: ((OwnerFolders & { title: string }) | number)[];
}

/** What the builder sends after a read: the change from the state the page holds (`base`), or from nothing. */
export interface SpaceChange {
  product: string;
  /** The builder's state the change makes, and the one it is from (null: from nothing). */
  seq: number;
  base: number | null;
  /** The meta model's number the tree was worked out with. */
  meta: number;
  records: RecordsChange;
  folders: FoldersChange;
  tree: TreeChange;
}

/** The problems' and the coverage's change: each record's problems and gaps, and each scope's coverage, that changed. */
export interface ChecksChange {
  product: string;
  seq: number;
  base: number | null;
  problems: MapChange<ListedProblem[]>;
  gaps: MapChange<string[]>;
  scopes: MapChange<ScopeCoverage>;
  /** The scopes in order (the product's own, then each domain by position), when it changed: the product's page lists them so. */
  scopeOrder: string[] | null;
}

/** A read the builder could not make: the server's refusal, as the page's reads give it. */
export interface SpaceRefusal { refused: { error: string; problems: StoreProblem[] } }

/** What the page asks of the builder. */
export type SpaceRequest =
  | { type: 'meta'; meta: MetaModel; number: number }
  | { type: 'read'; id: number; product: string; base: number | null; summaries: boolean; folders: boolean }
  | { type: 'checked'; id: number; product: string; base: number | null; problems: boolean; coverage: boolean }
  | { type: 'input'; id: number; product: string; seq: number; root: string; view: MapInput['view']; measure: string; held: boolean };
export type SpaceReply =
  | { type: 'read'; id: number; change: SpaceChange | SpaceRefusal }
  | { type: 'checked'; id: number; change: ChecksChange }
  | { type: 'input'; id: number; change: InputChange | null };

export const EMPTY_RECORDS: Records = { product: '', byId: new Map(), children: new Map(), outgoing: new Map(), incoming: new Map(), domains: [], links: [] };
const sameLinkList = (a: SummaryLink[], b: SummaryLink[]) => a === b || (a.length === b.length && a.every((l, i) => l.source === b[i].source && l.relation === b[i].relation && l.target === b[i].target));

/** What changed from the records `before` (the page's) to `next`; a record is changed when it is not the very object it was, as recordsOf keeps what did not change. */
export function recordsChange(before: Records, next: Records): RecordsChange {
  const put: RecordSummary[] = [];
  for (const r of next.byId.values()) if (before.byId.get(r.id) !== r) put.push(r);
  let ordered = before.byId.size === next.byId.size;
  if (ordered) {
    const was = before.byId.keys();
    for (const id of next.byId.keys()) if (was.next().value !== id) { ordered = false; break; }
  }
  return {
    put,
    order: ordered ? null : [...next.byId.keys()],
    children: mapChange(before.children, next.children, sameItems, (list) => list.map((r) => r.id)),
    outgoing: next.outgoing === before.outgoing ? [] : mapChange(before.outgoing, next.outgoing, sameLinkList, (l) => l),
    incoming: next.incoming === before.incoming ? [] : mapChange(before.incoming, next.incoming, sameLinkList, (l) => l),
    domains: sameItems(before.domains.map((d) => d.id), next.domains.map((d) => d.id)) ? null : next.domains.map((d) => d.id),
  };
}

/** The records `before` with a change put in: the same records the builder holds, as the page's own objects. */
export function patchRecords(product: string, before: Records, change: RecordsChange): Records {
  let byId = before.byId;
  if (change.put.length > 0 || change.order) {
    const put = new Map(change.put.map((r) => [r.id, r]));
    byId = change.order ? new Map(change.order.map((id) => [id, put.get(id) ?? before.byId.get(id)!])) : patchMap(before.byId, change.put.map((r) => [r.id, r]), (r) => r) as Map<string, RecordSummary>;
  }
  if (byId === before.byId && change.children.length === 0 && change.outgoing.length === 0 && change.incoming.length === 0 && !change.domains && before.product === product) return before;
  return {
    product,
    byId,
    children: patchMap(before.children, change.children, (ids) => ids.map((id) => byId.get(id)!)) as Map<string, RecordSummary[]>,
    outgoing: patchMap(before.outgoing, change.outgoing, (l) => l) as Map<string, SummaryLink[]>,
    incoming: patchMap(before.incoming, change.incoming, (l) => l) as Map<string, SummaryLink[]>,
    domains: (change.domains ?? before.domains.map((d) => d.id)).map((id) => byId.get(id)!),
    links: [],
  };
}

const ownerText = new WeakMap<OwnerFolders, string>();
const textOf = (o: OwnerFolders) => {
  let text = ownerText.get(o);
  if (text === undefined) { text = JSON.stringify(o); ownerText.set(o, text); }
  return text;
};

/** What changed from the folder tree `before` (the page's, or null) to `next`: the owners whose folders read differently. */
export function foldersChange(before: FolderTree | null, next: FolderTree): FoldersChange {
  const at = new Map(before?.domains.map((d, i) => [d.owner, i]) ?? []);
  return {
    shared: before && textOf(before.shared) === textOf(next.shared) ? null : next.shared,
    domains: next.domains.map((d) => {
      const i = at.get(d.owner);
      return i !== undefined && before!.domains[i].title === d.title && textOf(before!.domains[i]) === textOf(d) ? i : d;
    }),
  };
}

/** The folder tree `before` with a change put in, each owner that did not change the very one the page held. */
export function patchFolders(product: string, before: FolderTree | null, change: FoldersChange): FolderTree {
  return {
    product,
    shared: change.shared ?? before!.shared,
    domains: change.domains.map((d) => (typeof d === 'number' ? before!.domains[d] : d)),
  };
}

/** The products the builder and the mirror keep. */
export const KEEP = 3;
export const keep = <T>(map: Map<string, T>, key: string, value: T) => {
  map.delete(key);
  map.set(key, value);
  if (map.size > KEEP) map.delete(map.keys().next().value!);
};

/** The page's mirror of a product's space: what the builder's changes made, numbered as the builder numbers them. */
export interface Mirrored { seq: number; meta: number; records: Records; folders: FolderTree; tree: Tree }
const mirrors = new Map<string, Mirrored>();

/** The page's mirror of a product, or undefined before its first change. */
export const mirrorOf = (product: string): Mirrored | undefined => mirrors.get(product);

/** Puts a change in the product's mirror; a change from a state the mirror does not hold is put in from nothing. */
export function putChange(change: SpaceChange): Mirrored {
  const was = mirrors.get(change.product);
  const from = was && change.base !== null && was.seq === change.base ? was : null;
  const records = patchRecords(change.product, from?.records ?? EMPTY_RECORDS, change.records);
  const folders = patchFolders(change.product, from?.folders ?? null, change.folders);
  const next: Mirrored = { seq: change.seq, meta: change.meta, records, folders, tree: patchTree(from?.tree ?? emptyTree(), change.tree, records.byId) };
  keep(mirrors, change.product, next);
  return next;
}

/** Keeps the mirror's tree as the tree of an index made from it, when the index reads the meta model the tree was worked out with. */
export function keepMirroredTree(index: RecordIndex, mirrored: Mirrored, meta: number) {
  if (mirrored.meta === meta && index.byId === mirrored.records.byId && index.folders === mirrored.folders) keepTree(index, mirrored.tree);
}

/** No problems and no coverage, as an index holds until they are read. */
export const NO_PROBLEMS: RecordIndex['problemsFor'] = problemsOf(null);
export const NO_COVERAGE = coverageOf('', null);

const sameProblemList = (a: ListedProblem[], b: ListedProblem[]) => a.length === b.length && a.every((p, i) => p.severity === b[i].severity && p.check === b[i].check && p.record === b[i].record && p.message === b[i].message);
const scopeText = new WeakMap<ScopeCoverage, string>();
const sameScope = (a: ScopeCoverage, b: ScopeCoverage) => {
  const text = (s: ScopeCoverage) => { let t = scopeText.get(s); if (t === undefined) { t = JSON.stringify(s); scopeText.set(s, t); } return t; };
  return a === b || text(a) === text(b);
};

/** What changed from the problems and coverage `before` (the page's, or none) to `next`. */
export function checksChange(product: string, seq: number, base: MirroredChecks | null, next: Omit<MirroredChecks, 'seq' | 'product'>): ChecksChange {
  const was = base ?? { problemsFor: new Map(), coverage: { scopes: new Map(), gapsFor: new Map() } };
  return {
    product, seq, base: base?.seq ?? null,
    problems: mapChange(was.problemsFor, next.problemsFor, sameProblemList, (l) => l),
    gaps: mapChange(was.coverage.gapsFor, next.coverage.gapsFor, sameItems, (l) => l),
    scopes: mapChange(was.coverage.scopes, next.coverage.scopes, sameScope, (s) => s),
    scopeOrder: sameItems([...was.coverage.scopes.keys()], [...next.coverage.scopes.keys()]) ? null : [...next.coverage.scopes.keys()],
  };
}

/** The page's mirror of a product's problems and coverage, as the index holds them. */
export interface MirroredChecks { seq: number; product: string; problemsFor: RecordIndex['problemsFor']; coverage: { scopes: RecordIndex['coverage']; gapsFor: RecordIndex['gapsFor'] } }
const checks = new Map<string, MirroredChecks>();

/** The page's mirror of a product's problems and coverage, or undefined before their first change. */
export const checksOf = (product: string): MirroredChecks | undefined => checks.get(product);

/** Puts a change of the problems and coverage in; one from a state the mirror does not hold is put in from nothing. */
export function putChecks(change: ChecksChange): MirroredChecks {
  const was = checks.get(change.product);
  const from = was && change.base !== null && was.seq === change.base ? was : null;
  const as = <V,>(v: V) => v;
  const problemsFor = patchMap(from?.problemsFor ?? new Map(), change.problems, as) as RecordIndex['problemsFor'];
  const patched = patchMap(from?.coverage.scopes ?? new Map(), change.scopes, as) as RecordIndex['coverage'];
  const scopes = change.scopeOrder ? new Map(change.scopeOrder.map((key) => [key, patched.get(key)!])) : patched;
  const gapsFor = patchMap(from?.coverage.gapsFor ?? new Map(), change.gaps, as) as RecordIndex['gapsFor'];
  // What did not change keeps its very lookups, so the index is not made again for it.
  const coverage = from && from.coverage.scopes === scopes && from.coverage.gapsFor === gapsFor ? from.coverage : { scopes, gapsFor };
  const next: MirroredChecks = from && from.problemsFor === problemsFor && from.coverage === coverage ? from : { seq: change.seq, product: change.product, problemsFor, coverage };
  next.seq = change.seq;
  keep(checks, change.product, next);
  return next;
}

/** Forgets every mirror (between apps, as the reads are forgotten). */
export function forgetMirrors() {
  mirrors.clear();
  checks.clear();
}
