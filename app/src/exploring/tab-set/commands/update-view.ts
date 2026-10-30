// Change a tab's view (LA-EXP-CMD08): the active tab's depth, filters or wiki card change, and the view becomes the one last set; on the web, where there are no tabs, the browser tab's one place's view changes.
import { setView, type PlaceView } from '../../../views/place';
import { activeTab, changeTab, withSet, type TabSets } from '../model';

export interface UpdateView {
  /** The space whose active tab changes, or null on the web. */
  space: string | null;
  change: (view: PlaceView) => PlaceView;
}

/** Changes the active tab's view (the web's one place's), and keeps it as the view last set. */
export function updateView(tabs: TabSets, input: UpdateView): TabSets {
  if (input.space === null) {
    const view = input.change(tabs.view);
    return view === tabs.view ? tabs : { ...tabs, view };
  }
  const next = withSet(tabs, input.space, (set) => (set.active ? changeTab(set, set.active, (p) => setView(p, input.change)) : set));
  if (next === tabs) return tabs;
  return { ...next, view: activeTab(next.sets[input.space])!.place.view };
}
