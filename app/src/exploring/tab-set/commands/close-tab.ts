// Close a tab (LA-EXP-CMD06): closing the active tab activates its right neighbor, or else the left; closing the only tab leaves one at the product, so there is always a tab; the closed place's cameras are forgotten.
import { freshPlace } from '../../../views/place';
import { nextKey, placeKeyOf, setOf, withSet, type Tab, type TabSets } from '../model';

export interface CloseTab {
  space: string;
  key: string;
  /** Where the tab left when the last one closes stands: the product, on the closed tab's stage. */
  home: string;
}

/** Closes a tab of the space. */
export function closeTab(tabs: TabSets, input: CloseTab): TabSets {
  const set = setOf(tabs, input.space);
  const at = set.tabs.findIndex((t) => t.key === input.key);
  if (at < 0) return tabs;
  const closed = withSet(tabs, input.space, () => {
    if (set.tabs.length === 1) {
      const tab: Tab = { key: nextKey(set), place: freshPlace(input.home, set.tabs[0].place.view) };
      return { tabs: [tab], active: tab.key };
    }
    const rest = set.tabs.filter((t) => t.key !== input.key);
    if (set.active !== input.key) return { ...set, tabs: rest };
    return { tabs: rest, active: (rest[at] ?? rest[at - 1]).key };
  });
  const place = `${placeKeyOf(input.space, input.key)} `;
  const cameras = new Map([...tabs.cameras].filter(([k]) => !k.startsWith(place)));
  return cameras.size === tabs.cameras.size ? closed : { ...closed, cameras };
}
