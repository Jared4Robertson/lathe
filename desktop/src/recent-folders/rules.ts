// The Recent folders' rule (LA-PLT-INV14): each folder once, as a full path, at most RECENT_LIMIT. Latest first is
// how addRecent builds the list.
import path from 'node:path';
import { RECENT_LIMIT, type RecentFolders } from './model.ts';

export function recentFoldersProblems(folders: RecentFolders): string[] {
  const problems: string[] = [];
  if (folders.length > RECENT_LIMIT) problems.push(`The recent folders list ${folders.length} folders, more than ${RECENT_LIMIT}.`);
  const seen = new Set<string>();
  for (const folder of folders) {
    if (!path.isAbsolute(folder)) problems.push(`The recent folder ${folder} is not a full path.`);
    const key = path.resolve(folder);
    if (seen.has(key)) problems.push(`The recent folders list ${folder} twice.`);
    seen.add(key);
  }
  return problems;
}

/** Refuses a list that breaks a rule, with every reason. */
export function holdToRules(folders: RecentFolders): void {
  const problems = recentFoldersProblems(folders);
  if (problems.length) throw new Error(problems.join(' '));
}
