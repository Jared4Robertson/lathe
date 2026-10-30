import { BUILT_IN_THEMES, LATHE, type ModeChoice, type Theme } from '../../theme/theme';

// Themes (LA-PLT-RM03): every theme the person can choose, the built-ins first, with the one chosen and the mode,
// shaped for the theme picker, the Appearance page and the theme file it hands out.

/** What the projection reads: the person's own themes, the chosen theme's ID and the mode, as kept. */
export interface ThemesSource { custom: readonly Theme[]; chosen: string; mode: ModeChoice }

/** The read model's table, kept in memory. */
export interface ThemesTable {
  themes: readonly Theme[];
  byId: ReadonlyMap<string, Theme>;
  active: Theme;
  mode: ModeChoice;
}

/** Builds the Themes table: the only code that reads the kept Appearance for the queries. */
export function themesTableFrom(source: ThemesSource): ThemesTable {
  const themes = [...BUILT_IN_THEMES, ...source.custom];
  const byId = new Map(themes.map((t) => [t.id, t]));
  return { themes, byId, active: byId.get(source.chosen) ?? LATHE, mode: source.mode };
}
