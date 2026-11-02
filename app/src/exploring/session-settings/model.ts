import type { GraphLayout, GraphSettings } from '../../graph/GraphPage';
import type { BrowserStorage } from '../../shell/storage';
import { NO_FILTERS } from '../../graph/model';
import type { LookMark, Since } from '../../changes/changes';

// Session settings (LA-EXP-A6): how the Reader likes to see things, for the window's session, shared by every tab and
// every page (LA-V93-R72): the graph's layout, minimap and the Map's All links, how wide the wiki card is, whether the desktop app's chat
// panel is open and how wide (LA-PLT-UC19), and Highlight changes (LA-EXP-UC15): whether it is on, the baseline it
// compares with, whether Follow is on, and the moment the Reader last looked at each product. Where the Reader is (the
// focus, the stage, the depth, the kind filters, the wiki card's open and expanded state) is not here: it is the
// place's (views/place.ts). Moving through the stage never changes it; only the person's own commands do.
// Kept apart from GraphPage.tsx, which is loaded with import() when the graph is first shown.

/** The graph as a place starts it: the window's look with the least depth and no kind hidden (GraphView's own, with no host). */
export const DEFAULT_GRAPH_SETTINGS: GraphSettings = { layout: 'tree', depth: 1, filters: NO_FILTERS, minimap: false, allLinks: false };

/** How the graph is drawn, the window's: its layout, whether the minimap shows and whether the Map draws all its links. */
export type GraphLook = Pick<GraphSettings, 'layout' | 'minimap' | 'allLinks'>;
export const DEFAULT_GRAPH_LOOK: GraphLook = { layout: 'tree', minimap: false, allLinks: false };
/** The layouts the graph has. */
export const LAYOUTS: readonly GraphLayout[] = ['tree', 'nested', 'map'];

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
 * Highlight changes (changes/changes.ts): on or off, the baseline it compares with, Follow, and by product the moment
 * the Reader last looked at it (set as they dismiss Highlight changes or leave the product).
 */
export interface ChangeSettings { highlight: boolean; since: Since; follow: boolean; looked: Record<string, LookMark> }
export const DEFAULT_CHANGES: ChangeSettings = { highlight: false, since: 'commit', follow: false, looked: {} };

export interface SessionSettings { graph: GraphLook; card: CardSettings; chat: ChatSettings; changes: ChangeSettings }
export const DEFAULT_SESSION_SETTINGS: SessionSettings = { graph: DEFAULT_GRAPH_LOOK, card: DEFAULT_CARD, chat: DEFAULT_CHAT, changes: DEFAULT_CHANGES };

/** Where the Session settings are kept: whole, as JSON in session storage. Its repository is generated from it. */
export const SESSION_SETTINGS_STORAGE = { key: 'lathe:session-settings', store: 'session' } as const satisfies BrowserStorage;

/** The settings as they are stored, flat. */
export interface StoredSettings {
  layout: GraphLayout; minimap: boolean; allLinks: boolean;
  cardWidth: number | null; chat: boolean; chatWidth: number | null;
  highlight: boolean; since: Since; follow: boolean; looked: Record<string, LookMark>;
}

const isNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isMark = (v: unknown): v is LookMark => {
  const m = v as LookMark;
  return !!m && typeof m === 'object' && (m.commit === null || typeof m.commit === 'string') && typeof m.at === 'string' && !!m.digests && typeof m.digests === 'object';
};
/** Stored settings in today's form; anything else (an older form included) is dropped for the defaults. */
const isStored = (v: unknown): v is StoredSettings => {
  if (!v || typeof v !== 'object') return false;
  const s = v as StoredSettings;
  return typeof s.layout === 'string'
    && typeof s.minimap === 'boolean' && typeof s.allLinks === 'boolean' && (s.cardWidth === null || isNumber(s.cardWidth))
    && typeof s.chat === 'boolean' && (s.chatWidth === null || isNumber(s.chatWidth))
    && typeof s.highlight === 'boolean' && (s.since === 'commit' || s.since === 'branch' || s.since === 'looked') && typeof s.follow === 'boolean'
    && !!s.looked && typeof s.looked === 'object' && Object.values(s.looked).every(isMark);
};

const clamp = (min: number, max: number) => (w: number | null) => (w === null ? null : Math.round(Math.min(max, Math.max(min, w))));
/** A wiki card width brought within its limits. */
export const cardWidthWithin = clamp(CARD_MIN, CARD_MAX);
/** A chat width brought within its limits. */
export const chatWidthWithin = clamp(CHAT_MIN, CHAT_MAX);

/** The settings from their stored form, or the defaults. A layout the graph no longer has reads as the default. */
export function sessionSettingsFrom(stored: unknown): SessionSettings {
  if (!isStored(stored)) return DEFAULT_SESSION_SETTINGS;
  return {
    graph: { layout: LAYOUTS.includes(stored.layout) ? stored.layout : DEFAULT_GRAPH_LOOK.layout, minimap: stored.minimap, allLinks: stored.allLinks },
    card: { width: cardWidthWithin(stored.cardWidth) },
    chat: { open: stored.chat, width: chatWidthWithin(stored.chatWidth) },
    changes: { highlight: stored.highlight, since: stored.since, follow: stored.follow, looked: stored.looked },
  };
}

/** The settings in their stored form. */
export const sessionSettingsStored = ({ graph, card, chat, changes }: SessionSettings): StoredSettings => ({
  layout: graph.layout, minimap: graph.minimap, allLinks: graph.allLinks,
  cardWidth: card.width, chat: chat.open, chatWidth: chat.width,
  highlight: changes.highlight, since: changes.since, follow: changes.follow, looked: changes.looked,
});

/**
 * What each command that sets one setting keeps, by its handler: its input's one field and the setting's place in the
 * Session settings. Its handlers are generated from it. @public (read by `npm run generate`)
 */
export const SESSION_SETTINGS_SETS = {
  chooseChangesBaseline: { since: 'changes.since' },
  chooseGraphLayout: { layout: 'graph.layout' },
  showOrHideAllLinks: { shown: 'graph.allLinks' },
  showOrHideChat: { shown: 'chat.open' },
  showOrHideMinimap: { shown: 'graph.minimap' },
  turnFollowOnOrOff: { on: 'changes.follow' },
  turnHighlightChangesOnOrOff: { on: 'changes.highlight' },
} as const;
