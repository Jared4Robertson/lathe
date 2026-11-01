import './setup';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, waitFor } from '@testing-library/react';
import { drawnNested, FOCUS_CLEAR, FOCUS_SHARE, frameGround, frameMap, frameNested, frameOnMap, FRAME_PADDING, glideDuration, MAX_DRAWN, MAX_ZOOM, MIN_DRAWN, PARENT_STRIP, PARENT_STRIP_MAX, STREET_ZOOM, viewRect, wholeIn, zoomPath } from '../../src/graph/camera';
import { MOTION_SPEED_MS } from '../../src/graph/motion';
import { roundCamera } from '../../src/graph/GraphPage';
import { openApp, startAtDepth } from '../helpers';
import { testIndex, testWorkspace } from './workspace';
import { boxElement, isCenter, scene } from './scene';
import { graphMap, layoutTree, nestedMap } from './maps';

// Focusing moves the camera, never the map (LA-EXP-DS09): the camera frames the focus to most of
// the pane's width, the parent kept at the left edge, in one smooth zoom and pan on the shared
// motion; under reduced motion it moves at once.

const node = (id: string) => boxElement(id);

/** The camera now, and the counts of its moves and glides, as the canvas's scene reports them. */
const camera = () => scene().camera;
const moves = () => scene().moves;
const glides = () => scene().glides;
/** Every drawn box's place and size in the map. */
const boxes = () => new Map(scene().boxes.map((b) => [b.id, JSON.stringify(b.map)]));
const reducedMotion = () =>
  vi.stubGlobal('matchMedia', (query: string) => ({ matches: query.includes('prefers-reduced-motion: reduce'), media: query, addEventListener: () => {}, removeEventListener: () => {} }));

describe('graph camera', () => {
  const map = graphMap(testIndex(), 'P');

  it('LA-EXP-DS09-T03 LA-EXP-DS10-T01 The camera frames the focus to most of the pane\'s width, its parent in a strip at the left edge and its children\'s column starting on the right', () => {
    const w = 1000;
    const h = 800;
    for (const focus of ['P-D', 'P-D/use-cases', 'P-D-UC01', 'P-D/question', 'P-D-UC01-R01']) {
      const v = frameOnMap(map, focus, w, h);
      const f = map.nodes.get(focus)!;
      const screen = (x: number, y: number) => ({ x: x * v.zoom + v.x, y: y * v.zoom + v.y });
      const [x0, y0] = [screen(f.x, f.y).x, screen(f.x, f.y).y];
      const [x1, y1] = [screen(f.x + f.w, 0).x, screen(0, f.y + f.h).y];
      // The focus is whole in the pane, never past the camera's limit, and centered top to bottom.
      expect(x0, focus).toBeGreaterThanOrEqual(-0.5);
      expect(x1, focus).toBeLessThanOrEqual(w + 0.5);
      expect(y0, focus).toBeGreaterThanOrEqual(-0.5);
      expect(y1, focus).toBeLessThanOrEqual(h + 0.5);
      expect(v.zoom).toBeLessThanOrEqual(MAX_ZOOM);
      expect((y0 + y1) / 2, focus).toBeCloseTo(h / 2, 6);
      // Its width fills FOCUS_SHARE of the pane's, unless its height caps the zoom.
      const capped = (y1 - y0) >= h - 2 * FRAME_PADDING - 1e-6;
      if (!capped) expect((x1 - x0) / w, focus).toBeCloseTo(FOCUS_SHARE, 6);
      else expect((x1 - x0) / w, focus).toBeLessThanOrEqual(FOCUS_SHARE + 1e-9);
      // The parent shows at the left edge: its right edge in view, no further in than the strip.
      const p = map.nodes.get(f.parent!)!;
      const edge = screen(p.x + p.w, 0).x;
      expect(edge, focus).toBeGreaterThan(0);
      expect(edge, focus).toBeLessThanOrEqual(Math.min(PARENT_STRIP_MAX, w * PARENT_STRIP) + 0.5);
      expect(x0, focus).toBeGreaterThan(edge);
      // The children's column starts in view on the right, as a cue.
      if (f.children.length > 0) expect(screen(map.nodes.get(f.children[0])!.x, 0).x, focus).toBeLessThan(w);
    }
    // A leaf framed short of the limit: a deep leaf is small against the product's box, and the camera reaches it.
    expect(frameOnMap(map, 'P-D-UC01-R01', w, h).zoom).toBeLessThan(MAX_ZOOM);
    // The whole map fits the overview.
    const all = frameMap(map, w, h);
    expect(map.height * all.zoom).toBeLessThanOrEqual(h);
  });

  it('LA-EXP-DS09-T14 LA-V93-R07-T07 LA-PAT-APP-UX-R23-T01 A focus with many children is framed whole, its children\'s column starting beside it', () => {
    // A 6:1 tree: the product holds six parents; one has eight children (each with two of its own), one forty.
    const kids: Record<string, string[]> = {
      P: ['few', 'many', 'most', 'other 1', 'other 2', 'other 3'],
      few: ['few-a', 'few-b'],
      many: Array.from({ length: 8 }, (_, i) => `use case ${i + 1}`),
      most: Array.from({ length: 40 }, (_, i) => `rule ${i + 1}`) };
    for (const k of kids.many) kids[k] = [`${k} step 1`, `${k} step 2`];
    const tree = layoutTree(['P'], (id) => kids[id] ?? [], (id) => ({ title: `The record called ${id}`, meta: `Use case · ${id}` }));
    for (const [w, h] of [[1000, 800], [547, 600], [1400, 1000]] as const) for (const id of ['few', 'many', 'most']) {
      const v = frameOnMap(tree, id, w, h);
      const f = tree.nodes.get(id)!;
      const at = `${id} in ${w}x${h}`;
      // The focus whole, clear of the parent's strip at the left.
      expect(f.x * v.zoom + v.x, at).toBeGreaterThanOrEqual(0);
      expect((f.x + f.w) * v.zoom + v.x, at).toBeLessThanOrEqual(w + 0.5);
      expect(f.y * v.zoom + v.y, at).toBeGreaterThanOrEqual(-0.5);
      expect((f.y + f.h) * v.zoom + v.y, at).toBeLessThanOrEqual(h + 0.5);
      // Its first child shows beside it.
      const first = tree.nodes.get(f.children[0])!;
      expect(first.x * v.zoom + v.x, at).toBeLessThan(w);
    }
  });

  it('LA-PAT-APP-UX-R23-T01 The focused box is always whole in the frame: kept as it is when whole, moved in at an edge, zoomed out when too big, clear of the panels', () => {
    // The frame: what the panels leave, 300 px in from the left (the nav, a panel) and 60 down (the toolbar).
    const frame = { x: 300, y: 60, w: 700, h: 500 };
    const whole = (v: { x: number; y: number; zoom: number }, b: { x: number; y: number; w: number; h: number }) => {
      const [x0, y0, x1, y1] = [b.x * v.zoom + v.x, b.y * v.zoom + v.y, (b.x + b.w) * v.zoom + v.x, (b.y + b.h) * v.zoom + v.y];
      return x0 >= frame.x + FOCUS_CLEAR - 1e-6 && y0 >= frame.y + FOCUS_CLEAR - 1e-6 && x1 <= frame.x + frame.w - FOCUS_CLEAR + 1e-6 && y1 <= frame.y + frame.h - FOCUS_CLEAR + 1e-6;
    };
    const box = { x: 1000, y: 2000, w: 100, h: 50 };
    // Whole already: unchanged.
    const inside = { x: 500 - 1000, y: 200 - 2000, zoom: 1 };
    expect(wholeIn(inside, box, frame)).toEqual(inside);
    // At the map's edge, under the panel at the left and cut at the top: moved in as little as it takes, at the same zoom.
    const cut = { x: 280 - 1000, y: 40 - 2000, zoom: 1 };
    const moved = wholeIn(cut, box, frame);
    expect(moved.zoom).toBe(1);
    expect(whole(moved, box)).toBe(true);
    expect(box.x * moved.zoom + moved.x).toBeCloseTo(frame.x + FOCUS_CLEAR, 6);
    expect(box.y * moved.zoom + moved.y).toBeCloseTo(frame.y + FOCUS_CLEAR, 6);
    // Taller than the frame at the camera's zoom: zoomed out until it fits, and whole.
    const tall = { x: 0, y: 0, w: 200, h: 4000 };
    const out = wholeIn({ x: 400, y: 100, zoom: 1 }, tall, frame);
    expect(out.zoom).toBeCloseTo((frame.h - 2 * FOCUS_CLEAR) / tall.h, 9);
    expect(whole(out, tall)).toBe(true);
    // Never past the least zoom: then from its top left corner.
    const least = wholeIn({ x: 400, y: 100, zoom: 1 }, tall, frame, FOCUS_CLEAR, 0.5);
    expect(least.zoom).toBe(0.5);
    expect(tall.y * least.zoom + least.y).toBeCloseTo(frame.y + FOCUS_CLEAR, 6);
  });

  it('LA-PAT-APP-UX-R23-T01 The Map and the Nested view frame a focus whole: a record too big for the pane at street level is zoomed out until it fits', () => {
    const ground = { nodes: new Map([['big', { id: 'big', x: 100, y: 200, w: 3000, h: 2000, role: 'record' }], ['small', { id: 'small', x: 50, y: 60, w: 200, h: 80, role: 'record' }]]) } as unknown as Parameters<typeof frameGround>[0];
    const [w, h] = [900, 700];
    for (const id of ['big', 'small']) {
      const v = frameGround(ground, id, w, h);
      const n = ground.nodes.get(id)!;
      expect(v.zoom).toBeLessThanOrEqual(STREET_ZOOM);
      expect(n.x * v.zoom + v.x).toBeGreaterThanOrEqual(FRAME_PADDING - 1e-6);
      expect((n.x + n.w) * v.zoom + v.x).toBeLessThanOrEqual(w - FRAME_PADDING + 1e-6);
      expect(n.y * v.zoom + v.y).toBeGreaterThanOrEqual(FRAME_PADDING - 1e-6);
      expect((n.y + n.h) * v.zoom + v.y).toBeLessThanOrEqual(h - FRAME_PADDING + 1e-6);
    }
    expect(frameGround(ground, 'small', w, h).zoom).toBe(STREET_ZOOM);
    // Too big for street level: zoomed out until it fills FOCUS_SHARE of the pane's width, or its height fits.
    expect(frameGround(ground, 'big', w, h).zoom).toBeCloseTo(Math.min((FOCUS_SHARE * w) / 3000, (h - 2 * FRAME_PADDING) / 2000), 9);
    const nested = nestedMap(testIndex(), 'P');
    for (const id of nested.nodes.keys()) {
      const v = frameNested(nested, id, w, h);
      const n = nested.nodes.get(id)!;
      expect(n.x * v.zoom + v.x, id).toBeGreaterThanOrEqual(-1e-6);
      expect(n.y * v.zoom + v.y, id).toBeGreaterThanOrEqual(-1e-6);
      expect((n.x + n.w) * v.zoom + v.x, id).toBeLessThanOrEqual(w + 1e-6);
      expect((n.y + n.h) * v.zoom + v.y, id).toBeLessThanOrEqual(h + 1e-6);
    }
  });

  it('LA-EXP-DS09-T08 The glide is one smooth zoom and pan: from the view as it is to the framed one, zooming out only as far as the pan needs', () => {
    const from = frameOnMap(map, 'P-D', 1000, 800);
    const to = frameOnMap(map, 'P-D-UC01-R01', 1000, 800);
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
    // jsdom lays nothing out; the canvas is 1000 by 800.
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({ x: 0, y: 0, top: 0, left: 0, width: 1000, height: 800, right: 1000, bottom: 800, toJSON: () => ({}) } as DOMRect);
  });
  afterEach(() => vi.unstubAllGlobals());

  async function open(at = 'P-D-UC01') {
    startAtDepth(1);
    await openApp(`/${at}?stage=graph`, { data: testWorkspace() });
    await waitFor(() => expect(isCenter(at)).toBe(true));
    await waitFor(() => expect(moves()).toBeGreaterThan(0));
  }

  it('LA-EXP-DS05-T10 LA-EXP-DS09-T04 LA-V93-R16-T01 Focusing a child glides the camera on the shared motion, and no box moves or changes size', async () => {
    // From a domain to its use cases stage: a use case and its requirements share one frame, their column at reading size.
    await open('P-D');
    // The first picture appears at once, framed.
    expect(glides()).toBe(0);
    expect(camera()).toEqual(roundCamera(frameOnMap(graphMap(testIndex(), 'P'), 'P-D', 1000, 800)));
    const before = boxes();
    const first = moves();

    fireEvent.click(node('P-D/use-cases')!);
    await waitFor(() => expect(isCenter('P-D/use-cases')).toBe(true));
    // The camera glides there, frame by frame, and ends framing the new focus.
    const target = frameOnMap(graphMap(testIndex(), 'P'), 'P-D/use-cases', 1000, 800);
    await waitFor(() => expect(camera()).toEqual(roundCamera(target)), { timeout: 3000 });
    expect(glides()).toBe(1);
    expect(moves() - first).toBeGreaterThan(2);
    // Every box drawn before and after is where it was, at the size it was.
    const after = boxes();
    const both = [...before.keys()].filter((id) => after.has(id));
    expect(both).toContain('P-D');
    expect(both).toContain('P-D/use-cases');
    for (const id of both) expect(after.get(id), id).toBe(before.get(id));
    // Back glides back.
    window.history.back();
    await waitFor(() => expect(isCenter('P-D')).toBe(true));
    await waitFor(() => expect(camera()).toEqual(roundCamera(frameOnMap(graphMap(testIndex(), 'P'), 'P-D', 1000, 800))), { timeout: 3000 });
  });

  it('LA-EXP-DS09-T05 LA-V93-R01-T01 LA-V93-R16-T02 Under reduced motion focusing frames the new focus at once', async () => {
    reducedMotion();
    await open();
    const first = moves();
    fireEvent.click(node('P-D-UC01-R01')!);
    await waitFor(() => expect(isCenter('P-D-UC01-R01')).toBe(true));
    await waitFor(() => expect(moves()).toBe(first + 1));
    expect(glides()).toBe(0);
    expect(camera()).toEqual(roundCamera(frameOnMap(graphMap(testIndex(), 'P'), 'P-D-UC01-R01', 1000, 800)));
  });
});

describe('graph camera in the Nested layout', () => {
  const map = nestedMap(testIndex(), 'P');
  it('LA-EXP-DS09-T11 The camera frames the focus box to most of the pane\'s width, and draws each box in view and big enough with its label', () => {
    for (const focus of ['P', 'P-D', 'P-D/use-cases', 'P-D-UC01', 'P-D-UC01-R01']) {
      const n = map.nodes.get(focus)!;
      const v = frameNested(map, focus, 1000, 800);
      // Centered, FOCUS_SHARE of the pane's width unless its height caps it, within the padding, never past MAX_ZOOM.
      expect(v.x + (n.x + n.w / 2) * v.zoom).toBeCloseTo(500, 6);
      expect(v.y + (n.y + n.h / 2) * v.zoom).toBeCloseTo(400, 6);
      expect(n.w * v.zoom).toBeLessThanOrEqual(FOCUS_SHARE * 1000 + 1e-6);
      expect(n.h * v.zoom).toBeLessThanOrEqual(800 - 2 * FRAME_PADDING + 1e-6);
      if (n.h * v.zoom < 800 - 2 * FRAME_PADDING - 1e-6) expect(n.w * v.zoom, focus).toBeCloseTo(FOCUS_SHARE * 1000, 6);
      expect(v.zoom).toBeLessThanOrEqual(MAX_ZOOM);
      {
        const d = drawnNested(map, v, 1000, 800, []);
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
          // A drawn box is only its ID: its label is always drawn, at the map's text scale.
          expect(Object.keys(b)).toEqual(['id']);
        }
      }
    }
  });

  it('LA-EXP-DS09-T11 On the page, focusing a child in the Nested layout glides to its box, and Back glides back', async () => {
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({ x: 0, y: 0, top: 0, left: 0, width: 1000, height: 800, right: 1000, bottom: 800, toJSON: () => ({}) } as DOMRect);
    startAtDepth(1, 'nested');
    await openApp('/P-D-UC01?stage=graph', { data: testWorkspace() });
    await waitFor(() => expect(isCenter('P-D-UC01')).toBe(true));
    await waitFor(() => expect(camera()).toEqual(roundCamera(frameNested(nestedMap(testIndex(), 'P'), 'P-D-UC01', 1000, 800))));
    expect(document.querySelector('.graph-flow.is-nested')).not.toBeNull();
    const before = glides();
    fireEvent.click(node('P-D-UC01-R01')!);
    await waitFor(() => expect(isCenter('P-D-UC01-R01')).toBe(true));
    await waitFor(() => expect(camera()).toEqual(roundCamera(frameNested(nestedMap(testIndex(), 'P'), 'P-D-UC01-R01', 1000, 800))), { timeout: 3000 });
    expect(glides()).toBe(before + 1);
    window.history.back();
    await waitFor(() => expect(isCenter('P-D-UC01')).toBe(true));
    await waitFor(() => expect(camera()).toEqual(roundCamera(frameNested(nestedMap(testIndex(), 'P'), 'P-D-UC01', 1000, 800))), { timeout: 3000 });
  });
});
