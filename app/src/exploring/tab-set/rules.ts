import { refuseBroken, type RuleProblem } from '../../shell/prefs';
import { MAX_HISTORY } from '../../views/place';
import type { TabSets } from './model';

// The Tab set aggregate's rules, held whenever a command's change is saved (run.ts).

/**
 * Every problem with the tab sets: a set with tabs has one of them active (tab-set-has-active-tab, LA-EXP-INV07); each
 * tab's key is its own, and each tab's place is its own, with a history of 1 to MAX_HISTORY entries and its current
 * entry one of them (tab-place-is-its-own, LA-EXP-INV08).
 */
export function tabSetProblems(tabs: TabSets): RuleProblem[] {
  const problems: RuleProblem[] = [];
  for (const [space, set] of Object.entries(tabs.sets)) {
    if (set.tabs.length > 0 && !set.tabs.some((t) => t.key === set.active)) problems.push({ rule: 'tab-set-has-active-tab', message: `The tab set of ${space} has no active tab.` });
    const keys = new Set<string>();
    for (const tab of set.tabs) {
      if (keys.has(tab.key)) problems.push({ rule: 'tab-place-is-its-own', message: `The tab set of ${space} has two tabs ${tab.key}.` });
      keys.add(tab.key);
      const { history, at } = tab.place;
      if (history.length === 0 || history.length > MAX_HISTORY) problems.push({ rule: 'tab-place-is-its-own', message: `Tab ${tab.key} of ${space} has ${history.length} history entries; a place keeps 1 to ${MAX_HISTORY}.` });
      if (!Number.isInteger(at) || at < 0 || at >= history.length) problems.push({ rule: 'tab-place-is-its-own', message: `Tab ${tab.key} of ${space} stands on entry ${at}, which its history does not have.` });
    }
  }
  return problems;
}

/** Refuses the tab sets with every problem they have. */
export function holdToRules(tabs: TabSets): void {
  refuseBroken(tabSetProblems(tabs));
}
