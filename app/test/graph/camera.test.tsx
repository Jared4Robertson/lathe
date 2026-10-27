import './setup';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, waitFor } from '@testing-library/react';
import { drawnNested, frameMap, frameNested, frameOnMap, FRAME_MAX_ZOOM, FRAME_PADDING, glideDuration, MAX_DRAWN, MAX_ZOOM, MIN_DRAWN, PARENT_STRIP, PARENT_STRIP_MAX, viewRect, zoomPath } from '../../src/graph/camera';
import { nestedMap } from '../../src/graph/nested';
import { readyVoronoiMap } from '../../src/graph/voronoi';
import { graphMap } from '../../src/graph/map';
import { MOTION_SPEED_MS } from '../../src/graph/motion';
import { roundCamera } from '../../src/graph/GraphPage';
import { inPolygon } from '../../src/graph/hit';
import { openApp, startAtDepth } from '../helpers';
import { testIndex, testWorkspace } from './workspace';
import { boxElement, drawnBox, graphHost, isCenter, scene } from './scene';

// Focusing moves the camera, never the map (LA-EXP-DR59): the camera frames the focus and the
// levels the depth shows below it, the parent kept at the left edge, in one smooth zoom and pan on
// the shared motion; under reduced motion it moves at once.

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
    // jsdom lays nothing out; the canvas is 1000 by 800.
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({ x: 0, y: 0, top: 0, left: 0, width: 1000, height: 800, right: 1000, bottom: 800, toJSON: () => ({}) } as DOMRect);
  });
  afterEach(() => vi.unstubAllGlobals());

  async function open() {
    startAtDepth(1);
    await openApp('/P-D-UC01?view=graph', { workspace: testWorkspace() });
    await waitFor(() => expect(isCenter('P-D-UC01')).toBe(true));
    await waitFor(() => expect(moves()).toBeGreaterThan(0));
  }

  it('LA-EXP-T130 Focusing a child glides the camera on the shared motion, and no box moves or changes size', async () => {
    await open();
    // The first picture appears at once, framed.
    expect(glides()).toBe(0);
    expect(camera()).toEqual(roundCamera(frameOnMap(graphMap(testIndex(), 'P'), 'P-D-UC01', 1, 1000, 800)));
    const before = boxes();
    const first = moves();

    fireEvent.click(node('P-D-UC01-R01')!);
    await waitFor(() => expect(isCenter('P-D-UC01-R01')).toBe(true));
    // The camera glides there, frame by frame, and ends framing the new focus.
    const target = frameOnMap(graphMap(testIndex(), 'P'), 'P-D-UC01-R01', 1, 1000, 800);
    await waitFor(() => expect(camera()).toEqual(roundCamera(target)), { timeout: 3000 });
    expect(glides()).toBe(1);
    expect(moves() - first).toBeGreaterThan(2);
    // Every box drawn before and after is where it was, at the size it was.
    const after = boxes();
    const both = [...before.keys()].filter((id) => after.has(id));
    expect(both).toContain('P-D-UC01');
    expect(both).toContain('P-D-UC01-R01');
    for (const id of both) expect(after.get(id), id).toBe(before.get(id));
    // Back glides back.
    window.history.back();
    await waitFor(() => expect(isCenter('P-D-UC01')).toBe(true));
    await waitFor(() => expect(camera()).toEqual(roundCamera(frameOnMap(graphMap(testIndex(), 'P'), 'P-D-UC01', 1, 1000, 800))), { timeout: 3000 });
  });

  it('LA-EXP-T131 Under reduced motion focusing frames the new focus at once', async () => {
    reducedMotion();
    await open();
    const first = moves();
    fireEvent.click(node('P-D-UC01-R01')!);
    await waitFor(() => expect(isCenter('P-D-UC01-R01')).toBe(true));
    await waitFor(() => expect(moves()).toBe(first + 1));
    expect(glides()).toBe(0);
    expect(camera()).toEqual(roundCamera(frameOnMap(graphMap(testIndex(), 'P'), 'P-D-UC01-R01', 1, 1000, 800)));
  });
});

describe('graph camera in the Nested layout', () => {
  const map = nestedMap(testIndex(), 'P');
  it('LA-EXP-T188 The camera frames the focus box, whatever the depth, and draws each box in view and big enough with its label', () => {
    for (const focus of ['P', 'P-D', 'P-D/define', 'P-D-UC01', 'P-D-UC01-R01']) {
      const n = map.nodes.get(focus)!;
      const v = frameNested(map, focus, 1000, 800);
      // Centered, within the padding, never past MAX_ZOOM.
      expect(v.x + (n.x + n.w / 2) * v.zoom).toBeCloseTo(500, 6);
      expect(v.y + (n.y + n.h / 2) * v.zoom).toBeCloseTo(400, 6);
      expect(n.w * v.zoom).toBeLessThanOrEqual(1000 - 2 * FRAME_PADDING + 1e-6);
      expect(n.h * v.zoom).toBeLessThanOrEqual(800 - 2 * FRAME_PADDING + 1e-6);
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

  it('LA-EXP-T188 On the page, focusing a child in the Nested layout glides to its box, and Back glides back', async () => {
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({ x: 0, y: 0, top: 0, left: 0, width: 1000, height: 800, right: 1000, bottom: 800, toJSON: () => ({}) } as DOMRect);
    startAtDepth(1, 'nested');
    await openApp('/P-D-UC01?view=graph', { workspace: testWorkspace() });
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

  it('LA-EXP-T193 On the page, the Voronoi layout draws each cell as its outline, the pointer taking the outline and not its box, and focusing a child glides to its cell', async () => {
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({ x: 0, y: 0, top: 0, left: 0, width: 1000, height: 800, right: 1000, bottom: 800, toJSON: () => ({}) } as DOMRect);
    startAtDepth(1, 'voronoi');
    await openApp('/P-D-UC01?view=graph', { workspace: testWorkspace() });
    await waitFor(() => expect(isCenter('P-D-UC01')).toBe(true));
    const map = () => readyVoronoiMap(testIndex(), 'P')!;
    await waitFor(() => expect(camera()).toEqual(roundCamera(frameNested(map(), 'P-D-UC01', 1000, 800))));
    expect(document.querySelector('.graph-flow.is-voronoi')).not.toBeNull();
    // The cell is drawn as its outline, with its label inside it.
    const cell = drawnBox('P-D-UC01')!;
    expect(cell.view).toBe('voronoi');
    expect(cell.polygon!.length).toBeGreaterThanOrEqual(3);
    expect(cell.lines.map((l) => l.text).join(' ')).toContain('Lend a thing');
    // The pointer takes the outline, not its box: a corner of its bounding box outside the outline is not the cell.
    const corners = [[cell.rect.left + 1, cell.rect.top + 1], [cell.rect.left + cell.rect.width - 1, cell.rect.top + 1], [cell.rect.left + 1, cell.rect.top + cell.rect.height - 1], [cell.rect.left + cell.rect.width - 1, cell.rect.top + cell.rect.height - 1]];
    const outside = corners.filter(([x, y]) => !inPolygon(cell.polygon!, { x, y }));
    expect(outside.length).toBeGreaterThan(0);
    for (const [x, y] of outside) expect(graphHost()!.graphHit!(x, y)).not.toBe('P-D-UC01');
    const [cx, cy] = [cell.label.left + cell.label.width / 2, cell.label.top + cell.label.height / 2];
    expect(graphHost()!.graphHit!(cx, cy)).toBe('P-D-UC01');
    fireEvent.click(node('P-D-UC01-R01')!);
    await waitFor(() => expect(isCenter('P-D-UC01-R01')).toBe(true));
    await waitFor(() => expect(camera()).toEqual(roundCamera(frameNested(map(), 'P-D-UC01-R01', 1000, 800))), { timeout: 3000 });
  });
});
