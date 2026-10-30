import { refuseBroken, type RuleProblem } from '../../shell/prefs';
import { BUILT_IN_THEMES } from '../../theme/theme';
import { allThemes, type Appearance } from './model';

/**
 * What breaks the Appearance's rules: a theme without its light and dark sets (theme-has-light-and-dark,
 * LA-PLT-INV02), a built-in kept as the person's own or a theme of theirs with a built-in's ID (built-in-theme-unchanged,
 * LA-PLT-INV03), a chosen theme that does not exist (chosen-theme-exists, LA-PLT-INV04).
 */
export function appearanceProblems(appearance: Appearance): RuleProblem[] {
  const problems: RuleProblem[] = [];
  for (const t of appearance.custom) {
    if (!t.light || typeof t.light !== 'object' || !t.dark || typeof t.dark !== 'object') problems.push({ rule: 'theme-has-light-and-dark', message: `Theme "${t.name}" lacks its light or dark set.` });
    if (t.builtIn || BUILT_IN_THEMES.some((b) => b.id === t.id)) problems.push({ rule: 'built-in-theme-unchanged', message: `Theme "${t.name}" is a built-in, which is never changed.` });
  }
  if (!allThemes(appearance).some((t) => t.id === appearance.chosen)) problems.push({ rule: 'chosen-theme-exists', message: `The chosen theme ${appearance.chosen} does not exist.` });
  return problems;
}

/** Refuses an Appearance that breaks a rule, with every reason. */
export const holdToRules = (appearance: Appearance) => refuseBroken(appearanceProblems(appearance));
