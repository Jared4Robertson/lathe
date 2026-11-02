import type { BrowserStorage, StoredParts } from '../../shell/storage';

// Panel (LA-PLT-A2): a part of the app floating over the stage that the person shows, hides and resizes. The nav is
// the one kept here; the wiki card's width is the session's setting (exploring/session-settings) and its open state the
// place's. Hiding a panel gives its room to the stage and loses nothing.

export type PanelName = 'nav';

/** A panel's limits in px: its default width, its narrowest and widest, and the width a drag below collapses it at. */
export interface PanelLimits { fallback: number; min: number; max: number; collapseBelow: number }
export const PANEL_LIMITS: Readonly<Record<PanelName, PanelLimits>> = {
  nav: { fallback: 336, min: 256, max: 560, collapseBelow: 180 },
};

export interface PanelState { width: number; collapsed: boolean }
export type Panels = Readonly<Record<PanelName, PanelState>>;

export const DEFAULT_PANELS: Panels = { nav: { width: PANEL_LIMITS.nav.fallback, collapsed: false } };

/** A width brought within a panel's limits, in whole px. */
export const widthWithin = (panel: PanelName, width: number) => {
  const { min, max } = PANEL_LIMITS[panel];
  return Math.round(Math.min(max, Math.max(min, width)));
};

/** Where the Panels are kept: the nav's width and whether it is collapsed, in local storage. Its repository is generated from it. */
export const PANEL_STORAGE = {
  navWidth: { key: 'lathe:nav-width', store: 'local' },
  navCollapsed: { key: 'lathe:nav-collapsed', store: 'local' },
} as const satisfies BrowserStorage;

/** The Panels from their stored parts: a width outside the nav's limits, or anything of another form, reads as its default. */
export function panelFrom(stored: StoredParts<typeof PANEL_STORAGE>): Panels {
  const { min, max } = PANEL_LIMITS.nav;
  const width = typeof stored.navWidth === 'number' && Number.isFinite(stored.navWidth) && stored.navWidth >= min && stored.navWidth <= max ? stored.navWidth : DEFAULT_PANELS.nav.width;
  const collapsed = typeof stored.navCollapsed === 'boolean' ? stored.navCollapsed : DEFAULT_PANELS.nav.collapsed;
  return { nav: { width, collapsed } };
}

/** The Panels in their stored form. */
export const panelStored = (panels: Panels): { [P in keyof typeof PANEL_STORAGE]: unknown } => ({ navWidth: panels.nav.width, navCollapsed: panels.nav.collapsed });
