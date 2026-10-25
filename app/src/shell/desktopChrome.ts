import { useEffect, useState } from 'react';
import { parseColor, toHex } from '../theme/contrast';
import { resolvedValue, type Mode, type ModeChoice, type ThemeFile } from '../theme/theme';

// The desktop app's bridge (desktop/src/preload.cts; its type is Window['latheDesktop'] in
// commands.tsx), and the window chrome the theme sends it: the shell color behind the app's title bar
// and the ink its symbols take, so the native window controls match the theme (LA-DSK-UC04-R06).

export interface Chrome {
  background: string;
  foreground: string;
}

/** The desktop shell's bridge, when the app runs in it. */
export function desktopBridge(): LatheDesktop | null {
  if (typeof window === 'undefined') return null;
  const bridge = window.latheDesktop;
  return bridge?.isDesktop ? bridge : null;
}

/** A theme color as opaque #rrggbb, the only form the shell takes; null when it is not opaque or not a color. */
function opaqueHex(value: string | undefined): string | null {
  const rgba = value ? parseColor(value) : null;
  return rgba && rgba[3] === 1 ? toHex(rgba) : null;
}

/** The chrome of a theme in a mode: its --shell and --ink, or null when either is not an opaque color. */
export function chromeOf(theme: ThemeFile, mode: Mode): Chrome | null {
  const background = opaqueHex(resolvedValue(theme, mode, '--shell'));
  const foreground = opaqueHex(resolvedValue(theme, mode, '--ink'));
  return background && foreground ? { background, foreground } : null;
}

const DARK_QUERY = '(prefers-color-scheme: dark)';

/** Whether the system is dark now, following its changes while the person's mode is System. */
function useSystemDark(follow: boolean) {
  const query = () => (typeof window.matchMedia === 'function' ? window.matchMedia(DARK_QUERY) : null);
  const [dark, setDark] = useState(() => query()?.matches ?? false);
  useEffect(() => {
    const list = follow ? query() : null;
    if (!list) return;
    const update = () => setDark(list.matches);
    update();
    list.addEventListener?.('change', update);
    return () => list.removeEventListener?.('change', update);
  }, [follow]);
  return dark;
}

/** In the desktop app, sends the shown theme's chrome to the window whenever the theme, the mode or the system's appearance changes. */
export function useDesktopChrome(theme: ThemeFile, mode: ModeChoice) {
  const bridge = desktopBridge();
  const systemDark = useSystemDark(!!bridge && mode === 'system');
  const shown: Mode = mode === 'system' ? (systemDark ? 'dark' : 'light') : mode;
  const chrome = chromeOf(theme, shown);
  const key = chrome ? `${chrome.background} ${chrome.foreground}` : '';
  useEffect(() => {
    if (!chrome || !bridge) return;
    bridge.setChrome(chrome);
    // The key holds the colors; the chrome object is new on every render.
  }, [key, bridge]);
}
