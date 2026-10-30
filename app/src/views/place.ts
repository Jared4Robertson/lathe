import { isNumber } from '../shell/prefs';
import { DEFAULT_TRACE_VIEW, isTraceView, type TraceViewName } from '../trace/views';

// A place is where the Reader explores: one focus on one stage (both in its address), the camera over it, the
// graph's depth and kind filters, the Trace's view, the wiki card's open and expanded state and scroll, and its own Back and Forward.
// On the web a browser tab is one place (usePlace.ts); in the desktop app each of the app's tabs is one (tabs.ts).
// How the Reader likes to see things (the appearance, the graph's layout and minimap, the card's width, the Changes
// lens) is not a place's: it is the window's (graph/settings.ts).
//
// These are pure functions over a Place, so the web's one place and the desktop app's tabs share them.

/** One entry of a place's history: an address (path and query) and what the page noted in it (the card's scroll). */
export interface Entry {
  address: string;
  note: Record<string, unknown>;
}

/** What a place keeps besides its address: the graph's depth and hidden kinds, the Trace's view, and the wiki card's open and expanded state. */
export interface PlaceView {
  depth: number;
  hiddenKinds: string[];
  /** The Trace stage's view: All at once or Delivery (trace/views.ts). */
  trace: TraceViewName;
  card: { open: boolean; expanded: boolean };
}

export interface Place {
  /** Its history, oldest first; never empty. */
  history: Entry[];
  /** The entry shown now. */
  at: number;
  view: PlaceView;
}

/** The most entries a place's history keeps: the oldest are dropped past it. */
export const MAX_HISTORY = 50;

export const DEFAULT_VIEW: PlaceView = { depth: 1, hiddenKinds: [], trace: DEFAULT_TRACE_VIEW, card: { open: true, expanded: false } };

/** A place at an address, with a fresh history. */
export const freshPlace = (address: string, view: PlaceView): Place => ({ history: [{ address, note: {} }], at: 0, view });

/** The entry a place shows now. */
export const hereOf = (place: Place): Entry => place.history[place.at];

/** A move to an address: the entries after the current one are dropped, and the address becomes the newest. */
export function movePlace(place: Place, address: string): Place {
  if (hereOf(place).address === address) return place;
  const history = [...place.history.slice(0, place.at + 1), { address, note: {} }].slice(-MAX_HISTORY);
  return { ...place, history, at: history.length - 1 };
}

/** The current entry at another address (a stage switched on the same page): its note is kept. */
export function replacePlace(place: Place, address: string): Place {
  if (hereOf(place).address === address) return place;
  return { ...place, history: place.history.map((e, i) => (i === place.at ? { ...e, address } : e)) };
}

/** Back (-1) and Forward (+1) within the place's history, or to an entry by its index; out of range, nothing. */
export function stepPlace(place: Place, to: number): Place {
  return to === place.at || to < 0 || to >= place.history.length ? place : { ...place, at: to };
}

/** Notes values in the current entry. */
export function notePlace(place: Place, note: Record<string, unknown>): Place {
  const here = hereOf(place);
  if (Object.entries(note).every(([k, v]) => here.note[k] === v)) return place;
  return { ...place, history: place.history.map((e, i) => (i === place.at ? { ...e, note: { ...e.note, ...note } } : e)) };
}

export function setView(place: Place, change: (view: PlaceView) => PlaceView): Place {
  const view = change(place.view);
  return view === place.view ? place : { ...place, view };
}

// ---------- Stored places ----------

const isString = (v: unknown): v is string => typeof v === 'string';

/** A stored view, or the default for anything malformed. */
export function readView(value: unknown): PlaceView {
  if (!value || typeof value !== 'object') return DEFAULT_VIEW;
  const v = value as Partial<PlaceView>;
  const card = v.card && typeof v.card === 'object' ? v.card : DEFAULT_VIEW.card;
  return {
    depth: isNumber(v.depth) && [1, 2, 3].includes(v.depth) ? v.depth : DEFAULT_VIEW.depth,
    hiddenKinds: Array.isArray(v.hiddenKinds) ? v.hiddenKinds.filter(isString) : [],
    trace: isTraceView(v.trace) ? v.trace : DEFAULT_TRACE_VIEW,
    card: { open: typeof card.open === 'boolean' ? card.open : true, expanded: card.expanded === true },
  };
}

/**
 * Reads a stored place, dropping any entry whose address `isAddress` does not accept; null when no entry is left.
 */
export function readPlace(value: unknown, isAddress: (address: string) => boolean): Place | null {
  if (!value || typeof value !== 'object') return null;
  const raw = value as { history?: unknown; at?: unknown; view?: unknown };
  if (!Array.isArray(raw.history)) return null;
  const at = isNumber(raw.at) ? raw.at : 0;
  const history: Entry[] = [];
  let kept = 0;
  raw.history.forEach((e: unknown, i: number) => {
    if (!e || typeof e !== 'object') return;
    const { address, note } = e as { address?: unknown; note?: unknown };
    if (!isString(address) || !isAddress(address)) return;
    history.push({ address, note: note && typeof note === 'object' && !Array.isArray(note) ? (note as Record<string, unknown>) : {} });
    if (i <= at) kept = history.length - 1;
  });
  if (history.length === 0) return null;
  return { history, at: kept, view: readView(raw.view) };
}
