// Open the nav's branch to the page (LA-EXP-CMD21): every row that holds the current page opens, on the nav's first draw and after a move made in the nav.
import { holdToRules } from '../rules';
import { navRowRepository } from '../repository';

export interface OpenNavBranch {
  /** The keys of the rows that hold the current page. */
  branch: readonly string[];
}

/** Opens every row of the branch that holds the current page. */
export function openNavBranch(input: OpenNavBranch): void {
  const rows = navRowRepository.load();
  if (input.branch.every((k) => rows.folders[k] === true)) return;
  const next = { ...rows, folders: { ...rows.folders, ...Object.fromEntries(input.branch.map((k) => [k, true])) } };
  holdToRules(next);
  navRowRepository.save(next);
}
