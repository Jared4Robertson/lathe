import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { lastAddressMove, navigate, noteInEntry, type AddressMove } from '../router';
import { readPref, writePref, isNumber } from '../shell/prefs';
import { productOfPath } from '../shell/spaces';
import type { SpecIndex } from '../specs/data';
import { addressOf, focusOf, isFocusPath, pathOf, type FocusRoute } from './address';
import { copyCameras, forgetCameras } from './cameras';
import { DEFAULT_VIEW, hereOf, notePlace, type PlaceView } from './place';
import { currentTag, giveHistory, here, inStep, tagEntry, type EntryTag } from './tabHistory';
import { activateTab, activeTab, closeTab, cycleTab, duplicateTab, emptyTabs, moveInTab, newTab, parseTabSet, replaceInTab, stepTab, updatePlace, updateView, type Tab, type TabSet } from './tabs';
import { CARD_SCROLL, keepView, lastView, namingStage, rememberedStage, stageOf, withStageIn, type PlaceApi } from './usePlace';

// The desktop app's tabs (tabs.ts), one tab set per space, kept for the window's session with each tab's place and
// history, and the window's history kept in step with the active tab (tabHistory.ts, LA-PAT-APP-UX-R06):
// - a move (a click, a step, a link, quick open) changes the active tab's place, whatever other tabs hold;
// - Back and Forward step through the active tab's history;
// - activating, opening, duplicating or closing a tab gives the window that tab's place and history.
// The page shows the active tab's place, so a tab switched to shows at once, before the window's address catches up.

const TABS_KEY = 'lathe:tabs';
const isAny = (_v: unknown): _v is unknown => true;
const isAddress = (address: string) => isFocusPath(address.split(/[?#]/)[0]);

function loadAll(): Record<string, TabSet> {
  const raw = readPref<unknown>(TABS_KEY, null, isAny, 'session');
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out: Record<string, TabSet> = {};
  for (const [space, value] of Object.entries(raw as Record<string, unknown>)) {
    const set = parseTabSet(value, isAddress);
    if (set) out[space] = set;
  }
  return out;
}

/** The window entry the window was last in step on: a push from it is the active tab's next entry. */
let lastInStep: EntryTag | null = null;

/**
 * The tab set after the window arrives at an address, and whether the window's entry needs only its tag:
 * - Back or Forward (or a load) onto an entry of one of the space's tabs: that tab, at that entry;
 * - the active tab's own address (a space opened again), or the window's history rewritten: as it is;
 * - a stage switched in place: the active tab's entry, changed;
 * - anything else (a move, a link opened): a move in the active tab, which names the stage it was on.
 */
export function arrive(set: TabSet, space: string, address: string, move: AddressMove | 'load', tag: EntryTag | null, firstView: PlaceView): { set: TabSet; tagOnly: boolean } {
  // Only Back and Forward, or a load, step a tab: a rewrite that lands on another tab's entry (the window catching up
  // with a tab activated since) changes nothing, and the window is then given the active tab's history.
  if (tag && tag.space === space && (move === 'pop' || move === 'load')) {
    const tab = set.tabs.find((t) => t.key === tag.tab);
    if (tab && tab.place.history[tag.at]?.address === address) return { set: activateTab(stepTab(set, tab.key, tag.at), tab.key), tagOnly: false };
  }
  const active = activeTab(set);
  if (move === 'rewrite' || (active && hereOf(active.place).address === address)) return { set, tagOnly: false };
  const stage = active ? stageOf(hereOf(active.place).address, rememberedStage()) : rememberedStage();
  const to = namingStage(address, stage);
  if (move === 'replace' && active) return { set: replaceInTab(set, to), tagOnly: true };
  const wasInStep = !!active && !!lastInStep && lastInStep.space === space && lastInStep.tab === active.key && lastInStep.at === active.place.at;
  return { set: moveInTab(set, to, active?.place.view ?? firstView), tagOnly: move === 'push' && wasInStep };
}

const cameraKeyOf = (space: string, tab: string) => `${space}/${tab}`;

export function usePageTabs(index: SpecIndex, route: FocusRoute, search: string): PlaceApi {
  const page = pathOf(route);
  const space = productOfPath(index, page) ?? index.byId.get(focusOf(route))?.product ?? '';
  const address = page + search;
  const [all, setAll] = useState<Record<string, TabSet>>(loadAll);
  const tagOnly = useRef(false);

  // Arriving at an address: adjusted while rendering, so no frame shows the tab before.
  const arrival = `${space}\n${address}`;
  const [synced, setSynced] = useState<string | null>(null);
  if (synced !== arrival) {
    setSynced(arrival);
    const move = synced === null ? 'load' : lastAddressMove();
    const tag = currentTag();
    const was = all[space] ?? emptyTabs();
    const next = arrive(was, space, address, move, tag, lastView());
    tagOnly.current = next.tagOnly;
    if (next.set !== was) setAll((prev) => ({ ...prev, [space]: next.set }));
  }
  const set = all[space] ?? emptyTabs();
  const active: Tab = activeTab(set) ?? { key: '', place: { history: [{ address: namingStage(address, rememberedStage()), note: {} }], at: 0, view: DEFAULT_VIEW } };
  const shown = hereOf(active.place).address;

  useEffect(() => { writePref(TABS_KEY, all, 'session'); }, [all]);

  // The window follows the active tab: the address it stands on is tagged as the tab's entry, or, when it stands
  // elsewhere, it is given the tab's history (tabHistory.ts).
  const latest = useRef({ space, active });
  latest.current = { space, active };
  // Each rewrite done is looked at again: the active tab may have changed while it ran.
  const [rewrites, setRewrites] = useState(0);
  useEffect(() => {
    if (!active.key) return;
    const tag = { space, tab: active.key, at: active.place.at };
    if (inStep(space, active, shown)) { lastInStep = tag; return; }
    if (tagOnly.current) {
      tagOnly.current = false;
      // An address that named no stage (a link in the card) names the tab's, in the same entry.
      if (here() !== shown) navigate(shown, true);
      tagEntry(tag);
      lastInStep = tag;
      return;
    }
    void giveHistory(() => {
      const now = latest.current;
      const at = hereOf(now.active.place).address;
      return now.active.key && !inStep(now.space, now.active, at) ? { space: now.space, tab: now.active } : null;
    }, (tag) => { lastInStep = tag; setRewrites((n) => n + 1); });
  }, [space, active, shown, rewrites]);

  const allRef = useRef(all);
  allRef.current = all;
  const spaceRef = useRef(space);
  spaceRef.current = space;
  /** Applies a change to this space's tab set. */
  const change = useCallback((fn: (s: TabSet) => TabSet) => {
    const sp = spaceRef.current;
    const before = allRef.current[sp] ?? emptyTabs();
    const after = fn(before);
    if (after === before) return;
    allRef.current = { ...allRef.current, [sp]: after };
    setAll((prev) => ({ ...prev, [sp]: fn(prev[sp] ?? emptyTabs()) }));
  }, []);

  const activeRef = useRef(active);
  activeRef.current = active;
  const stageNow = () => stageOf(hereOf(activeRef.current.place).address, rememberedStage());
  const home = () => withStageIn(addressOf(spaceRef.current), stageNow());

  const activate = useCallback((key: string) => change((s) => activateTab(s, key)), [change]);
  const close = useCallback((key: string) => {
    forgetCameras(cameraKeyOf(spaceRef.current, key));
    change((s) => closeTab(s, key, home()));
  }, [change]);
  const cycle = useCallback((step: number) => change((s) => cycleTab(s, step)), [change]);
  const openNew = useCallback((to: string, background = false) => {
    const view = activeRef.current.place.view;
    change((s) => newTab(s, namingStage(to, stageNow()), view, { background }));
  }, [change]);
  const openHome = useCallback(() => openNew(home()), [openNew]);
  const duplicate = useCallback(() => change((s) => {
    if (!s.active) return s;
    const next = duplicateTab(s, s.active);
    if (next.active) copyCameras(cameraKeyOf(spaceRef.current, s.active), cameraKeyOf(spaceRef.current, next.active));
    return next;
  }), [change]);
  // The view last set is also what a space's first tab starts with.
  const setView = useCallback((fn: (v: PlaceView) => PlaceView) => change((s) => {
    if (!s.active) return s;
    const next = updateView(s, s.active, fn);
    if (next !== s) keepView(activeTab(next)!.place.view);
    return next;
  }), [change]);
  const scroll = useCallback(() => {
    const top = hereOf(activeRef.current.place).note[CARD_SCROLL];
    return isNumber(top) ? top : 0;
  }, []);
  const setScroll = useCallback((top: number) => {
    const value = Math.max(0, Math.round(top));
    const tab = activeRef.current;
    change((s) => (tab.key ? updatePlace(s, tab.key, (p) => notePlace(p, { [CARD_SCROLL]: value })) : s));
    if (inStep(spaceRef.current, tab, hereOf(tab.place).address)) noteInEntry(CARD_SCROLL, value);
  }, [change]);

  // A link opened with Cmd or Ctrl held, or by the middle button, opens in a new tab (in the background for the
  // middle button), as in a browser; the page never leaves the app for it.
  useEffect(() => {
    const target = (e: MouseEvent): string | null => {
      const a = e.target instanceof Element ? e.target.closest<HTMLAnchorElement>('a[href]') : null;
      if (!a || a.target === '_blank') return null;
      const url = new URL(a.href, window.location.href);
      return url.origin === window.location.origin && isAddress(url.pathname) ? url.pathname + url.search : null;
    };
    const onClick = (e: MouseEvent) => {
      if (e.button !== 0 || !(e.metaKey || e.ctrlKey)) return;
      const to = target(e);
      if (!to) return;
      e.preventDefault();
      e.stopPropagation();
      openNew(to);
    };
    const onAux = (e: MouseEvent) => {
      if (e.button !== 1) return;
      const to = target(e);
      if (!to) return;
      e.preventDefault();
      e.stopPropagation();
      openNew(to, true);
    };
    document.addEventListener('click', onClick, true);
    document.addEventListener('auxclick', onAux, true);
    return () => { document.removeEventListener('click', onClick, true); document.removeEventListener('auxclick', onAux, true); };
  }, [openNew]);

  const tabs = useMemo(() => ({ set, activate, close, cycle, openHome, duplicate }), [set, activate, close, cycle, openHome, duplicate]);
  return useMemo(() => ({
    address: shown, stage: stageOf(shown, rememberedStage()), key: cameraKeyOf(space, active.key), view: active.place.view, setView, scroll, setScroll, openNew, tabs,
  }), [shown, space, active, setView, scroll, setScroll, openNew, tabs]);
}
