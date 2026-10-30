// Fold or unfold a nav row (LA-EXP-CMD03): an open row folds; a folded one opens, and when it holds the current page, so does its branch down to the page.
import { holdToRules } from '../rules';
import { navRowRepository } from '../repository';

export interface FoldOrUnfoldNavRow {
  /** The row's key. */
  key: string;
  /** The keys of the rows that hold the current page, outermost first. */
  branch: readonly string[];
}

/** Folds an open row, or opens a folded one with the branch below it that holds the current page. */
export function foldOrUnfoldNavRow(input: FoldOrUnfoldNavRow): void {
  const rows = navRowRepository.load();
  const at = input.branch.indexOf(input.key);
  const change = rows.folders[input.key] === true
    ? { [input.key]: false }
    : Object.fromEntries((at >= 0 ? input.branch.slice(at) : [input.key]).map((k) => [k, true]));
  const next = { ...rows, folders: { ...rows.folders, ...change } };
  holdToRules(next);
  navRowRepository.save(next);
}
