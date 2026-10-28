import { useLayoutEffect, useSyncExternalStore, type RefObject } from 'react';

// The open space over the stage (LA-V96): the part of the stage no floating panel covers, where
// the stage frames its focus. It is measured from the panels' own rectangles, never from widths
// assumed in code: every floating panel carries `data-floating` with the side it sits on (left,
// right, top or bottom), and the open space runs from the innermost edge of each side's panels,
// plus a gap, to the next. A stage's own tools (the graph's toolbar, the ERD's key) float inside
// the open space, so they cannot decide it (that would feed back into their own place): they carry
// `data-stage-tools` with the side they sit on, and only the frame, the space the camera fits the
// focus into, gives them room.
//
// The measure runs when the stage or a panel changes size (a ResizeObserver on each), when a
// panel comes or goes (a MutationObserver on the panels' parents, children only), and on a window
// resize. It writes the insets as CSS variables on the stage (`--open-left` … and `--frame-left`
// …), with no React render, and tells the stages through a small store, so a camera moves only when
// the open space really changed.

export interface Insets { left: number; top: number; right: number; bottom: number }
export interface OpenSpace {
  /** What the floating panels leave of the stage, as insets from its edges. */
  open: Insets;
  /** The open space less the stage's own tools: where the camera frames the focus. */
  frame: Insets;
}

/** The room kept between a panel and what the stage frames, in px. */
export const OPEN_GAP = 8;
const SIDES = ['left', 'top', 'right', 'bottom'] as const;
const NONE: Insets = { left: 0, top: 0, right: 0, bottom: 0 };
const same = (a: Insets, b: Insets) => SIDES.every((s) => Math.abs(a[s] - b[s]) < 0.5);

export interface OpenSpaceStore {
  get: () => OpenSpace;
  subscribe: (listener: () => void) => () => void;
  /** Sets the measure; tells the listeners only when it changed. */
  set: (next: OpenSpace) => void;
}

export function createOpenSpaceStore(): OpenSpaceStore {
  let value: OpenSpace = { open: NONE, frame: NONE };
  const listeners = new Set<() => void>();
  return {
    get: () => value,
    subscribe: (l) => { listeners.add(l); return () => { listeners.delete(l); }; },
    set: (next) => {
      if (same(next.open, value.open) && same(next.frame, value.frame)) return;
      value = next;
      for (const l of listeners) l();
    },
  };
}

type Rect = Pick<DOMRect, 'left' | 'top' | 'right' | 'bottom' | 'width' | 'height'>;
export interface Panel { side: string; rect: Rect }

/**
 * The open space a stage's rectangle leaves among panels: from each side, past the innermost
 * edge of that side's panels (and a gap). A panel of no size (collapsed, hidden) leaves nothing.
 */
export function openInsets(stage: Rect, panels: readonly Panel[], gap = OPEN_GAP): Insets {
  const out = { ...NONE };
  for (const { side, rect: r } of panels) {
    if (r.width <= 0 || r.height <= 0) continue;
    if (side === 'left') out.left = Math.max(out.left, r.right - stage.left + gap);
    else if (side === 'right') out.right = Math.max(out.right, stage.right - r.left + gap);
    else if (side === 'top') out.top = Math.max(out.top, r.bottom - stage.top + gap);
    else if (side === 'bottom') out.bottom = Math.max(out.bottom, stage.bottom - r.top + gap);
  }
  return out;
}

/** The frame: the open space less the stage's tools on each side. */
export function frameInsets(open: Insets, tools: readonly Panel[], gap = OPEN_GAP): Insets {
  const out = { ...open };
  for (const { side, rect: r } of tools) {
    if (r.width <= 0 || r.height <= 0) continue;
    if (side === 'top') out.top = Math.max(out.top, open.top + r.height + gap);
    else if (side === 'bottom') out.bottom = Math.max(out.bottom, open.bottom + r.height + gap);
  }
  return out;
}

const panelsIn = (root: ParentNode, attr: 'floating' | 'stageTools'): Panel[] =>
  [...root.querySelectorAll<HTMLElement>(attr === 'floating' ? '[data-floating]' : '[data-stage-tools]')].map((el) => ({
    side: (attr === 'floating' ? el.dataset.floating : el.dataset.stageTools) ?? '',
    rect: el.getBoundingClientRect(),
  }));

/**
 * Measures the open space over `stage` among the floating panels in `root` (the app), writes it on
 * the stage as CSS variables and into `store`.
 */
export function useOpenSpaceMeasure(stage: RefObject<HTMLElement | null>, store: OpenSpaceStore, root: RefObject<HTMLElement | null>) {
  useLayoutEffect(() => {
    const el = stage.current;
    const scope = root.current?.closest('.app') ?? root.current;
    if (!el || !scope) return;
    const measure = () => {
      const open = openInsets(el.getBoundingClientRect(), panelsIn(scope, 'floating'));
      const frame = frameInsets(open, panelsIn(el, 'stageTools'));
      for (const s of SIDES) {
        el.style.setProperty(`--open-${s}`, `${Math.round(open[s])}px`);
        el.style.setProperty(`--frame-${s}`, `${Math.round(frame[s])}px`);
      }
      store.set({ open, frame });
    };
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const sizes = new ResizeObserver(measure);
    const watched = new Set<Element>();
    const watch = () => {
      const now = new Set<Element>([el, ...scope.querySelectorAll('[data-floating]'), ...el.querySelectorAll('[data-stage-tools]')]);
      for (const w of watched) if (!now.has(w)) { sizes.unobserve(w); watched.delete(w); }
      for (const w of now) if (!watched.has(w)) { sizes.observe(w); watched.add(w); }
    };
    watch();
    // A panel or a stage's tools coming or going: measured once a frame at most.
    let frame: number | null = null;
    const later = () => {
      if (frame !== null) return;
      frame = requestAnimationFrame(() => { frame = null; watch(); measure(); });
    };
    // The panels' parents (the app, the page's layout), their children only; and the stage, whose
    // tools come with its content (a lazily loaded stage, an ERD laid out).
    const comings = new MutationObserver(later);
    const parents = new Set<Element>([scope, ...[...scope.querySelectorAll('[data-floating]')].map((p) => p.parentElement).filter((p): p is HTMLElement => !!p)]);
    for (const p of parents) comings.observe(p, { childList: true });
    comings.observe(el, { childList: true, subtree: true });
    window.addEventListener('resize', measure);
    return () => {
      if (frame !== null) cancelAnimationFrame(frame);
      sizes.disconnect();
      comings.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [stage, store, root]);
}

/** The open space and frame, for a stage that frames its focus in them; null outside a stage. */
export const useOpenSpace = (store: OpenSpaceStore | undefined): OpenSpace | null =>
  useSyncExternalStore(store?.subscribe ?? noSubscribe, store?.get ?? noValue, store?.get ?? noValue);
const noSubscribe = () => () => {};
const noValue = () => null;
