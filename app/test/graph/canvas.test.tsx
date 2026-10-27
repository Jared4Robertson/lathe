import './setup';
import { describe, expect, it } from 'vitest';
import { waitFor } from '@testing-library/react';
import { graphMap } from '../../src/graph/map';
import { nestedMap } from '../../src/graph/nested';
import { readyVoronoiMap } from '../../src/graph/voronoi';
import { plateOf, type Plate, type PlateSource } from '../../src/graph/plate';
import { hitPlate, inPlate, inPolygon, onScreen } from '../../src/graph/hit';
import { TEXT_BAR_PX } from '../../src/graph/paint';
import { canvasMeasure, fontFor } from '../../src/graph/fonts';
import { META_FONT, PLAIN_MEASURE, TITLE_FONT, FILE_FONT } from '../../src/graph/text';
import type { NestedNode } from '../../src/graph/nested';
import type { VoronoiNode } from '../../src/graph/voronoi';
import type { PlacedMap } from '../../src/graph/map';
import { openApp, startAtDepth } from '../helpers';
import { testIndex, testWorkspace } from './workspace';
import { boxElements, scene } from './scene';

// The canvas renderer (LA-EXP-DR59, LA-EXP-DR60, LA-PAT-APP-UX-R12): every box's label placed once
// in map units and drawn at its map size times the zoom, the pointer finding the box under it from
// the map's own outlines, and only what is on screen drawn.

const sourceOf = (map: PlacedMap, id: string): PlateSource => {
  const n = map.nodes.get(id)!;
  return map.view === 'tree' ? { view: 'tree', node: n } : map.view === 'nested' ? { view: 'nested', node: n as NestedNode } : { view: 'voronoi', node: n as VoronoiNode };
};
const platesOf = (map: PlacedMap): Plate[] => [...map.nodes.keys()].map((id) => plateOf(testIndex(), id, sourceOf(map, id)));
const maps = () => [graphMap(testIndex(), 'P'), nestedMap(testIndex(), 'P'), readyVoronoiMap(testIndex(), 'P')!] as PlacedMap[];

describe('text sizing', () => {
  it('LA-EXP-T210 Every label line is placed in map units at its face\'s size times its box\'s text scale, inside its box, in every layout', () => {
    for (const map of maps()) {
      for (const p of platesOf(map)) {
        expect(p.lines.length, p.id).toBeGreaterThan(0);
        for (const line of p.lines) {
          // Its size is its face's at text scale 1 times the box's text scale, fixed by the map.
          const base = line.tone === 'muted' ? META_FONT : p.file ? FILE_FONT : TITLE_FONT;
          expect(line.size, `${p.id} ${line.text}`).toBeCloseTo(base * p.text, 9);
          // The whole line lies inside its box: within its rectangle, and a cell's within its outline.
          const eps = 1e-6 * Math.max(1, p.w);
          expect(line.x, `${map.view} ${p.id}: "${line.text}" left`).toBeGreaterThanOrEqual(p.x - eps);
          expect(line.x + line.width, `${map.view} ${p.id}: "${line.text}" right`).toBeLessThanOrEqual(p.x + p.w + eps);
          expect(line.top, `${map.view} ${p.id}: "${line.text}" top`).toBeGreaterThanOrEqual(p.y - eps);
          expect(line.top + line.height, `${map.view} ${p.id}: "${line.text}" bottom`).toBeLessThanOrEqual(p.y + p.h + eps);
          if (p.outline.kind === 'polygon' && p.view === 'voronoi') {
            for (const [x, y] of [[line.x, line.top], [line.x + line.width, line.top], [line.x, line.top + line.height], [line.x + line.width, line.top + line.height]]) {
              expect(inPolygon(p.outline.points, { x, y }), `${p.id}: "${line.text}" inside its cell`).toBe(true);
            }
          }
        }
        for (const b of p.badges) {
          expect(b.x).toBeGreaterThanOrEqual(p.x);
          expect(b.x + b.w).toBeLessThanOrEqual(p.x + p.w + 1e-6);
          expect(b.y).toBeGreaterThanOrEqual(p.y);
        }
      }
    }
  });

  it('LA-EXP-T210 On the page, each drawn line\'s font is its map size times the zoom, and a line under TEXT_BAR_PX on screen is drawn as a bar', async () => {
    startAtDepth(3);
    await openApp('/P?view=graph', { data: testWorkspace() });
    await waitFor(() => expect(boxElements().length).toBeGreaterThan(3));
    const s = scene();
    for (const box of s.boxes) {
      for (const line of box.lines) {
        const map = line.rect.height / s.camera.zoom / 1.4;
        expect(line.fontPx).toBeCloseTo(map * s.camera.zoom, 6);
        expect(line.bar).toBe(line.fontPx < TEXT_BAR_PX);
        expect(line.font).toContain(`${line.fontPx}px`);
      }
    }
  });

  it('LA-EXP-T210 The text measure is the canvas\'s on the loaded faces, each width read once; without a canvas it is the plain measure', () => {
    const asked: string[] = [];
    const ctx = { font: '', measureText: (t: string) => { asked.push(`${ctx.font}|${t}`); return { width: t.length * 50, fontBoundingBoxAscent: 90, fontBoundingBoxDescent: 20 } as TextMetrics; } };
    const fonts = { body: '"Public Sans", sans-serif', mono: '"JetBrains Mono", monospace' };
    const m = canvasMeasure(ctx as unknown as CanvasRenderingContext2D, fonts);
    expect(m.em('abcd', 'title')).toBe(2);
    expect(m.em('abcd', 'title')).toBe(2);
    expect(asked).toEqual([`${fontFor(fonts, 'title', 100)}|abcd`]);
    expect(m.metrics('meta')).toEqual({ ascent: 0.9, descent: 0.2 });
    expect(m.key).toBe('canvas|"Public Sans", sans-serif|"JetBrains Mono", monospace');
    expect(fontFor(fonts, 'title', 12.5)).toBe('600 12.5px "Public Sans", sans-serif');
    expect(fontFor(fonts, 'badge', 9.5)).toBe('700 9.5px "JetBrains Mono", monospace');
    expect(fontFor(fonts, 'meta', 10.5)).toBe('400 10.5px "JetBrains Mono", monospace');
    // The plain measure: the same text always measures the same.
    expect(PLAIN_MEASURE.em('Lend a thing', 'title')).toBe(PLAIN_MEASURE.em('Lend a thing', 'title'));
    expect(PLAIN_MEASURE.em('LA-EXP', 'meta')).toBeCloseTo(6 * 0.6, 9);
  });
});

describe('hit testing', () => {
  it('LA-EXP-T211 The pointer finds the deepest box under it from the map\'s outlines: a shape\'s polygon, rounded corners, a cell', () => {
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
  it('LA-EXP-T212 Only boxes on screen are drawn: a box is culled once it lies wholly past an edge of the pane', () => {
    const cam = { cx: 500, cy: 400, zoom: 1, w: 1000, h: 800 };
    expect(onScreen({ x: 10, y: 10, w: 50, h: 50 }, cam)).toBe(true);
    expect(onScreen({ x: -60, y: 10, w: 50, h: 50 }, cam)).toBe(false);
    expect(onScreen({ x: 990, y: 790, w: 50, h: 50 }, cam)).toBe(true);
    expect(onScreen({ x: 1001, y: 10, w: 50, h: 50 }, cam)).toBe(false);
    // Zoomed out four times about the same center, the same far box comes into view.
    expect(onScreen({ x: 1600, y: 400, w: 50, h: 50 }, { ...cam, zoom: 0.25 })).toBe(true);
    // Relative to the camera's center, a box deep in a very large map is placed as steadily as one near the origin.
    const deep = { cx: 1e7 + 0.5, cy: 1e7 + 0.5, zoom: 1e4, w: 1000, h: 800 };
    expect(onScreen({ x: 1e7 + 0.49, y: 1e7 + 0.49, w: 0.02, h: 0.02 }, deep)).toBe(true);
    expect(onScreen({ x: 1e7 + 0.6, y: 1e7 + 0.49, w: 0.02, h: 0.02 }, deep)).toBe(false);
  });
});
