import './setup';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, waitFor } from '@testing-library/react';
import { frameMap, frameOnMap, FRAME_MAX_ZOOM, FRAME_PADDING, glideDuration, PARENT_STRIP, PARENT_STRIP_MAX, zoomPath } from '../../src/graph/camera';
import { graphMap } from '../../src/graph/map';
import { MOTION_SPEED_MS } from '../../src/graph/motion';
import { openApp, startAtDepth } from '../helpers';
import { testIndex, testWorkspace } from './workspace';

// Focusing moves the camera, never the map (LA-BRW-DR392): the camera frames the focus and the
// levels the depth shows below it, the parent kept at the left edge, in one smooth zoom and pan on
// the shared motion; under reduced motion it moves at once.

const calls = vi.hoisted(() => [] as { viewport: { x: number; y: number; zoom: number }; options?: { duration?: number } }[]);

// The page's viewport moves, recorded on their way to React Flow.
vi.mock('@xyflow/react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@xyflow/react')>();
  const wrapped = new WeakMap<object, unknown>();
  return {
    ...actual,
    useReactFlow: () => {
      const flow = actual.useReactFlow();
      if (!wrapped.has(flow.setViewport)) {
        wrapped.set(flow.setViewport, (viewport: (typeof calls)[number]['viewport'], options?: (typeof calls)[number]['options']) => {
          calls.push({ viewport, options });
          return flow.setViewport(viewport, options as never);
        });
      }
      return { ...flow, setViewport: wrapped.get(flow.setViewport) };
    },
  };
});

const node = (id: string) => document.querySelector<HTMLElement>(`.react-flow__node[data-id="${id}"]`);
const isCenter = (id: string) => !!node(id)?.querySelector('.graph-node.is-focus');
/** Every drawn box's place and size on the canvas. */
const boxes = () => new Map([...document.querySelectorAll<HTMLElement>('.react-flow__node')].map((el) => [el.dataset.id!, `${el.style.transform} ${el.style.width} ${el.style.height}`]));
const reducedMotion = () =>
  vi.stubGlobal('matchMedia', (query: string) => ({ matches: query.includes('prefers-reduced-motion: reduce'), media: query, addEventListener: () => {}, removeEventListener: () => {} }));

describe('graph camera', () => {
  const map = graphMap(testIndex());

  it('LA-BRW-T382 The camera frames the focus and the levels the depth shows below it, the parent at the left edge', () => {
    const w = 1000;
    const h = 800;
    const strip = Math.min(PARENT_STRIP_MAX, w * PARENT_STRIP);
    for (const [focus, depth] of [['P-D', 1], ['P-D', 2], ['P-D/define', 3], ['P-D-UC01', 1]] as const) {
      const v = frameOnMap(map, focus, depth, w, h);
      const f = map.nodes.get(focus)!;
      const screen = (x: number, y: number) => ({ x: x * v.zoom + v.x, y: y * v.zoom + v.y });
      // The focus fills the height, or the levels fill the width; never past a leaf's own size.
      const top = screen(f.x, f.y);
      const bottom = screen(f.x, f.y + f.h);
      expect(top.y).toBeGreaterThanOrEqual(FRAME_PADDING - 0.5);
      expect(bottom.y).toBeLessThanOrEqual(h - FRAME_PADDING + 0.5);
      expect(v.zoom).toBeLessThanOrEqual(FRAME_MAX_ZOOM);
      // Centered on the focus's middle, top to bottom.
      expect((top.y + bottom.y) / 2).toBeCloseTo(h / 2, 6);
      // The parent is in view at the left edge, a strip of it at least, and the focus right of it.
      const p = map.nodes.get(f.parent!)!;
      expect(screen(p.x + p.w, 0).x).toBeGreaterThanOrEqual(strip + FRAME_PADDING - 0.5);
      expect(top.x).toBeGreaterThan(screen(p.x + p.w, 0).x);
    }
    // Deeper frames take more levels in: never a larger zoom.
    expect(frameOnMap(map, 'P-D', 3, w, h).zoom).toBeLessThanOrEqual(frameOnMap(map, 'P-D', 1, w, h).zoom);
    // A leaf at its own size, at most.
    expect(frameOnMap(map, 'P-D-UC01-R01', 1, w, h).zoom).toBe(FRAME_MAX_ZOOM);
    // The whole map fits the overview.
    const all = frameMap(map, w, h);
    expect(map.height * all.zoom).toBeLessThanOrEqual(h);
  });

  it('LA-BRW-T741 The glide is one smooth zoom and pan: from the view as it is to the framed one, zooming out only as far as the pan needs', () => {
    const from = frameOnMap(map, 'P-D', 1, 1000, 800);
    const to = frameOnMap(map, 'P-D-UC01-R01', 1, 1000, 800);
    const path = zoomPath(from, to, 1000, 800);
    expect(path.at(0)).toEqual(from);
    expect(path.at(1)).toEqual(to);
    // The zoom never leaves the range by more than the pan needs, and it changes smoothly.
    let last = path.at(0);
    for (let t = 0.05; t <= 1.0001; t += 0.05) {
      const v = path.at(Math.min(1, t));
      expect(Math.abs(Math.log(v.zoom) - Math.log(last.zoom))).toBeLessThan(1);
      last = v;
    }
    // Its length sets the duration: the shared speed for a short move, up to twice it for a long one.
    expect(glideDuration(MOTION_SPEED_MS, 0.1)).toBe(MOTION_SPEED_MS);
    expect(glideDuration(MOTION_SPEED_MS, 100)).toBe(2 * MOTION_SPEED_MS);
    expect(path.S).toBeGreaterThan(0);
  });
});

describe('graph camera on the page', () => {
  beforeEach(() => {
    calls.length = 0;
    // jsdom lays nothing out; the canvas is 1000 by 800.
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({ x: 0, y: 0, top: 0, left: 0, width: 1000, height: 800, right: 1000, bottom: 800, toJSON: () => ({}) } as DOMRect);
  });
  afterEach(() => vi.unstubAllGlobals());

  async function open() {
    startAtDepth(1);
    await openApp('/P-D-UC01?view=graph', { workspace: testWorkspace() });
    await waitFor(() => expect(isCenter('P-D-UC01')).toBe(true));
    await waitFor(() => expect(calls.length).toBeGreaterThan(0));
  }

  it('LA-BRW-T383 Focusing a child glides the camera on the shared motion, and no box moves or changes size', async () => {
    await open();
    // The first picture appears at once, framed.
    expect(calls.every((c) => c.options?.duration === 0)).toBe(true);
    expect(calls.at(-1)!.viewport).toEqual(frameOnMap(graphMap(testIndex()), 'P-D-UC01', 1, 1000, 800));
    const before = boxes();
    const first = calls.length;

    fireEvent.click(node('P-D-UC01-R01')!);
    await waitFor(() => expect(isCenter('P-D-UC01-R01')).toBe(true));
    // The camera glides there, frame by frame, and ends framing the new focus.
    const target = frameOnMap(graphMap(testIndex()), 'P-D-UC01-R01', 1, 1000, 800);
    await waitFor(() => expect(calls.at(-1)!.viewport).toEqual(target), { timeout: 3000 });
    expect(calls.length - first).toBeGreaterThan(2);
    // Every box drawn before and after is where it was, at the size it was.
    const after = boxes();
    const both = [...before.keys()].filter((id) => after.has(id));
    expect(both).toContain('P-D-UC01');
    expect(both).toContain('P-D-UC01-R01');
    for (const id of both) expect(after.get(id), id).toBe(before.get(id));
    // Back glides back.
    window.history.back();
    await waitFor(() => expect(isCenter('P-D-UC01')).toBe(true));
    await waitFor(() => expect(calls.at(-1)!.viewport).toEqual(frameOnMap(graphMap(testIndex()), 'P-D-UC01', 1, 1000, 800)), { timeout: 3000 });
  });

  it('LA-BRW-T384 Under reduced motion focusing frames the new focus at once', async () => {
    reducedMotion();
    await open();
    const first = calls.length;
    fireEvent.click(node('P-D-UC01-R01')!);
    await waitFor(() => expect(isCenter('P-D-UC01-R01')).toBe(true));
    await waitFor(() => expect(calls.length).toBe(first + 1));
    expect(calls[first]).toEqual({ viewport: frameOnMap(graphMap(testIndex()), 'P-D-UC01-R01', 1, 1000, 800), options: { duration: 0 } });
  });
});
