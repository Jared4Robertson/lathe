import { useCallback, useSyncExternalStore } from 'react';
import { isNumber, readPref, writePref } from '../shell/prefs';
import type { GraphLayout, GraphSettings } from './GraphPage';
import { NO_FILTERS } from './model';

// The one reader setting for the browser session, shared by every tab and every page (LA-V93-R72):
// how the graph is drawn (its layout, depth, kind filters and minimap), and whether the
// wiki card is open, how wide it is and whether it shows its summary or its whole page, and whether the desktop app's chat panel is open and how
// wide (LA-PLT-UC19). Moving through the stage (an arrow step, a click or Enter on a box, a link, a
// tab, Back or Forward) never changes it; only the person changing a setting does: the graph's
// toolbar, the v, +/- and w keys, the card's and the chat's buttons and resize handles. Every part
// of the page that reads it reads the one stored value, so a change in one is seen by all.
// Kept apart from GraphPage.tsx, which is loaded with import() when the graph is first shown.

export const SETTINGS_KEY = 'lathe:session-settings';
export const DEFAULT_GRAPH_SETTINGS: GraphSettings = { layout: 'tree', depth: 1, filters: NO_FILTERS, minimap: false };

/** The wiki card: open or collapsed, its width in px (null: a third of the open space), and whether it shows the whole page (More) or its summary (Less). */
export interface CardSettings { open: boolean; width: number | null; expanded: boolean }
export const DEFAULT_CARD: CardSettings = { open: true, width: null, expanded: false };
/** The card's narrowest, the width it stays readable at (a long title on whole words, a table with room for its columns), and its widest, in px. */
export const CARD_MIN = 360;
export const CARD_MAX = 900;

/** The desktop app's chat panel: open or closed, and its width in px (null: its default). */
export interface ChatSettings { open: boolean; width: number | null }
export const DEFAULT_CHAT: ChatSettings = { open: false, width: null };
/** The chat's narrowest, default and widest, in px. */
export const CHAT_MIN = 320;
export const CHAT_DEFAULT = 400;
export const CHAT_MAX = 760;

export interface SessionSettings { graph: GraphSettings; card: CardSettings; chat: ChatSettings }

interface Stored {
  layout: GraphLayout; depth: number; hiddenKinds: string[]; minimap: boolean;
  card: boolean; cardWidth: number | null; cardExpanded: boolean; chat: boolean; chatWidth: number | null;
}
/** Stored settings in today's form; anything else (an older form included) is dropped for the defaults. */
const isStored = (v: unknown): v is Stored => {
  if (!v || typeof v !== 'object') return false;
  const s = v as Stored;
  return (s.layout === 'tree' || s.layout === 'nested' || s.layout === 'voronoi') && isNumber(s.depth) && Array.isArray(s.hiddenKinds)
    && typeof s.minimap === 'boolean' && typeof s.card === 'boolean' && (s.cardWidth === null || isNumber(s.cardWidth)) && typeof s.cardExpanded === 'boolean'
    && typeof s.chat === 'boolean' && (s.chatWidth === null || isNumber(s.chatWidth));
};
const isAny = (_v: unknown): _v is unknown => true;
const clamp = (min: number, max: number) => (w: number | null) => (w === null ? null : Math.round(Math.min(max, Math.max(min, w))));
const clampWidth = clamp(CARD_MIN, CARD_MAX);
const clampChat = clamp(CHAT_MIN, CHAT_MAX);

/** The session's settings, or the defaults when none are stored. */
export function sessionSettings(): SessionSettings {
  const s = readPref<unknown>(SETTINGS_KEY, null, isAny, 'session');
  if (!isStored(s)) return { graph: DEFAULT_GRAPH_SETTINGS, card: DEFAULT_CARD, chat: DEFAULT_CHAT };
  return {
    graph: {
      layout: s.layout,
      depth: [1, 2, 3].includes(s.depth) ? s.depth : 1,
      filters: { hiddenKinds: new Set(s.hiddenKinds) },
      minimap: s.minimap,
    },
    card: { open: s.card, width: clampWidth(s.cardWidth), expanded: s.cardExpanded },
    chat: { open: s.chat, width: clampChat(s.chatWidth) },
  };
}

/** Sets the session's settings: only the person changing a setting calls this. */
export function saveSessionSettings({ graph: g, card, chat }: SessionSettings) {
  const stored: Stored = {
    layout: g.layout, depth: g.depth, hiddenKinds: [...g.filters.hiddenKinds], minimap: g.minimap,
    card: card.open, cardWidth: clampWidth(card.width), cardExpanded: card.expanded, chat: chat.open, chatWidth: clampChat(chat.width),
  };
  writePref(SETTINGS_KEY, stored, 'session');
  for (const listener of listeners) listener();
}

// The one value every reader shares: read again only when the stored text changes.
const listeners = new Set<() => void>();
let cached: { raw: string | null; value: SessionSettings } | null = null;
const rawStored = () => { try { return window.sessionStorage.getItem(SETTINGS_KEY); } catch { return null; } };
function current(): SessionSettings {
  const raw = rawStored();
  if (!cached || cached.raw !== raw) cached = { raw, value: sessionSettings() };
  return cached.value;
}
const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };

/** The session's settings, and the setters for the person's own changes. */
export function useSessionSettings() {
  const settings = useSyncExternalStore(subscribe, current, current);
  const setGraph = useCallback((graph: GraphSettings) => saveSessionSettings({ ...current(), graph }), []);
  const setCard = useCallback((patch: Partial<CardSettings>) => {
    const was = current();
    const card = { ...was.card, ...patch };
    card.width = clampWidth(card.width);
    if (card.open !== was.card.open || card.width !== was.card.width || card.expanded !== was.card.expanded) saveSessionSettings({ ...was, card });
  }, []);
  const setChat = useCallback((patch: Partial<ChatSettings>) => {
    const was = current();
    const chat = { ...was.chat, ...patch };
    chat.width = clampChat(chat.width);
    if (chat.open !== was.chat.open || chat.width !== was.chat.width) saveSessionSettings({ ...was, chat });
  }, []);
  return { graph: settings.graph, card: settings.card, chat: settings.chat, setGraph, setCard, setChat };
}
