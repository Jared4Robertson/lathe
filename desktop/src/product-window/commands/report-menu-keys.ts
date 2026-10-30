// Report a window's keys (LA-PLT-CMD59): the keys the person bound in the window's page, kept for the menu's key labels.
import { menuKeysFrom } from '../../menu.ts';
import type { ProductWindowRepository } from '../repository.ts';
import { holdToRules } from '../rules.ts';

export interface ReportMenuKeys {
  folder: string;
  /** What the page sent, checked here. */
  keys: unknown;
}

/** Whether the keys changed, so the menu shows them again. */
export function reportMenuKeys(windows: ProductWindowRepository, input: ReportMenuKeys): boolean {
  const now = windows.load();
  const window = now.open.get(input.folder);
  if (!window) return false;
  const keys = menuKeysFrom(input.keys);
  if (JSON.stringify(keys) === JSON.stringify(window.menuKeys ?? {})) return false;
  window.menuKeys = keys;
  holdToRules(now);
  windows.save(now);
  return true;
}
