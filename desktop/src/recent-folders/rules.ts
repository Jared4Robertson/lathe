// The Recent folders' rule (recent-folders-once-at-most-10, LA-PLT-INV14): each folder once, as a full path, at most
// RECENT_LIMIT. Latest first is how addRecent builds the list.
import path from 'node:path';
import { holdTo, type RuleProblem } from '../rules.ts';
import { RECENT_LIMIT, type RecentFolders } from './model.ts';

export function recentFoldersProblems(folders: RecentFolders): RuleProblem[] {
  const problems: RuleProblem[] = [];
  if (folders.length > RECENT_LIMIT) problems.push({ rule: 'recent-folders-once-at-most-10', message: `The recent folders list ${folders.length} folders, more than ${RECENT_LIMIT}.` });
  const seen = new Set<string>();
  for (const folder of folders) {
    if (!path.isAbsolute(folder)) problems.push({ rule: 'recent-folders-once-at-most-10', message: `The recent folder ${folder} is not a full path.` });
    const key = path.resolve(folder);
    if (seen.has(key)) problems.push({ rule: 'recent-folders-once-at-most-10', message: `The recent folders list ${folder} twice.` });
    seen.add(key);
  }
  return problems;
}

/** Refuses a list that breaks a rule, with every reason. */
export function holdToRules(folders: RecentFolders): void {
  holdTo(recentFoldersProblems(folders));
}
