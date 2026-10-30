import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { lastAddressMove, noteInEntry } from '../router';
import { isNumber, useAggregate } from '../shell/prefs';
import { productOfPath } from '../shell/spaces';
import type { SpecIndex } from '../specs/data';
import { addressOf, focusOf, isFocusPath, pathOf, type FocusRoute } from './address';
import { DEFAULT_VIEW, hereOf, type PlaceView } from './place';
import { currentTag, inStep } from './tabHistory';
import { CARD_SCROLL, namingStage, rememberedStage, stageOf, withStageIn, type PlaceApi } from './usePlace';
import { activateTab } from '../exploring/tab-set/commands/activate-tab';
import { closeTab } from '../exploring/tab-set/commands/close-tab';
import { cycleTab } from '../exploring/tab-set/commands/cycle-tab';
import { duplicateTab } from '../exploring/tab-set/commands/duplicate-tab';
import { newTab } from '../exploring/tab-set/commands/new-tab';
import { noteInTab } from '../exploring/tab-set/commands/note-in-tab';
import { updateView } from '../exploring/tab-set/commands/update-view';
import { activeTab, placeKeyOf, setOf, type Tab } from '../exploring/tab-set/model';
import { arrive, onActiveTabChangedMoveAddress, onPageOpenedMoveActiveTab, type Arrival } from '../exploring/tab-set/policies';
import { tabSetRepository } from '../exploring/tab-set/repository';
import { runTabSetCommand } from '../exploring/tab-set/run';

// The desktop app's tabs (the Tab set aggregate, exploring/tab-set/), one tab set per space, kept for the window's
// session with each tab's place and history, and the window's history kept in step with the active tab
// (tabHistory.ts, LA-PAT-APP-UX-R06). The page shows the active tab's place, so a tab switched to shows at once, before
// the window's address catches up. Arriving at an address is worked out while rendering, so no frame shows the tab
// before, and saved once rendered (the policy When a page opens, move the active tab there).

const isAddress = (address: string) => isFocusPath(address.split(/[?#]/)[0]);

export function usePageTabs(index: SpecIndex, route: FocusRoute, search: string): PlaceApi {
  const page = pathOf(route);
  const space = productOfPath(index, page) ?? index.byId.get(focusOf(route))?.product ?? '';
  const address = page + search;
  const tabs = useAggregate(tabSetRepository);
  const stored = setOf(tabs, space);

  // Arriving at an address: worked out while rendering (pure, so a second render gives the same), saved after it.
  const arrival = `${space}\n${address}`;
  const [arrived, setArrived] = useState<{ arrival: string; from: typeof stored; to: typeof stored; move: Arrival } | null>(null);
  if (arrived?.arrival !== arrival) {
    const move = arrived === null ? 'load' : lastAddressMove();
    const next = arrive(stored, space, address, move, currentTag(), tabSetRepository.load().view);
    setArrived({ arrival, from: stored, to: next.set, move: next });
  }
  const pending = !!arrived && arrived.arrival === arrival && arrived.from === stored && arrived.to !== stored;
  const set = pending ? arrived.to : stored;
  useLayoutEffect(() => {
    if (pending) onPageOpenedMoveActiveTab(arrived.move);
  }, [pending, arrived]);

  const active: Tab = activeTab(set) ?? { key: '', place: { history: [{ address: namingStage(address, rememberedStage()), note: {} }], at: 0, view: DEFAULT_VIEW } };
  const shown = hereOf(active.place).address;

  // The window follows the active tab (Active tab changed).
  const latest = useRef({ space, active });
  latest.current = { space, active };
  const tagOnly = !!arrived && arrived.arrival === arrival && arrived.move.tagOnly;
  const tagOnlyDone = useRef<string | null>(null);
  // Each rewrite done is looked at again: the active tab may have changed while it ran.
  const [rewrites, setRewrites] = useState(0);
  useEffect(() => {
    const once = tagOnly && tagOnlyDone.current !== arrival;
    if (once) tagOnlyDone.current = arrival;
    onActiveTabChangedMoveAddress(space, active, once, () => latest.current, () => setRewrites((n) => n + 1));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [space, active, shown, rewrites]);

  const spaceRef = useRef(space);
  spaceRef.current = space;
  const activeRef = useRef(active);
  activeRef.current = active;
  const stageNow = () => stageOf(hereOf(activeRef.current.place).address, rememberedStage());
  const home = () => withStageIn(addressOf(spaceRef.current), stageNow());

  const activate = useCallback((key: string) => runTabSetCommand(activateTab, { space: spaceRef.current, key }), []);
  const close = useCallback((key: string) => runTabSetCommand(closeTab, { space: spaceRef.current, key, home: home() }), []);
  const cycle = useCallback((step: number) => runTabSetCommand(cycleTab, { space: spaceRef.current, step }), []);
  const openNew = useCallback((to: string, background = false) => {
    runTabSetCommand(newTab, { space: spaceRef.current, address: namingStage(to, stageNow()), view: activeRef.current.place.view, background });
  }, []);
  const openHome = useCallback(() => openNew(home()), [openNew]);
  const duplicate = useCallback(() => {
    const key = setOf(tabSetRepository.load(), spaceRef.current).active;
    if (key) runTabSetCommand(duplicateTab, { space: spaceRef.current, key });
  }, []);
  const setView = useCallback((change: (v: PlaceView) => PlaceView) => runTabSetCommand(updateView, { space: spaceRef.current, change }), []);
  const scroll = useCallback(() => {
    const top = hereOf(activeRef.current.place).note[CARD_SCROLL];
    return isNumber(top) ? top : 0;
  }, []);
  const setScroll = useCallback((top: number) => {
    const value = Math.max(0, Math.round(top));
    const tab = activeRef.current;
    if (tab.key) runTabSetCommand(noteInTab, { space: spaceRef.current, key: tab.key, note: { [CARD_SCROLL]: value } });
    if (inStep(spaceRef.current, tab, hereOf(tab.place).address)) noteInEntry(CARD_SCROLL, value);
  }, []);

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

  const tabsApi = useMemo(() => ({ set, activate, close, cycle, openHome, duplicate }), [set, activate, close, cycle, openHome, duplicate]);
  return useMemo(() => ({
    address: shown, stage: stageOf(shown, rememberedStage()), key: placeKeyOf(space, active.key), view: active.place.view, setView, scroll, setScroll, openNew, tabs: tabsApi,
  }), [shown, space, active, setView, scroll, setScroll, openNew, tabsApi]);
}
