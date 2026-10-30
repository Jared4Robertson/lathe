import { BUILT_IN_THEMES, DEFAULT_THEME_ID, LATHE, parseTheme, type ModeChoice, type Theme } from '../../theme/theme';

// Appearance (LA-PLT-A4): the person's own themes, the theme chosen and the Light, Dark or System choice. The built-in
// themes are code (theme/theme.ts) and are never kept or changed: a person changes one only through a copy of their own.

export interface Appearance {
  /** The person's own themes, each a copy of a built-in or an imported file. */
  custom: readonly Theme[];
  /** The chosen theme's ID: a built-in's or one of `custom`. */
  chosen: string;
  mode: ModeChoice;
}

/** Every theme there is: the built-ins first, then the person's own. */
export const allThemes = (appearance: Appearance): readonly Theme[] => [...BUILT_IN_THEMES, ...appearance.custom];

/** The chosen theme (Lathe when it is gone). */
export const chosenTheme = (appearance: Appearance): Theme => allThemes(appearance).find((t) => t.id === appearance.chosen) ?? LATHE;

/** Custom themes as stored, `{ id, basedOn, ...theme file }`: each one is checked like an imported file, and bad ones are dropped. */
export function customThemesFrom(value: unknown): Theme[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item): Theme[] => {
    if (!item || typeof item !== 'object') return [];
    const { id, basedOn, ...file } = item as { id?: unknown; basedOn?: unknown };
    if (typeof id !== 'string' || !/^custom-[a-z0-9-]+$/.test(id)) return [];
    const parsed = parseTheme(file);
    if (!parsed.ok) return [];
    return [{ ...parsed.theme, id, builtIn: false, ...(typeof basedOn === 'string' ? { basedOn } : {}) }];
  });
}

/** The Appearance from its stored parts; a chosen theme that is gone reads as Lathe, an unknown mode as System. */
export function appearanceFrom(custom: unknown, chosen: unknown, mode: unknown): Appearance {
  const themes = customThemesFrom(custom);
  const all = [...BUILT_IN_THEMES, ...themes];
  return {
    custom: themes,
    chosen: typeof chosen === 'string' && all.some((t) => t.id === chosen) ? chosen : DEFAULT_THEME_ID,
    mode: mode === 'light' || mode === 'dark' || mode === 'system' ? mode : 'system',
  };
}
