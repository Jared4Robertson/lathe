import type { SpecIndex } from '../specs/data';

// What an obligation is, kept apart from chain.ts, which reads the wiki's trace logic (React's module
// graph), so the Voronoi worker that reaches this loads nothing more.

/** An obligation: a constraint, invariant, specification, policy, domain service, UC, view or API requirement, pattern or standard rule, or a product's own obligation kind. */
export const isObligation = (index: SpecIndex, id: string): boolean => {
  const kind = index.byId.get(id)?.kind;
  return !!kind && !!index.kinds.get(kind)?.obligation;
};
