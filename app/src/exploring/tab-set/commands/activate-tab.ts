// Activate a tab (LA-EXP-CMD07): the tab becomes the space's active tab.
import { withSet, type TabSets } from '../model';

export interface ActivateTab {
  space: string;
  key: string;
}

/** Makes a tab the space's active tab. */
export function activateTab(tabs: TabSets, input: ActivateTab): TabSets {
  return withSet(tabs, input.space, (set) => (set.tabs.some((t) => t.key === input.key) && set.active !== input.key ? { ...set, active: input.key } : set));
}
