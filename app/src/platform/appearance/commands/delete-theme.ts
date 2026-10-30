// Delete a theme (LA-PLT-CMD09): the person removes a theme of their own; the theme in use goes back to Lathe.
import { DEFAULT_THEME_ID } from '../../../theme/theme';
import { appearanceRepository } from '../repository';
import { holdToRules } from '../rules';

export interface DeleteTheme { id: string }

/** Removes the theme, and chooses Lathe when it was the chosen one. */
export function deleteTheme({ id }: DeleteTheme): void {
  const was = appearanceRepository.load();
  const next = { ...was, custom: was.custom.filter((t) => t.id !== id), chosen: was.chosen === id ? DEFAULT_THEME_ID : was.chosen };
  holdToRules(next);
  appearanceRepository.save(next);
}
