import { COLOR_NAMES, COLOR_TOKENS, SETTING_NAMES, isColorValue, isSettingValue, type SettingToken } from './tokens';
import latheFile from './themes/lathe.json';
import highContrastFile from './themes/high-contrast.json';
import workshopFile from './themes/workshop.json';
import midnightFile from './themes/midnight.json';
import graphiteFile from './themes/graphite.json';

// A theme is data that sets tokens (LA-PAT-APP-CODE-R15): a light set and a dark set of color
// tokens, and the tokens for type, shape, density and motion that serve both modes. The same
// small, versioned file format holds a built-in theme, an exported one, and one to import.

export type Mode = 'light' | 'dark';
/** What the person chose: follow the system (the default), or always light or dark. */
export type ModeChoice = 'system' | Mode;
export const MODE_CHOICES: readonly ModeChoice[] = ['system', 'light', 'dark'];
export const MODE_LABELS: Record<ModeChoice, string> = { system: 'System', light: 'Light', dark: 'Dark' };

export type TokenValues = Record<string, string>;

/** A theme as a file holds it: `format`, `version`, `name`, and token names with their values. */
export interface ThemeFile {
  format: 'lathe-theme';
  version: 1;
  name: string;
  light: TokenValues;
  dark: TokenValues;
  tokens: TokenValues;
}

export interface Theme extends ThemeFile {
  id: string;
  builtIn: boolean;
  /** For a custom theme, the built-in it was copied from, which Reset goes back to. Kept beside the file, not in it. */
  basedOn?: string;
}

export const THEME_FORMAT = 'lathe-theme';
export const THEME_VERSION = 1;
const FILE_KEYS = new Set(['format', 'version', 'name', 'light', 'dark', 'tokens']);

export type ParseResult = { ok: true; theme: ThemeFile } | { ok: false; error: string };

const isRecord = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);

/**
 * Reads a theme file: it must say its format and version, and hold token names only, each with a
 * value of its kind. Core colors a file leaves out are taken from Lathe, so a partial file works.
 */
export function parseTheme(input: unknown): ParseResult {
  if (!isRecord(input)) return { ok: false, error: 'A theme file is a JSON object.' };
  if (input.format !== THEME_FORMAT) return { ok: false, error: `This is not a theme file: "format" must be "${THEME_FORMAT}".` };
  if (input.version !== THEME_VERSION) return { ok: false, error: `This theme file is version ${String(input.version)}; Lathe reads version ${THEME_VERSION}.` };
  const extra = Object.keys(input).filter((k) => !FILE_KEYS.has(k));
  if (extra.length) return { ok: false, error: `Unknown field${extra.length > 1 ? 's' : ''}: ${extra.join(', ')}.` };
  const name = typeof input.name === 'string' ? input.name.trim() : '';
  if (!name || name.length > 60) return { ok: false, error: 'The theme needs a name of 1 to 60 characters.' };
  const sets: Partial<Record<'light' | 'dark' | 'tokens', TokenValues>> = {};
  for (const key of ['light', 'dark', 'tokens'] as const) {
    const set = input[key] ?? {};
    if (!isRecord(set)) return { ok: false, error: `"${key}" must be an object of token names and values.` };
    const out: TokenValues = {};
    for (const [token, value] of Object.entries(set)) {
      const known = key === 'tokens' ? SETTING_NAMES.has(token) : COLOR_NAMES.has(token);
      if (!known) return { ok: false, error: `"${token}" is not a ${key === 'tokens' ? 'type, shape or motion' : 'color'} token a theme can set.` };
      if (typeof value !== 'string') return { ok: false, error: `${token} must be a string.` };
      const valid = key === 'tokens' ? isSettingValue(token as SettingToken, value) : isColorValue(value);
      if (!valid) return { ok: false, error: `${token}: "${value}" is not a value it takes.` };
      out[token] = value.trim();
    }
    sets[key] = out;
  }
  const theme: ThemeFile = { format: THEME_FORMAT, version: THEME_VERSION, name, light: sets.light!, dark: sets.dark!, tokens: sets.tokens! };
  return { ok: true, theme: completeCore(theme) };
}

/** Every theme sets the core colors in both modes; any it leaves out come from Lathe's. */
function completeCore(theme: ThemeFile): ThemeFile {
  const light = { ...theme.light };
  const dark = { ...theme.dark };
  for (const t of COLOR_TOKENS) {
    if (!t.core) continue;
    light[t.name] ??= LATHE_FILE.light[t.name];
    dark[t.name] ??= LATHE_FILE.dark[t.name];
  }
  return { ...theme, light, dark };
}

/** The file for a theme, as exported: the format, its name and its tokens, in a stable order. */
export function toFile(theme: ThemeFile): ThemeFile {
  const order = (set: TokenValues, names: readonly string[]) => Object.fromEntries(names.filter((n) => set[n] !== undefined).map((n) => [n, set[n]]));
  const colors = COLOR_TOKENS.map((t) => t.name);
  return {
    format: THEME_FORMAT,
    version: THEME_VERSION,
    name: theme.name,
    light: order(theme.light, colors),
    dark: order(theme.dark, colors),
    tokens: order(theme.tokens, [...SETTING_NAMES]),
  };
}

const LATHE_FILE = latheFile as ThemeFile;

function builtIn(id: string, file: unknown): Theme {
  const parsed = parseTheme(file);
  if (!parsed.ok) throw new Error(`Built-in theme ${id}: ${parsed.error}`);
  return { ...parsed.theme, id, builtIn: true };
}

/** The built-in themes, Lathe first. Their files are in app/src/theme/themes/. */
export const BUILT_IN_THEMES: readonly Theme[] = [
  builtIn('lathe', latheFile),
  builtIn('high-contrast', highContrastFile),
  builtIn('workshop', workshopFile),
  builtIn('midnight', midnightFile),
  builtIn('graphite', graphiteFile),
];

export const DEFAULT_THEME_ID = 'lathe';
export const LATHE = BUILT_IN_THEMES[0];

/**
 * A token's value in a mode, as the stylesheet resolves it: the mode's own value, else the light
 * one (which serves both modes), else Lathe's, which is the stylesheet's own `:root`.
 */
export function tokenValue(theme: ThemeFile, mode: Mode, token: string): string | undefined {
  if (SETTING_NAMES.has(token)) return theme.tokens[token] ?? LATHE.tokens[token];
  return theme[mode][token] ?? theme.light[token] ?? (mode === 'dark' ? LATHE.dark[token] : undefined) ?? LATHE.light[token];
}

/** A token's value with every `var(--x)` it refers to followed, so it can be drawn or measured. */
export function resolvedValue(theme: ThemeFile, mode: Mode, token: string, depth = 0): string | undefined {
  const v = tokenValue(theme, mode, token);
  const ref = v?.match(/^var\((--[a-z0-9-]+)\)$/)?.[1];
  if (ref && depth < 8) return resolvedValue(theme, mode, ref, depth + 1);
  return v;
}

/** A theme's id, made from its name and unique among the given ones. */
export function newThemeId(name: string, taken: readonly string[]): string {
  const base = `custom-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'theme'}`;
  let id = base;
  for (let n = 2; taken.includes(id); n++) id = `${base}-${n}`;
  return id;
}

/** A name not yet used: "Workshop copy", "Workshop copy 2". */
export function freshName(name: string, taken: readonly string[]): string {
  const base = `${name} copy`.slice(0, 60);
  let out = base;
  for (let n = 2; taken.includes(out); n++) out = `${base} ${n}`;
  return out;
}
