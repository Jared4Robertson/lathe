// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { PLAIN_LOOK } from '../../src/graph/look';
import { paint, type PaintState } from '../../src/graph/paint';
import { plateOf } from '../../src/graph/plate';
import { keepLabel, STICKY_READ_PX, stickyLabel, stickyRoom, type ScreenBox } from '../../src/graph/sticky';
import { BORDER, LABEL_PAD, linesIn, TITLE_FONT, textMeasure, treeLabel } from '../../src/graph/text';
import { besideToggle, ITEM_HEIGHT, ITEM_WIDTH, toggleAt, TOGGLE_ROOM } from '../../src/trace/layout';
import type { MapNode } from '../../src/graph/map';
import { testIndex } from './workspace';
import { graphMap } from './maps';

// A box only partly in the open space draws its label in its visible part, or, when it cannot fit there, where the map
// placed it, cut by the edge: no box is drawn empty (graph/sticky.ts, LA-EXP-DS06).

describe('LA-EXP-DS06-T14 a label the open space cuts is laid out in the box\'s visible part, else drawn as placed and cut by the edge', () => {
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

  it('keeps its title when the visible part cannot hold its eyebrow too, and draws it as placed, cut by the edge, only when the title cannot fit', () => {
    // A panel over the box's right part and one over its lower part: the visible part shrinks from below.
    const shown = (bottom: number) => stickyLabel(plate, zoom, X, Y, { left: -10, top: -10, right: 600, bottom });
    const labelTop = Y(plate.label.y);
    let titleOnly = false;
    for (let bottom = Y(plate.label.y + plate.label.h); bottom > labelTop; bottom -= 1) {
      const s = shown(bottom);
      if (s.kind !== 'moved') continue;
      if (s.lines.every((l) => l.face === 'title')) { titleOnly = true; expect(s.lines.length).toBeGreaterThan(0); }
      else expect(s.lines.some((l) => l.face === 'title')).toBe(true);
    }
    expect(titleOnly).toBe(true);
    expect(shown(labelTop + 2).kind).toBe('cut');
  });

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
    // Centered in the visible part of its room: the label's content box and its side padding but twice a border (its
    // shape keeps some of the box's right end).
    const roomRight = X(plate.label.x + plate.label.w + (LABEL_PAD - 2 * BORDER) * plate.text);
    const lefts = s.lines.map((l) => l.x);
    const rights = s.lines.map((l) => l.x + m.em(l.text.trimEnd(), l.face) * l.px);
    expect((Math.min(...lefts) + Math.max(...rights)) / 2).toBeCloseTo((seen.left + roomRight) / 2, 0);
  });

  it('still draws the title of a box mostly off screen, where the map placed it, the edge cutting it', () => {
    // Only the box's right 20 px show: no room there for its title at the readable floor.
    const open: ScreenBox = { left: 880, top: -10, right: 2000, bottom: 2000 };
    expect(stickyLabel(plate, zoom, X, Y, open).kind).toBe('cut');
    const drawn: string[] = [];
    const ctx = new Proxy({ globalAlpha: 1, fillStyle: '', canvas: { width: 2000, height: 2000 } } as Record<string, unknown>, {
      get: (t, k) => (k in t ? t[k as string] : k === 'measureText' ? () => ({ width: 10 }) : k === 'fillText' ? (text: string) => drawn.push(text) : () => undefined),
      set: (t, k, v) => { t[k as string] = v; return true; },
    }) as unknown as CanvasRenderingContext2D;
    const state: PaintState = { focus: '', hover: null, ring: null, armed: null, lit: null, litLines: null, spot: 0, strength: () => 1, marks: null, open };
    // The camera of X and Y: the box from x = 0 to 900 on a 2000 px canvas.
    const cam = { cx: node.x + 1000 / zoom, cy: node.y + 1000 / zoom, zoom, w: 2000, h: 2000 };
    paint(ctx, 1, cam, { plates: [plate], bars: [], lines: [] }, PLAIN_LOOK, { body: 'sans-serif', mono: 'monospace' }, state);
    const title = plate.lines.filter((l) => l.face === 'title').map((l) => l.text);
    expect(title.length).toBeGreaterThan(0);
    expect(drawn).toEqual(expect.arrayContaining(title));
  });
});

describe('LA-EXP-DS06-T14 a label pulled into view stays in its room: before a Trace box\'s toggle, a word too long cut, no copy left', () => {
  const index = testIndex();
  // A Trace box as the Trace makes it (TraceCanvas.tsx plateFor): 264 by 72 at text scale 1, its label wrapped beside its
  // toggle; 220 px wide on screen, its left part under a panel.
  const own = { ...treeLabel(index, 'P-D-UC01'), title: 'Read the reference generated from the schema' };
  const node: MapNode = { id: 'P-D-UC01', parent: null, children: [], level: 2, x: 0, y: 0, w: ITEM_WIDTH, h: ITEM_HEIGHT, text: 1, centered: false, lines: linesIn(own, ITEM_WIDTH - TOGGLE_ROOM - 2 * BORDER, false) };
  const plate = besideToggle({ ...plateOf(index, 'P-D-UC01', { view: 'tree', node }), title: own.title });
  const zoom = 220 / node.w;
  const X = (x: number) => (x - node.x) * zoom;
  const Y = (y: number) => (y - node.y) * zoom;
  const m = textMeasure();
  const rightOf = (l: { text: string; face: 'title' | 'eyebrow' | 'mono' | 'badge'; px: number; x: number }) => l.x + m.em(l.text.trimEnd(), l.face) * l.px;

  it('wraps a label pulled into a cut box\'s visible part before its toggle, never under it, at every cut', () => {
    const toggle = X(toggleAt(plate).x);
    let moved = 0;
    for (let left = 10; left < 200; left += 5) {
      const s = stickyLabel(plate, zoom, X, Y, { left, top: -10, right: 2000, bottom: 2000 });
      if (s.kind !== 'moved') continue;
      moved++;
      for (const l of s.lines) {
        expect(l.x, `${left} ${l.text}`).toBeGreaterThanOrEqual(left - 1e-6);
        expect(rightOf(l), `${left} ${l.text}`).toBeLessThanOrEqual(toggle + 1e-6);
      }
    }
    expect(moved).toBeGreaterThan(0);
  });

  it('draws a title too long for the visible part at the floor, its words cut with an ellipsis, rather than as placed', () => {
    // A long word in a narrow room: laid out anew it cannot fit on whole words.
    const long = { ...plate, title: 'Supercalifragilistic expialidocious reference generated', lines: plate.lines.map((l) => (l.level === 'title' ? { ...l, text: 'Supercalifragilistic expialidocious reference generated' } : l)) };
    const open: ScreenBox = { left: X(plate.label.x + plate.label.w) - 60, top: -10, right: 2000, bottom: 2000 };
    const s = stickyLabel(long, zoom, X, Y, open);
    expect(s.kind).toBe('moved');
    if (s.kind !== 'moved') return;
    expect(s.clipped).toBe(true);
    expect(s.lines.at(-1)!.text.endsWith('…')).toBe(true);
    const room = stickyRoom(long, X, Y, open);
    for (const l of s.lines) {
      expect(l.px).toBe(STICKY_READ_PX);
      expect(l.x).toBeGreaterThanOrEqual(room.left - 1e-6);
      expect(rightOf(l)).toBeLessThanOrEqual(room.right + 1e-6);
    }
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

describe('LA-EXP-DS06-T15 a focused box is never left without its label: the camera moves to where its visible part holds it', () => {
  const index = testIndex();
  const map = graphMap(index, 'P');
  const node = map.nodes.get('P-D')!;
  const plate = plateOf(index, 'P-D', { view: 'tree', node });
  // The domain's box 900 px wide from x = 0; a panel covers all but its right 20 px.
  const zoom = 900 / node.w;
  const v = { x: -node.x * zoom, y: -node.y * zoom, zoom };
  const open: ScreenBox = { left: 880, top: -10, right: 2000, bottom: 2000 };
  const at = (cam: typeof v) => stickyLabel(plate, cam.zoom, (x) => cam.x + x * cam.zoom, (y) => cam.y + y * cam.zoom, open);

  it('leaves a camera that draws the label as it is', () => {
    const wide: ScreenBox = { left: 300, top: -10, right: 2000, bottom: 2000 };
    expect(keepLabel(plate, v, wide)).toEqual(v);
  });

  it('moves a camera whose cut leaves the label no room right, as little as it takes, at the same zoom', () => {
    // Drawn whole: placed, or laid out anew with no word cut.
    const whole = (s: ReturnType<typeof at>) => s.kind === 'placed' || (s.kind === 'moved' && !s.clipped);
    expect(whole(at(v))).toBe(false);
    const kept = keepLabel(plate, v, open);
    expect(kept.zoom).toBe(zoom);
    expect(kept.y).toBe(v.y);
    expect(kept.x).toBeGreaterThan(v.x);
    expect(whole(at(kept))).toBe(true);
    // A pixel less and it would only be drawn cut, by the edge or with an ellipsis.
    expect(whole(at({ ...kept, x: kept.x - 1.5 }))).toBe(false);
  });
});
