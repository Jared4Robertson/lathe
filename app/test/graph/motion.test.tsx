import { describe, expect, it } from 'vitest';
import { cubicBezier, MOTION_EASE, parseDuration, parseEase } from '../../src/graph/motion';
import { zoomPath } from '../../src/graph/camera';

// The camera glides on the shared motion (LA-PAT-APP-UX-R04): the stylesheet's duration and easing.

describe('graph motion', () => {
  it.each(['LA-EXP-DS09-T02', 'LA-PAT-APP-UX-R04-T02'])("%s The glide follows the shared easing: CSS's ease, read from the motion tokens", () => {
    const ease = cubicBezier(...MOTION_EASE);
    expect(ease(0)).toBe(0);
    expect(ease(1)).toBe(1);
    // The curve, found by walking it finely: at time x(s), progress is y(s).
    const curve = (a: number, b: number, s: number) => 3 * a * s * (1 - s) ** 2 + 3 * b * s * s * (1 - s) + s ** 3;
    const reference = (t: number) => {
      let best = 0;
      for (let s = 0; s <= 1; s += 1e-5) if (Math.abs(curve(0.25, 0.25, s) - t) < Math.abs(curve(0.25, 0.25, best) - t)) best = s;
      return curve(0.1, 1, best);
    };
    for (const t of [0.1, 0.25, 0.5, 0.75, 0.9]) expect(ease(t)).toBeCloseTo(reference(t), 4);
    expect(ease(0.5)).toBeCloseTo(0.8024, 3);
    // So halfway through the time, a pan with no zoom is 80% of the way there.
    const path = zoomPath({ x: 0, y: 0, zoom: 1 }, { x: -300, y: 0, zoom: 1 }, 1000, 800);
    expect(path.at(ease(0.5)).x).toBeLessThan(-0.6 * 300);
    // The tokens parse as the stylesheet writes them, and the keyword matches the written-out curve.
    expect(parseDuration('320ms')).toBe(320);
    expect(parseDuration('0.32s')).toBe(320);
    expect(parseDuration('')).toBe(320);
    expect(parseEase('cubic-bezier(0.25, 0.1, 0.25, 1)')(0.5)).toBeCloseTo(ease(0.5), 6);
    expect(parseEase('ease')(0.3)).toBeCloseTo(ease(0.3), 6);
    expect(parseEase('linear')(0.3)).toBeCloseTo(0.3, 6);
  });
});
