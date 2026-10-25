import { boxExit, type Point } from './layout';

// Shared motion (LA-PAT-APP-CODE-R12): the speed and easing every animation uses, read from the
// stylesheet's `--motion-speed` and `--motion-ease` tokens, and turned off when the person asks for
// reduced motion. The graph's edges use it to move exactly as their nodes do when the graph
// re-centers: the nodes glide by a CSS transition of their transform, and each edge tweens the two
// box centers it joins with the same duration and easing, so its ends stay on the boxes throughout.

/** The values in `:root` (app/src/styles.css), used where the stylesheet can't be read (tests). */
export const MOTION_SPEED_MS = 320;
/** CSS's `ease`, written out so JS can follow the same curve. */
export const MOTION_EASE: [number, number, number, number] = [0.25, 0.1, 0.25, 1];

export interface Motion {
  /** How long a move takes, in milliseconds; 0 under reduced motion. */
  duration: number;
  /** The easing: progress (0 to 1) for elapsed time (0 to 1). */
  ease: (t: number) => number;
  reduced: boolean;
}

/** A CSS `cubic-bezier(x1, y1, x2, y2)` as a function of time, solved for x by Newton's method with a bisection fallback. */
export function cubicBezier(x1: number, y1: number, x2: number, y2: number): (t: number) => number {
  const at = (a: number, b: number, s: number) => 3 * a * s * (1 - s) ** 2 + 3 * b * s * s * (1 - s) + s ** 3;
  const slope = (a: number, b: number, s: number) => 3 * a * (1 - s) ** 2 + 6 * (b - a) * s * (1 - s) + 3 * (1 - b) * s * s;
  return (t) => {
    if (t <= 0) return 0;
    if (t >= 1) return 1;
    let s = t;
    for (let i = 0; i < 8; i++) {
      const err = at(x1, x2, s) - t;
      if (Math.abs(err) < 1e-6) return at(y1, y2, s);
      const d = slope(x1, x2, s);
      if (Math.abs(d) < 1e-6) break;
      s -= err / d;
    }
    let lo = 0;
    let hi = 1;
    s = t;
    for (let i = 0; i < 40; i++) {
      const x = at(x1, x2, s);
      if (Math.abs(x - t) < 1e-6) break;
      if (x < t) lo = s; else hi = s;
      s = (lo + hi) / 2;
    }
    return at(y1, y2, s);
  };
}

/** Parses a duration token ("320ms", "0.32s"). */
export function parseDuration(value: string, fallback = MOTION_SPEED_MS): number {
  const m = value.trim().match(/^([0-9.]+)(ms|s)$/);
  return m ? Number(m[1]) * (m[2] === 's' ? 1000 : 1) : fallback;
}

/** Parses an easing token: `cubic-bezier(…)`, or the CSS keywords `ease`, `linear`, `ease-in`, `ease-out`, `ease-in-out`. */
export function parseEase(value: string): (t: number) => number {
  const v = value.trim();
  const keywords: Record<string, [number, number, number, number]> = {
    ease: MOTION_EASE, linear: [0, 0, 1, 1], 'ease-in': [0.42, 0, 1, 1], 'ease-out': [0, 0, 0.58, 1], 'ease-in-out': [0.42, 0, 0.58, 1],
  };
  const m = v.match(/^cubic-bezier\(([^)]*)\)$/);
  const parts = m ? m[1].split(',').map(Number) : keywords[v];
  return parts && parts.length === 4 && parts.every(Number.isFinite) ? cubicBezier(...(parts as [number, number, number, number])) : cubicBezier(...MOTION_EASE);
}

/** True when the person asked the system for reduced motion. */
export function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** The shared motion, read from the stylesheet's tokens. */
export function readMotion(): Motion {
  const reduced = prefersReducedMotion();
  let speed = '';
  let ease = '';
  if (typeof document !== 'undefined' && typeof getComputedStyle === 'function') {
    const style = getComputedStyle(document.documentElement);
    speed = style.getPropertyValue('--motion-speed');
    ease = style.getPropertyValue('--motion-ease');
  }
  return { duration: reduced ? 0 : parseDuration(speed), ease: parseEase(ease), reduced };
}

/** The two box centers an edge joins. */
export interface EdgeEnds { source: Point; target: Point }

/** Where an edge between two box centers is drawn: from where it leaves the source box to where it enters the target box. */
export function edgePoints(ends: EdgeEnds): [Point, Point] {
  const { source: s, target: t } = ends;
  return [boxExit(s.x, s.y, t.x, t.y), boxExit(t.x, t.y, s.x, s.y)];
}

const mix = (a: number, b: number, p: number) => a + (b - a) * p;
const mixPoint = (a: Point, b: Point, p: number) => ({ x: mix(a.x, b.x, p), y: mix(a.y, b.y, p) });

/** One frame of an edge: its two box centers, its drawn points and its opacity. */
export interface EdgeFrame { ends: EdgeEnds; points: [Point, Point]; opacity: number }

/**
 * An edge part of the way through a move, at elapsed time `t` (0 to 1).
 * It moves the two box centers (as the nodes move: from where they were to where they go, along
 * the same easing) and draws the line between their box edges, so each end stays on its box.
 * The opacity goes from `from.opacity` to `to.opacity` along the same easing: an edge that persists
 * stays at 1, a new one fades in from 0, and a removed one fades out to 0.
 */
export function tweenEdge(
  from: { ends: EdgeEnds; opacity: number },
  to: { ends: EdgeEnds; opacity: number },
  t: number,
  ease: (t: number) => number = cubicBezier(...MOTION_EASE),
): EdgeFrame {
  const p = ease(Math.max(0, Math.min(1, t)));
  const ends = { source: mixPoint(from.ends.source, to.ends.source, p), target: mixPoint(from.ends.target, to.ends.target, p) };
  return { ends, points: edgePoints(ends), opacity: mix(from.opacity, to.opacity, p) };
}

/** How an edge comes into a new picture: it was there before, it is new, or it is leaving. */
export type EdgePhase = 'persist' | 'enter' | 'leave';

/** Where an edge starts and ends its move in a re-center, for its phase. */
export function edgeMove(phase: EdgePhase, ends: EdgeEnds, drawn: { ends: EdgeEnds; opacity: number } | null) {
  const target = { ends, opacity: phase === 'leave' ? 0 : 1 };
  if (drawn) return { from: drawn, to: target };
  return { from: { ends, opacity: phase === 'enter' ? 0 : target.opacity }, to: target };
}

/**
 * How far through its CSS transform transition the first moving element is (0 to 1), or null when
 * none of them is moving. An edge reads its nodes' clock so it starts and ends with them, frame for
 * frame, rather than a frame behind.
 */
export function transitionProgress(elements: (Element | null | undefined)[], duration: number): number | null {
  if (duration <= 0) return null;
  for (const el of elements) {
    const running = el?.getAnimations?.().find((a) => (a as CSSTransition).transitionProperty === 'transform');
    if (running && running.currentTime !== null) return Math.min(1, Math.max(0, Number(running.currentTime) / duration));
  }
  return null;
}
