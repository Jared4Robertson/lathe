import { describe, expect, it } from 'vitest';
import { followBox, morphFrom, plateAt } from '../../src/graph/morph';
import type { Plate } from '../../src/graph/plate';
import { layoutTree } from './maps';

// What moves morphs (LA-PAT-APP-UX-R22, graph/morph.ts): a new layout's moved boxes glide from where they were drawn to
// their new places, nothing else moves, and the camera stays put unless the focus itself moved, when it glides with it.

const kids: Record<string, string[]> = { p: ['a', 'b'], a: ['a1', 'a2'], b: ['b1'] };
const before = layoutTree(['p'], (id) => kids[id] ?? []);
const after = layoutTree(['p'], (id) => (id === 'a' ? ['a1', 'a2', 'a3'] : kids[id] ?? []));
const linear = (t: number) => t;

describe('LA-V93-R16-T04 a new layout morphs from the one drawn before', () => {
  it('only the boxes the new layout moved glide, from their old places, over the motion\'s duration', () => {
    const start = morphFrom(null, before, 0, 300, linear);
    const m = morphFrom(start, after, 1000, 300, linear);
    // a's children shrink to make room for a3; nothing outside a moves, and a3, new, has no old place.
    expect([...m.from.keys()].sort()).toEqual(['a1', 'a2']);
    expect(m.from.get('a1')).toMatchObject({ y: before.nodes.get('a1')!.y, h: before.nodes.get('a1')!.h });
  });

  it('under reduced motion (no duration), or for another layout or product, nothing glides', () => {
    const start = morphFrom(null, before, 0, 300, linear);
    expect(morphFrom(start, after, 1000, 0, linear).from.size).toBe(0);
    const other = layoutTree(['q'], (id) => (id === 'q' ? ['a'] : []));
    expect(morphFrom(start, other, 1000, 300, linear).from.size).toBe(0);
  });

  it('a layout arriving mid-glide starts from where each box is drawn then', () => {
    const start = morphFrom(null, before, 0, 300, linear);
    const mid = morphFrom(start, after, 1000, 300, linear);
    const back = morphFrom(mid, before, 1150, 300, linear);
    const was = before.nodes.get('a1')!;
    const to = after.nodes.get('a1')!;
    expect(back.from.get('a1')!.h).toBeCloseTo((was.h + to.h) / 2, 6);
  });

  it('a plate drawn at another box keeps its label inside it, scaled by the smaller stretch', () => {
    const p = {
      id: 'x', place: 'x', x: 0, y: 0, w: 100, h: 50, scale: 1, text: 1, border: 2,
      outline: { kind: 'polygon', points: [[0, 0], [100, 0], [100, 50], [0, 50]] },
      label: { x: 10, y: 10, w: 80, h: 30 },
      lines: [{ text: 'Title', face: 'title', size: 12, x: 30, baseline: 30, top: 18, height: 14, width: 40, tone: 'ink' }],
      icons: [], badges: [],
    } as unknown as Plate;
    const q = plateAt(p, { x: 200, y: 100, w: 50, h: 50 });
    expect(q).toMatchObject({ x: 200, y: 100, w: 50, h: 50, text: 0.5, border: 1 });
    expect(q.outline).toEqual({ kind: 'polygon', points: [[200, 100], [250, 100], [250, 150], [200, 150]] });
    // The line's middle stays at its stretched place (x 50 maps to 225), its width and size halved.
    const line = q.lines[0];
    expect(line.size).toBe(6);
    expect(line.x + line.width / 2).toBeCloseTo(225, 9);
    expect(plateAt(p, { x: 0, y: 0, w: 100, h: 50 })).toBe(p);
  });
});

describe('LA-V93-R16-T04 the camera on new data', () => {
  const v = { x: 40, y: -20, zoom: 0.5 };
  const zoom = { min: 0.01, max: 4 };
  it('stays put when the focus did not move', () => {
    expect(followBox(v, { x: 10, y: 10, w: 100, h: 50 }, { x: 10, y: 10, w: 100, h: 50 }, zoom)).toBeNull();
  });
  it('glides with the focus when it moved, keeping it where it was on screen', () => {
    const was = { x: 10, y: 10, w: 100, h: 50 };
    const now = { x: 300, y: 500, w: 50, h: 25 };
    const f = followBox(v, was, now, zoom)!;
    const middle = (b: typeof was, c: typeof v) => [(b.x + b.w / 2) * c.zoom + c.x, (b.y + b.h / 2) * c.zoom + c.y];
    expect(middle(now, f)[0]).toBeCloseTo(middle(was, v)[0], 9);
    expect(middle(now, f)[1]).toBeCloseTo(middle(was, v)[1], 9);
    expect(now.w * f.zoom).toBeCloseTo(was.w * v.zoom, 9);
  });
});
