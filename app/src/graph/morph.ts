import { useRef } from 'react';
import type { PlacedMap } from './map';
import { readMotion } from './motion';
import type { Plate } from './plate';
import type { Viewport } from './camera';

// A change moves only what it changed, and what moves morphs (LA-PAT-APP-UX-R22): when a canvas stage's map is laid out
// again for new data, each box the new map moves or resizes glides from where the map drawn before had it to its new
// place, on the shared motion, so the eye follows it; a new box appears at its place, and a removed one leaves its ghost
// (changes/marks.ts). Under reduced motion nothing glides: every box is at its new place at once. The camera stays where
// it was, unless the focus itself moved, when it glides with it (`followBox`). Nothing is laid out again for a morph:
// each frame draws the new map's plates moved and scaled from their old box to their new one.

type Box = { x: number; y: number; w: number; h: number };

const same = (a: Box, b: Box) => a.x === b.x && a.y === b.y && a.w === b.w && a.h === b.h;
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const between = (a: Box, b: Box, t: number): Box => ({ x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t), w: lerp(a.w, b.w, t), h: lerp(a.h, b.h, t) });

/**
 * A plate drawn at another box: its outline stretched to the box, its label, icons and badges moved with it and scaled
 * by the smaller of the two stretches, so its text keeps its shape while the box changes its own.
 */
export function plateAt(p: Plate, to: Box): Plate {
  if (same(p, to)) return p;
  const sx = p.w > 0 ? to.w / p.w : 1;
  const sy = p.h > 0 ? to.h / p.h : 1;
  const s = Math.min(sx, sy);
  const X = (x: number) => to.x + (x - p.x) * sx;
  const Y = (y: number) => to.y + (y - p.y) * sy;
  return {
    ...p,
    x: to.x, y: to.y, w: to.w, h: to.h,
    scale: p.scale * s, text: p.text * s, border: p.border * s,
    outline: p.outline.kind === 'polygon'
      ? { kind: 'polygon', points: p.outline.points.map(([x, y]) => [X(x), Y(y)] as [number, number]) }
      : { kind: 'round', rx: p.outline.rx * s, ry: p.outline.ry * s },
    label: { x: X(p.label.x), y: Y(p.label.y), w: p.label.w * sx, h: p.label.h * sy },
    // Each line keeps its middle where the stretch puts it.
    lines: p.lines.map((l) => ({ ...l, size: l.size * s, x: X(l.x) + (l.width * (sx - s)) / 2, baseline: Y(l.baseline), top: Y(l.top), height: l.height * s, width: l.width * s })),
    icons: p.icons.map((i) => ({ ...i, x: X(i.x), y: Y(i.y), w: i.w * s, h: i.h * s })),
    badges: p.badges.map((b) => ({ ...b, x: X(b.x), y: Y(b.y), w: b.w * s, h: b.h * s, size: b.size * s })),
  };
}

interface Morphing { map: PlacedMap; from: ReadonlyMap<string, Box>; start: number; duration: number; ease: (t: number) => number }

/** Where a morph has a box now: between its old place and its map's, or its map's once the morph is over. */
function boxAt(m: Morphing, id: string, now: number): Box | null {
  const n = m.map.nodes.get(id);
  if (!n) return null;
  const from = m.from.get(id);
  if (!from) return n;
  const t = m.duration > 0 ? Math.min(1, (now - m.start) / m.duration) : 1;
  return t >= 1 ? n : between(from, n, m.ease(t));
}

/** The morph of a map from the one drawn before it (pure, for tests): each box the new map moves, from where it was drawn at `now`. */
export function morphFrom(before: Morphing | null, map: PlacedMap, now: number, duration: number, ease: (t: number) => number): Morphing {
  const from = new Map<string, Box>();
  // Only a new layout of the same map morphs: another product or another layout is a new picture.
  if (before && duration > 0 && before.map !== map && before.map.view === map.view && before.map.roots[0] === map.roots[0]) {
    for (const [id, n] of map.nodes) {
      const was = boxAt(before, id, now);
      if (was && !same(was, n)) from.set(id, was);
    }
  }
  return { map, from, start: now, duration, ease };
}

/** A stage's morph: what each plate is drawn at now, and whether anything is still moving (the stage paints again while it is). */
export interface Morph {
  plate: (p: Plate, now: number) => Plate;
  moving: (now: number) => boolean;
}

/** The morph from the map a scene drew before to the one it draws now, started as the new map arrives: one object for the scene's life. */
export function useMorph(map: PlacedMap): Morph {
  const state = useRef<Morphing | null>(null);
  if (state.current?.map !== map) {
    const motion = readMotion();
    state.current = morphFrom(state.current, map, performance.now(), motion.duration, motion.ease);
  }
  const morph = useRef<Morph | null>(null);
  morph.current ??= {
    plate: (p, now) => {
      const m = state.current!;
      if (!m.from.has(p.place)) return p;
      const at = boxAt(m, p.place, now);
      return at ? plateAt(p, at) : p;
    },
    moving: (now) => { const m = state.current!; return m.from.size > 0 && now - m.start < m.duration; },
  };
  return morph.current;
}

/**
 * The camera that keeps a box where it was on screen after a new layout moved it from `before` to `after` (the focus
 * moved: the camera glides with it), within the camera's zoom limits; null when the box did not move, so the camera
 * stays where it is.
 */
export function followBox(v: Viewport, before: Box, after: Box, zoom: { min: number; max: number }): Viewport | null {
  if (same(before, after)) return null;
  const z = Math.min(zoom.max, Math.max(zoom.min, after.w > 0 ? v.zoom * (before.w / after.w) : v.zoom));
  // The box's middle stays where it was on screen.
  const sx = (before.x + before.w / 2) * v.zoom + v.x;
  const sy = (before.y + before.h / 2) * v.zoom + v.y;
  return { x: sx - (after.x + after.w / 2) * z, y: sy - (after.y + after.h / 2) * z, zoom: z };
}
