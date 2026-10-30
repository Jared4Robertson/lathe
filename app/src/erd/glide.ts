import { useEffect, useRef, useState } from 'react';
import { readMotion } from '../graph/motion';
import type { Rect } from './erd';

// The ERD's lines glide with its boxes (LA-PAT-APP-UX-R22): the boxes glide to a new layout's places by CSS (styles.css),
// on the shared motion, and each line is drawn between its ends' boxes as they are at that moment, on the same motion,
// so a line never jumps ahead of the boxes it joins. Under reduced motion both land at once.

export interface Glide { from: ReadonlyMap<string, Rect>; to: ReadonlyMap<string, Rect>; start: number; duration: number; ease: (t: number) => number }

/** Each box where a glide has it at `now` (pure, for tests): between where it was drawn and its new place; a new box at its place. */
export function rectsAt(glide: Glide, now: number): ReadonlyMap<string, Rect> {
  const t = glide.duration > 0 ? Math.min(1, Math.max(0, (now - glide.start) / glide.duration)) : 1;
  if (t >= 1) return glide.to;
  const k = glide.ease(t);
  const mix = (a: number, b: number) => a + (b - a) * k;
  const out = new Map<string, Rect>();
  for (const [id, to] of glide.to) {
    const from = glide.from.get(id);
    out.set(id, from ? { x: mix(from.x, to.x), y: mix(from.y, to.y), width: mix(from.width, to.width), height: mix(from.height, to.height) } : to);
  }
  return out;
}

/** The boxes' places to draw the lines at (a new layout's, reached by a glide from where they were drawn), and whether they are gliding now. */
export function useGlidingRects(rects: ReadonlyMap<string, Rect> | undefined): { rects: ReadonlyMap<string, Rect> | undefined; gliding: boolean } {
  const [, paint] = useState(0);
  const glide = useRef<Glide | null>(null);
  const last = useRef(rects);
  if (rects !== last.current) {
    const now = performance.now();
    const drawn = glide.current ? rectsAt(glide.current, now) : last.current;
    const motion = readMotion();
    glide.current = drawn && rects && motion.duration > 0 ? { from: drawn, to: rects, start: now, duration: motion.duration, ease: motion.ease } : null;
    last.current = rects;
  }
  useEffect(() => {
    const g = glide.current;
    if (!g) return;
    let frame = requestAnimationFrame(function tick(now) {
      if (now - g.start < g.duration) { paint((n) => n + 1); frame = requestAnimationFrame(tick); return; }
      if (glide.current === g) glide.current = null;
      paint((n) => n + 1);
    });
    return () => cancelAnimationFrame(frame);
  }, [rects]);
  return glide.current ? { rects: rectsAt(glide.current, performance.now()), gliding: true } : { rects, gliding: false };
}
