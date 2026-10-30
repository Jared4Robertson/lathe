import { navigate, type AddressMove } from '../../router';
import { hereOf, type PlaceView } from '../../views/place';
import { giveHistory, here, inStep, tagEntry, type EntryTag } from '../../views/tabHistory';
import { namingStage, rememberedStage, stageOf } from '../../views/usePlace';
import { moveInTab } from './commands/move-in-tab';
import { replaceInTab } from './commands/replace-in-tab';
import { stepTab } from './commands/step-tab';
import { activeTab, NO_TABS, type Tab, type TabSet, type TabSets } from './model';
import { runTabSetCommand } from './run';

// The Tab set aggregate's policies (LA-PAT-APP-UX-R06), one named reaction each:
// - when a page opens (Page opened, LA-EXP-EV01: a click, a step, a link, quick open, the address, Back and Forward),
//   the active tab moves there, never another tab, and Back and Forward step through the active tab's own history;
// - when the active tab changes (Active tab changed, LA-EXP-EV02), the window's address and history follow it
//   (views/tabHistory.ts).

/** The window entry the window was last in step on: a push from it is the active tab's next entry. */
let lastInStep: EntryTag | null = null;

/** What arriving at an address does to the tab sets, and whether the window's entry then needs only its tag. */
export interface Arrival {
  apply: (tabs: TabSets) => TabSets;
  tagOnly: boolean;
}

const unchanged = (tabs: TabSets) => tabs;

/**
 * What arriving at an address does to a space's tab set, and whether the window's entry needs only its tag:
 * - Back or Forward (or a load) onto an entry of one of the space's tabs: that tab, at that entry;
 * - the active tab's own address (a space opened again), or the window's history rewritten: nothing;
 * - a stage switched in place: the active tab's entry, changed;
 * - anything else (a move, a link opened): a move in the active tab, which names the stage it was on.
 * `set` is the space's tab set after it, which the page shows while the move is saved.
 */
export function arrive(set: TabSet, space: string, address: string, move: AddressMove | 'load', tag: EntryTag | null, firstView: PlaceView): Arrival & { set: TabSet } {
  const decided = decide(set, space, address, move, tag, firstView);
  return { ...decided, set: decided.apply({ ...NO_TABS, sets: { [space]: set } }).sets[space] ?? set };
}

function decide(set: TabSet, space: string, address: string, move: AddressMove | 'load', tag: EntryTag | null, firstView: PlaceView): Arrival {
  // Only Back and Forward, or a load, step a tab: a rewrite that lands on another tab's entry (the window catching up
  // with a tab activated since) changes nothing, and the window is then given the active tab's history.
  if (tag && tag.space === space && (move === 'pop' || move === 'load')) {
    const tab = set.tabs.find((t) => t.key === tag.tab);
    if (tab && tab.place.history[tag.at]?.address === address) return { apply: (tabs) => stepTab(tabs, { space, key: tab.key, to: tag.at }), tagOnly: false };
  }
  const active = activeTab(set);
  if (move === 'rewrite' || (active && hereOf(active.place).address === address)) return { apply: unchanged, tagOnly: false };
  const stage = active ? stageOf(hereOf(active.place).address, rememberedStage()) : rememberedStage();
  const to = namingStage(address, stage);
  if (move === 'replace' && active) return { apply: (tabs) => replaceInTab(tabs, { space, address: to }), tagOnly: true };
  const wasInStep = !!active && !!lastInStep && lastInStep.space === space && lastInStep.tab === active.key && lastInStep.at === active.place.at;
  return { apply: (tabs) => moveInTab(tabs, { space, address: to, view: active?.place.view ?? firstView }), tagOnly: move === 'push' && wasInStep };
}

/** When a page opens, move the active tab there (LA-EXP-PO02): saves the arrival the page showed. */
export function onPageOpenedMoveActiveTab(arrival: Arrival): void {
  runTabSetCommand((tabs, a: Arrival) => a.apply(tabs), arrival);
}

/**
 * When the active tab changes, move the address to it (LA-EXP-PO03): the address the window stands on is tagged as
 * the tab's entry, or, when it stands elsewhere, the window is given the tab's history; `rewritten` hears each rewrite
 * done, so the active tab is looked at again (it may have changed while it ran).
 */
export function onActiveTabChangedMoveAddress(
  space: string,
  active: Tab,
  tagOnly: boolean,
  latest: () => { space: string; active: Tab },
  rewritten: () => void,
): void {
  if (!active.key) return;
  const shown = hereOf(active.place).address;
  const tag = { space, tab: active.key, at: active.place.at };
  if (inStep(space, active, shown)) { lastInStep = tag; return; }
  if (tagOnly) {
    // An address that named no stage (a link in the card) names the tab's, in the same entry.
    if (here() !== shown) navigate(shown, true);
    tagEntry(tag);
    lastInStep = tag;
    return;
  }
  void giveHistory(() => {
    const now = latest();
    const at = hereOf(now.active.place).address;
    return now.active.key && !inStep(now.space, now.active, at) ? { space: now.space, tab: now.active } : null;
  }, (t) => { lastInStep = t; rewritten(); });
}
