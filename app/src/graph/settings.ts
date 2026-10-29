import { useCallback, useSyncExternalStore } from 'react';
import { isNumber, readPref, writePref } from '../shell/prefs';
import type { GraphLayout, GraphSettings } from './GraphPage';
import { NO_FILTERS } from './model';
import type { LookMark, Since } from '../changes/changes';

// How the Reader likes to see things, for the window's session, shared by every tab and every page (LA-V93-R72):
// the graph's layout and minimap, how wide the wiki card is, whether the desktop app's chat panel is open and how
// wide (LA-PLT-UC19), and the Changes lens (LA-EXP-UC15): whether it is on, the baseline it compares with, whether
// Follow is on, and the moment the Reader last looked at each product. Where the Reader is (the focus, the stage, the
// depth, the kind filters, the wiki card's open and expanded state) is not here: it is the place's (views/place.ts).
// Moving through the stage (an arrow step, a click or Enter on a box, a link, a tab, Back or Forward) never changes
// it; only the person changing a setting does: the graph's toolbar, the v key, the card's and the chat's resize
// handles. Every part of the page that reads it reads the one stored value, so a change in one is seen by all.
// Kept apart from GraphPage.tsx, which is loaded with import() when the graph is first shown.

export const SETTINGS_KEY = 'lathe:session-settings';
/** The graph as a place starts it: the window's look with the least depth and no kind hidden (GraphView's own, with no host). */
export const DEFAULT_GRAPH_SETTINGS: GraphSettings = { layout: 'tree', depth: 1, filters: NO_FILTERS, minimap: false };

/** How the graph is drawn, the window's: its layout and whether the minimap shows. */
export type GraphLook = Pick<GraphSettings, 'layout' | 'minimap'>;
export const DEFAULT_GRAPH_LOOK: GraphLook = { layout: 'tree', minimap: false };

/** The wiki card's width in px (null: a third of the open space). Whether it is open or expanded is the place's. */
export interface CardSettings { width: number | null }
export const DEFAULT_CARD: CardSettings = { width: null };
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

/**
 * The Changes lens (changes/changes.ts): on or off, the baseline it compares with, Follow, and by product the moment
 * the Reader last looked at it (set as they dismiss the lens or leave the product).
 */
export interface ChangeSettings { lens: boolean; since: Since; follow: boolean; looked: Record<string, LookMark> }
export const DEFAULT_CHANGES: ChangeSettings = { lens: false, since: 'commit', follow: false, looked: {} };

export interface SessionSettings { graph: GraphLook; card: CardSettings; chat: ChatSettings; changes: ChangeSettings }

interface Stored {
  layout: GraphLayout; minimap: boolean;
  cardWidth: number | null; chat: boolean; chatWidth: number | null;
  lens: boolean; since: Since; follow: boolean; looked: Record<string, LookMark>;
}
const isMark = (v: unknown): v is LookMark => {
  const m = v as LookMark;
  return !!m && typeof m === 'object' && (m.commit === null || typeof m.commit === 'string') && typeof m.at === 'string' && !!m.delta && typeof m.delta === 'object';
};
/** Stored settings in today's form; anything else (an older form included) is dropped for the defaults. */
const isStored = (v: unknown): v is Stored => {
  if (!v || typeof v !== 'object') return false;
  const s = v as Stored;
  return typeof s.layout === 'string'
    && typeof s.minimap === 'boolean' && (s.cardWidth === null || isNumber(s.cardWidth))
    && typeof s.chat === 'boolean' && (s.chatWidth === null || isNumber(s.chatWidth))
    && typeof s.lens === 'boolean' && (s.since === 'commit' || s.since === 'branch' || s.since === 'looked') && typeof s.follow === 'boolean'
    && !!s.looked && typeof s.looked === 'object' && Object.values(s.looked).every(isMark);
};
const isAny = (_v: unknown): _v is unknown => true;
const clamp = (min: number, max: number) => (w: number | null) => (w === null ? null : Math.round(Math.min(max, Math.max(min, w))));
const clampWidth = clamp(CARD_MIN, CARD_MAX);
const clampChat = clamp(CHAT_MIN, CHAT_MAX);

/** The session's settings, or the defaults when none are stored. */
export function sessionSettings(): SessionSettings {
  const s = readPref<unknown>(SETTINGS_KEY, null, isAny, 'session');
  if (!isStored(s)) return { graph: DEFAULT_GRAPH_LOOK, card: DEFAULT_CARD, chat: DEFAULT_CHAT, changes: DEFAULT_CHANGES };
  return {
    graph: {
      // A layout the graph no longer has reads as the default.
      layout: s.layout === 'nested' ? 'nested' : DEFAULT_GRAPH_LOOK.layout,
      minimap: s.minimap,
    },
    card: { width: clampWidth(s.cardWidth) },
    chat: { open: s.chat, width: clampChat(s.chatWidth) },
    changes: { lens: s.lens, since: s.since, follow: s.follow, looked: s.looked },
  };
}

/** Sets the session's settings: only the person changing a setting calls this. */
export function saveSessionSettings({ graph: g, card, chat, changes }: SessionSettings) {
  const stored: Stored = {
    layout: g.layout, minimap: g.minimap,
    cardWidth: clampWidth(card.width), chat: chat.open, chatWidth: clampChat(chat.width),
    lens: changes.lens, since: changes.since, follow: changes.follow, looked: changes.looked,
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
  const setGraph = useCallback((patch: Partial<GraphLook>) => {
    const was = current();
    const graph = { ...was.graph, ...patch };
    if (graph.layout !== was.graph.layout || graph.minimap !== was.graph.minimap) saveSessionSettings({ ...was, graph });
  }, []);
  const setCard = useCallback((patch: Partial<CardSettings>) => {
    const was = current();
    const card = { width: clampWidth(patch.width === undefined ? was.card.width : patch.width) };
    if (card.width !== was.card.width) saveSessionSettings({ ...was, card });
  }, []);
  const setChat = useCallback((patch: Partial<ChatSettings>) => {
    const was = current();
    const chat = { ...was.chat, ...patch };
    chat.width = clampChat(chat.width);
    if (chat.open !== was.chat.open || chat.width !== was.chat.width) saveSessionSettings({ ...was, chat });
  }, []);
  const setChanges = useCallback((patch: Partial<ChangeSettings>) => {
    const was = current();
    saveSessionSettings({ ...was, changes: { ...was.changes, ...patch } });
  }, []);
  return { graph: settings.graph, card: settings.card, chat: settings.chat, changes: settings.changes, setGraph, setCard, setChat, setChanges };
}
