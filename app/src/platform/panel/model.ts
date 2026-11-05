import type { BrowserStorage, StoredParts } from '../../shell/storage';

// Panel (LA-PLT-A2): a part of the app floating over the stage that the person shows, hides and resizes. The nav and
// whether the desktop app's chat shows are kept here; the chat's and the wiki card's widths are the session's settings
// (exploring/session-settings), and the card's open state the place's. Hiding a panel gives its room to the stage and
// loses nothing.

/** The panels a person shows and hides. */
export type PanelName = 'nav' | 'chat';
/** The panels whose width is kept here, with their limits. */
export type SizedPanel = 'nav';

/** A panel's limits in px: its default width, its narrowest and widest, and the width a drag below collapses it at. */
export interface PanelLimits { fallback: number; min: number; max: number; collapseBelow: number }
export const PANEL_LIMITS: Readonly<Record<SizedPanel, PanelLimits>> = {
  nav: { fallback: 336, min: 256, max: 560, collapseBelow: 180 },
};

/** Whether a panel is folded away, and for a sized panel its width in px. */
export interface PanelShown { collapsed: boolean }
export interface PanelState extends PanelShown { width: number }
export interface Panels { readonly nav: PanelState; readonly chat: PanelShown }

/** The nav shows at its default width; the chat is hidden until the person shows it. */
export const DEFAULT_PANELS: Panels = { nav: { width: PANEL_LIMITS.nav.fallback, collapsed: false }, chat: { collapsed: true } };

/** A width brought within a panel's limits, in whole px. */
export const widthWithin = (panel: SizedPanel, width: number) => {
  const { min, max } = PANEL_LIMITS[panel];
  return Math.round(Math.min(max, Math.max(min, width)));
};

/** Where the Panels are kept: the nav's width and whether it is collapsed, and whether the chat is, in local storage. Its repository is generated from it. */
export const PANEL_STORAGE = {
  navWidth: { key: 'lathe:nav-width', store: 'local' },
  navCollapsed: { key: 'lathe:nav-collapsed', store: 'local' },
  chatCollapsed: { key: 'lathe:chat-collapsed', store: 'local' },
} as const satisfies BrowserStorage;

/** The Panels from their stored parts: a width outside the nav's limits, or anything of another form, reads as its default. */
export function panelFrom(stored: StoredParts<typeof PANEL_STORAGE>): Panels {
  const { min, max } = PANEL_LIMITS.nav;
  const width = typeof stored.navWidth === 'number' && Number.isFinite(stored.navWidth) && stored.navWidth >= min && stored.navWidth <= max ? stored.navWidth : DEFAULT_PANELS.nav.width;
  const collapsed = typeof stored.navCollapsed === 'boolean' ? stored.navCollapsed : DEFAULT_PANELS.nav.collapsed;
  const chat = typeof stored.chatCollapsed === 'boolean' ? stored.chatCollapsed : DEFAULT_PANELS.chat.collapsed;
  return { nav: { width, collapsed }, chat: { collapsed: chat } };
}

/** The Panels in their stored form. */
export const panelStored = (panels: Panels): { [P in keyof typeof PANEL_STORAGE]: unknown } => ({ navWidth: panels.nav.width, navCollapsed: panels.nav.collapsed, chatCollapsed: panels.chat.collapsed });
