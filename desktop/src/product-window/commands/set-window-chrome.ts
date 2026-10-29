// Set a window's chrome (LA-PLT-CMD13): the page's theme colors, checked, color the window's chrome and launch view,
// and are kept for the system's appearance, so the next window opens in them.
import { applyChrome, type Chrome } from '../../chrome.ts';
import type { ProductWindowRepository } from '../repository.ts';
import { holdToRules } from '../rules.ts';

export interface SetWindowChrome {
  folder: string;
  /** What the page sent, checked here. */
  chrome: unknown;
  dark: boolean;
  platform: NodeJS.Platform;
}

/** The chrome applied, or null when the page's colors were refused. */
export function setWindowChrome(windows: ProductWindowRepository, input: SetWindowChrome): Chrome | null {
  const now = windows.load();
  const window = now.open.get(input.folder);
  if (!window) return null;
  const chrome = applyChrome(window.win, input.platform, input.chrome);
  if (!chrome) return null;
  window.chrome = chrome;
  window.overlay?.view.setBackgroundColor(chrome.background);
  const mode = input.dark ? 'dark' : 'light';
  const kept = now.chrome[mode];
  const next = kept?.background === chrome.background && kept.foreground === chrome.foreground ? now : { ...now, chrome: { ...now.chrome, [mode]: chrome } };
  holdToRules(next);
  windows.save(next);
  return chrome;
}
