import { useCallback, useRef, useState } from 'react';
import { isNumber, readPref, writePref } from '../shell/prefs';
import type { GraphLayout, GraphSettings } from './GraphPage';
import { NO_FILTERS } from './model';

// The one reader setting for the browser session, shared by every tab and every page (LA-V93-R72):
// how the graph is drawn (its layout, depth, filters, Links switch and minimap), and whether the
// wiki card is open and how wide it is. Moving through the stage (an arrow step, a click or Enter
// on a box, a link, a tab, Back or Forward) never changes it; only the person changing a setting
// does: the graph's toolbar, the v, +/- and w keys, the card's button and its resize handle.
// Kept apart from GraphPage.tsx, which is loaded with import() when the graph is first shown.

export const SETTINGS_KEY = 'lathe:session-settings';
export const DEFAULT_GRAPH_SETTINGS: GraphSettings = { layout: 'tree', depth: 1, filters: NO_FILTERS, links: false, minimap: false };

/** The wiki card: open or collapsed, and its width in px (null: a third of the open space). */
export interface CardSettings { open: boolean; width: number | null }
export const DEFAULT_CARD: CardSettings = { open: true, width: null };
/** The card's narrowest and widest, in px. */
export const CARD_MIN = 300;
export const CARD_MAX = 900;

export interface SessionSettings { graph: GraphSettings; card: CardSettings }

interface Stored {
  layout: GraphLayout; depth: number; hiddenKinds: string[]; hiddenRelations: string[]; links: boolean; minimap: boolean;
  card: boolean; cardWidth: number | null;
}
/** Stored settings in today's form; anything else (an older form included) is dropped for the defaults. */
const isStored = (v: unknown): v is Stored => {
  if (!v || typeof v !== 'object') return false;
  const s = v as Stored;
  return (s.layout === 'tree' || s.layout === 'nested' || s.layout === 'voronoi') && isNumber(s.depth) && Array.isArray(s.hiddenKinds) && Array.isArray(s.hiddenRelations)
    && typeof s.links === 'boolean' && typeof s.minimap === 'boolean' && typeof s.card === 'boolean' && (s.cardWidth === null || isNumber(s.cardWidth));
};
const isAny = (_v: unknown): _v is unknown => true;
const clampWidth = (w: number | null) => (w === null ? null : Math.round(Math.min(CARD_MAX, Math.max(CARD_MIN, w))));

/** The session's settings, or the defaults when none are stored. */
export function sessionSettings(): SessionSettings {
  const s = readPref<unknown>(SETTINGS_KEY, null, isAny, 'session');
  if (!isStored(s)) return { graph: DEFAULT_GRAPH_SETTINGS, card: DEFAULT_CARD };
  return {
    graph: {
      layout: s.layout,
      depth: [1, 2, 3].includes(s.depth) ? s.depth : 1,
      filters: { hiddenKinds: new Set(s.hiddenKinds), hiddenRelations: new Set(s.hiddenRelations) },
      links: s.links,
      minimap: s.minimap,
    },
    card: { open: s.card, width: clampWidth(s.cardWidth) },
  };
}

/** Sets the session's settings: only the person changing a setting calls this. */
export function saveSessionSettings({ graph: g, card }: SessionSettings) {
  const stored: Stored = {
    layout: g.layout, depth: g.depth, hiddenKinds: [...g.filters.hiddenKinds], hiddenRelations: [...g.filters.hiddenRelations], links: g.links, minimap: g.minimap,
    card: card.open, cardWidth: clampWidth(card.width),
  };
  writePref(SETTINGS_KEY, stored, 'session');
}

/** The session's settings, and the setters for the person's own changes. */
export function useSessionSettings() {
  const [settings, setState] = useState(sessionSettings);
  const latest = useRef(settings);
  latest.current = settings;
  const save = useCallback((next: SessionSettings) => { latest.current = next; saveSessionSettings(next); setState(next); }, []);
  const setGraph = useCallback((graph: GraphSettings) => save({ ...latest.current, graph }), [save]);
  const setCard = useCallback((patch: Partial<CardSettings>) => {
    const card = { ...latest.current.card, ...patch };
    card.width = clampWidth(card.width);
    if (card.open !== latest.current.card.open || card.width !== latest.current.card.width) save({ ...latest.current, card });
  }, [save]);
  return { graph: settings.graph, card: settings.card, setGraph, setCard };
}
