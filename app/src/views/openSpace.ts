import { createContext, useContext, useEffect, useLayoutEffect, useMemo, useState, useSyncExternalStore, type RefObject } from 'react';
import { CARD_MIN } from '../graph/settings';

// The open space over the stage (LA-V96): the part of the stage no floating panel covers, where
// the stage frames its focus. It is measured from the panels' own rectangles, never from widths
// assumed in code: every floating panel carries `data-floating` with the side it sits on (left,
// right, top or bottom), and the open space runs from the innermost edge of each side's panels,
// plus a gap, to the next. A stage's own tools (the graph's toolbar, the ERD's key) float inside
// the open space, so they cannot decide it (that would feed back into their own place): they carry
// `data-stage-tools` with the side they sit on, and only the frame, the space the camera fits the
// focus into, gives them room.
//
// The measure runs when the stage or a panel changes size (a ResizeObserver on each), when a
// panel comes or goes (a MutationObserver on the panels' parents, children only), and on a window
// resize. It writes the insets as CSS variables on the stage (`--open-left` … and `--frame-left`
// …), and the foot of the stage's tools at its top on the stage's parent (`--tools-foot`), where the
// wiki card reads it to sit just under that row (LA-V96-R19), all with no React render, and tells
// the stages through a small store, so a camera moves only when the open space really changed.

export interface Insets { left: number; top: number; right: number; bottom: number }
export interface OpenSpace {
  /** What the floating panels leave of the stage, as insets from its edges. */
  open: Insets;
  /** The open space less the stage's own tools: where the camera frames the focus. */
  frame: Insets;
}

/** The room kept between a panel and what the stage frames, in px. */
export const OPEN_GAP = 8;
const SIDES = ['left', 'top', 'right', 'bottom'] as const;
const NONE: Insets = { left: 0, top: 0, right: 0, bottom: 0 };
const same = (a: Insets, b: Insets) => SIDES.every((s) => Math.abs(a[s] - b[s]) < 0.5);

export interface OpenSpaceStore {
  /** The measure, or null before the first one, so a stage never frames on a guess. */
  get: () => OpenSpace | null;
  subscribe: (listener: () => void) => () => void;
  /** Sets the measure; tells the listeners only when it changed. */
  set: (next: OpenSpace) => void;
}

export function createOpenSpaceStore(): OpenSpaceStore {
  let value: OpenSpace | null = null;
  const listeners = new Set<() => void>();
  return {
    get: () => value,
    subscribe: (l) => { listeners.add(l); return () => { listeners.delete(l); }; },
    set: (next) => {
      if (value && same(next.open, value.open) && same(next.frame, value.frame)) return;
      value = next;
      for (const l of listeners) l();
    },
  };
}

type Rect = Pick<DOMRect, 'left' | 'top' | 'right' | 'bottom' | 'width' | 'height'>;
export interface Panel { side: string; rect: Rect }

/**
 * The open space a stage's rectangle leaves among panels: from each side, past the innermost
 * edge of that side's panels (and a gap). A panel of no size (collapsed, hidden) leaves nothing.
 */
export function openInsets(stage: Rect, panels: readonly Panel[], gap = OPEN_GAP): Insets {
  const out = { ...NONE };
  for (const { side, rect: r } of panels) {
    if (r.width <= 0 || r.height <= 0) continue;
    if (side === 'left') out.left = Math.max(out.left, r.right - stage.left + gap);
    else if (side === 'right') out.right = Math.max(out.right, stage.right - r.left + gap);
    else if (side === 'top') out.top = Math.max(out.top, r.bottom - stage.top + gap);
    else if (side === 'bottom') out.bottom = Math.max(out.bottom, stage.bottom - r.top + gap);
  }
  return out;
}

/** The frame: the open space less the stage's tools on each side. */
export function frameInsets(open: Insets, tools: readonly Panel[], gap = OPEN_GAP): Insets {
  const out = { ...open };
  for (const { side, rect: r } of tools) {
    if (r.width <= 0 || r.height <= 0) continue;
    if (side === 'top') out.top = Math.max(out.top, open.top + r.height + gap);
    else if (side === 'bottom') out.bottom = Math.max(out.bottom, open.bottom + r.height + gap);
  }
  return out;
}

const panelsIn = (root: ParentNode, attr: 'floating' | 'stageTools'): Panel[] =>
  [...root.querySelectorAll<HTMLElement>(attr === 'floating' ? '[data-floating]' : '[data-stage-tools]')].map((el) => ({
    side: (attr === 'floating' ? el.dataset.floating : el.dataset.stageTools) ?? '',
    rect: el.getBoundingClientRect(),
  }));

/**
 * Measures the open space over `stage` among the floating panels in `root` (the app), writes it on
 * the stage as CSS variables and into `store`.
 */
export function useOpenSpaceMeasure(stage: RefObject<HTMLElement | null>, store: OpenSpaceStore, root: RefObject<HTMLElement | null>) {
  useLayoutEffect(() => {
    const el = stage.current;
    const scope = root.current?.closest('.app') ?? root.current;
    if (!el || !scope) return;
    const measure = () => {
      const open = openInsets(el.getBoundingClientRect(), panelsIn(scope, 'floating'));
      const frame = frameInsets(open, panelsIn(el, 'stageTools'));
      for (const s of SIDES) {
        el.style.setProperty(`--open-${s}`, `${Math.round(open[s])}px`);
        el.style.setProperty(`--frame-${s}`, `${Math.round(frame[s])}px`);
      }
      // The card is the stage's sibling; it floats on the right, so where it sits never moves this top.
      el.parentElement?.style.setProperty('--tools-foot', `${Math.round(frame.top - OPEN_GAP)}px`);
      store.set({ open, frame });
    };
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const sizes = new ResizeObserver(measure);
    const watched = new Set<Element>();
    const watch = () => {
      const now = new Set<Element>([el, ...scope.querySelectorAll('[data-floating]'), ...el.querySelectorAll('[data-stage-tools]')]);
      for (const w of watched) if (!now.has(w)) { sizes.unobserve(w); watched.delete(w); }
      for (const w of now) if (!watched.has(w)) { sizes.observe(w); watched.add(w); }
    };
    watch();
    // A panel or a stage's tools coming or going: a burst of changes is measured once, after it.
    let queued = false;
    let live = true;
    const later = () => {
      if (queued) return;
      queued = true;
      queueMicrotask(() => { queued = false; if (live) { watch(); measure(); } });
    };
    // The panels' parents (the app, the page's layout), their children only; and the stage, whose
    // tools come with its content (a lazily loaded stage, an ERD laid out).
    const comings = new MutationObserver(later);
    const parents = new Set<Element>([scope, ...[...scope.querySelectorAll('[data-floating]')].map((p) => p.parentElement).filter((p): p is HTMLElement => !!p)]);
    for (const p of parents) comings.observe(p, { childList: true });
    comings.observe(el, { childList: true, subtree: true });
    window.addEventListener('resize', measure);
    return () => {
      live = false;
      sizes.disconnect();
      comings.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [stage, store, root]);
}

/** The open space and frame, for a stage that frames its focus in them; null outside a stage. */
export const useOpenSpace = (store: OpenSpaceStore | undefined): OpenSpace | null =>
  useSyncExternalStore(store?.subscribe ?? noSubscribe, store?.get ?? noValue, store?.get ?? noValue);
const noSubscribe = () => () => {};
const noValue = () => null;

// ---------- Room: panels never crowd the page (LA-PAT-APP-UX-R18) ----------
//
// Every panel has a readable width: the wiki card shrinks to CARD_MIN and no further, the nav and the
// side bar keep the width they were given, and the stage's open space keeps at least STAGE_MIN. When
// the window can't hold every open panel at its readable width, panels collapse for space, in a set
// order: the side bar first, then the wiki card, then the nav. The chat is the Reader's task at hand
// and never collapses for space. They reopen in reverse order as the window grows. A collapse for
// space is never the Reader's choice: their open or closed setting stays as they set it, and the
// panel's toggle shows it is collapsed for space. A panel the Reader opens while it is collapsed for
// space is held open (the next panel in the order gives way instead) until it would fit anyway, or
// they close it.

/**
 * The narrowest the stage's open space may get before panels collapse for space, in px, between the
 * gaps at its edges: room for a column of the graph or a box of the ERD. With the chat open, 1456 px
 * keeps the nav, the wiki card and the chat open, only the side bar giving way; at 1440 px the card
 * gives way too.
 */
export const STAGE_MIN = 300;
/**
 * The wiki card's gap from what is at its right (the side bar, the chat or the window), in px: well wider than the
 * panels' own gap (`--float-inset`), so the card floats in the map with room to its right.
 */
export const CARD_GAP = 28;
/** The card's gap from the stage's tools above it and the window's foot below it, in px: the same as at its right. */
export const CARD_GAP_Y = 28;
/** A panel that collapses when the window is too narrow for every open panel. */
export type CrowdPanel = 'sideBar' | 'card' | 'nav';
/** The order panels collapse in as the window narrows; they reopen in reverse. */
const CROWD_ORDER: readonly CrowdPanel[] = ['sideBar', 'card', 'nav'];
const CROWD_NAMES: Record<CrowdPanel, string> = { sideBar: 'side bar', card: 'wiki card', nav: 'navigation' };

/** What the window has to hold: the panels the Reader has open, at their widths, in px. */
export interface Room {
  /** The window's width. */
  width: number;
  /** The gap between the window and each panel, and between panels (`--float-inset`). */
  inset: number;
  /** The nav: open (as against its rail) by the Reader's choice, its width and its rail's. */
  nav: { open: boolean; width: number; rail: number };
  /** Whether the page has a wiki card the Reader has open. */
  card: boolean;
  /** The side bar's width while the Reader has it open; null when closed or on a page with none. */
  sideBar: number | null;
  /** The chat's width while it shows; null when hidden. */
  chat: number | null;
  /** The panels the Reader opened while they were collapsed for space. */
  held: ReadonlySet<CrowdPanel>;
}

const isOpen = (room: Room, panel: CrowdPanel) => (panel === 'nav' ? room.nav.open : panel === 'card' ? room.card : room.sideBar !== null);

/** The width of the stage's open space with the panels in `collapsed` collapsed. */
export function openWidth(room: Room, collapsed: ReadonlySet<CrowdPanel>): number {
  const { inset } = room;
  const navShown = room.nav.open && !collapsed.has('nav');
  const navRight = inset + (navShown ? room.nav.width : room.nav.rail);
  const card = room.card && !collapsed.has('card');
  const sideBar = room.sideBar !== null && !collapsed.has('sideBar') ? room.sideBar : null;
  const left = navRight + OPEN_GAP;
  // On the right, from the window's edge inward: the chat, the side bar, then the wiki card.
  const chatSpace = room.chat !== null ? room.chat + 2 * inset : inset;
  const sideSpace = sideBar !== null ? sideBar + inset + chatSpace : chatSpace;
  let right = 0;
  if (card) right = sideSpace - inset + CARD_GAP + CARD_MIN + OPEN_GAP;
  else if (sideBar !== null) right = sideSpace + OPEN_GAP;
  else if (room.chat !== null) right = chatSpace - inset + OPEN_GAP;
  return room.width - left - right;
}

/** The panels collapsed for space: the fewest, taken in CROWD_ORDER, that leave the stage STAGE_MIN. */
export function crowded(room: Room): ReadonlySet<CrowdPanel> {
  const out = new Set<CrowdPanel>();
  for (const panel of CROWD_ORDER) {
    if (openWidth(room, out) >= STAGE_MIN) break;
    if (!room.held.has(panel) && isOpen(room, panel)) out.add(panel);
  }
  return out;
}

/** What a page tells the shell about its own panels: whether its wiki card is open, and its side bar's width while open. */
export interface PageRoom { card: boolean; sideBar: number | null }

interface RoomApi {
  /** The panels collapsed for space now. */
  crowded: ReadonlySet<CrowdPanel>;
  /** A page sets its panels' room as it lays out, and null as it goes. */
  setPage: (page: PageRoom | null) => void;
  /** Holds a panel open while it is collapsed for space (the Reader asked for it), or lets it go. */
  hold: (panel: CrowdPanel, on: boolean) => void;
}

const NOTHING: ReadonlySet<CrowdPanel> = new Set<CrowdPanel>();
export const RoomContext = createContext<RoomApi>({ crowded: NOTHING, setPage: () => {}, hold: () => {} });
/** The panels collapsed for space, and how a page reports its own. */
export const useRoom = () => useContext(RoomContext);

/** A page's side of the rule: it tells the shell its panels while it shows them, before paint. */
export function usePageRoom(card: boolean, sideBar: number | null) {
  const { setPage } = useRoom();
  useLayoutEffect(() => {
    setPage({ card, sideBar });
    return () => setPage(null);
  }, [setPage, card, sideBar]);
}

const sameSet = (a: ReadonlySet<CrowdPanel>, b: ReadonlySet<CrowdPanel>) => a.size === b.size && [...a].every((p) => b.has(p));

/**
 * The shell's side of the rule: follows the window's width, takes the page's panels, and works out
 * which panels collapse for space. Off (nothing collapses) on a phone, where panels are sheets.
 */
export function useRoomState(shell: Pick<Room, 'nav' | 'chat'>, off: boolean): RoomApi {
  const [width, setWidth] = useState(() => window.innerWidth);
  useEffect(() => {
    const update = () => setWidth(window.innerWidth);
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);
  const [page, setPage] = useState<PageRoom | null>(null);
  const [held, setHeld] = useState<ReadonlySet<CrowdPanel>>(NOTHING);
  const [inset] = useState(() => parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--float-inset')) || OPEN_GAP);
  const room: Room = { ...shell, width, inset, card: page?.card ?? false, sideBar: page?.sideBar ?? null, held: NOTHING };
  // A hold on an open panel lasts only while the panel would otherwise collapse: once it would fit
  // anyway it goes, so a window that narrows again collapses it in its turn.
  const unheld = off ? NOTHING : crowded(room);
  const kept = held.size === 0 ? held : new Set([...held].filter((p) => !isOpen(room, p) || unheld.has(p)));
  const result = off ? NOTHING : kept.size === 0 ? unheld : crowded({ ...room, held: kept });
  useLayoutEffect(() => { if (!sameSet(kept, held)) setHeld(kept); });
  const [api] = useState(() => ({
    setPage: (next: PageRoom | null) => setPage((was) => (was === next || (was && next && was.card === next.card && was.sideBar === next.sideBar) ? was : next)),
    hold: (panel: CrowdPanel, on: boolean) => setHeld((was) => {
      if (was.has(panel) === on) return was;
      const next = new Set(was);
      if (on) next.add(panel); else next.delete(panel);
      return next;
    }),
  }));
  // The same panels keep the same set, so the pages under the shell draw again only when it changes.
  const [shown, setShown] = useState(result);
  const crowdedNow = sameSet(shown, result) ? shown : result;
  useLayoutEffect(() => { if (crowdedNow !== shown) setShown(crowdedNow); }, [crowdedNow, shown]);
  return useMemo(() => ({ crowded: crowdedNow, setPage: api.setPage, hold: api.hold }), [crowdedNow, api]);
}

/** The tooltip and accessible name of a panel's toggle while it is collapsed for space. */
export const crowdedLabel = (panel: CrowdPanel) => `Show the ${CROWD_NAMES[panel]} (collapsed to give the stage room)`;
