// Cycle through the tabs (LA-EXP-CMD23): the tab some places from the active one, in tab order and wrapping at either end, becomes active.
import { withSet, type TabSets } from '../model';

export interface CycleTab {
  space: string;
  /** How many tabs on (negative: back). */
  step: number;
}

/** Activates the tab `step` places from the active one. */
export function cycleTab(tabs: TabSets, input: CycleTab): TabSets {
  return withSet(tabs, input.space, (set) => {
    if (set.tabs.length < 2) return set;
    const at = Math.max(0, set.tabs.findIndex((t) => t.key === set.active));
    const n = set.tabs.length;
    return { ...set, active: set.tabs[(((at + input.step) % n) + n) % n].key };
  });
}
