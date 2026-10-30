// Reset a theme (LA-PLT-CMD08): the person puts a theme of their own back to the built-in it was copied from, keeping its name.
import { BUILT_IN_THEMES, LATHE, toFile } from '../../../theme/theme';
import { appearanceRepository } from '../repository';
import { holdToRules } from '../rules';

export interface ResetTheme { id: string }

/** Gives the theme its built-in's tokens again (Lathe's when it has none), under its own name. */
export function resetTheme({ id }: ResetTheme): void {
  const was = appearanceRepository.load();
  const next = {
    ...was,
    custom: was.custom.map((t) => {
      if (t.id !== id) return t;
      const base = BUILT_IN_THEMES.find((b) => b.id === t.basedOn) ?? LATHE;
      return { ...toFile(base), name: t.name, id, builtIn: false, basedOn: t.basedOn };
    }),
  };
  holdToRules(next);
  appearanceRepository.save(next);
}
