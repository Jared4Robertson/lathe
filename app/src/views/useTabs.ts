import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { GraphSettings } from '../graph/GraphPage';
import { NO_FILTERS } from '../graph/model';
import { navigate } from '../router';
import { isNumber, readPref, writePref } from '../shell/prefs';
import { productOfPath } from '../shell/spaces';
import type { SpecIndex } from '../specs/data';
import { currentAddress, focusOf, parseViews, pathOf, VIEW_NAMES, viewsFromSearch, withView, type FocusRoute, type ViewName } from './address';
import { activateTab, activeTab, closeTab, cycleTab, emptyTabs, keepTab, openTab, parseTabSet, tabFor, updateTab, type Tab, type TabSet } from './tabs';

// The open tabs of the focus page, one tab set per space, kept for the browser session, and the
// address kept in step with the active tab (LA-PAT-APP-UX-R06):
// - a new address opens its page as tabs.ts says: the tab it is open in, or the preview tab;
// - the address names the active tab's views, so a link, a reload, Back and Forward work as before;
// - activating, cycling or closing a tab moves the address to the tab now active.
// Each tab keeps its own views, pane sizes, wiki scroll and graph settings. A new tab starts from
// the active tab's, or for a space's first tab from the last ones used (the remembered view, sizes
// and graph settings).

/** What a tab remembers of its page, besides the wiki's scroll (kept apart, as it changes often). */
export interface TabView {
  /** The views asked for, those the page does not offer included, so they come back where offered. */
  views: ViewName[];
  /** Each pane's weight, which the gaps share out. */
  sizes: Record<ViewName, number>;
  graph: GraphSettings;
}
export type PageTab = Tab<TabView>;
export type PageTabs = TabSet<TabView>;

const TABS_KEY = 'lathe:tabs';
export const VIEW_KEY = 'lathe:view';
export const GRAPH_KEY = 'lathe:graph-settings';
export const PANE_SIZE_KEY = (v: ViewName) => `lathe:pane-size:${v}`;
/** Each pane's share of the width is a weight; equal weights share the space evenly. */
export const PANE_WEIGHT = 100;
export const PANE_WEIGHT_MIN = 1;
export const PANE_WEIGHT_MAX = 10000;
const isString = (v: unknown): v is string => typeof v === 'string';
const isAny = (_v: unknown): _v is unknown => true;
const isWeight = (v: unknown): v is number => isNumber(v) && v >= PANE_WEIGHT_MIN && v <= PANE_WEIGHT_MAX;

// ---------- Graph settings, stored ----------

interface StoredSettings { depth: number; trace: boolean; hiddenKinds: string[]; hiddenRelations: string[]; openGroups: [string, boolean][] }
const isStored = (v: unknown): v is StoredSettings => !!v && typeof v === 'object' && isNumber((v as StoredSettings).depth) && Array.isArray((v as StoredSettings).hiddenKinds);

export const DEFAULT_SETTINGS: GraphSettings = { depth: 1, trace: false, filters: NO_FILTERS, openGroups: new Map() };

function settingsFrom(s: unknown): GraphSettings | null {
  if (!isStored(s)) return null;
  return {
    depth: [1, 2, 3].includes(s.depth) ? s.depth : 1,
    trace: s.trace === true,
    filters: { hiddenKinds: new Set(s.hiddenKinds), hiddenRelations: new Set(s.hiddenRelations ?? []) },
    openGroups: new Map((s.openGroups ?? []).filter((e) => Array.isArray(e) && typeof e[0] === 'string')),
  };
}
function storedFrom(s: GraphSettings): StoredSettings {
  return { depth: s.depth, trace: s.trace, hiddenKinds: [...s.filters.hiddenKinds], hiddenRelations: [...s.filters.hiddenRelations], openGroups: [...s.openGroups] as [string, boolean][] };
}

/** The graph settings last used, for a space's first tab. */
export const lastSettings = (): GraphSettings => settingsFrom(readPref<unknown>(GRAPH_KEY, null, isAny, 'session')) ?? DEFAULT_SETTINGS;
export const saveLastSettings = (s: GraphSettings) => writePref(GRAPH_KEY, storedFrom(s), 'session');

/** The views last open, for a space's first tab. */
export const rememberedViews = (): ViewName[] => parseViews(readPref<string>(VIEW_KEY, 'wiki', isString));

/** What a space's first tab starts with: the views, sizes and graph settings last used. */
export function firstTabView(): TabView {
  const views = rememberedViews();
  const sizes = Object.fromEntries(VIEW_NAMES.map((v) => [v, readPref<number>(PANE_SIZE_KEY(v), PANE_WEIGHT, isWeight)])) as Record<ViewName, number>;
  return { views: views.length > 0 ? views : ['wiki'], sizes, graph: lastSettings() };
}

// ---------- Stored tab sets ----------

interface StoredTab { views: string; sizes: Record<string, number>; graph: StoredSettings; scroll: number }

function tabViewFrom(v: unknown): (TabView & { scroll: number }) | null {
  if (!v || typeof v !== 'object') return null;
  const s = v as Partial<StoredTab>;
  const views = parseViews(typeof s.views === 'string' ? s.views : '');
  const first = firstTabView();
  const sizes = Object.fromEntries(VIEW_NAMES.map((name) => [name, isWeight(s.sizes?.[name]) ? s.sizes![name] : first.sizes[name]])) as Record<ViewName, number>;
  return { views: views.length > 0 ? views : ['wiki'], sizes, graph: settingsFrom(s.graph) ?? first.graph, scroll: isNumber(s.scroll) && s.scroll >= 0 ? s.scroll : 0 };
}

const scrollKey = (t: { key: string; page: string }) => `${t.key} ${t.page}`;

function loadAll(scrolls: Map<string, number>): Record<string, PageTabs> {
  const raw = readPref<unknown>(TABS_KEY, null, isAny, 'session');
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out: Record<string, PageTabs> = {};
  for (const [space, value] of Object.entries(raw as Record<string, unknown>)) {
    // A tab saved under an old address (/records/<id>, /specs/<product>) opens at today's.
    const set = parseTabSet(value, tabViewFrom, currentAddress);
    if (!set) continue;
    out[space] = {
      active: set.active,
      tabs: set.tabs.map((t) => {
        const { scroll, ...state } = t.state;
        if (scroll > 0) scrolls.set(scrollKey(t), scroll);
        return { ...t, state };
      }),
    };
  }
  return out;
}

function saveAll(all: Record<string, PageTabs>, scrolls: Map<string, number>) {
  const out: Record<string, TabSet<StoredTab>> = {};
  for (const [space, set] of Object.entries(all)) {
    out[space] = {
      active: set.active,
      tabs: set.tabs.map((t) => ({
        key: t.key,
        page: t.page,
        preview: t.preview,
        state: { views: t.state.views.join(','), sizes: t.state.sizes, graph: storedFrom(t.state.graph), scroll: scrolls.get(scrollKey(t)) ?? 0 },
      })),
    };
  }
  writePref(TABS_KEY, out, 'session');
}

const sameViews = (a: readonly ViewName[], b: readonly ViewName[]) => a.length === b.length && a.every((v, i) => v === b[i]);

/**
 * The tab set after arriving at an address: the page's tab activated, or the page opened in the
 * preview tab with the views the address names, else those of the tab that was active. The views
 * an address names win over the tab's own only on the page already active, or on the first load
 * (a shared link or a reload); a link to a page open in another tab activates that tab as it was.
 */
export function arrive(set: PageTabs, page: string, linked: ViewName[] | null, first: boolean): PageTabs {
  const open = tabFor(set, page);
  const wasActive = open !== undefined && open.key === set.active;
  let next = openTab(set, page, (from) => {
    const base = from?.state ?? firstTabView();
    return { ...base, views: linked ?? base.views };
  });
  if (open && linked && (first || wasActive) && !sameViews(open.state.views, linked)) {
    next = updateTab(next, open.key, (s) => ({ ...s, views: linked }));
  }
  return next;
}

export const addressOfTab = (t: PageTab) => withView(t.page, t.state.views);

export interface PageTabsApi {
  set: PageTabs;
  active: PageTab;
  activate: (key: string) => void;
  close: (key: string) => void;
  keep: (key: string) => void;
  cycle: (step: number) => void;
  /** Changes the active tab's state; `keep` also makes it lasting. */
  update: (change: (s: TabView) => TabView, keep?: boolean) => void;
  scrollOf: (t: PageTab) => number;
  setScroll: (t: PageTab, top: number) => void;
}

export function usePageTabs(index: SpecIndex, route: FocusRoute, search: string): PageTabsApi {
  const page = pathOf(route);
  const space = productOfPath(index, page) ?? index.byId.get(focusOf(route))?.product ?? '';
  const linked = viewsFromSearch(search);
  const scrolls = useRef<Map<string, number>>(null as unknown as Map<string, number>);
  if (!scrolls.current) scrolls.current = new Map();
  const [all, setAll] = useState<Record<string, PageTabs>>(() => loadAll(scrolls.current));

  // Arriving at an address: adjusted while rendering, so no frame shows the old tab's state.
  const here = `${space}\n${page}\n${search}`;
  const [synced, setSynced] = useState<string | null>(null);
  if (synced !== here) {
    const first = synced === null;
    setSynced(here);
    setAll((prev) => ({ ...prev, [space]: arrive(prev[space] ?? emptyTabs(), page, linked, first) }));
  }
  const set = all[space] ?? emptyTabs<TabView>();
  const active = activeTab(set) ?? { key: '', page, preview: true, state: firstTabView() };

  // The address names the active tab's views: a link to a page open in another tab shows it as it was.
  useEffect(() => {
    if (synced !== here || active.page !== page) return;
    if (linked && !sameViews(linked, active.state.views)) navigate(addressOfTab(active), true);
  }, [synced, here, active, page, linked]);

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => { saveAll(all, scrolls.current); }, [all]);
  useEffect(() => () => { if (saveTimer.current) clearTimeout(saveTimer.current); }, []);

  const allRef = useRef(all);
  allRef.current = all;
  const spaceRef = useRef(space);
  spaceRef.current = space;
  /** Applies a change to this space's set, and moves the address when the active tab changed. */
  const change = useCallback((fn: (s: PageTabs) => PageTabs) => {
    const sp = spaceRef.current;
    const before = allRef.current[sp] ?? emptyTabs<TabView>();
    const after = fn(before);
    if (after === before) return;
    allRef.current = { ...allRef.current, [sp]: after };
    setAll((prev) => ({ ...prev, [sp]: fn(prev[sp] ?? emptyTabs()) }));
    const now = activeTab(after);
    if (now && now.key !== before.active) navigate(addressOfTab(now));
  }, []);

  const activate = useCallback((key: string) => change((s) => activateTab(s, key)), [change]);
  const close = useCallback((key: string) => change((s) => closeTab(s, key)), [change]);
  const keep = useCallback((key: string) => change((s) => keepTab(s, key)), [change]);
  const cycle = useCallback((step: number) => change((s) => cycleTab(s, step)), [change]);
  const update = useCallback((fn: (s: TabView) => TabView, keepIt = false) => change((s) => {
    if (!s.active) return s;
    const next = updateTab(s, s.active, fn);
    return keepIt ? keepTab(next, s.active) : next;
  }), [change]);
  const scrollOf = useCallback((t: PageTab) => scrolls.current.get(scrollKey(t)) ?? 0, []);
  const setScroll = useCallback((t: PageTab, top: number) => {
    scrolls.current.set(scrollKey(t), Math.max(0, Math.round(top)));
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => saveAll(allRef.current, scrolls.current), 150);
  }, []);

  return useMemo(() => ({ set, active, activate, close, keep, cycle, update, scrollOf, setScroll }), [set, active, activate, close, keep, cycle, update, scrollOf, setScroll]);
}
