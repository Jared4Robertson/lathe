// Move in the active tab (LA-EXP-CMD04): the active tab's place goes to the address, dropping its forward entries; it never switches tabs, and in an empty set the address opens the first tab.
import { movePlace, type PlaceView } from '../../../views/place';
import { changeTab, withSet, type TabSets } from '../model';
import { newTab } from './new-tab';

export interface MoveInTab {
  space: string;
  address: string;
  /** The view the first tab starts with, when the space has none. */
  view: PlaceView;
}

/** Moves the active tab of the space to the address. */
export function moveInTab(tabs: TabSets, input: MoveInTab): TabSets {
  const set = tabs.sets[input.space];
  if (!set?.active) return newTab(tabs, input);
  return withSet(tabs, input.space, (s) => changeTab(s, s.active!, (p) => movePlace(p, input.address)));
}
