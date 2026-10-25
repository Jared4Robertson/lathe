import { parseTheme, type ModeChoice, type Theme } from './theme';

// Where a person's themes are kept: the custom themes, the chosen theme and the Light, Dark or
// System choice. The web app keeps them in local storage; the desktop app (brief 47) can keep them
// in its user data by calling setThemeStore() with its own store before the app renders.
//
// The early script in app/index.html reads two of these keys itself, before first paint: the
// chosen theme's stylesheet and the mode. Keep the keys and their JSON in step with it.

export const STORAGE_KEYS = {
  themes: 'lathe:themes',
  chosen: 'lathe:theme',
  mode: 'lathe:color-mode',
  /** The chosen theme written as its stylesheet, so index.html can apply it before first paint. */
  css: 'lathe:theme-css',
} as const;

export interface ThemeState {
  custom: Theme[];
  chosen: string;
  mode: ModeChoice;
}

export interface ThemeStore {
  load(): Partial<ThemeState>;
  save(state: ThemeState, css: string): void;
}

const local = (): Storage | null => {
  try { return window.localStorage; } catch { return null; }
};

const readJson = (key: string): unknown => {
  try {
    const raw = local()?.getItem(key);
    return raw == null ? undefined : JSON.parse(raw);
  } catch {
    return undefined;
  }
};

/** Custom themes as stored: `{ id, basedOn, ...theme file }`. Each one is checked like an imported file; bad ones are dropped. */
function readCustom(value: unknown): Theme[] {
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

export const localThemeStore: ThemeStore = {
  load() {
    const chosen = readJson(STORAGE_KEYS.chosen);
    const mode = readJson(STORAGE_KEYS.mode);
    return {
      custom: readCustom(readJson(STORAGE_KEYS.themes)),
      chosen: typeof chosen === 'string' ? chosen : undefined,
      mode: mode === 'light' || mode === 'dark' || mode === 'system' ? mode : undefined,
    };
  },
  save(state, css) {
    const s = local();
    if (!s) return;
    try {
      s.setItem(STORAGE_KEYS.themes, JSON.stringify(state.custom.map(({ builtIn: _builtIn, ...rest }) => rest)));
      s.setItem(STORAGE_KEYS.chosen, JSON.stringify(state.chosen));
      s.setItem(STORAGE_KEYS.mode, JSON.stringify(state.mode));
      s.setItem(STORAGE_KEYS.css, css);
    } catch { /* storage full or blocked: the choice lasts until reload */ }
  },
};

let store: ThemeStore = localThemeStore;

/** The seam for another home for themes (the desktop app's user data). */
export function setThemeStore(next: ThemeStore) { store = next; }
export const themeStore = () => store;
