// Fold or unfold a nav section (LA-EXP-CMD22): a section of the nav (Tools) opens or folds, kept from one launch to the next.
import { holdToRules } from '../rules';
import { navRowRepository } from '../repository';

export interface FoldOrUnfoldNavSection {
  section: string;
  open: boolean;
}

/** Opens or folds a section of the nav. */
export function foldOrUnfoldNavSection(input: FoldOrUnfoldNavSection): void {
  const rows = navRowRepository.load();
  if ((rows.sections[input.section] !== false) === input.open) return;
  const next = { ...rows, sections: { ...rows.sections, [input.section]: input.open } };
  holdToRules(next);
  navRowRepository.save(next);
}
