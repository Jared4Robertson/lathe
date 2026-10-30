// Duplicate a tab (LA-EXP-CMD24): a copy of the tab, with its history and cameras, after it and active.
import { nextKey, placeKeyOf, setOf, withSet, type Tab, type TabSets } from '../model';

export interface DuplicateTab {
  space: string;
  key: string;
}

/** Copies a tab of the space, with its history and cameras. */
export function duplicateTab(tabs: TabSets, input: DuplicateTab): TabSets {
  const set = setOf(tabs, input.space);
  const tab = set.tabs.find((t) => t.key === input.key);
  if (!tab) return tabs;
  const copy: Tab = { key: nextKey(set), place: tab.place };
  const at = set.tabs.indexOf(tab) + 1;
  const next = withSet(tabs, input.space, () => ({ tabs: [...set.tabs.slice(0, at), copy, ...set.tabs.slice(at)], active: copy.key }));
  const from = `${placeKeyOf(input.space, input.key)} `;
  const to = `${placeKeyOf(input.space, copy.key)} `;
  const copied = [...tabs.cameras].filter(([k]) => k.startsWith(from)).map(([k, c]): [string, typeof c] => [to + k.slice(from.length), c]);
  return copied.length === 0 ? next : { ...next, cameras: new Map([...tabs.cameras, ...copied]) };
}
