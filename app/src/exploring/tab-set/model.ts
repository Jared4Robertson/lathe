import { DEFAULT_STAGE, type StageName } from '../../views/address';
import { DEFAULT_VIEW, readPlace, type Place, type PlaceView } from '../../views/place';

// The Tab set aggregate (LA-EXP-A5): the places open in the window, as a browser's tabs. In the desktop app each space
// has its tab set: each tab is one place (views/place.ts) where the Reader explores, with its own focus, stage,
// camera, depth, filters, wiki card and Back and Forward. Moving never leaves the tab: a click, a step, a link, quick
// open, Back and Forward change only the active tab's place, even onto a page another tab holds, so a page may be open
// in several tabs. A new tab opens only when asked for, after the active one. There is always a tab: closing the last
// leaves one at the product. On the web a browser tab is the one place and there is no tab set: the view last set is
// that place's view. Besides the sets, the window keeps the view last set (what a space's first tab starts with), the
// stage last chosen (what a place starts on when its address names none) and each place's cameras.
//
// Its commands (commands/) are pure functions over the whole TabSets, run by run.ts through TabSetRepository.

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

/** A stage's camera kept for a place, with what it framed (the focus, the layout and the depth, joined). */
export interface KeptCamera<V> {
  framed: string;
  view: V;
}

/** The Tab set aggregate as the window holds it. */
export interface TabSets {
  /** Each space's tab set, by product ID (the desktop app's). */
  sets: Readonly<Record<string, TabSet>>;
  /** The view last set: the web's one place's, and what a space's first tab starts with. */
  view: PlaceView;
  /** The stage last chosen: what a place starts on when its address names none. */
  stage: StageName;
  /** Each place's camera on each stage, by `<place> <stage>`, kept while the window is open. */
  cameras: ReadonlyMap<string, KeptCamera<unknown>>;
}

export const NO_TABS: TabSets = { sets: {}, view: DEFAULT_VIEW, stage: DEFAULT_STAGE, cameras: new Map() };

/** A space's tab set before its first tab: one value, never changed (every command makes a new set). */
const NO_TAB_SET: TabSet = Object.freeze({ tabs: [], active: null }) as TabSet;
export const emptyTabs = (): TabSet => NO_TAB_SET;

export const activeTab = (set: TabSet): Tab | undefined => set.tabs.find((t) => t.key === set.active);

/** A space's tab set (empty when it has none). */
export const setOf = (tabs: TabSets, space: string): TabSet => tabs.sets[space] ?? emptyTabs();

/** The tab sets with a space's set changed; the same object when nothing changed. */
export function withSet(tabs: TabSets, space: string, change: (set: TabSet) => TabSet): TabSets {
  const was = setOf(tabs, space);
  const set = change(was);
  return set === was ? tabs : { ...tabs, sets: { ...tabs.sets, [space]: set } };
}

/** The key a place's cameras are kept under: its space and tab in the desktop app. */
export const placeKeyOf = (space: string, tab: string) => `${space}/${tab}`;

/** A key no tab in the set has: t1, t2, … */
export function nextKey(set: TabSet): string {
  const n = set.tabs.reduce((max, t) => Math.max(max, Number(t.key.slice(1)) || 0), 0);
  return `t${n + 1}`;
}

/** The set with one tab's place changed; the same set when nothing changed. */
export function changeTab(set: TabSet, key: string, change: (place: Place) => Place): TabSet {
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

/** The set with a tab at a place after the active one, active unless opened in the background. */
export function insertTab(set: TabSet, place: Place, background: boolean): TabSet {
  const from = activeTab(set);
  const tab: Tab = { key: nextKey(set), place };
  const at = from ? set.tabs.indexOf(from) + 1 : set.tabs.length;
  return { tabs: [...set.tabs.slice(0, at), tab, ...set.tabs.slice(at)], active: background && from ? from.key : tab.key };
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
