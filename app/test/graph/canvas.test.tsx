import './setup';
import { describe, expect, it } from 'vitest';
import { waitFor } from '@testing-library/react';
import { plateOf, type Plate, type PlateSource } from '../../src/graph/plate';
import { hitPlate, inPlate, inPolygon } from '../../src/graph/hit';
import { BLOCK_BELOW_PX } from '../../src/graph/camera';
import { BADGE_LEAST_ALPHA, onCanvas, paint, type PaintState } from '../../src/graph/paint';
import { PLAIN_LOOK } from '../../src/graph/look';
import { canvasMeasure, fontFor } from '../../src/graph/fonts';
import { EYEBROW_FONT, PLAIN_MEASURE, STATUS_FONT, TITLE_FONT } from '../../src/graph/text';
import type { NestedNode } from '../../src/graph/nested';
import type { PlacedMap } from '../../src/graph/map';
import { openApp, startAtDepth } from '../helpers';
import { testIndex, testWorkspace } from './workspace';
import { boxElements, scene } from './scene';
import { graphMap, nestedMap } from './maps';

// The canvas renderer (LA-EXP-DS09, LA-EXP-DS10, LA-PAT-APP-UX-R12): every box's label placed once
// in map units and drawn at its map size times the zoom, the pointer finding the box under it from
// the map's own outlines, and only what is on screen drawn.

const sourceOf = (map: PlacedMap, id: string): PlateSource => {
  const n = map.nodes.get(id)!;
  return map.view === 'tree' ? { view: 'tree', node: n } : { view: 'nested', node: n as NestedNode };
};
const platesOf = (map: PlacedMap): Plate[] => [...map.nodes.keys()].map((id) => plateOf(testIndex(), id, sourceOf(map, id)));
const maps = () => [graphMap(testIndex(), 'P'), nestedMap(testIndex(), 'P')] as PlacedMap[];

describe('text sizing', () => {
  it('LA-EXP-DS06-T13 LA-EXP-DS10-T07 LA-PAT-APP-UX-R12-T02 Every label line is placed in map units at its face\'s size times its box\'s text scale, inside its box, in every layout', () => {
    for (const map of maps()) {
      for (const p of platesOf(map)) {
        expect(p.lines.length, p.id).toBeGreaterThan(0);
        for (const line of p.lines) {
          // Its size is its face's at text scale 1 times the box's text scale, fixed by the map.
          const base = line.level === 'eyebrow' ? EYEBROW_FONT : line.level === 'status' ? STATUS_FONT : TITLE_FONT;
          expect(line.size, `${p.id} ${line.text}`).toBeCloseTo(base * p.text, 9);
          // The whole line lies inside its box: within its rectangle.
          const eps = 1e-6 * Math.max(1, p.w);
          expect(line.x, `${map.view} ${p.id}: "${line.text}" left`).toBeGreaterThanOrEqual(p.x - eps);
          expect(line.x + line.width, `${map.view} ${p.id}: "${line.text}" right`).toBeLessThanOrEqual(p.x + p.w + eps);
          expect(line.top, `${map.view} ${p.id}: "${line.text}" top`).toBeGreaterThanOrEqual(p.y - eps);
          expect(line.top + line.height, `${map.view} ${p.id}: "${line.text}" bottom`).toBeLessThanOrEqual(p.y + p.h + eps);
        }
        for (const b of p.badges) {
          expect(b.x).toBeGreaterThanOrEqual(p.x);
          expect(b.x + b.w).toBeLessThanOrEqual(p.x + p.w + 1e-6);
          expect(b.y).toBeGreaterThanOrEqual(p.y);
        }
      }
    }
  });

  it('LA-EXP-DS06-T13 On the page, each drawn line\'s font is its map size times the zoom, and a box whose title is under BLOCK_BELOW_PX on screen is a plain block', async () => {
    startAtDepth(3);
    await openApp('/P?stage=graph', { data: testWorkspace() });
    await waitFor(() => expect(boxElements().length).toBeGreaterThan(3));
    const s = scene();
    for (const box of s.boxes) {
      expect(box.block).toBe(box.textScale * TITLE_FONT * s.camera.zoom < BLOCK_BELOW_PX);
      for (const line of box.lines) {
        const map = line.rect.height / s.camera.zoom / 1.4;
        expect(line.fontPx).toBeCloseTo(map * s.camera.zoom, 6);
        expect(line.font).toContain(`${line.fontPx}px`);
      }
    }
  });

  it('LA-EXP-DS06-T13 The text measure is the canvas\'s on the loaded faces, each width read once; without a canvas it is the plain measure', () => {
    const asked: string[] = [];
    const ctx = { font: '', measureText: (t: string) => { asked.push(`${ctx.font}|${t}`); return { width: t.length * 50, fontBoundingBoxAscent: 90, fontBoundingBoxDescent: 20 } as TextMetrics; } };
    const fonts = { body: '"Public Sans", sans-serif', mono: '"JetBrains Mono", monospace' };
    const m = canvasMeasure(ctx as unknown as CanvasRenderingContext2D, fonts);
    expect(m.em('abcd', 'title')).toBe(2);
    expect(m.em('abcd', 'title')).toBe(2);
    expect(asked).toEqual([`${fontFor(fonts, 'title', 100)}|abcd`]);
    expect(m.metrics('mono')).toEqual({ ascent: 0.9, descent: 0.2 });
    expect(m.key).toBe('canvas|"Public Sans", sans-serif|"JetBrains Mono", monospace');
    expect(fontFor(fonts, 'title', 12.5)).toBe('600 12.5px "Public Sans", sans-serif');
    expect(fontFor(fonts, 'badge', 9.5)).toBe('700 9.5px "JetBrains Mono", monospace');
    expect(fontFor(fonts, 'eyebrow', 9)).toBe('400 9px "Public Sans", sans-serif');
    expect(fontFor(fonts, 'mono', 9)).toBe('400 9px "JetBrains Mono", monospace');
    // The plain measure: the same text always measures the same.
    expect(PLAIN_MEASURE.em('Lend a thing', 'title')).toBe(PLAIN_MEASURE.em('Lend a thing', 'title'));
    expect(PLAIN_MEASURE.em('LA-EXP', 'mono')).toBeCloseTo(6 * 0.6, 9);
  });
});

describe('badges', () => {
  it('LA-EXP-DS10-T08 A faded box draws no problem badge, whose label could not be read; a box at full strength draws it with its label', () => {
    const map = graphMap(testIndex(), 'P');
    const plate = platesOf(map).find((p) => p.badges.length > 0 && !p.group)!;
    expect(plate).toBeDefined();
    /** What a frame draws of the plate at a strength: each pill's rounded rectangle and each text, by their colors. */
    const drawn = (strength: number) => {
      const out: string[] = [];
      const ctx = new Proxy({ globalAlpha: 1, fillStyle: '', canvas: { width: 2000, height: 2000 } } as Record<string, unknown>, {
        get: (t, k) => (k in t ? t[k as string] : k === 'measureText' ? () => ({ width: 10 }) : k === 'fillText' ? (text: string) => out.push(`${String(t.fillStyle)}:${text}:${Number(t.globalAlpha).toFixed(2)}`) : () => undefined),
        set: (t, k, v) => { t[k as string] = v; return true; },
      }) as unknown as CanvasRenderingContext2D;
      const state: PaintState = { focus: '', hover: null, ring: null, lit: null, litLines: null, spot: 0, strength: () => strength, marks: null, open: { left: 0, top: 0, right: 2000, bottom: 2000 } };
      const cam = { cx: plate.x + plate.w / 2, cy: plate.y + plate.h / 2, zoom: 1, w: 2000, h: 2000 };
      paint(ctx, 1, cam, { plates: [plate], bars: [], lines: [] }, PLAIN_LOOK, { body: 'sans-serif', mono: 'monospace' }, state);
      return out.filter((t) => plate.badges.some((b) => t.includes(`:${b.label}:`)));
    };
    expect(drawn(1)).toHaveLength(plate.badges.length);
    expect(drawn(BADGE_LEAST_ALPHA - 0.3)).toEqual([]);
  });
});

describe('hit testing', () => {
  it('LA-V93-R07-T01 The pointer finds the deepest box under it from the map\'s outlines: a shape\'s polygon, rounded corners', () => {
    // A polygon, by the even-odd rule.
    const tri: [number, number][] = [[0, 0], [10, 0], [0, 10]];
    expect(inPolygon(tri, { x: 2, y: 2 })).toBe(true);
    expect(inPolygon(tri, { x: 8, y: 8 })).toBe(false);
    // A rounded box: inside its rectangle but outside a corner's curve is outside it.
    const round = { x: 0, y: 0, w: 100, h: 40, outline: { kind: 'round' as const, rx: 20, ry: 20 } };
    expect(inPlate(round, { x: 50, y: 20 })).toBe(true);
    expect(inPlate(round, { x: 1, y: 1 })).toBe(false);
    expect(inPlate(round, { x: 101, y: 20 })).toBe(false);
    for (const map of maps()) {
      const plates = platesOf(map);
      const order = map.view === 'tree' ? plates : [...plates].sort((a, b) => (map.nodes.get(a.id) as NestedNode).order - (map.nodes.get(b.id) as NestedNode).order);
      for (const p of order) {
        // The middle of its label is the box itself, not its parent drawn under it; a child is found over its parent.
        const at = { x: p.label.x + p.label.w / 2, y: p.label.y + p.label.h / 2 };
        expect(hitPlate(order, at)?.id, `${map.view} ${p.id}`).toBe(p.id);
      }
      // Far outside the map, nothing.
      expect(hitPlate(order, { x: -1e9, y: -1e9 })).toBeNull();
    }
    // A hexagon's corner cut is outside the domain, so the pointer there finds nothing (or what lies behind it).
    const domain = platesOf(graphMap(testIndex(), 'P')).find((p) => p.id === 'P-D')!;
    expect(domain.outline.kind).toBe('polygon');
    expect(inPlate(domain, { x: domain.x + 0.5, y: domain.y + 0.5 })).toBe(false);
  });
});

describe('culling', () => {
  it('LA-EXP-DS10-T08 LA-V93-R07-T02 Only boxes, bars and lines on screen are drawn: one is culled once it lies wholly past an edge of the pane and its margin', () => {
    const cam = { cx: 500, cy: 400, zoom: 1, w: 1000, h: 800 };
    expect(onCanvas({ x: 10, y: 10, w: 50, h: 50 }, cam)).toBe(true);
    // A box just past the left edge is still drawn (its edge and ring reach in); one past the margin is not.
    expect(onCanvas({ x: -60, y: 10, w: 50, h: 50 }, cam)).toBe(true);
    expect(onCanvas({ x: -80, y: 10, w: 50, h: 50 }, cam)).toBe(false);
    expect(onCanvas({ x: 990, y: 790, w: 50, h: 50 }, cam)).toBe(true);
    expect(onCanvas({ x: 1030, y: 10, w: 50, h: 50 }, cam)).toBe(false);
    // A line is its bounds: a level line across the pane is drawn, one wholly below it is not.
    expect(onCanvas({ x: -500, y: 400, w: 2000, h: 0 }, cam)).toBe(true);
    expect(onCanvas({ x: -500, y: 900, w: 2000, h: 0 }, cam)).toBe(false);
    // Zoomed out four times about the same center, the same far box comes into view.
    expect(onCanvas({ x: 1600, y: 400, w: 50, h: 50 }, { ...cam, zoom: 0.25 })).toBe(true);
    // Relative to the camera's center, a box deep in a very large map is placed as steadily as one near the origin.
    const deep = { cx: 1e7 + 0.5, cy: 1e7 + 0.5, zoom: 1e4, w: 1000, h: 800 };
    expect(onCanvas({ x: 1e7 + 0.49, y: 1e7 + 0.49, w: 0.02, h: 0.02 }, deep)).toBe(true);
    expect(onCanvas({ x: 1e7 + 0.6, y: 1e7 + 0.49, w: 0.02, h: 0.02 }, deep)).toBe(false);
  });
});
