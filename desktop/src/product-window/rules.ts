// The Product window's rule (one-window-per-folder, LA-PLT-INV05): each folder has one window, open under its own folder.
import path from 'node:path';
import { holdTo, type RuleProblem } from '../rules.ts';
import type { ProductWindows } from './model.ts';

export function productWindowProblems(windows: ProductWindows): RuleProblem[] {
  const problems: RuleProblem[] = [];
  const seen = new Set<unknown>();
  for (const [folder, window] of windows.open) {
    if (window.folder !== folder) problems.push({ rule: 'one-window-per-folder', message: `The window for ${window.folder} is kept under ${folder}.` });
    if (path.resolve(folder) !== folder) problems.push({ rule: 'one-window-per-folder', message: `The window for ${folder} is not kept under its full path.` });
    if (seen.has(window.win)) problems.push({ rule: 'one-window-per-folder', message: `One window shows ${folder} and another folder.` });
    seen.add(window.win);
  }
  return problems;
}

/** Refuses windows that break a rule, with every reason. */
export function holdToRules(windows: ProductWindows): void {
  holdTo(productWindowProblems(windows));
}
