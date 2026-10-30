import { type RecordIndex } from '../exploring/record-summaries/record-index';

// What an obligation is, kept apart from chain.ts, which reads the wiki's trace logic (React's module
// graph), so the modules that reach this load nothing more.

/** An obligation: a constraint, invariant, specification, policy, domain service, UC, view or API requirement, pattern or standard rule, or a product's own obligation kind. */
export const isObligation = (index: RecordIndex, id: string): boolean => {
  const kind = index.byId.get(id)?.kind;
  return !!kind && !!index.meta.kinds.get(kind)?.obligation;
};
