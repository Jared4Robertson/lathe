import { useSyncExternalStore } from 'react';
import { readPref, writePref } from '../shell/prefs';
import { VIEW_NAMES, type ViewName } from './address';

// The side bar's state (LA-EXP-UC12), apart from React: which views it has, how it opens in each
// view mode, and what the canvases tell it about the node under the pointer or selected.
//
// - The mode is what the main area shows: the wiki alone, or the graph, the ERD or the Trace view
//   (the first of them open beside the wiki). Each mode has its own open state and view, kept per
//   tab and, for a space's first tab, as last used.
// - Closed in the Wiki view, which shows the record's facts itself, and in the Trace view, whose
//   matrix wants the width; open in the Graph and ERD views.

export const SIDE_VIEWS = ['details', 'outline', 'history'] as const;
export type SideView = (typeof SIDE_VIEWS)[number];
export const SIDE_VIEW_LABELS: Record<SideView, string> = { details: 'Details', outline: 'Outline', history: 'History' };
export const SIDE_VIEW_ICONS: Record<SideView, string> = { details: 'info', outline: 'outline', history: 'history' };

/** The side bar's mode: the view it describes. */
export type SideMode = ViewName;
export interface SideModeState { open: boolean; view: SideView }
export type SideState = Partial<Record<SideMode, SideModeState>>;

export const SIDE_DEFAULTS: Record<SideMode, SideModeState> = {
  wiki: { open: false, view: 'details' },
  graph: { open: true, view: 'details' },
  erd: { open: true, view: 'details' },
  trace: { open: false, view: 'details' },
};

/** The last choices made in each mode, for a space's first tab. */
export const SIDE_KEY = 'lathe:side-bar';

/** The mode for the open views: the first view open beside the wiki, else the wiki. On a phone, the one view shown. */
export function sideModeOf(open: readonly ViewName[], narrow: boolean): SideMode {
  if (narrow) return open[0] ?? 'wiki';
  return open.find((v) => v !== 'wiki') ?? 'wiki';
}

const isSideView = (v: unknown): v is SideView => typeof v === 'string' && (SIDE_VIEWS as readonly string[]).includes(v);

/** Reads a stored side bar state, keeping only well-formed modes. */
export function sideStateFrom(v: unknown): SideState {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return {};
  const out: SideState = {};
  for (const mode of VIEW_NAMES) {
    const m = (v as Record<string, unknown>)[mode] as Partial<SideModeState> | undefined;
    if (m && typeof m === 'object' && typeof m.open === 'boolean' && isSideView(m.view)) out[mode] = { open: m.open, view: m.view };
  }
  return out;
}

const isAny = (_v: unknown): _v is unknown => true;
export const lastSideState = (): SideState => sideStateFrom(readPref<unknown>(SIDE_KEY, null, isAny));
export function saveLastSide(mode: SideMode, state: SideModeState) {
  writePref(SIDE_KEY, { ...lastSideState(), [mode]: state });
}

/** A tab's side bar in one mode: the tab's own, else the last used, else the default. */
export function sideFor(tabState: SideState | undefined, mode: SideMode): SideModeState {
  return tabState?.[mode] ?? lastSideState()[mode] ?? SIDE_DEFAULTS[mode];
}

// ---------- What the canvases tell the side bar ----------

/**
 * The node a canvas has under the pointer or keyboard focus (`hover`, the spotlight)
 * and the one selected (`selected`: tapped once, or a wiki row focused or right-clicked). It is a
 * small store, so a hover redraws only the side bar, never the canvas.
 */
export interface Peek { hover: string | null; selected: string | null }
export interface PeekStore {
  get: () => Peek;
  set: (kind: keyof Peek, id: string | null) => void;
  clear: () => void;
  subscribe: (listener: () => void) => () => void;
}

export function createPeekStore(): PeekStore {
  let peek: Peek = { hover: null, selected: null };
  const listeners = new Set<() => void>();
  const emit = () => { for (const l of listeners) l(); };
  return {
    get: () => peek,
    set: (kind, id) => {
      if (peek[kind] === id) return;
      peek = { ...peek, [kind]: id };
      emit();
    },
    clear: () => {
      if (!peek.hover && !peek.selected) return;
      peek = { hover: null, selected: null };
      emit();
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

export const usePeek = (store: PeekStore): Peek => useSyncExternalStore(store.subscribe, store.get, store.get);
