import './setup';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, waitFor } from '@testing-library/react';
import { CHILD_MIN_H, CHILD_MIN_W, childZoom, drawnFor, drawnNested, FOCUS_CLEAR, keptBox, FOCUS_SHARE, frameGround, frameMap, frameNested, frameOnMap, FRAME_PADDING, glideDuration, MAX_DRAWN, MAX_ZOOM, MIN_DRAWN, PARENT_STRIP, CHILD_PAD_PX, CHILD_TITLE_PX, PARENT_STRIP_MAX, STREET_ZOOM, viewRect, wholeIn, zoomPath } from '../../src/graph/camera';
import { MOTION_SPEED_MS } from '../../src/graph/motion';
import { roundCamera } from '../../src/graph/GraphPage';
import { openApp, startAtDepth } from '../helpers';
import { testIndex, testWorkspace } from './workspace';
import { boxElement, isCenter, scene } from './scene';
import { graphMap, layoutNested, layoutTree, nestedMap } from './maps';
import { drawnLabel, isBlock } from '../../src/graph/paint';
import { plateOf } from '../../src/graph/plate';
import type { NestedNode } from '../../src/graph/nested';

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

  it('LA-EXP-DS09-T03 LA-EXP-DS10-T01 The camera frames the focus with its children\'s column, its parent in a strip at the left edge, and a leaf to most of the pane\'s width', () => {
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
      const capped = (y1 - y0) >= h - 2 * FRAME_PADDING - 1e-6;
      if (f.children.length === 0) {
        // A leaf's width fills FOCUS_SHARE of the pane's, unless its height caps the zoom.
        if (!capped) expect((x1 - x0) / w, focus).toBeCloseTo(FOCUS_SHARE, 6);
        else expect((x1 - x0) / w, focus).toBeLessThanOrEqual(FOCUS_SHARE + 1e-9);
      } else {
        // A parent's children's column is whole on the right, its right edge at the padding unless the height caps the zoom,
        // and every child at least CHILD_MIN_W by CHILD_MIN_H.
        const first = map.nodes.get(f.children[0])!;
        const right = screen(first.x + first.w, 0).x;
        expect(right, focus).toBeLessThanOrEqual(w - FRAME_PADDING + 1e-6);
        if (!capped) expect(right, focus).toBeCloseTo(w - FRAME_PADDING, 6);
        expect(first.w * v.zoom, focus).toBeGreaterThanOrEqual(CHILD_MIN_W - 1e-6);
        expect(first.h * v.zoom, focus).toBeGreaterThanOrEqual(CHILD_MIN_H - 1e-6);
      }
      // The parent shows at the left edge: its right edge in view, no further in than the strip.
      const p = map.nodes.get(f.parent!)!;
      const edge = screen(p.x + p.w, 0).x;
      expect(edge, focus).toBeGreaterThan(0);
      expect(edge, focus).toBeLessThanOrEqual(Math.min(PARENT_STRIP_MAX, w * PARENT_STRIP) + 0.5);
      expect(x0, focus).toBeGreaterThan(edge);
    }
    // A leaf framed short of the limit: a deep leaf is small against the product's box, and the camera reaches it.
    expect(frameOnMap(map, 'P-D-UC01-R01', w, h).zoom).toBeLessThan(MAX_ZOOM);
    // The whole map fits the overview.
    const all = frameMap(map, w, h);
    expect(map.height * all.zoom).toBeLessThanOrEqual(h);
  });

  it('LA-EXP-DS09-T14 LA-V93-R07-T07 LA-PAT-APP-UX-R23-T01 A focus is framed whole with its children\'s column, however many children it has; they read where the room lets them', () => {
    // A 6:1 tree: the product holds six parents; one has two children, one eight (each with two of its own), one forty.
    const kids: Record<string, string[]> = {
      P: ['few', 'many', 'most', 'other 1', 'other 2', 'other 3'],
      few: ['few-a', 'few-b'],
      many: Array.from({ length: 8 }, (_, i) => `use case ${i + 1}`),
      most: Array.from({ length: 40 }, (_, i) => `rule ${i + 1}`) };
    for (const k of kids.many) kids[k] = [`${k} step 1`, `${k} step 2`];
    const tree = layoutTree(['P'], (id) => kids[id] ?? [], (id) => ({ title: `The record called ${id}`, meta: `Use case · ${id}` }));
    const reads = new Set<string>();
    for (const [w, h] of [[1000, 800], [547, 600], [1400, 1000], [343, 560]] as const) for (const id of ['few', 'many', 'most']) {
      const v = frameOnMap(tree, id, w, h);
      const f = tree.nodes.get(id)!;
      const at = `${id} in ${w}x${h}`;
      // The focus and its whole column on screen, inside the padding, and centered top to bottom.
      const last = tree.nodes.get(f.children.at(-1)!)!;
      expect(f.x * v.zoom + v.x, at).toBeGreaterThan(0);
      expect(f.y * v.zoom + v.y, at).toBeGreaterThanOrEqual(FRAME_PADDING - 1e-6);
      expect((f.y + f.h) * v.zoom + v.y, at).toBeLessThanOrEqual(h - FRAME_PADDING + 1e-6);
      expect((last.x + last.w) * v.zoom + v.x, at).toBeLessThanOrEqual(w - FRAME_PADDING + 1e-6);
      expect((f.y + f.h / 2) * v.zoom + v.y, at).toBeCloseTo(h / 2, 6);
      const first = tree.nodes.get(f.children[0])!;
      if (first.w * v.zoom >= CHILD_MIN_W - 1e-6 && first.h * v.zoom >= CHILD_MIN_H - 1e-6) reads.add(at);
      // What the camera keeps whole as it follows: the focus with its column, inside the frame, at the same zoom.
      const kept = keptBox(tree, id, v, w, h)!;
      expect(kept.x * v.zoom + v.x, at).toBeGreaterThanOrEqual(FOCUS_CLEAR - 1e-6);
      expect((kept.x + kept.w) * v.zoom + v.x, at).toBeLessThanOrEqual(w - FOCUS_CLEAR + 1e-6);
      expect(wholeIn(v, kept, { x: 0, y: 0, w, h }).zoom / v.zoom, at).toBeCloseTo(1, 9);
    }
    // Two children read beside the whole focus in a desktop pane; forty in a phone's are too small to, and walking in reads them.
    expect(reads).toContain('few in 1000x800');
    expect(reads).not.toContain('most in 343x560');
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
    const ground = { nodes: new Map([['big', { id: 'big', x: 100, y: 200, w: 3000, h: 2000, role: 'record', children: [] }], ['small', { id: 'small', x: 50, y: 60, w: 200, h: 80, role: 'record', children: [] }]]) } as unknown as Parameters<typeof frameGround>[0];
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

describe('a focus\'s children drawn whole', () => {
  // A parent with thirty children, each with three of its own: at a zoom where its children are too small to see.
  const kids: Record<string, string[]> = { P: ['parent', 'other'], parent: Array.from({ length: 30 }, (_, i) => `child ${i + 1}`) };
  for (const k of kids.parent) kids[k] = [`${k} a`, `${k} b`, `${k} c`];
  const label = (id: string) => ({ title: `The record called ${id} with a long title`, meta: `Use case · ${id}` });
  const tree = layoutTree(['P'], (id) => kids[id] ?? [], label);
  const nested = layoutNested(['P'], (id) => kids[id] ?? [], label);

  it('LA-V93-R77-T01 Each of the focus\'s children is its own box with a readable label at any zoom, never a bar or a block, in the Tree and Nested maps; grandchildren keep their level of detail', () => {
    for (const [name, map] of [['Tree', tree], ['Nested', nested]] as const) {
      const parent = map.nodes.get('parent')!;
      const children = parent.children;
      // Zoomed out until the children are under MIN_DRAWN, the parent still in view.
      const zoom = (MIN_DRAWN / 2) / Math.max(...children.map((c) => map.nodes.get(c)!.h));
      const v = { x: 500 - (parent.x + parent.w / 2) * zoom, y: 400 - (parent.y + parent.h / 2) * zoom, zoom };
      const always = ['parent', ...children];
      const d = name === 'Tree' ? drawnFor(map, v, 1000, 800, always, parent.level + 2) : drawnNested(map, v, 1000, 800, always);
      const boxes = new Set(d.boxes.map((b) => b.id));
      for (const c of children) expect(boxes.has(c), `${name} ${c}`).toBe(true);
      // No bar stands for any of them; the grandchildren, too small, are left out or barred as before.
      for (const bar of d.bars) expect(bar.parent, name).not.toBe('parent');
      for (const c of children) for (const g of map.nodes.get(c)!.children) expect(boxes.has(g), `${name} ${g}`).toBe(false);
      // Without them in `always`, the children are a bar (Tree) or not drawn (Nested): what the rule changes.
      const before = name === 'Tree' ? drawnFor(map, v, 1000, 800, ['parent'], parent.level + 2) : drawnNested(map, v, 1000, 800, ['parent']);
      expect(before.boxes.some((b) => children.includes(b.id)), name).toBe(false);
      // Each child's label: never a block, its title at CHILD_TITLE_PX or more, on two lines at most, cut with an ellipsis
      // only past them; in Nested, where each child holds others, at its top.
      const place = name === 'Nested' ? 'top' : 'middle';
      for (const c of children) {
        const plate = plateOf(testIndex(), c, name === 'Tree' ? { view: 'tree', node: map.nodes.get(c)! } : { view: 'nested', node: map.nodes.get(c)! as NestedNode });
        // Framed: in Nested as the camera frames it; in the Tree, where the focus stays whole and its thirty children are too
        // small there to read, as walking in or zooming in draws them, at the zoom they read at.
        const framed = name === 'Tree' ? childZoom(tree, 'parent') : frameNested(nested, 'parent', 343, 560).zoom;
        for (const z of [zoom, framed]) {
          // Under the zoom the children would be blocks, as any other box.
          if (z === zoom) expect(isBlock(plate, z), `${name} ${c}`).toBe(true);
          const { plate: shown, block, floor } = drawnLabel(plate, z, place);
          expect(block, `${name} ${c}`).toBe(false);
          expect(shown.lines.length, `${name} ${c}`).toBeLessThanOrEqual(2);
          for (const line of shown.lines) expect(line.size * z, `${name} ${c}`).toBeGreaterThanOrEqual(CHILD_TITLE_PX - 1e-9);
          for (const line of shown.lines) expect(line.width, `${name} ${c}`).toBeLessThanOrEqual(plate.w);
          if (floor && place === 'top' && shown.lines.length > 0) expect((shown.lines[0].top - plate.y) * z, `${name} ${c}`).toBeLessThanOrEqual(CHILD_PAD_PX + plate.border * z + 1e-6);
          // Framed, the title shows, cut with an ellipsis where it is longer than its box; zoomed out past that by the
          // person, the box keeps what of it fits, an ellipsis or nothing where not even that does.
          const title = shown.lines.filter((l) => l.face === 'title').map((l) => l.text).join('');
          if (z === framed) expect(shown.lines.map((l) => l.text).join(' '), `${name} ${c}`).toBe(plate.title);
          else expect(title === '' || title.endsWith('…'), `${name} ${c}: ${title}`).toBe(true);
        }
        // Not a focus's child: a block, as before.
        expect(drawnLabel(plate, zoom, undefined).block).toBe(true);
        // A long title wraps on whole words to two lines, the second cut with an ellipsis only past them.
        const long = { ...plate, title: 'A title far longer than any box of a focus\'s child can hold on two lines at the readable size, so its end is cut' };
        const lines = drawnLabel(long, framed, place).plate.lines.map((l) => l.text);
        expect(lines.length, `${name} ${c}`).toBe(2);
        expect(long.title.startsWith(lines[0]), `${name} ${c}`).toBe(true);
        expect(lines[1].endsWith('…'), `${name} ${c}: ${lines[1]}`).toBe(true);
      }
    }
  });
});
