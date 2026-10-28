import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { navigate } from '../router';
import { isNumber, readPref, writePref } from '../shell/prefs';
import { productOfPath } from '../shell/spaces';
import type { SpecIndex } from '../specs/data';
import { DEFAULT_STAGE, focusOf, isFocusPath, parseStage, pathOf, stageFromSearch, withStage, type FocusRoute, type StageName } from './address';
import { activateTab, activeTab, closeTab, cycleTab, emptyTabs, keepTab, openTab, parseTabSet, tabFor, updateTab, type Tab, type TabSet } from './tabs';
import { sideStateFrom, type SideState } from './sideBarState';

// The open tabs of the focus page, one tab set per space, kept for the browser session, and the
// address kept in step with the active tab (LA-PAT-APP-UX-R06):
// - a new address opens its page as tabs.ts says: the tab it is open in, or the preview tab;
// - the address names the active tab's stage, so a link, a reload, Back and Forward work as before;
// - activating, cycling or closing a tab moves the address to the tab now active.
// Each tab keeps its own stage, side bar and wiki card scroll. A new tab starts from the active
// tab's, or for a space's first tab from the stage last used. How the graph is drawn, and the wiki
// card's open state and width, are not a tab's: they are one setting for the session (graph/settings.ts).

/** What a tab remembers of its page, besides the wiki card's scroll (kept apart, as it changes often). */
export interface TabView {
  /** The stage asked for, kept where the page does not offer it, so it comes back where offered. */
  stage: StageName;
  /** The side bar on each stage: open or not, and its view. Absent modes use the last used. */
  side?: SideState;
}
export type PageTab = Tab<TabView>;
export type PageTabs = TabSet<TabView>;

const TABS_KEY = 'lathe:tabs';
export const STAGE_KEY = 'lathe:stage';
const isString = (v: unknown): v is string => typeof v === 'string';
const isAny = (_v: unknown): _v is unknown => true;

/** What a space's first tab starts with: the stage last used. */
export const firstTabView = (): TabView => ({ stage: parseStage(readPref<string>(STAGE_KEY, DEFAULT_STAGE, isString)) ?? DEFAULT_STAGE });

// ---------- Stored tab sets ----------

interface StoredTab { stage: string; scroll: number; side?: SideState }

function tabViewFrom(v: unknown): (TabView & { scroll: number }) | null {
  if (!v || typeof v !== 'object') return null;
  const s = v as Partial<StoredTab>;
  const stage = parseStage(typeof s.stage === 'string' ? s.stage : '');
  if (!stage) return null;
  const side = sideStateFrom(s.side);
  return { stage, scroll: isNumber(s.scroll) && s.scroll >= 0 ? s.scroll : 0, ...(Object.keys(side).length > 0 ? { side } : {}) };
}

const scrollKey = (t: { key: string; page: string }) => `${t.key} ${t.page}`;

function loadAll(scrolls: Map<string, number>): Record<string, PageTabs> {
  const raw = readPref<unknown>(TABS_KEY, null, isAny, 'session');
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out: Record<string, PageTabs> = {};
  for (const [space, value] of Object.entries(raw as Record<string, unknown>)) {
    // A tab whose page is not a focus page's address is dropped.
    const set = parseTabSet(value, tabViewFrom, isFocusPath);
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
        state: { stage: t.state.stage, scroll: scrolls.get(scrollKey(t)) ?? 0, ...(t.state.side ? { side: t.state.side } : {}) },
      })),
    };
  }
  writePref(TABS_KEY, out, 'session');
}

/**
 * The tab set after arriving at an address: the page's tab activated, or the page opened in the
 * preview tab with the stage the address names, else that of the tab that was active. The stage an
 * address names wins over the tab's own only on the page already active, or on the first load (a
 * shared link or a reload); a link to a page open in another tab activates that tab as it was.
 */
export function arrive(set: PageTabs, page: string, linked: StageName | null, first: boolean): PageTabs {
  const open = tabFor(set, page);
  const wasActive = open !== undefined && open.key === set.active;
  let next = openTab(set, page, (from) => {
    const base = from?.state ?? firstTabView();
    return { ...base, stage: linked ?? base.stage };
  });
  if (open && linked && (first || wasActive) && open.state.stage !== linked) {
    next = updateTab(next, open.key, (s) => ({ ...s, stage: linked }));
  }
  return next;
}

export const addressOfTab = (t: PageTab) => withStage(t.page, t.state.stage);

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

/** Remembers the stage last chosen, for a space's first tab. */
export const rememberStage = (stage: StageName) => writePref(STAGE_KEY, stage);

export function usePageTabs(index: SpecIndex, route: FocusRoute, search: string): PageTabsApi {
  const page = pathOf(route);
  const space = productOfPath(index, page) ?? index.byId.get(focusOf(route))?.product ?? '';
  const linked = stageFromSearch(search);
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

  // The address names the active tab's stage: a link to a page open in another tab shows it as it was.
  useEffect(() => {
    if (synced !== here || active.page !== page) return;
    if (linked && linked !== active.state.stage) navigate(addressOfTab(active), true);
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
