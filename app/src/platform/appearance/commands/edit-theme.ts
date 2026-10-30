// Edit a theme (LA-PLT-CMD07): the person changes a theme of their own, its tokens or its name.
import { parseTheme, toFile, type ThemeFile } from '../../../theme/theme';
import { appearanceRepository } from '../repository';
import { holdToRules } from '../rules';

export interface EditTheme { id: string; change: (file: ThemeFile) => ThemeFile }

/** Keeps the edited theme; an edit that does not make a valid theme file leaves it as it was. */
export function editTheme({ id, change }: EditTheme): void {
  const was = appearanceRepository.load();
  const next = {
    ...was,
    custom: was.custom.map((t) => {
      if (t.id !== id) return t;
      const parsed = parseTheme(toFile(change(toFile(t))));
      return parsed.ok ? { ...parsed.theme, id, builtIn: false, basedOn: t.basedOn } : t;
    }),
  };
  holdToRules(next);
  appearanceRepository.save(next);
}
