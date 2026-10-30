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
