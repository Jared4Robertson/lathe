import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { applyTheme } from './apply';
import { useDesktopChrome } from '../shell/desktopChrome';
import { useAggregate } from '../shell/prefs';
import { appearanceRepository } from '../platform/appearance/repository';
import { themesReader } from '../platform/appearance/reader';
import { getThemeFile, listThemes } from '../platform/appearance/queries';
import { chooseColorMode, chooseTheme } from '../platform/appearance/commands/handlers.generated';
import { duplicateTheme } from '../platform/appearance/commands/duplicate-theme';
import { importThemeFile } from '../platform/appearance/commands/import-theme-file';
import { editTheme } from '../platform/appearance/commands/edit-theme';
import { resetTheme } from '../platform/appearance/commands/reset-theme';
import { deleteTheme } from '../platform/appearance/commands/delete-theme';
import { BUILT_IN_THEMES, LATHE, type ModeChoice, type Theme, type ThemeFile } from './theme';

// The person's themes: the built-ins and their own, the one chosen, and the Light, Dark or System
// choice, read through the Themes read model (platform/appearance). Every change is one of the Appearance's commands,
// which keeps it, and applies at once (no reload). A preview (the theme picker arrowing through its list) applies
// without being kept, until it is kept or undone.

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
  const appearance = useAggregate(appearanceRepository);
  const reader = useMemo(() => themesReader(appearance), [appearance]);
  const { themes, active, mode } = useMemo(() => listThemes(reader), [reader]);
  const [shown, setShown] = useState<{ theme?: Theme; mode?: ModeChoice } | null>(null);

  // The stylesheet the early script in index.html reads is written with each save; the first run writes it too.
  useEffect(() => { appearanceRepository.save(appearanceRepository.load()); }, []);
  // Apply what shows.
  useEffect(() => { applyTheme(shown?.theme ?? active, shown?.mode ?? mode); }, [active, mode, shown]);

  // In the desktop app, the window's chrome follows what shows (LA-V67-R06).
  useDesktopChrome(shown?.theme ?? active, shown?.mode ?? mode);

  const choose = useCallback((id: string) => { setShown(null); chooseTheme({ id }); }, []);
  const setMode = useCallback((m: ModeChoice) => { setShown(null); chooseColorMode({ mode: m }); }, []);
  const preview = useCallback((p: { theme?: Theme; mode?: ModeChoice } | null) => setShown(p), []);
  const duplicate = useCallback((id: string) => { const copy = duplicateTheme({ id }); setShown(null); return copy; }, []);
  const update = useCallback((id: string, change: (file: ThemeFile) => ThemeFile) => editTheme({ id, change }), []);
  const remove = useCallback((id: string) => deleteTheme({ id }), []);
  const reset = useCallback((id: string) => resetTheme({ id }), []);
  const importFile = useCallback((text: string) => importThemeFile({ text }), []);
  const exportFile = useCallback((id: string) => getThemeFile(reader, { id }), [reader]);
  const basedOn = useCallback((id: string) => {
    const base = reader.theme(id)?.basedOn;
    return BUILT_IN_THEMES.find((t) => t.id === base) ?? LATHE;
  }, [reader]);

  const api = useMemo<ThemesApi>(() => ({
    themes, active, mode, choose, setMode, preview, duplicate, update, remove, reset, importFile, exportFile, basedOn,
  }), [themes, active, mode, choose, setMode, preview, duplicate, update, remove, reset, importFile, exportFile, basedOn]);

  return <ThemesContext.Provider value={api}>{children}</ThemesContext.Provider>;
}
