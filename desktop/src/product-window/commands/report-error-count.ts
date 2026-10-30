// Report a window's error count (LA-PLT-CMD14): the page's number of check errors, kept for the Dock badge.
import { parseErrorCount } from '../../dock.ts';
import type { ProductWindowRepository } from '../repository.ts';
import { holdToRules } from '../rules.ts';

export interface ReportErrorCount {
  folder: string;
  /** What the page sent, checked here. */
  count: unknown;
}

/** Whether the count was taken. */
export function reportErrorCount(windows: ProductWindowRepository, input: ReportErrorCount): boolean {
  const now = windows.load();
  const window = now.open.get(input.folder);
  const count = parseErrorCount(input.count);
  if (!window || count === null) return false;
  window.errors = count;
  holdToRules(now);
  windows.save(now);
  return true;
}
