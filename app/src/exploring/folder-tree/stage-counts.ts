import type { FolderEntry, FolderTree, OwnerFolders } from '../../../../lathe/src/exploring/folder-tree/read-model';
import type { Stage } from '../../../../lathe/src/platform/data/schema';

// How many records each domain, and Shared, holds in each stage, counting everything folded under a stage's entries:
// the Folder tree read (LA-EXP-QRY05) counts a stage's entries alone, so a stage whose aggregates fold 148 records
// reads 6 there. Worked out by the space's index builder (space-builder.ts), off the page's main thread, since a large
// product's tree has tens of thousands of entries.

/** Each owner's records by stage: the domain's ID, or the product's for Shared. */
export type StageCounts = Record<string, Partial<Record<Stage, number>>>;

const under = (entry: FolderEntry): number => entry.folded.reduce((n, e) => n + under(e), 1);

/** An owner's records by stage; a platform domain's two sections of one stage (Building blocks and Standards) add up. */
function ownerCounts(owner: OwnerFolders): Partial<Record<Stage, number>> {
  const counts: Partial<Record<Stage, number>> = {};
  for (const s of owner.stages) counts[s.stage] = (counts[s.stage] ?? 0) + s.folders.reduce((n, f) => n + f.entries.reduce((m, e) => m + under(e), 0), 0);
  return counts;
}

/** Every owner's records by stage. */
export function stageCounts(tree: FolderTree): StageCounts {
  return Object.fromEntries([tree.shared, ...tree.domains].map((owner) => [owner.owner, ownerCounts(owner)]));
}
