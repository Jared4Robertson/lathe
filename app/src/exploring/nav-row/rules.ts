import { refuseBroken, type RuleProblem } from '../../shell/prefs';
import type { NavRows } from './model';

// The Nav row aggregate's rules, held by every command before it saves.

/** Every problem with the rows as kept: each row has a key and is open or folded (nav-row-is-open-or-folded, LA-EXP-INV21). */
export function navRowProblems(rows: NavRows): RuleProblem[] {
  const problems: RuleProblem[] = [];
  for (const [what, map] of [['folder row', rows.folders], ['section', rows.sections]] as const) {
    for (const [key, open] of Object.entries(map)) {
      if (key.trim() === '') problems.push({ rule: 'nav-row-is-open-or-folded', message: `A ${what} has no key.` });
      if (typeof open !== 'boolean') problems.push({ rule: 'nav-row-is-open-or-folded', message: `The ${what} ${key} is neither open nor folded.` });
    }
  }
  return problems;
}

/** Refuses the rows with every problem they have. */
export function holdToRules(rows: NavRows): void {
  refuseBroken(navRowProblems(rows));
}
