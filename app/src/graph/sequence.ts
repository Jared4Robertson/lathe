import type { FolderEntry, OwnerFolders } from '../../../lathe/src/exploring/folder-tree/read-model';
import { compareIds, type RecordIndex, type RecordSummary } from '../exploring/record-summaries/record-index';

// The order of the steps a Map record is composed of (LA-EXP-DS12): a journey's steps and a flow's run path by path,
// the main path first, each by position, as the folder tree (LA-EXP-RM02) lists them under their journey or flow; and
// the derived "then" arrows that join each step to the next on its path. "Then" is no relation: it is drawn from the
// order, the way the folder tree orders. Pure, worked out once per index.

/** Each record the folder tree folds under another: its place among its siblings there and, for a step, its path. */
interface Placing { rank: number; path: string | undefined }

const placings = new WeakMap<RecordIndex, Map<string, Placing>>();

function placingsOf(index: RecordIndex): Map<string, Placing> {
  const known = placings.get(index);
  if (known) return known;
  const out = new Map<string, Placing>();
  const walk = (entries: readonly FolderEntry[]) => entries.forEach((e, rank) => {
    out.set(e.id, { rank, path: e.path });
    walk(e.folded);
  });
  const owner = (o: OwnerFolders) => { for (const f of [...o.stages.flatMap((s) => s.folders), ...o.loose]) walk(f.entries); };
  owner(index.folders.shared);
  index.folders.domains.forEach(owner);
  placings.set(index, out);
  return out;
}

/**
 * A record's composed children in the Map's order: kind by kind, each kind where its first ID falls; within a kind as the
 * folder tree folds them (a journey's or flow's steps path by path, each by position), then by ID.
 */
export function composedOrder(index: RecordIndex, children: readonly RecordSummary[]): RecordSummary[] {
  const at = placingsOf(index);
  const rank = (r: RecordSummary) => at.get(r.id)?.rank ?? Infinity;
  const first = new Map<string, string>();
  for (const c of children) { const was = first.get(c.kind); if (was === undefined || compareIds(c.id, was) < 0) first.set(c.kind, c.id); }
  return [...children].sort((a, b) => (a.kind === b.kind ? rank(a) - rank(b) || compareIds(a.id, b.id) : compareIds(first.get(a.kind)!, first.get(b.kind)!)));
}

/** A step's path, as the folder tree gives it; undefined for a record with none. */
export const pathOf = (index: RecordIndex, id: string): string | undefined => placingsOf(index).get(id)?.path;

/** The "then" arrows inside a record: each pair of consecutive children (in `order`) of one kind on one path, from the earlier to the later. */
export function thenPairs(index: RecordIndex, order: readonly string[]): [string, string][] {
  const pairs: [string, string][] = [];
  for (let k = 1; k < order.length; k++) {
    const [a, b] = [order[k - 1], order[k]];
    const path = pathOf(index, a);
    if (path !== undefined && path === pathOf(index, b) && index.byId.get(a)?.kind === index.byId.get(b)?.kind) pairs.push([a, b]);
  }
  return pairs;
}
