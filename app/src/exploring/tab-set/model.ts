import { freshPlace, movePlace, readPlace, replacePlace, setView, stepPlace, type Place, type PlaceView } from './place';

// The desktop app's tabs, as a browser's: each tab is one place (place.ts) where the Reader explores, with its own
// focus, stage, camera, depth, filters, wiki card and Back and Forward. Moving never leaves the tab: a click, a step,
// a link, quick open, Back and Forward change only the active tab's place, even onto a page another tab holds, so a
// page may be open in several tabs. A new tab opens only when asked for, after the active one. There is always a tab:
// closing the last leaves one at the product. On the web a browser tab is the one place and there is no tab set.
//
// These are pure functions over a TabSet: useTabs.ts holds one per space.

export interface Tab {
  /** Stable for the tab's life. */
  key: string;
  place: Place;
}

export interface TabSet {
  tabs: Tab[];
  /** The active tab's key, or null in an empty set. */
  active: string | null;
}

export const emptyTabs = (): TabSet => ({ tabs: [], active: null });

export const activeTab = (set: TabSet): Tab | undefined => set.tabs.find((t) => t.key === set.active);

/** A key no tab in the set has: t1, t2, … */
function nextKey(set: TabSet): string {
  const n = set.tabs.reduce((max, t) => Math.max(max, Number(t.key.slice(1)) || 0), 0);
  return `t${n + 1}`;
}

function changeTab(set: TabSet, key: string, change: (place: Place) => Place): TabSet {
  let changed = false;
  const tabs = set.tabs.map((t) => {
    if (t.key !== key) return t;
    const place = change(t.place);
    if (place === t.place) return t;
    changed = true;
    return { ...t, place };
  });
  return changed ? { ...set, tabs } : set;
}

/**
 * A move in the active tab: its place goes to the address, dropping its forward entries. It never switches tabs. In
 * an empty set the address opens the first tab, with `view`.
 */
export function moveInTab(set: TabSet, address: string, view: PlaceView): TabSet {
  if (!set.active) return newTab(set, address, view);
  return changeTab(set, set.active, (p) => movePlace(p, address));
}

/** The active tab's current entry at another address (a stage switched): no new entry. */
export function replaceInTab(set: TabSet, address: string): TabSet {
  return set.active ? changeTab(set, set.active, (p) => replacePlace(p, address)) : set;
}

/** Back and Forward in a tab: to the entry at `to` in its history. */
export function stepTab(set: TabSet, key: string, to: number): TabSet {
  return changeTab(set, key, (p) => stepPlace(p, to));
}

export interface NewTabOptions {
  /** Opened in the background (a middle-click): the active tab stays active. */
  background?: boolean;
}

/**
 * A new tab at an address, with a fresh history and the view given (the caller copies the active tab's stage, depth
 * and filters): after the active tab, and active unless opened in the background.
 */
export function newTab(set: TabSet, address: string, view: PlaceView, { background = false }: NewTabOptions = {}): TabSet {
  return insert(set, freshPlace(address, view), background);
}

/** A copy of a tab, with its history, after it, and active. */
export function duplicateTab(set: TabSet, key: string): TabSet {
  const tab = set.tabs.find((t) => t.key === key);
  if (!tab) return set;
  const at = set.tabs.indexOf(tab) + 1;
  const copy: Tab = { key: nextKey(set), place: tab.place };
  return { tabs: [...set.tabs.slice(0, at), copy, ...set.tabs.slice(at)], active: copy.key };
}

function insert(set: TabSet, place: Place, background: boolean): TabSet {
  const from = activeTab(set);
  const tab: Tab = { key: nextKey(set), place };
  const at = from ? set.tabs.indexOf(from) + 1 : set.tabs.length;
  return { tabs: [...set.tabs.slice(0, at), tab, ...set.tabs.slice(at)], active: background && from ? from.key : tab.key };
}

/**
 * Closes a tab. Closing the active tab activates its neighbor to the right, or else the left. Closing the only tab
 * leaves one tab at `home` (the product), with the closed tab's view and a fresh history, so there is always one.
 */
export function closeTab(set: TabSet, key: string, home: string): TabSet {
  const at = set.tabs.findIndex((t) => t.key === key);
  if (at < 0) return set;
  if (set.tabs.length === 1) {
    const tab: Tab = { key: nextKey(set), place: freshPlace(home, set.tabs[0].place.view) };
    return { tabs: [tab], active: tab.key };
  }
  const tabs = set.tabs.filter((t) => t.key !== key);
  if (set.active !== key) return { ...set, tabs };
  return { tabs, active: (tabs[at] ?? tabs[at - 1]).key };
}

export function activateTab(set: TabSet, key: string): TabSet {
  return set.tabs.some((t) => t.key === key) && set.active !== key ? { ...set, active: key } : set;
}

/** The tab `step` places from the active one, in tab order, wrapping at either end. */
export function cycleTab(set: TabSet, step: number): TabSet {
  if (set.tabs.length < 2) return set;
  const at = Math.max(0, set.tabs.findIndex((t) => t.key === set.active));
  const n = set.tabs.length;
  return { ...set, active: set.tabs[(((at + step) % n) + n) % n].key };
}

/** Changes a tab's view (its depth, filters or wiki card). */
export function updateView(set: TabSet, key: string, change: (view: PlaceView) => PlaceView): TabSet {
  return changeTab(set, key, (p) => setView(p, change));
}

/** Changes a tab's place by any of place.ts's functions (a note in its current entry). */
export function updatePlace(set: TabSet, key: string, change: (place: Place) => Place): TabSet {
  return changeTab(set, key, change);
}

/**
 * Reads a stored tab set, dropping anything malformed and any entry whose address `isAddress` does not accept; null
 * when no tab is left.
 */
export function parseTabSet(value: unknown, isAddress: (address: string) => boolean): TabSet | null {
  if (!value || typeof value !== 'object') return null;
  const raw = value as { tabs?: unknown; active?: unknown };
  if (!Array.isArray(raw.tabs)) return null;
  const tabs: Tab[] = [];
  for (const t of raw.tabs as unknown[]) {
    if (!t || typeof t !== 'object') continue;
    const { key, place } = t as Record<string, unknown>;
    if (typeof key !== 'string' || tabs.some((x) => x.key === key)) continue;
    const p = readPlace(place, isAddress);
    if (p) tabs.push({ key, place: p });
  }
  if (tabs.length === 0) return null;
  const active = typeof raw.active === 'string' && tabs.some((t) => t.key === raw.active) ? raw.active : tabs[0].key;
  return { tabs, active };
}
