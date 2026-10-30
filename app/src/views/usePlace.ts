import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { entryState, navigate, noteInEntry } from '../router';
import { desktopBridge } from '../shell/desktopChrome';
import { isNumber, useAggregate } from '../shell/prefs';
import type { SpecIndex } from '../specs/data';
import { pathOf, stageFromSearch, type FocusRoute, type StageName } from './address';
import type { PlaceView } from './place';
import { updateView } from '../exploring/tab-set/commands/update-view';
import type { TabSet } from '../exploring/tab-set/model';
import { tabSetRepository } from '../exploring/tab-set/repository';
import { runTabSetCommand } from '../exploring/tab-set/run';
import { usePageTabs } from './useTabs';

// The place the focus page shows (place.ts), the same to the page whichever host holds it:
// - on the web a browser tab is one place: its focus and stage are the address, its depth, filters and wiki card are
//   kept in the tab's sessionStorage, its history is the browser's own, and a new place is a new browser tab;
// - in the desktop app each of the app's tabs is one (useTabs.ts), and the address follows the active tab.
// Where the Reader is belongs to the place; how they like to see things is the window's (graph/settings.ts).

/** The key an entry notes the wiki card's scroll under. */
export const CARD_SCROLL = 'cardScroll';

export interface TabsApi {
  set: TabSet;
  activate: (key: string) => void;
  close: (key: string) => void;
  cycle: (step: number) => void;
  /** A new tab at the product, with the active tab's stage, depth and filters (Cmd/Ctrl+T). */
  openHome: () => void;
  /** A copy of the active tab, with its history. */
  duplicate: () => void;
}

export interface PlaceApi {
  /** The address the page shows, path and query: the active tab's in the desktop app, the window's on the web. */
  address: string;
  /** The stage the place shows: the one its address names, else the one it was on. */
  stage: StageName;
  /** Changes when another place shows (another tab): what keeps the camera and the card's scroll apart. */
  key: string;
  view: PlaceView;
  setView: (change: (view: PlaceView) => PlaceView) => void;
  /** The wiki card's scroll noted in the place's current entry: 0 for a page just opened. */
  scroll: () => number;
  setScroll: (top: number) => void;
  /** Opens an address in a new place, with this one's stage unless it names one: a new tab, or a new browser tab on the web. */
  openNew: (address: string, background?: boolean) => void;
  /** The app's tabs in the desktop app; null on the web, whose tabs are the browser's. */
  tabs: TabsApi | null;
}

// ---------- The stage an address names ----------

/** The stage last chosen (the Tab set's): what a place starts on when its address names none. */
export const rememberedStage = (): StageName => tabSetRepository.load().stage;

/** The stage of an address: the one it names, or else `fallback`. */
export const stageOf = (address: string, fallback: StageName): StageName => stageFromSearch(searchOf(address)) ?? fallback;
const searchOf = (address: string) => { const q = address.indexOf('?'); return q < 0 ? '' : address.slice(q).split('#')[0]; };

/** An address with its stage set (`/LA-EXP?stage=erd`), the rest of its query kept. */
export function withStageIn(address: string, stage: StageName): string {
  const hashAt = address.indexOf('#');
  const hash = hashAt < 0 ? '' : address.slice(hashAt);
  const bare = hashAt < 0 ? address : address.slice(0, hashAt);
  const q = bare.indexOf('?');
  const path = q < 0 ? bare : bare.slice(0, q);
  const params = new URLSearchParams(q < 0 ? '' : bare.slice(q));
  params.set('stage', stage);
  return `${path}?${params.toString().replace(/%2F/gi, '/')}${hash}`;
}

/** An address that names a stage: as it is, or with `stage` added. */
export const namingStage = (address: string, stage: StageName) => (stageFromSearch(searchOf(address)) ? address : withStageIn(address, stage));

// ---------- A new place from anywhere ----------

let opener: ((address: string, background?: boolean) => void) | null = null;

/**
 * Opens an address in a new place from outside the focus page (quick open's Cmd/Ctrl+Enter): a new tab beside the
 * shown place's, or a new browser tab on the web; with no place shown, the window goes there.
 */
export function openInNewPlace(address: string) {
  if (opener) opener(address);
  else if (desktopBridge()) navigate(address);
  else window.open(address, '_blank');
}

/** Lets the shown place open new places for the rest of the app. */
export function useNewPlaceOpener(openNew: PlaceApi['openNew']) {
  useEffect(() => {
    opener = openNew;
    return () => { if (opener === openNew) opener = null; };
  }, [openNew]);
}

// ---------- The place ----------

/** The focus page's place: the active tab's in the desktop app, the browser tab's on the web. */
export function usePlace(index: SpecIndex, route: FocusRoute, search: string): PlaceApi {
  // Whether the app runs in the desktop shell does not change while it runs.
  const [desktop] = useState(() => desktopBridge() !== null);
  return desktop ? usePageTabs(index, route, search) : useBrowserPlace(route, search);
}

/** The web's one place: the browser tab's. */
function useBrowserPlace(route: FocusRoute, search: string): PlaceApi {
  const address = pathOf(route) + search;
  // The browser tab's one place keeps its view as the view last set (the Tab set's).
  const { view } = useAggregate(tabSetRepository);
  const setView = useCallback((change: (view: PlaceView) => PlaceView) => runTabSetCommand(updateView, { space: null, change }), []);

  // An address that names no stage (a link in the card, a tool opened over the stage) keeps the stage shown before.
  const stage = useRef<StageName>(stageFromSearch(search) ?? rememberedStage());
  const named = stageFromSearch(search);
  if (named) stage.current = named;

  const scroll = useCallback(() => { const top = entryState<number>(CARD_SCROLL); return isNumber(top) ? top : 0; }, []);
  const setScroll = useCallback((top: number) => noteInEntry(CARD_SCROLL, Math.max(0, Math.round(top))), []);
  // The browser opens it, and a page opened from this one starts with a copy of its sessionStorage: its depth and filters.
  const openNew = useCallback((to: string) => { window.open(namingStage(to, stage.current), '_blank'); }, []);
  const shown = stage.current;
  return useMemo(() => ({ address, stage: shown, key: 'place', view, setView, scroll, setScroll, openNew, tabs: null }), [address, shown, view, setView, scroll, setScroll, openNew]);
}
