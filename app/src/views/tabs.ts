// Tabs for open pages, as editors are in VS Code. A tab is one open page (a record, group, product
// or domain, by its address path) with its own state: the views it shows, its pane sizes, where the
// wiki was scrolled. A tab set is an ordered row of tabs with one active.
//
// Opening a page by a plain click opens it in the preview tab (italic, replaced by the next plain
// open); keeping a tab, by double-click, the "Keep open" command or switching its views, makes it
// lasting. At most one preview tab exists, a page is open in at most one tab, and there is always
// a tab: closing the last one leaves its page open as the preview.
//
// These are pure functions over a TabSet, so a set can belong to anything that holds tabs: today
// each space has one; with editor groups (stage 2) each group would own one.

export interface Tab<S> {
  /** Stable for the tab's life, even when a preview tab moves to another page. */
  key: string;
  /** The page's address path, without the query string: `/LA-TRC-UC09`. */
  page: string;
  /** True for the preview tab, which the next plain open replaces. */
  preview: boolean;
  state: S;
}

export interface TabSet<S> {
  tabs: Tab<S>[];
  /** The active tab's key, or null in an empty set. */
  active: string | null;
}

export const emptyTabs = <S>(): TabSet<S> => ({ tabs: [], active: null });

export const activeTab = <S>(set: TabSet<S>): Tab<S> | undefined => set.tabs.find((t) => t.key === set.active);
export const tabFor = <S>(set: TabSet<S>, page: string): Tab<S> | undefined => set.tabs.find((t) => t.page === page);

/** A key no tab in the set has: t1, t2, … */
function nextKey<S>(set: TabSet<S>): string {
  const n = set.tabs.reduce((max, t) => Math.max(max, Number(t.key.slice(1)) || 0), 0);
  return `t${n + 1}`;
}

export interface OpenOptions {
  /** Open as a lasting tab (true), or in the preview tab (false, a plain open). */
  keep?: boolean;
}

/**
 * Opens a page. A page already open activates its tab (keeping it, when asked). Otherwise a plain
 * open replaces the preview tab in place, or adds one after the active tab when there is none; a
 * kept open adds a lasting tab after the active one. `state` makes the new page's state from the
 * tab that was active.
 */
export function openTab<S>(set: TabSet<S>, page: string, state: (from: Tab<S> | undefined) => S, { keep = false }: OpenOptions = {}): TabSet<S> {
  const open = tabFor(set, page);
  if (open) {
    const tabs = keep && open.preview ? set.tabs.map((t) => (t === open ? { ...t, preview: false } : t)) : set.tabs;
    return { tabs, active: open.key };
  }
  const from = activeTab(set);
  const preview = set.tabs.find((t) => t.preview);
  if (!keep && preview) {
    const replaced: Tab<S> = { key: preview.key, page, preview: true, state: state(from) };
    return { tabs: set.tabs.map((t) => (t === preview ? replaced : t)), active: preview.key };
  }
  const tab: Tab<S> = { key: nextKey(set), page, preview: !keep, state: state(from) };
  const at = from ? set.tabs.indexOf(from) + 1 : set.tabs.length;
  return { tabs: [...set.tabs.slice(0, at), tab, ...set.tabs.slice(at)], active: tab.key };
}

/** Makes a tab lasting: the next plain open no longer replaces it. */
export function keepTab<S>(set: TabSet<S>, key: string): TabSet<S> {
  if (!set.tabs.some((t) => t.key === key && t.preview)) return set;
  return { ...set, tabs: set.tabs.map((t) => (t.key === key ? { ...t, preview: false } : t)) };
}

/**
 * Closes a tab. Closing the active tab activates its neighbor to the right, or else the left.
 * Closing the only tab leaves its page open, as the preview tab, so there is always one.
 */
export function closeTab<S>(set: TabSet<S>, key: string): TabSet<S> {
  const at = set.tabs.findIndex((t) => t.key === key);
  if (at < 0) return set;
  if (set.tabs.length === 1) return keepAsPreview(set);
  const tabs = set.tabs.filter((t) => t.key !== key);
  if (set.active !== key) return { ...set, tabs };
  return { tabs, active: (tabs[at] ?? tabs[at - 1]).key };
}

function keepAsPreview<S>(set: TabSet<S>): TabSet<S> {
  return { tabs: set.tabs.map((t) => ({ ...t, preview: true })), active: set.tabs[0].key };
}

export function activateTab<S>(set: TabSet<S>, key: string): TabSet<S> {
  return set.tabs.some((t) => t.key === key) && set.active !== key ? { ...set, active: key } : set;
}

/** The tab `step` places from the active one, in tab order, wrapping at either end. */
export function cycleTab<S>(set: TabSet<S>, step: number): TabSet<S> {
  if (set.tabs.length < 2) return set;
  const at = Math.max(0, set.tabs.findIndex((t) => t.key === set.active));
  const n = set.tabs.length;
  return { ...set, active: set.tabs[(((at + step) % n) + n) % n].key };
}

/** Changes one tab's state. */
export function updateTab<S>(set: TabSet<S>, key: string, change: (state: S) => S): TabSet<S> {
  let changed = false;
  const tabs = set.tabs.map((t) => {
    if (t.key !== key) return t;
    const state = change(t.state);
    if (state === t.state) return t;
    changed = true;
    return { ...t, state };
  });
  return changed ? { ...set, tabs } : set;
}

/**
 * Reads a stored tab set, dropping anything malformed, and any tab whose page `isPage` does not
 * accept as an address; null when nothing usable is left.
 */
export function parseTabSet<S>(value: unknown, readState: (v: unknown) => S | null, isPage: (page: string) => boolean): TabSet<S> | null {
  if (!value || typeof value !== 'object') return null;
  const raw = value as { tabs?: unknown; active?: unknown };
  if (!Array.isArray(raw.tabs)) return null;
  const tabs: Tab<S>[] = [];
  for (const t of raw.tabs as unknown[]) {
    if (!t || typeof t !== 'object') continue;
    const { key, page, preview, state } = t as Record<string, unknown>;
    if (typeof key !== 'string' || typeof page !== 'string' || !isPage(page)) continue;
    if (tabs.some((x) => x.key === key || x.page === page)) continue;
    const s = readState(state);
    if (s === null) continue;
    tabs.push({ key, page, preview: preview === true, state: s });
  }
  if (tabs.length === 0) return null;
  // At most one preview: the last one stored wins.
  const lastPreview = tabs.map((t) => t.preview).lastIndexOf(true);
  const clean = tabs.map((t, i) => (t.preview && i !== lastPreview ? { ...t, preview: false } : t));
  const active = typeof raw.active === 'string' && clean.some((t) => t.key === raw.active) ? raw.active : clean[0].key;
  return { tabs: clean, active };
}
