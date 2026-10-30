// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { graphMap } from '../../src/graph/map';
import { plateOf } from '../../src/graph/plate';
import { STICKY_READ_PX, stickyLabel, stickyRoom, type ScreenBox } from '../../src/graph/sticky';
import { TITLE_FONT, textMeasure } from '../../src/graph/text';
import { testIndex } from './workspace';

// A box only partly in the open space draws its label in its visible part, or not at all (graph/sticky.ts, LA-EXP-DS06).

describe('LA-EXP-DS06-T14 a label the open space cuts is laid out in the box\'s visible part, never drawn half cut', () => {
  const index = testIndex();
  const map = graphMap(index, 'P');
  const node = map.nodes.get('P-D')!;
  const plate = plateOf(index, 'P-D', { view: 'tree', node });
  // A camera that draws the domain's box 900 px wide from x = 0, its title well over the floor.
  const zoom = 900 / node.w;
  const X = (x: number) => (x - node.x) * zoom;
  const Y = (y: number) => (y - node.y) * zoom;
  const box = { left: 0, top: 0, right: 900, bottom: node.h * zoom };
  const own = plate.text * zoom * TITLE_FONT;

  it('draws a label wholly in the open space as the map placed it', () => {
    expect(stickyLabel(plate, zoom, X, Y, { left: -10, top: -10, right: 2000, bottom: 2000 }).kind).toBe('placed');
  });

  it('lays a cut label out anew inside the visible part, centered, no larger than its own scale and at least the floor', () => {
    expect(own).toBeGreaterThan(STICKY_READ_PX);
    // A panel covers the box's left half and more: only its right 300 px show.
    const open: ScreenBox = { left: 600, top: -10, right: 2000, bottom: 2000 };
    const s = stickyLabel(plate, zoom, X, Y, open);
    expect(s.kind).toBe('moved');
    if (s.kind !== 'moved') return;
    const m = textMeasure();
    const seen = { left: Math.max(box.left, open.left), right: Math.min(box.right, open.right) };
    for (const l of s.lines) {
      const width = m.em(l.text.trimEnd(), l.face) * l.px;
      expect(l.x, l.text).toBeGreaterThanOrEqual(seen.left - 1e-6);
      expect(l.x + width, l.text).toBeLessThanOrEqual(seen.right + 1e-6);
    }
    const title = s.lines.filter((l) => l.face === 'title');
    expect(title.map((l) => l.text).join('')).toBe(plate.title);
    expect(title[0].px).toBeLessThanOrEqual(own + 1e-9);
    expect(title[0].px).toBeGreaterThanOrEqual(STICKY_READ_PX);
    // Centered in the visible part of the label's content box (its shape keeps some of the box's right end).
    const roomRight = X(plate.label.x + plate.label.w);
    const lefts = s.lines.map((l) => l.x);
    const rights = s.lines.map((l) => l.x + m.em(l.text.trimEnd(), l.face) * l.px);
    expect((Math.min(...lefts) + Math.max(...rights)) / 2).toBeCloseTo((seen.left + roomRight) / 2, 0);
  });

  it('draws no label when the visible part cannot hold it at the readable floor', () => {
    expect(stickyLabel(plate, zoom, X, Y, { left: 880, top: -10, right: 2000, bottom: 2000 }).kind).toBe('hidden');
  });
});

describe('LA-EXP-DS06-T14 a moved label lies on its box\'s one fill, never across an edge or a decoration', () => {
  const index = testIndex();
  const map = graphMap(index, 'P');
  it('lays every cut label out inside its content box, clear of the edge, the focus\'s wider edge and the shape\'s decoration', () => {
    const m = textMeasure();
    let moved = 0;
    for (const node of map.nodes.values()) {
      const plate = plateOf(index, node.id, { view: 'tree', node });
      const zoom = 900 / node.w;
      const X = (x: number) => (x - node.x) * zoom;
      const Y = (y: number) => (y - node.y) * zoom;
      // A panel covers the box's left third; the label is laid out in what shows.
      const open: ScreenBox = { left: 300, top: -10, right: 2000, bottom: 2000 };
      const s = stickyLabel(plate, zoom, X, Y, open);
      if (s.kind !== 'moved') continue;
      moved++;
      const room = stickyRoom(plate, X, Y, open);
      // The padding round the content box holds every edge and decoration the box draws: a stack's front sheet, a page's fold.
      expect(room.left).toBeGreaterThanOrEqual(X(plate.x + plate.border) - 1e-6);
      expect(room.right).toBeLessThanOrEqual(X(plate.x + plate.w - plate.border) + 1e-6);
      for (const l of s.lines) {
        const { ascent, descent } = m.metrics(l.face);
        const width = m.em(l.text.trimEnd(), l.face) * l.px;
        expect(l.x, `${node.id} ${l.text}`).toBeGreaterThanOrEqual(room.left - 1e-6);
        expect(l.x + width, `${node.id} ${l.text}`).toBeLessThanOrEqual(room.right + 1e-6);
        expect(l.baseline - ascent * l.px, `${node.id} ${l.text}`).toBeGreaterThanOrEqual(room.top - 1e-6);
        expect(l.baseline + descent * l.px, `${node.id} ${l.text}`).toBeLessThanOrEqual(room.bottom + 1e-6);
      }
    }
    expect(moved).toBeGreaterThan(0);
  });
});
