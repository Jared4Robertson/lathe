import './setup';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { NODE_HEIGHT, NODE_WIDTH } from '../../src/graph/layout';
import { cubicBezier, edgeMove, edgePoints, MOTION_EASE, parseDuration, parseEase, readMotion, tweenEdge, type EdgeEnds } from '../../src/graph/motion';
import { openApp, startAtDepth } from '../helpers';
import { testWorkspace } from './workspace';

// The graph moves as one picture when it re-centers (LA-BRW-UC20-R09): each edge tweens with its
// nodes on the shared motion (LA-PAT-APP-UX-R04), new edges fade in, leaving ones fade out, and
// under reduced motion everything jumps.

const linear = (t: number) => t;
/** A box centered at (x, y): its left, right, top and bottom sides. */
const box = (c: { x: number; y: number }) => ({ left: c.x - NODE_WIDTH / 2, right: c.x + NODE_WIDTH / 2, top: c.y - NODE_HEIGHT / 2, bottom: c.y + NODE_HEIGHT / 2 });
/** True when the point lies on the box's outline. */
const onBox = (p: { x: number; y: number }, c: { x: number; y: number }) => {
  const b = box(c);
  const near = (a: number, v: number) => Math.abs(a - v) < 1e-6;
  const inX = p.x >= b.left - 1e-6 && p.x <= b.right + 1e-6;
  const inY = p.y >= b.top - 1e-6 && p.y <= b.bottom + 1e-6;
  return ((near(p.x, b.left) || near(p.x, b.right)) && inY) || ((near(p.y, b.top) || near(p.y, b.bottom)) && inX);
};

const from: EdgeEnds = { source: { x: 0, y: 0 }, target: { x: 300, y: 0 } };
const to: EdgeEnds = { source: { x: -300, y: 100 }, target: { x: 0, y: 0 } };

describe('graph motion', () => {
  it('LA-BRW-T299 An edge tweens its two boxes from where they were to where they go, its ends on the boxes at t = 0, 0.5 and 1', () => {
    const start = tweenEdge({ ends: from, opacity: 1 }, { ends: to, opacity: 1 }, 0, linear);
    expect(start.points).toEqual(edgePoints(from));
    expect(start.points[0]).toEqual({ x: NODE_WIDTH / 2, y: 0 });
    expect(start.points[1]).toEqual({ x: 300 - NODE_WIDTH / 2, y: 0 });

    const half = tweenEdge({ ends: from, opacity: 1 }, { ends: to, opacity: 1 }, 0.5, linear);
    expect(half.ends).toMatchObject({ source: { x: -150, y: 50 }, target: { x: 150, y: 0 } });
    expect(onBox(half.points[0], half.ends.source)).toBe(true);
    expect(onBox(half.points[1], half.ends.target)).toBe(true);

    const end = tweenEdge({ ends: from, opacity: 1 }, { ends: to, opacity: 1 }, 1, linear);
    expect(end.points).toEqual(edgePoints(to));
    for (const t of [0, 0.1, 0.25, 0.5, 0.75, 0.9, 1]) {
      const f = tweenEdge({ ends: from, opacity: 1 }, { ends: to, opacity: 1 }, t);
      expect(onBox(f.points[0], f.ends.source)).toBe(true);
      expect(onBox(f.points[1], f.ends.target)).toBe(true);
    }
    // Out of range times are held at the ends.
    expect(tweenEdge({ ends: from, opacity: 1 }, { ends: to, opacity: 1 }, 2, linear).ends).toMatchObject(to);
  });

  it("LA-BRW-T300 The tween follows the nodes' easing: CSS's ease, read from the motion tokens", () => {
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
    // So halfway through the time, the boxes are 80% of the way there.
    const half = tweenEdge({ ends: from, opacity: 1 }, { ends: to, opacity: 1 }, 0.5);
    expect(half.ends.source.x).toBeCloseTo(-300 * ease(0.5), 6);
    // The tokens parse as the stylesheet writes them, and the keyword matches the written-out curve.
    expect(parseDuration('320ms')).toBe(320);
    expect(parseDuration('0.32s')).toBe(320);
    expect(parseDuration('')).toBe(320);
    expect(parseEase('cubic-bezier(0.25, 0.1, 0.25, 1)')(0.5)).toBeCloseTo(ease(0.5), 6);
    expect(parseEase('ease')(0.3)).toBeCloseTo(ease(0.3), 6);
    expect(parseEase('linear')(0.3)).toBeCloseTo(0.3, 6);
  });

  it('LA-BRW-T301 An edge that persists moves at full strength, a new one fades in and a leaving one fades out', () => {
    const drawn = { ends: from, opacity: 1 };
    // Persists: from where it was drawn to its new place, opacity 1 throughout.
    const persist = edgeMove('persist', to, drawn);
    expect(persist.from).toBe(drawn);
    expect(persist.to).toEqual({ ends: to, opacity: 1 });
    expect(tweenEdge(persist.from, persist.to, 0.5).opacity).toBe(1);
    // Enters: drawn at its place, from transparent to opaque.
    const enter = edgeMove('enter', to, null);
    expect(enter.from).toEqual({ ends: to, opacity: 0 });
    expect(tweenEdge(enter.from, enter.to, 0, linear).opacity).toBe(0);
    expect(tweenEdge(enter.from, enter.to, 0.5, linear).opacity).toBe(0.5);
    expect(tweenEdge(enter.from, enter.to, 1, linear).opacity).toBe(1);
    // Leaves: from where it was, fading to nothing as its boxes move.
    const leave = edgeMove('leave', to, drawn);
    expect(leave.to).toEqual({ ends: to, opacity: 0 });
    expect(tweenEdge(leave.from, leave.to, 0.5, linear).opacity).toBe(0.5);
    expect(tweenEdge(leave.from, leave.to, 1, linear).opacity).toBe(0);
    // A first picture's edge is simply there.
    const first = edgeMove('persist', to, null);
    expect(first.from).toEqual(first.to);
  });
});

// The use case's line from its folder. When the center moves out to the Define stage, the stage
// spans all its folders and the use cases' folder all its use cases, so the use case moves and the
// line, level at its middle, moves with it.
const EDGE = 'P-D/define/use-cases|parent|P-D-UC01';
const path = () => document.getElementById(EDGE);
const node = (id: string) => document.querySelector<HTMLElement>(`.react-flow__node[data-id="${id}"]`);
const isCenter = (id: string) => !!node(id)?.querySelector('.graph-node.is-focus');
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Opens Lend a thing's graph, then re-centers on its Define stage; returns the line from the use cases' folder to the use case as first drawn and just after the click. */
async function recenter() {
  startAtDepth(1);
  await openApp('/P-D-UC01?view=graph', { workspace: testWorkspace() });
  await waitFor(() => expect(path()).not.toBeNull());
  await waitFor(() => expect(isCenter('P-D-UC01')).toBe(true));
  // With Links on, a cross-link is drawn that leaves the picture.
  fireEvent.click(screen.getByRole('button', { name: 'Links' }));
  await waitFor(() => expect(node('P-D-DR01')).not.toBeNull());
  await sleep(500);
  const element = path()!;
  const before = element.getAttribute('d');
  fireEvent.click(node('P-D/define')!);
  await waitFor(() => expect(isCenter('P-D/define')).toBe(true));
  return { element, before, first: path()?.getAttribute('d') };
}

describe('graph motion on the page', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('LA-BRW-T302 A persisting edge keeps its element and moves to its new place; edges that leave fade out and are then dropped', async () => {
    const { element, before, first } = await recenter();
    // The new picture is drawn, but the edge starts where it was and is the same element.
    expect(path()).toBe(element);
    expect(first).toBe(before);
    const leaving = document.querySelectorAll('.graph-edge-motion[data-phase="leave"]');
    expect(leaving.length).toBeGreaterThan(0);
    // It moves, staying the same element, and ends where the new picture puts it.
    let seen = new Set<string | null>();
    for (let i = 0; i < 12; i++) {
      await sleep(40);
      expect(path()).toBe(element);
      seen.add(element.getAttribute('d'));
    }
    seen = new Set([...seen].filter((d) => d !== before));
    expect(seen.size).toBeGreaterThan(1); // frames in between, not one jump
    await waitFor(() => expect(document.querySelectorAll('.graph-edge-motion[data-phase="leave"]')).toHaveLength(0));
    const settled = element.getAttribute('d');
    await sleep(100);
    expect(element.getAttribute('d')).toBe(settled);
    expect(settled).not.toBe(before);
    expect(element.closest('g')!.style.opacity).toBe('1');
  });

  it('LA-BRW-T303 Under reduced motion the edges jump with the nodes: no tween and nothing fading out', async () => {
    vi.stubGlobal('matchMedia', (query: string) => ({ matches: query.includes('prefers-reduced-motion: reduce'), media: query, addEventListener: () => {}, removeEventListener: () => {} }));
    expect(readMotion()).toMatchObject({ duration: 0, reduced: true });
    const { element, before, first } = await recenter();
    expect(path()).toBe(element);
    // Already at its new place the moment the new picture is drawn, and it stays there.
    expect(first).not.toBe(before);
    expect(document.querySelectorAll('.graph-edge-motion[data-phase="leave"]')).toHaveLength(0);
    await sleep(200);
    expect(element.getAttribute('d')).toBe(first);
    expect(document.querySelectorAll('.graph-edge-motion[data-phase="leave"]')).toHaveLength(0);
  });
});
