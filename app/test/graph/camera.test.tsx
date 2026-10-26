import './setup';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, waitFor } from '@testing-library/react';
import { drawnNested, frameMap, frameNested, frameOnMap, FRAME_MAX_ZOOM, FRAME_PADDING, glideDuration, MAX_DRAWN, MAX_ZOOM, MIN_DRAWN, PARENT_STRIP, PARENT_STRIP_MAX, REVEAL_ZOOM, viewRect, zoomPath } from '../../src/graph/camera';
import { nestedMap } from '../../src/graph/nested';
import { readyVoronoiMap } from '../../src/graph/voronoi';
import { labelShown, MIN_LABEL_PX, TITLE_FONT } from '../../src/graph/text';
import { graphMap } from '../../src/graph/map';
import { MOTION_SPEED_MS } from '../../src/graph/motion';
import { openApp, startAtDepth } from '../helpers';
import { testIndex, testWorkspace } from './workspace';

// Focusing moves the camera, never the map (LA-EXP-DR59): the camera frames the focus and the
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
  const map = graphMap(testIndex(), 'P');

  it('LA-EXP-T129 The camera frames the focus and the levels the depth shows below it, the parent at the left edge', () => {
    const w = 1000;
    const h = 800;
    const strip = Math.min(PARENT_STRIP_MAX, w * PARENT_STRIP);
    for (const [focus, depth] of [['P-D', 1], ['P-D', 2], ['P-D/define', 3], ['P-D-UC01', 1], ['P-D/question', 1]] as const) {
      const v = frameOnMap(map, focus, depth, w, h);
      const f = map.nodes.get(focus)!;
      const screen = (x: number, y: number) => ({ x: x * v.zoom + v.x, y: y * v.zoom + v.y });
      // The focus fills the height, or the levels fill the width; never past a leaf's own size.
      const top = screen(f.x, f.y);
      const bottom = screen(f.x, f.y + f.h);
      expect(top.y).toBeGreaterThanOrEqual(FRAME_PADDING - 0.5);
      expect(bottom.y).toBeLessThanOrEqual(h - FRAME_PADDING + 0.5);
      expect(v.zoom).toBeLessThanOrEqual(FRAME_MAX_ZOOM);
      // Never so far out that the focus's own title is under MIN_LABEL_PX on screen (LA-EXP-DR60).
      expect(TITLE_FONT * f.text * v.zoom).toBeGreaterThanOrEqual(MIN_LABEL_PX - 1e-9);
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

  it('LA-EXP-T169 The glide is one smooth zoom and pan: from the view as it is to the framed one, zooming out only as far as the pan needs', () => {
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

  it('LA-EXP-T130 Focusing a child glides the camera on the shared motion, and no box moves or changes size', async () => {
    await open();
    // The first picture appears at once, framed.
    expect(calls.every((c) => c.options?.duration === 0)).toBe(true);
    expect(calls.at(-1)!.viewport).toEqual(frameOnMap(graphMap(testIndex(), 'P'), 'P-D-UC01', 1, 1000, 800));
    const before = boxes();
    const first = calls.length;

    fireEvent.click(node('P-D-UC01-R01')!);
    await waitFor(() => expect(isCenter('P-D-UC01-R01')).toBe(true));
    // The camera glides there, frame by frame, and ends framing the new focus.
    const target = frameOnMap(graphMap(testIndex(), 'P'), 'P-D-UC01-R01', 1, 1000, 800);
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
    await waitFor(() => expect(calls.at(-1)!.viewport).toEqual(frameOnMap(graphMap(testIndex(), 'P'), 'P-D-UC01', 1, 1000, 800)), { timeout: 3000 });
  });

  it('LA-EXP-T131 Under reduced motion focusing frames the new focus at once', async () => {
    reducedMotion();
    await open();
    const first = calls.length;
    fireEvent.click(node('P-D-UC01-R01')!);
    await waitFor(() => expect(isCenter('P-D-UC01-R01')).toBe(true));
    await waitFor(() => expect(calls.length).toBe(first + 1));
    expect(calls[first]).toEqual({ viewport: frameOnMap(graphMap(testIndex(), 'P'), 'P-D-UC01-R01', 1, 1000, 800), options: { duration: 0 } });
  });
});

describe('graph camera in the Nested layout', () => {
  const map = nestedMap(testIndex(), 'P');
  /** How many levels a node lies inside another, or -1. */
  const inside = (id: string, focus: string) => {
    let d = 0;
    for (let at: string | null = id; at !== null; at = map.nodes.get(at)!.parent, d++) if (at === focus) return d;
    return -1;
  };

  it('LA-EXP-T188 The camera frames the focus box, and depth labels the levels inside it until the person zooms in', () => {
    for (const focus of ['P', 'P-D', 'P-D/define', 'P-D-UC01', 'P-D-UC01-R01']) {
      const n = map.nodes.get(focus)!;
      const v = frameNested(map, focus, 1000, 800);
      // Centered, within the padding, never past MAX_ZOOM.
      expect(v.x + (n.x + n.w / 2) * v.zoom).toBeCloseTo(500, 6);
      expect(v.y + (n.y + n.h / 2) * v.zoom).toBeCloseTo(400, 6);
      expect(n.w * v.zoom).toBeLessThanOrEqual(1000 - 2 * FRAME_PADDING + 1e-6);
      expect(n.h * v.zoom).toBeLessThanOrEqual(800 - 2 * FRAME_PADDING + 1e-6);
      expect(v.zoom).toBeLessThanOrEqual(MAX_ZOOM);
      for (const depth of [1, 2, 3]) {
        const limit = { focus, depth, framed: v.zoom };
        const d = drawnNested(map, v, 1000, 800, [], limit);
        const rect = viewRect(v, 1000, 800);
        const order = d.boxes.map((b) => b.id);
        expect(d.bars).toEqual([]);
        expect(d.boxes.length).toBeLessThanOrEqual(MAX_DRAWN);
        for (const b of d.boxes) {
          const m = map.nodes.get(b.id)!;
          // In view and big enough each way, its parent drawn before it.
          expect(m.x + m.w >= rect.x0 && m.x <= rect.x1 && m.y + m.h >= rect.y0 && m.y <= rect.y1, b.id).toBe(true);
          expect(Math.min(m.w, m.h) * v.zoom).toBeGreaterThanOrEqual(MIN_DRAWN);
          if (m.parent !== null) expect(order.indexOf(m.parent), b.id).toBeLessThan(order.indexOf(b.id));
          // Deeper than the depth inside the focus, or a label that does not fit its box: plain. Otherwise labeled while its title reads.
          expect(b.label, `${b.id} at depth ${depth}`).toBe(map.nodes.get(b.id)!.fits && inside(b.id, focus) <= depth && labelShown(m.text, v.zoom));
        }
        // Zoomed in REVEAL_ZOOM times past the frame, the deeper boxes are labeled as their titles read.
        const z = { ...v, zoom: v.zoom * REVEAL_ZOOM };
        for (const b of drawnNested(map, z, 1000, 800, [], limit).boxes) expect(b.label).toBe(map.nodes.get(b.id)!.fits && labelShown(map.nodes.get(b.id)!.text, z.zoom));
      }
    }
    // A focus whose label fits is labeled at its frame: its title reads.
    for (const focus of ['P', 'P-D', 'P-D-UC01'].filter((id) => map.nodes.get(id)!.fits)) {
      const v = frameNested(map, focus, 1000, 800);
      expect(drawnNested(map, v, 1000, 800, [], { focus, depth: 1, framed: v.zoom }).boxes.find((b) => b.id === focus)?.label).toBe(true);
    }
  });

  it('LA-EXP-T188 On the page, focusing a child in the Nested layout glides to its box, and Back glides back', async () => {
    calls.length = 0;
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({ x: 0, y: 0, top: 0, left: 0, width: 1000, height: 800, right: 1000, bottom: 800, toJSON: () => ({}) } as DOMRect);
    startAtDepth(1, 'nested');
    await openApp('/P-D-UC01?view=graph', { workspace: testWorkspace() });
    await waitFor(() => expect(isCenter('P-D-UC01')).toBe(true));
    await waitFor(() => expect(calls.at(-1)?.viewport).toEqual(frameNested(nestedMap(testIndex(), 'P'), 'P-D-UC01', 1000, 800)));
    expect(document.querySelector('.graph-flow.is-nested')).not.toBeNull();
    fireEvent.click(node('P-D-UC01-R01')!);
    await waitFor(() => expect(isCenter('P-D-UC01-R01')).toBe(true));
    await waitFor(() => expect(calls.at(-1)!.viewport).toEqual(frameNested(nestedMap(testIndex(), 'P'), 'P-D-UC01-R01', 1000, 800)), { timeout: 3000 });
    window.history.back();
    await waitFor(() => expect(isCenter('P-D-UC01')).toBe(true));
    await waitFor(() => expect(calls.at(-1)!.viewport).toEqual(frameNested(nestedMap(testIndex(), 'P'), 'P-D-UC01', 1000, 800)), { timeout: 3000 });
  });

  it('LA-EXP-T193 On the page, the Voronoi layout draws each cell as its outline, clipped to it, and focusing a child glides to its cell', async () => {
    calls.length = 0;
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({ x: 0, y: 0, top: 0, left: 0, width: 1000, height: 800, right: 1000, bottom: 800, toJSON: () => ({}) } as DOMRect);
    startAtDepth(1, 'voronoi');
    await openApp('/P-D-UC01?view=graph', { workspace: testWorkspace() });
    await waitFor(() => expect(isCenter('P-D-UC01')).toBe(true));
    const map = () => readyVoronoiMap(testIndex(), 'P')!;
    await waitFor(() => expect(calls.at(-1)?.viewport).toEqual(frameNested(map(), 'P-D-UC01', 1000, 800)));
    expect(document.querySelector('.graph-flow.is-voronoi')).not.toBeNull();
    expect(node('P-D-UC01')!.style.clipPath).toMatch(/^polygon\(/);
    const cell = node('P-D-UC01')!.querySelector<HTMLElement>('.graph-node.is-cell')!;
    expect(cell.querySelector('.graph-cell-shape polygon')).not.toBeNull();
    expect(cell.querySelector('.graph-cell-label strong')?.textContent).toBe('Lend a thing');
    fireEvent.click(node('P-D-UC01-R01')!);
    await waitFor(() => expect(isCenter('P-D-UC01-R01')).toBe(true));
    await waitFor(() => expect(calls.at(-1)!.viewport).toEqual(frameNested(map(), 'P-D-UC01-R01', 1000, 800)), { timeout: 3000 });
  });
});
