// Go back or forward in a tab (LA-EXP-CMD10): the tab goes to an entry of its own history, and becomes the active tab.
import { stepPlace } from '../../../views/place';
import { changeTab, withSet, type TabSets } from '../model';

export interface StepTab {
  space: string;
  key: string;
  /** The entry's index in the tab's history. */
  to: number;
}

/** Steps a tab to an entry of its history, and activates it. */
export function stepTab(tabs: TabSets, input: StepTab): TabSets {
  return withSet(tabs, input.space, (set) => {
    const tab = set.tabs.find((t) => t.key === input.key);
    if (!tab || input.to < 0 || input.to >= tab.place.history.length) return set;
    const stepped = changeTab(set, input.key, (p) => stepPlace(p, input.to));
    return stepped.active === input.key ? stepped : { ...stepped, active: input.key };
  });
}
