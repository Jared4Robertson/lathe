// Change the active tab's address in place (LA-EXP-CMD25): the active tab's current entry takes another address (a stage switched on the same page), with no new entry.
import { replacePlace } from '../../../views/place';
import { changeTab, withSet, type TabSets } from '../model';

export interface ReplaceInTab {
  space: string;
  address: string;
}

/** Puts the active tab's current entry at another address. */
export function replaceInTab(tabs: TabSets, input: ReplaceInTab): TabSets {
  return withSet(tabs, input.space, (set) => (set.active ? changeTab(set, set.active, (p) => replacePlace(p, input.address)) : set));
}
