import { useLayoutEffect, useRef, type RefObject } from 'react';
import { CARD_GAP_Y, OPEN_GAP, type OpenSpaceStore } from './openSpace';

// Where the wiki card sits on the stage's height (LA-V96-R19): level with the focused box, its title
// row on the box's center, as a callout to it. The stage reports where it frames its focus (the
// anchor, openSpace.ts) when it frames it, never while the Reader pans or zooms; the card moves there
// once that camera arrives and the focus has settled, with a short glide (none under reduced motion,
// the stylesheet's). It stays inside the room below the stage's own tools and above the window's
// foot, so a focus off-screen leaves it at the nearest edge. Only its top moves: the open space is
// measured from the card's horizontal band, so where it sits never moves the camera.

export interface CardTopInput {
  /** The focused box's center, from the stage's top; null when the stage draws none. */
  anchorY: number | null;
  /** The card's title row's center, from the card's top. */
  titleAt: number;
  /** The card's height. */
  height: number;
  /** The highest the card may sit: below the stage's tools. */
  minTop: number;
  stageHeight: number;
}

/** The card's top: its title row level with the anchor, clamped to the room below the tools and above the foot. */
export function cardTop({ anchorY, titleAt, height, minTop, stageHeight }: CardTopInput): number {
  const maxTop = Math.max(minTop, stageHeight - CARD_GAP_Y - height);
  if (anchorY === null) return minTop;
  return Math.min(maxTop, Math.max(minTop, anchorY - titleAt));
}

/**
 * Places the card (the `.wiki-panel` around `inside`) for the settled focus, and again as the card, the stage or the
 * open space change size. `shown` is whether the card is drawn as a floating panel now.
 */
export function useCardPlace(inside: RefObject<HTMLElement | null>, store: OpenSpaceStore | undefined, focus: string, shown: boolean) {
  // Where the focus was framed last: kept across a new focus, so the card waits where it is until the stage frames the next.
  const anchored = useRef<number | null>(null);
  useLayoutEffect(() => {
    const el = inside.current?.closest<HTMLElement>('.wiki-panel');
    if (!el || !store || !shown) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const place = () => {
      const host = el.offsetParent as HTMLElement | null;
      if (!host) return;
      // The frame's top is the stage's tools' foot plus the open space's gap; the card keeps its own, wider gap.
      const minTop = (store.get()?.frame.top ?? 0) - OPEN_GAP + CARD_GAP_Y;
      const stageHeight = host.clientHeight;
      el.style.setProperty('--card-room', `${Math.max(0, Math.round(stageHeight - minTop - CARD_GAP_Y))}px`);
      const box = el.getBoundingClientRect();
      const title = el.querySelector('.wiki-panel-title h2')?.getBoundingClientRect();
      const titleAt = title ? title.top - box.top + title.height / 2 : 0;
      el.style.top = `${Math.round(cardTop({ anchorY: anchored.current, titleAt, height: box.height, minTop, stageHeight }))}px`;
      el.dataset.placed = 'true';
    };
    const follow = () => {
      const a = store.anchor();
      if (!a || a.focus !== focus) return;
      clearTimeout(timer);
      timer = setTimeout(() => { anchored.current = a.y; place(); }, Math.max(0, a.at - performance.now()));
    };
    place();
    follow();
    const offAnchor = store.subscribeAnchor(follow);
    const offSpace = store.subscribe(place);
    const sizes = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(place);
    sizes?.observe(el);
    if (el.offsetParent) sizes?.observe(el.offsetParent);
    return () => {
      clearTimeout(timer);
      offAnchor();
      offSpace();
      sizes?.disconnect();
    };
  }, [inside, store, focus, shown]);
}
