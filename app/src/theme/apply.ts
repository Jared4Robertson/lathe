import { themeCss } from './css';
import type { ModeChoice, ThemeFile } from './theme';

// Puts a theme on the page at once, without a reload: its stylesheet in one <style> element, and
// the person's mode as `data-mode` on <html>. The early script in app/index.html does the same
// before first paint, from the stylesheet saved in storage.

export const STYLE_ID = 'lathe-theme';

export function applyTheme(theme: ThemeFile & { id: string }, mode: ModeChoice, doc: Document = document): string {
  const css = themeCss(theme);
  let style = doc.getElementById(STYLE_ID) as HTMLStyleElement | null;
  if (!style) {
    style = doc.createElement('style');
    style.id = STYLE_ID;
    doc.head.appendChild(style);
  }
  if (style.textContent !== css) style.textContent = css;
  const root = doc.documentElement;
  root.setAttribute('data-theme', theme.id);
  if (mode === 'system') root.removeAttribute('data-mode');
  else root.setAttribute('data-mode', mode);
  return css;
}

/** The mode the page shows now: the chosen one, or the system's. */
export function shownMode(mode: ModeChoice): 'light' | 'dark' {
  if (mode !== 'system') return mode;
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}
