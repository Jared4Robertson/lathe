// Shared motion (LA-PAT-APP-UX-R04): the speed and easing every animation uses, read from the
// stylesheet's `--motion-speed` and `--motion-ease` tokens, and turned off when the person asks for
// reduced motion. The graph's camera glides on them (camera.ts), and so do the Model view's camera
// and the side bar's Outline.

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
