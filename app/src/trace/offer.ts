import type { SpecIndex } from '../specs/data';
import { treeChildren } from '../graph/tree';

// Whether a page offers the Trace view (LA-V98-R01): its focus is an obligation, or one sits under it in
// the nav's tree. Kept apart from chain.ts, which reads the wiki's trace logic (React's module graph), so
// the address module and the Voronoi worker that reach this load nothing more than the tree.

/** An obligation: a constraint, invariant, specification, policy, domain service, UC, view or API requirement, pattern or standard rule, or a product's own obligation kind. */
export const isObligation = (index: SpecIndex, id: string): boolean => {
  const kind = index.byId.get(id)?.kind;
  return !!kind && !!index.kinds.get(kind)?.obligation;
};

/** Whether the Trace view has something to show: the focus is an obligation, or one sits under it. Stops at the first. */
export function hasTrace(index: SpecIndex, focus: string): boolean {
  const seen = new Set<string>();
  const find = (id: string): boolean => {
    if (seen.has(id)) return false;
    seen.add(id);
    return isObligation(index, id) || treeChildren(index, id).some(find);
  };
  return find(focus);
}
