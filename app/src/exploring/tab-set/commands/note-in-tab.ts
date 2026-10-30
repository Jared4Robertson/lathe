// Note where a tab's page was (LA-EXP-CMD26): values, such as the wiki card's scroll, are noted in a tab's current entry, so Back and Forward bring them back.
import { notePlace } from '../../../views/place';
import { changeTab, withSet, type TabSets } from '../model';

export interface NoteInTab {
  space: string;
  key: string;
  note: Record<string, unknown>;
}

/** Notes values in a tab's current entry. */
export function noteInTab(tabs: TabSets, input: NoteInTab): TabSets {
  return withSet(tabs, input.space, (set) => changeTab(set, input.key, (p) => notePlace(p, input.note)));
}
