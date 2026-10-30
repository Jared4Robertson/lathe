// Open a new tab (LA-EXP-CMD05): a new tab at an address, with a fresh history and the view given, after the active tab, and active unless opened in the background.
import { freshPlace, type PlaceView } from '../../../views/place';
import { insertTab, withSet, type TabSets } from '../model';

export interface NewTab {
  space: string;
  address: string;
  /** Its view: the caller gives the active tab's stage, depth and filters. */
  view: PlaceView;
  /** Opened in the background (a middle-click): the active tab stays active. */
  background?: boolean;
}

/** Opens a new tab in the space. */
export function newTab(tabs: TabSets, input: NewTab): TabSets {
  return withSet(tabs, input.space, (set) => insertTab(set, freshPlace(input.address, input.view), input.background === true));
}
