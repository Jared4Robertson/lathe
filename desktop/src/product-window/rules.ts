// The Product window's rule (LA-PLT-INV05): each folder has one window, open under its own folder.
import path from 'node:path';
import type { ProductWindows } from './model.ts';

export function productWindowProblems(windows: ProductWindows): string[] {
  const problems: string[] = [];
  const seen = new Set<unknown>();
  for (const [folder, window] of windows.open) {
    if (window.folder !== folder) problems.push(`The window for ${window.folder} is kept under ${folder}.`);
    if (path.resolve(folder) !== folder) problems.push(`The window for ${folder} is not kept under its full path.`);
    if (seen.has(window.win)) problems.push(`One window shows ${folder} and another folder.`);
    seen.add(window.win);
  }
  return problems;
}

/** Refuses windows that break a rule, with every reason. */
export function holdToRules(windows: ProductWindows): void {
  const problems = productWindowProblems(windows);
  if (problems.length) throw new Error(problems.join(' '));
}
