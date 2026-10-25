import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { applyTheme } from './apply';
import { useDesktopChrome } from '../shell/desktopChrome';
import { themeStore, type ThemeState } from './store';
import {
  BUILT_IN_THEMES,
  DEFAULT_THEME_ID,
  LATHE,
  freshName,
  newThemeId,
  parseTheme,
  toFile,
  type ModeChoice,
  type Theme,
  type ThemeFile,
} from './theme';

// The person's themes: the built-ins and their own, the one chosen, and the Light, Dark or System
// choice. Every change applies at once (no reload) and is kept in the theme store. A preview (the
// theme picker arrowing through its list) applies without being kept, until it is kept or undone.

export interface ThemesApi {
  themes: readonly Theme[];
  /** The chosen theme (Lathe when the chosen one is gone). */
  active: Theme;
  mode: ModeChoice;
  choose: (id: string) => void;
  setMode: (mode: ModeChoice) => void;
  /** Shows a theme or mode on the page without keeping it; null puts back what is chosen. */
  preview: (p: { theme?: Theme; mode?: ModeChoice } | null) => void;
  /** Makes an editable copy of a theme, chooses it, and returns its id. */
  duplicate: (id: string) => string;
  /** Saves an edited custom theme (its tokens or its name). */
  update: (id: string, change: (file: ThemeFile) => ThemeFile) => void;
  remove: (id: string) => void;
  /** Puts a custom theme back to the theme it was copied from. */
  reset: (id: string) => void;
  /** Reads a theme file and adds it as a custom theme, or says what is wrong with it. */
  importFile: (text: string) => { ok: true; theme: Theme } | { ok: false; error: string };
  exportFile: (id: string) => string;
  basedOn: (id: string) => Theme;
}

const ThemesContext = createContext<ThemesApi | null>(null);

export function useThemes(): ThemesApi {
  const api = useContext(ThemesContext);
  if (!api) throw new Error('useThemes needs a ThemeProvider');
  return api;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ThemeState>(() => {
    const loaded = themeStore().load();
    return { custom: loaded.custom ?? [], chosen: loaded.chosen ?? DEFAULT_THEME_ID, mode: loaded.mode ?? 'system' };
  });
  const [shown, setShown] = useState<{ theme?: Theme; mode?: ModeChoice } | null>(null);

  const themes = useMemo(() => [...BUILT_IN_THEMES, ...state.custom], [state.custom]);
  const active = themes.find((t) => t.id === state.chosen) ?? LATHE;

  // Apply what shows; keep what is chosen. The first run also writes the stylesheet index.html reads.
  const kept = useRef('');
  useEffect(() => {
    const css = applyTheme(shown?.theme ?? active, shown?.mode ?? state.mode);
    if (shown) return;
    const key = JSON.stringify([state, css]);
    if (kept.current === key) return;
    kept.current = key;
    themeStore().save(state, css);
  }, [active, state, shown]);

  // In the desktop app, the window's chrome follows what shows (LA-PLT-UC14-R06).
  useDesktopChrome(shown?.theme ?? active, shown?.mode ?? state.mode);

  const choose = useCallback((id: string) => { setShown(null); setState((s) => ({ ...s, chosen: id })); }, []);
  const setMode = useCallback((mode: ModeChoice) => { setShown(null); setState((s) => ({ ...s, mode })); }, []);
  const preview = useCallback((p: { theme?: Theme; mode?: ModeChoice } | null) => setShown(p), []);

  const duplicate = useCallback((id: string) => {
    const source = themes.find((t) => t.id === id) ?? LATHE;
    const name = freshName(source.name, themes.map((t) => t.name));
    const basedOn = source.builtIn ? source.id : source.basedOn ?? DEFAULT_THEME_ID;
    const copy: Theme = { ...toFile(source), name, id: newThemeId(name, themes.map((t) => t.id)), builtIn: false, basedOn };
    setState((s) => ({ ...s, custom: [...s.custom, copy], chosen: copy.id }));
    setShown(null);
    return copy.id;
  }, [themes]);

  const update = useCallback((id: string, change: (file: ThemeFile) => ThemeFile) => {
    setState((s) => ({
      ...s,
      custom: s.custom.map((t) => {
        if (t.id !== id) return t;
        const parsed = parseTheme(toFile(change(toFile(t))));
        return parsed.ok ? { ...parsed.theme, id, builtIn: false, basedOn: t.basedOn } : t;
      }),
    }));
  }, []);

  const remove = useCallback((id: string) => {
    setState((s) => ({ ...s, custom: s.custom.filter((t) => t.id !== id), chosen: s.chosen === id ? DEFAULT_THEME_ID : s.chosen }));
  }, []);

  const basedOn = useCallback((id: string) => {
    const base = themes.find((t) => t.id === id)?.basedOn;
    return BUILT_IN_THEMES.find((t) => t.id === base) ?? LATHE;
  }, [themes]);

  const reset = useCallback((id: string) => {
    const base = basedOn(id);
    update(id, (file) => ({ ...toFile(base), name: file.name }));
  }, [basedOn, update]);

  const importFile = useCallback((text: string) => {
    let json: unknown;
    try { json = JSON.parse(text); } catch { return { ok: false as const, error: 'The file is not JSON.' }; }
    const parsed = parseTheme(json);
    if (!parsed.ok) return parsed;
    const name = themes.some((t) => t.name === parsed.theme.name) ? freshName(parsed.theme.name, themes.map((t) => t.name)) : parsed.theme.name;
    const theme: Theme = { ...parsed.theme, name, id: newThemeId(name, themes.map((t) => t.id)), builtIn: false };
    setState((s) => ({ ...s, custom: [...s.custom, theme] }));
    return { ok: true as const, theme };
  }, [themes]);

  const exportFile = useCallback((id: string) => `${JSON.stringify(toFile(themes.find((t) => t.id === id) ?? LATHE), null, 2)}\n`, [themes]);

  const api = useMemo<ThemesApi>(() => ({
    themes, active, mode: state.mode, choose, setMode, preview, duplicate, update, remove, reset, importFile, exportFile, basedOn,
  }), [themes, active, state.mode, choose, setMode, preview, duplicate, update, remove, reset, importFile, exportFile, basedOn]);

  return <ThemesContext.Provider value={api}>{children}</ThemesContext.Provider>;
}
