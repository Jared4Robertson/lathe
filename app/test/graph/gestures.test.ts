import { describe, expect, it } from 'vitest';
import { wheelLatch, wheelMove, type WheelInput } from '../../src/graph/gestures';

// One wheel rule on every stage (LA-V93-R07, LA-EXP-DS09): with Scroll to zoom off, scroll pans and Cmd/Ctrl+scroll
// zooms about the pointer, Figma's convention; with it on, scroll zooms and Cmd/Ctrl+scroll pans. A pinch zooms either way.

const wheel = (e: Partial<WheelInput>): WheelInput =>
  ({ deltaX: 0, deltaY: 0, deltaMode: 0, shiftKey: false, ctrlKey: false, metaKey: false, pinch: false, ...e });
const size = { w: 1000, h: 600 };
const off = (e: Partial<WheelInput>, s: { w: number; h: number } | null = size) => wheelMove(wheel(e), s, false);
const on = (e: Partial<WheelInput>, s: { w: number; h: number } | null = size) => wheelMove(wheel(e), s, true);

describe('LA-V93-R07-T05 With Scroll to zoom off, scroll pans the camera, Shift+scroll sideways, and Cmd/Ctrl+scroll or a pinch zooms', () => {
  it('pans by deltaY down and deltaX across, by the same screen pixels, both at once', () => {
    expect(off({ deltaY: 40 })).toEqual({ dx: 0, dy: 40 });
    expect(off({ deltaX: -25 })).toEqual({ dx: -25, dy: 0 });
    expect(off({ deltaX: 3, deltaY: 7 })).toEqual({ dx: 3, dy: 7 });
  });

  it('turns a wheel\'s deltaY sideways with Shift, never swapping twice', () => {
    expect(off({ deltaY: 100, shiftKey: true })).toEqual({ dx: 100, dy: 0 });
    // A browser that already sent Shift+wheel as deltaX keeps it.
    expect(off({ deltaX: 100, shiftKey: true })).toEqual({ dx: 100, dy: 0 });
  });

  it('scales line and page deltas to pixels', () => {
    expect(off({ deltaY: 3, deltaMode: 1 })).toEqual({ dx: 0, dy: 60 });
    expect(off({ deltaX: 1, deltaY: 1, deltaMode: 2 })).toEqual({ dx: 1000, dy: 600 });
    expect(off({ deltaY: 1, deltaMode: 2 }, null)).toEqual({ dx: 0, dy: 800 });
  });

  it('zooms with Cmd or Ctrl held, in on scrolling up, and a pinch keeps its speed', () => {
    expect(off({ deltaY: -100, metaKey: true })).toEqual({ zoom: expect.closeTo(0.2, 6) });
    expect(off({ deltaY: 100, metaKey: true })).toEqual({ zoom: expect.closeTo(-0.2, 6) });
    // A trackpad pinch arrives as a wheel with Ctrl set, its deltas small.
    expect(off({ deltaY: -2, ctrlKey: true, pinch: true })).toEqual({ zoom: expect.closeTo(0.04, 6) });
    expect(off({ deltaY: -2, ctrlKey: true })).toEqual({ zoom: expect.closeTo(0.04, 6) });
    expect(off({ deltaY: -3, deltaMode: 1, metaKey: true })).toEqual({ zoom: expect.closeTo(0.15, 6) });
    // One event zooms by a doubling at most.
    expect(off({ deltaY: -500, ctrlKey: true })).toEqual({ zoom: 1 });
    expect(off({ deltaY: 1, deltaMode: 2, ctrlKey: true })).toEqual({ zoom: -1 });
  });
});

describe('LA-V93-R07-T08 With Scroll to zoom on, scroll zooms about the pointer, Cmd/Ctrl+scroll pans, Shift+scroll pans sideways, and a pinch zooms', () => {
  it('zooms on plain scroll, in on scrolling up, at Cmd\'s speed, a line or page scaled, a doubling at most', () => {
    expect(on({ deltaY: -100 })).toEqual({ zoom: expect.closeTo(0.2, 6) });
    expect(on({ deltaY: 100 })).toEqual({ zoom: expect.closeTo(-0.2, 6) });
    expect(on({ deltaY: -3, deltaMode: 1 })).toEqual({ zoom: expect.closeTo(0.15, 6) });
    expect(on({ deltaY: -1, deltaMode: 2 })).toEqual({ zoom: 1 });
  });

  it('pans with Cmd or Ctrl held, down and across at once as a trackpad scrolls, a line or page scaled', () => {
    expect(on({ deltaX: 3, deltaY: 7, metaKey: true })).toEqual({ dx: 3, dy: 7 });
    expect(on({ deltaY: 40, ctrlKey: true })).toEqual({ dx: 0, dy: 40 });
    expect(on({ deltaY: 3, deltaMode: 1, metaKey: true })).toEqual({ dx: 0, dy: 60 });
    expect(on({ deltaX: 1, deltaY: 1, deltaMode: 2, ctrlKey: true })).toEqual({ dx: 1000, dy: 600 });
  });

  it('pans sideways with Shift, never swapping twice', () => {
    expect(on({ deltaY: 100, shiftKey: true })).toEqual({ dx: 100, dy: 0 });
    expect(on({ deltaX: 100, shiftKey: true })).toEqual({ dx: 100, dy: 0 });
  });

  it('zooms on a pinch at today\'s speed, the Ctrl it arrives with not taken for Ctrl+scroll', () => {
    expect(on({ deltaY: -2, ctrlKey: true, pinch: true })).toEqual({ zoom: expect.closeTo(0.04, 6) });
    expect(on({ deltaY: -500, ctrlKey: true, pinch: true })).toEqual({ zoom: 1 });
  });
});

describe('LA-V93-R07-T06 A scroll keeps its move: a key that changes it mid-scroll drops the rest of it, until a new scroll', () => {
  /** A wheel event as the latch reads it: whether wheelMove made it a zoom, and its deltas. */
  const ev = (zoom: boolean, deltaY: number) => ({ zoom, deltaX: 0, deltaY });
  /** What the latch is given for a wheel event read in a mode: wheelMove's own answer. */
  const read = (e: Partial<WheelInput>, scrollToZoom: boolean) => ({ zoom: 'zoom' in wheelMove(wheel(e), size, scrollToZoom), deltaX: e.deltaX ?? 0, deltaY: e.deltaY ?? 0 });

  it('drops a zoom\'s momentum after Cmd is let go, until the scroll pauses', () => {
    const latch = wheelLatch();
    expect(latch(ev(true, -30), 0)).toBe('move');
    expect(latch(ev(true, -20), 16)).toBe('move');
    expect(latch(ev(false, -14), 32)).toBe('drop');
    // Momentum keeps arriving, fading, and stays dropped even if Cmd is pressed again.
    expect(latch(ev(false, -9), 48)).toBe('drop');
    expect(latch(ev(true, -6), 64)).toBe('drop');
    // After a pause, a new scroll starts afresh.
    expect(latch(ev(false, 3), 300)).toBe('move');
  });

  it('drops a pan\'s momentum after Ctrl is pressed', () => {
    const latch = wheelLatch();
    expect(latch(ev(false, 20), 0)).toBe('move');
    expect(latch(ev(true, 15), 20)).toBe('drop');
    expect(latch(ev(true, 10), 40)).toBe('drop');
  });

  it('moves again as soon as a new scroll grows while momentum still arrives, in the move it starts with', () => {
    const latch = wheelLatch();
    expect(latch(ev(true, -30), 0)).toBe('move');
    expect(latch(ev(false, -12), 16)).toBe('drop');
    expect(latch(ev(false, -5), 32)).toBe('drop');
    expect(latch(ev(false, -2), 48)).toBe('drop');
    // The fingers scroll again with no pause: the deltas grow past the fade, and it pans.
    expect(latch(ev(false, 4), 64)).toBe('drop');
    expect(latch(ev(false, 9), 80)).toBe('move');
    expect(latch(ev(false, 14), 96)).toBe('move');
  });

  it('with Scroll to zoom on, drops a zoom\'s momentum once Cmd is pressed, and a pan\'s once it is let go', () => {
    const zoom = wheelLatch();
    expect(zoom(read({ deltaY: -30 }, true), 0)).toBe('move');
    expect(zoom(read({ deltaY: -20, metaKey: true }, true), 16)).toBe('drop');
    expect(zoom(read({ deltaY: -12, metaKey: true }, true), 32)).toBe('drop');
    expect(zoom(read({ deltaY: 3 }, true), 300)).toBe('move');
    const pan = wheelLatch();
    expect(pan(read({ deltaY: 30, ctrlKey: true }, true), 0)).toBe('move');
    expect(pan(read({ deltaY: 20 }, true), 16)).toBe('drop');
    // Shift turns a zoom into a sideways pan, so it ends a zoom's scroll too.
    const shift = wheelLatch();
    expect(shift(read({ deltaY: -30 }, true), 0)).toBe('move');
    expect(shift(read({ deltaY: -20, shiftKey: true }, true), 16)).toBe('drop');
  });
});
