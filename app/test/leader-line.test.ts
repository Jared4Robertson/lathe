import { describe, expect, it } from 'vitest';
import { crosses, leaderLine, STUB_EDGE, STUB_PX, type Box, type LeaderLine, type Point } from '../src/views/leaderLine';

// LA-V96-R24-T01: the leader line's ends for a camera, a focused box and the card (views/leaderLine.ts).

/** A stage 1200 by 800 px whose open space runs from 300 px (the nav) to 760 px (the card's gap), below a 60 px tool row. */
const OPEN: Box = { left: 300, top: 60, right: 760, bottom: 790 };
/** The card's inner edge at 772 px, its title's row 120 px down. */
const CARD = { x: 772, y: 120 };
/** A map box of 100 by 40 at (200, 300), under a camera: screen = map * zoom + offset. */
const under = (cam: { x: number; y: number; zoom: number }): Box => ({
  left: 200 * cam.zoom + cam.x, top: 300 * cam.zoom + cam.y, right: 300 * cam.zoom + cam.x, bottom: 340 * cam.zoom + cam.y,
});

describe('LA-V96-R24-T01 the leader line runs from the focused box\'s nearest edge to the card, level with its title, or stubs toward a box out of view', () => {
  it('joins the box\'s nearest edge to the card\'s inner edge at its title, and slants when they are not level', () => {
    const box = under({ x: 200, y: 0, zoom: 1 }); // 400..500 x 300..340
    const line = leaderLine(box, CARD, OPEN)!;
    expect(line.stub).toBe(false);
    expect(line.to).toEqual(CARD);
    // The nearest point of the box to the card's end: its right edge, at its top corner, since the title sits above it.
    expect(line.from).toEqual({ x: 500, y: 300 });
  });

  it('starts level with the title when the box spans its row', () => {
    const line = leaderLine({ left: 400, top: 100, right: 520, bottom: 160 }, CARD, OPEN)!;
    expect(line.from).toEqual({ x: 520, y: 120 });
    expect(line.to.y).toBe(line.from.y);
  });

  it('follows the camera: a pan and a zoom move its start with the box, never its end', () => {
    const a = leaderLine(under({ x: 200, y: 0, zoom: 1 }), CARD, OPEN)!;
    const b = leaderLine(under({ x: 150, y: -100, zoom: 2 }), CARD, OPEN)!; // 550..750 x 500..580
    expect(b.to).toEqual(a.to);
    expect(b.from).toEqual({ x: 750, y: 500 });
  });

  it('starts on the part of a box the open space shows, when the box runs under a panel', () => {
    const line = leaderLine({ left: 500, top: 100, right: 1100, bottom: 200 }, CARD, OPEN)!;
    expect(line.stub).toBe(false);
    expect(line.from).toEqual({ x: 760, y: 120 });
  });

  it('stubs just inside the open space\'s edge, pointing toward a box off-screen or behind a panel', () => {
    // Above the stage: a stub on the open space's top edge, pointing up.
    const above = leaderLine(under({ x: 200, y: -1000, zoom: 1 }), CARD, OPEN)!; // 400..500 x -700..-660
    expect(above.stub).toBe(true);
    expect(above.to).toEqual({ x: 450, y: OPEN.top + STUB_EDGE });
    expect(above.from).toEqual({ x: 450, y: OPEN.top + STUB_EDGE + STUB_PX });
    // Behind the nav, on the left: on the left edge, pointing left.
    const left = leaderLine(under({ x: -100, y: 0, zoom: 1 }), CARD, OPEN)!; // 100..200 x 300..340
    expect(left.stub).toBe(true);
    expect(left.to).toEqual({ x: OPEN.left + STUB_EDGE, y: 320 });
    expect(left.from).toEqual({ x: OPEN.left + STUB_EDGE + STUB_PX, y: 320 });
    // Down and to the right, past a corner: at the corner, along the way to the box.
    const corner = leaderLine({ left: 900, top: 900, right: 940, bottom: 940 }, CARD, OPEN)!;
    expect(corner.to).toEqual({ x: OPEN.right - STUB_EDGE, y: OPEN.bottom - STUB_EDGE });
    expect(corner.from.x).toBeLessThan(corner.to.x);
    expect(corner.from.y).toBeLessThan(corner.to.y);
    expect(Math.hypot(corner.to.x - corner.from.x, corner.to.y - corner.from.y)).toBeCloseTo(STUB_PX);
    // Clear of the stage's own tools: inside the frame, below a 50 px tool row.
    const framed = leaderLine(under({ x: 200, y: -1000, zoom: 1 }), CARD, OPEN, { ...OPEN, top: OPEN.top + 50 })!;
    expect(framed.to).toEqual({ x: 450, y: OPEN.top + 50 + STUB_EDGE });
  });

  it('draws nothing with no focused box, with no floating card, or with no open space', () => {
    expect(leaderLine(null, CARD, OPEN)).toBeNull();
    expect(leaderLine(under({ x: 0, y: 0, zoom: 1 }), null, OPEN)).toBeNull();
    expect(leaderLine(under({ x: 0, y: 0, zoom: 1 }), CARD, { left: 300, top: 60, right: 300, bottom: 790 })).toBeNull();
  });
});

describe('LA-V96-R24-T04 the leader line never crosses a drawn box: it runs along a gap between rows into the focus, or onto its edge', () => {
  /** The line's points, from its start to the card. */
  const pointsOf = (l: LeaderLine): Point[] => [l.from, ...l.via, l.to];
  const crossesAny = (l: LeaderLine, avoid: readonly Box[]) => pointsOf(l).some((p, i, all) => i > 0 && avoid.some((r) => crosses(all[i - 1], p, r)));
  // A focus at the left edge (300..420 x 100..400), its children's column to its right, four rows 50 tall a 20 px gap apart.
  const focus: Box = { left: 200, top: 100, right: 420, bottom: 400 };
  const rows: Box[] = [0, 1, 2, 3].map((i) => ({ left: 460, top: 100 + 70 * i, right: 700, bottom: 150 + 70 * i }));

  it('stays straight when nothing is in its way', () => {
    const line = leaderLine(focus, CARD, OPEN, OPEN, [{ left: 460, top: 300, right: 700, bottom: 350 }])!;
    expect(line.via).toEqual([]);
    expect(line.from).toEqual({ x: 420, y: 120 });
  });

  it('runs level along the gap between the rows nearest the title, then turns to the card, crossing no box', () => {
    const line = leaderLine(focus, CARD, OPEN, OPEN, rows)!;
    expect(line.stub).toBe(false);
    expect(line.to).toEqual(CARD);
    expect(crossesAny(line, rows)).toBe(false);
    // It leaves the focus's right edge in the first gap (150..170) and runs level past the column.
    expect(line.from).toEqual({ x: 420, y: 160 });
    expect(line.via[0].y).toBe(160);
    expect(line.via[0].x).toBeGreaterThan(700);
  });

  it('ends on the focus\'s nearest edge from a gap above it when no gap lies beside it', () => {
    // A column that fills the focus's height: the only way in is from the gap above it, onto its top edge.
    const column: Box[] = [{ left: 460, top: 95, right: 700, bottom: 405 }];
    const line = leaderLine(focus, CARD, OPEN, OPEN, column)!;
    expect(crossesAny(line, column)).toBe(false);
    expect(line.from.y).toBe(focus.top);
    expect(line.from.x).toBeGreaterThan(focus.left);
    expect(line.from.x).toBeLessThanOrEqual(focus.right);
  });

  it('is not drawn when no path keeps clear of the boxes', () => {
    const wall: Box[] = [{ left: 440, top: OPEN.top - 10, right: 700, bottom: OPEN.bottom + 10 }];
    expect(leaderLine(focus, CARD, OPEN, OPEN, wall)).toBeNull();
  });
});
