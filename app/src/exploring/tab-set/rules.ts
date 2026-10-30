import { refuseBroken } from '../../shell/prefs';
import { MAX_HISTORY } from '../../views/place';
import type { TabSets } from './model';

// The Tab set aggregate's rules, held whenever a command's change is saved (run.ts).

/**
 * Every problem with the tab sets: a set with tabs has one of them active (LA-EXP-INV07), each tab's key is its own,
 * and each tab's place is its own, with a history of 1 to MAX_HISTORY entries and its current entry one of them
 * (LA-EXP-INV08).
 */
export function tabSetProblems(tabs: TabSets): string[] {
  const problems: string[] = [];
  for (const [space, set] of Object.entries(tabs.sets)) {
    if (set.tabs.length > 0 && !set.tabs.some((t) => t.key === set.active)) problems.push(`The tab set of ${space} has no active tab.`);
    const keys = new Set<string>();
    for (const tab of set.tabs) {
      if (keys.has(tab.key)) problems.push(`The tab set of ${space} has two tabs ${tab.key}.`);
      keys.add(tab.key);
      const { history, at } = tab.place;
      if (history.length === 0 || history.length > MAX_HISTORY) problems.push(`Tab ${tab.key} of ${space} has ${history.length} history entries; a place keeps 1 to ${MAX_HISTORY}.`);
      if (!Number.isInteger(at) || at < 0 || at >= history.length) problems.push(`Tab ${tab.key} of ${space} stands on entry ${at}, which its history does not have.`);
    }
  }
  return problems;
}

/** Refuses the tab sets with every problem they have. */
export function holdToRules(tabs: TabSets): void {
  refuseBroken(tabSetProblems(tabs));
}
