// Duplicate a theme (LA-PLT-CMD05): the person makes an editable copy of a theme, which is chosen at once.
import { DEFAULT_THEME_ID, LATHE, freshName, newThemeId, toFile, type Theme } from '../../../theme/theme';
import { allThemes } from '../model';
import { appearanceRepository } from '../repository';
import { holdToRules } from '../rules';

export interface DuplicateTheme { id: string }

/** Adds a copy of the theme under a fresh name, chooses it, and returns its ID. */
export function duplicateTheme({ id }: DuplicateTheme): string {
  const was = appearanceRepository.load();
  const themes = allThemes(was);
  const source = themes.find((t) => t.id === id) ?? LATHE;
  const name = freshName(source.name, themes.map((t) => t.name));
  const basedOn = source.builtIn ? source.id : source.basedOn ?? DEFAULT_THEME_ID;
  const copy: Theme = { ...toFile(source), name, id: newThemeId(name, themes.map((t) => t.id)), builtIn: false, basedOn };
  const next = { ...was, custom: [...was.custom, copy], chosen: copy.id };
  holdToRules(next);
  appearanceRepository.save(next);
  return copy.id;
}
