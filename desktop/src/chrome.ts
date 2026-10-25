// The window's chrome: no system title bar, so the app draws its own (app/src/shell/DesktopTitleBar.tsx)
// with the window's controls over it, as in VS Code. On macOS the traffic lights float, centered in
// the app's 38 px bar; on Windows and Linux the native controls draw as an overlay in the theme's
// colors. The page sends its theme's colors through the preload's setChrome, and parseChrome checks
// them here, in the main process, before any reaches the window.

/** The app's title bar height, in CSS pixels (app/src/shell/DesktopTitleBar.css). */
export const TITLE_BAR_HEIGHT = 38;

/** Where the traffic lights sit on macOS: their 14 px buttons centered in the bar. */
export const TRAFFIC_LIGHTS = { x: 14, y: Math.round((TITLE_BAR_HEIGHT - 14) / 2) };

/** The colors of the window's chrome: the shell behind the bar and the ink its symbols take. */
export interface Chrome {
  background: string;
  foreground: string;
}

/** The Lathe theme's shell and ink (app/src/styles.css), used until the page sends its own. */
export const DEFAULT_CHROME: Record<'light' | 'dark', Chrome> = {
  light: { background: '#DDE3E6', foreground: '#1D2830' },
  dark: { background: '#0A0F12', foreground: '#E2E8EA' },
};

const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;

/** One opaque color as #RRGGBB, from #rgb or #rrggbb; null for anything else. */
export function parseHexColor(value: unknown): string | null {
  if (typeof value !== 'string' || !HEX.test(value)) return null;
  const digits = value.slice(1);
  const full = digits.length === 3 ? [...digits].map((c) => c + c).join('') : digits;
  return `#${full.toUpperCase()}`;
}

/** The chrome a page asked for, when it is exactly { background, foreground } with two opaque hex colors; else null. */
export function parseChrome(input: unknown): Chrome | null {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) return null;
  const keys = Object.keys(input).sort();
  if (keys.length !== 2 || keys[0] !== 'background' || keys[1] !== 'foreground') return null;
  const { background, foreground } = input as Record<string, unknown>;
  const bg = parseHexColor(background);
  const fg = parseHexColor(foreground);
  return bg && fg ? { background: bg, foreground: fg } : null;
}

/** The overlay the native window controls draw on Windows and Linux. */
export function titleBarOverlay(chrome: Chrome) {
  return { color: chrome.background, symbolColor: chrome.foreground, height: TITLE_BAR_HEIGHT };
}

export interface ChromeWindowOptions {
  titleBarStyle: 'hidden';
  trafficLightPosition?: { x: number; y: number };
  titleBarOverlay?: { color: string; symbolColor: string; height: number };
  backgroundColor: string;
}

/**
 * The chrome the pages last sent, by the system's appearance at the time, kept in the user data
 * folder so a new window opens in the theme's shell color rather than the default (LA-PLT-UC14-R10).
 */
export type SavedChrome = Partial<Record<'light' | 'dark', Chrome>>;

/** Reads saved chrome, keeping only valid colors. */
export function parseSavedChrome(raw: unknown): SavedChrome {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const saved: SavedChrome = {};
  for (const mode of ['light', 'dark'] as const) {
    const chrome = parseChrome((raw as Record<string, unknown>)[mode]);
    if (chrome) saved[mode] = chrome;
  }
  return saved;
}

/** The chrome a new window takes in the system's appearance: the last the pages sent, else Lathe's own. */
export function startChrome(saved: SavedChrome, dark: boolean): Chrome {
  return saved[dark ? 'dark' : 'light'] ?? DEFAULT_CHROME[dark ? 'dark' : 'light'];
}

/** The title bar options of a new window on a platform, in the system's light or dark appearance. */
export function chromeWindowOptions(platform: NodeJS.Platform, dark: boolean, saved: SavedChrome = {}): ChromeWindowOptions {
  const chrome = startChrome(saved, dark);
  if (platform === 'darwin') return { titleBarStyle: 'hidden', trafficLightPosition: { ...TRAFFIC_LIGHTS }, backgroundColor: chrome.background };
  return { titleBarStyle: 'hidden', titleBarOverlay: titleBarOverlay(chrome), backgroundColor: chrome.background };
}

/** The part of a window applyChrome changes, so tests can stand in for a BrowserWindow. */
export interface ChromeTarget {
  setBackgroundColor(color: string): void;
  setTitleBarOverlay?(options: { color?: string; symbolColor?: string; height?: number }): void;
}

/**
 * Applies what a page sent, after checking it: the window's background, and on Windows and Linux
 * the controls' overlay. Returns the chrome applied, or null when the input was refused.
 */
export function applyChrome(win: ChromeTarget, platform: NodeJS.Platform, input: unknown): Chrome | null {
  const chrome = parseChrome(input);
  if (!chrome) return null;
  win.setBackgroundColor(chrome.background);
  if (platform !== 'darwin') win.setTitleBarOverlay?.(titleBarOverlay(chrome));
  return chrome;
}
