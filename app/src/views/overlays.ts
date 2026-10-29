import { useEffect, useLayoutEffect, useRef, type RefObject } from 'react';
import { navigate } from '../router';
import { isFocusPath } from './address';

// Nothing replaces the stage: tools open as panels over it (LA-PAT-APP-UX-R20). The stage is what the
// Reader navigates; Checks, Changes, Appearance and the theme editor open as frosted panels over it, and a
// format page opens in the wiki card. Each is layered on the current focus in the address's query
// (`?panel=checks`, `?panel=changes`, `?panel=appearance`, `?panel=theme&theme=<id>`, `?page=format/kinds/use_case`),
// so the stage underneath keeps its place and every overlay is still a link: a link to one is a
// patch of the current address (router.tsx). A move to another focus carries the open tool along
// (the Checks panel stays open to work down its list), while the card follows the new focus, so a
// format page in it closes. The parameters keep the order the overlays were opened in, so Escape
// closes the last one opened, the topmost, and focus goes back where it was before it opened.

/** The tools that open as panels over the stage. */
export type ToolPanel = 'checks' | 'changes' | 'appearance' | 'theme';
const TOOL_PANELS: readonly ToolPanel[] = ['checks', 'changes', 'appearance', 'theme'];

/** The query parameters of the overlays: the tool panel, the theme the editor edits, and the format page in the wiki card. */
export const PANEL_PARAM = 'panel';
export const THEME_PARAM = 'theme';
export const PAGE_PARAM = 'page';

/** The overlays an address's query opens, and the topmost of them. */
export interface Overlays {
  panel: ToolPanel | null;
  /** The theme the editor edits, with `panel` 'theme'. */
  theme: string | null;
  /** The format page the wiki card shows, as `format/kinds/use_case`. */
  page: string | null;
  /** The overlay opened last: the one Escape closes. */
  top: 'panel' | 'page' | null;
}

export function overlaysOf(search: string): Overlays {
  const params = new URLSearchParams(search);
  const raw = params.get(PANEL_PARAM);
  const panel = TOOL_PANELS.find((p) => p === raw) ?? null;
  const theme = panel === 'theme' ? params.get(THEME_PARAM) : null;
  const page = params.get(PAGE_PARAM) || null;
  const keys = [...params.keys()];
  const at = (key: string, on: boolean) => (on ? keys.lastIndexOf(key) : -1);
  const panelAt = at(PANEL_PARAM, panel !== null);
  const pageAt = at(PAGE_PARAM, page !== null);
  const top = panelAt < 0 && pageAt < 0 ? null : panelAt > pageAt ? 'panel' : 'page';
  return { panel, theme: panel === 'theme' ? theme : null, page, top };
}

/** The link that opens a tool panel over the stage, or closes every one with null. */
export function panelHref(panel: ToolPanel | null, theme?: string): string {
  if (panel === 'theme' && theme) return `?${PANEL_PARAM}=theme&${THEME_PARAM}=${encodeURIComponent(theme)}`;
  return `?${PANEL_PARAM}=${panel ?? ''}&${THEME_PARAM}=`;
}

/** The link that opens a format page in the wiki card (`format`, `format/kinds/use_case`), or closes it with null. */
export const pageHref = (page: string | null) => `?${PAGE_PARAM}=${page ?? ''}`;

/** The link that closes the topmost overlay, or null when none is open. */
export function closeTopmostHref(search: string): string | null {
  const { top } = overlaysOf(search);
  return top === 'page' ? pageHref(null) : top === 'panel' ? panelHref(null) : null;
}

/**
 * What a move to another address keeps of the one it leaves: a tool panel open over the stage
 * stays open over a new focus, unless the new address names its own. A format page in the card
 * does not: the card follows the new focus.
 */
export function carryOverlays(to: string, from: URLSearchParams): string {
  const panel = from.get(PANEL_PARAM);
  if (!panel) return to;
  const hashAt = to.indexOf('#');
  const hash = hashAt < 0 ? '' : to.slice(hashAt);
  const bare = hashAt < 0 ? to : to.slice(0, hashAt);
  const [path, query = ''] = bare.split('?');
  if (!isFocusPath(path)) return to;
  const params = new URLSearchParams(query);
  if (params.has(PANEL_PARAM)) return to;
  params.set(PANEL_PARAM, panel);
  const theme = from.get(THEME_PARAM);
  if (panel === 'theme' && theme) params.set(THEME_PARAM, theme);
  return `${path}?${params.toString().replace(/%2F/gi, '/')}${hash}`;
}

/** The query without its overlays: what a space remembers as the page it was on. */
export function withoutOverlays(search: string): string {
  const params = new URLSearchParams(search);
  for (const key of [PANEL_PARAM, THEME_PARAM, PAGE_PARAM]) params.delete(key);
  const query = params.toString();
  return query ? `?${query}` : '';
}

/**
 * Escape closes the topmost overlay (LA-PAT-APP-UX-R20), unless something nearer the focus took the key
 * first (a filter clearing its text, a menu, a dialog of its own, a stage clearing its filters).
 * `fallback` is what Escape does with no overlay open (the products picker going back to its stage).
 */
export function useEscapeClosesTopmost(search: string, fallback: (() => void) | null) {
  const searchRef = useRef(search);
  searchRef.current = search;
  const fallbackRef = useRef(fallback);
  fallbackRef.current = fallback;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) return;
      const close = closeTopmostHref(searchRef.current);
      if (close) { e.preventDefault(); navigate(close); return; }
      if (fallbackRef.current) { e.preventDefault(); fallbackRef.current(); }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);
}

/**
 * The one way an overlay (a tool panel, a dialog) handles focus: it takes focus as it opens (its
 * first element matching `first`, or itself), unless focus is already inside it, and gives it back
 * to where it was (the button that opened it, the stage) as it closes, when focus would otherwise be lost.
 */
export function useOverlayFocus(box: RefObject<HTMLElement | null>, first?: string) {
  useLayoutEffect(() => {
    const before = document.activeElement as HTMLElement | null;
    const el = box.current;
    if (el && !el.contains(document.activeElement)) ((first && el.querySelector<HTMLElement>(first)) || el).focus({ preventScroll: true });
    return () => {
      const now = document.activeElement;
      const lost = !now || now === document.body || !now.isConnected || (el?.contains(now) ?? false);
      // At once, as it closes: an overlay that opens in its place in the same move takes focus after.
      if (lost && before && before !== document.body && before.isConnected) before.focus({ preventScroll: true });
    };
  }, [box, first]);
}
