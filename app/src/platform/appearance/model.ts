import type { BrowserStorage, StoredParts } from '../../shell/storage';
import { themeCss } from '../../theme/css';
import { BUILT_IN_THEMES, DEFAULT_THEME_ID, LATHE, parseTheme, type ModeChoice, type Theme } from '../../theme/theme';

// Appearance (LA-PLT-A4): the person's own themes, the theme chosen, the Light, Dark or System choice, and whether scroll
// zooms the stages' cameras (Scroll to zoom, graph/gestures.ts's wheelMove). The built-in themes are code (theme/theme.ts)
// and are never kept or changed: a person changes one only through a copy of their own.

export interface Appearance {
  /** The person's own themes, each a copy of a built-in or an imported file. */
  custom: readonly Theme[];
  /** The chosen theme's ID: a built-in's or one of `custom`. */
  chosen: string;
  mode: ModeChoice;
  /** Scroll to zoom: on, scroll zooms the Graph's, the ERD's and the Trace's cameras and Cmd or Ctrl with scroll pans; off (the default), scroll pans. */
  scrollToZoom: boolean;
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

/**
 * Where the Appearance is kept, as JSON in local storage: the person's own themes, the chosen theme's ID, the mode,
 * Scroll to zoom, and the chosen theme written as its stylesheet. The early script in app/index.html reads the mode,
 * the chosen theme and its stylesheet itself, before first paint: keep these keys and their JSON in step with it. Its
 * repository is generated from it.
 */
export const APPEARANCE_STORAGE = {
  themes: { key: 'lathe:themes', store: 'local' },
  chosen: { key: 'lathe:theme', store: 'local' },
  mode: { key: 'lathe:color-mode', store: 'local' },
  scrollToZoom: { key: 'lathe:scroll-to-zoom', store: 'local' },
  css: { key: 'lathe:theme-css', store: 'local' },
} as const satisfies BrowserStorage;

/** The Appearance from its stored parts; a chosen theme that is gone reads as Lathe, an unknown mode as System, Scroll to zoom anything but true as off. The stylesheet is only written. */
export function appearanceFrom({ themes: stored, chosen, mode, scrollToZoom }: StoredParts<typeof APPEARANCE_STORAGE>): Appearance {
  const themes = customThemesFrom(stored);
  const all = [...BUILT_IN_THEMES, ...themes];
  return {
    custom: themes,
    chosen: typeof chosen === 'string' && all.some((t) => t.id === chosen) ? chosen : DEFAULT_THEME_ID,
    mode: mode === 'light' || mode === 'dark' || mode === 'system' ? mode : 'system',
    scrollToZoom: scrollToZoom === true,
  };
}

/** The Appearance in its stored form, with the chosen theme's stylesheet for the early script. */
export const appearanceStored = (appearance: Appearance): { [P in keyof typeof APPEARANCE_STORAGE]: unknown } => ({
  themes: appearance.custom.map(({ builtIn: _builtIn, ...rest }) => rest),
  chosen: appearance.chosen,
  mode: appearance.mode,
  scrollToZoom: appearance.scrollToZoom,
  css: themeCss(chosenTheme(appearance)),
});

/**
 * What each command that sets one setting keeps, by its handler: its input's one field and the setting's place in the
 * Appearance. Its handlers are generated from it. @public (read by `npm run generate`)
 */
export const APPEARANCE_SETS = {
  chooseColorMode: { mode: 'mode' },
  chooseTheme: { id: 'chosen' },
  turnScrollToZoomOnOrOff: { on: 'scrollToZoom' },
} as const;
