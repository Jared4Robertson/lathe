import { describe, expect, it } from 'vitest';
import { wheelMove } from '../../src/graph/gestures';

// Scroll pans and Cmd/Ctrl+scroll or a pinch zooms about the pointer, Figma's convention (LA-V93-R07).

const wheel = (e: Partial<Parameters<typeof wheelMove>[0]>) =>
  ({ deltaX: 0, deltaY: 0, deltaMode: 0, shiftKey: false, ctrlKey: false, metaKey: false, ...e });
const size = { w: 1000, h: 600 };

describe('LA-V93-R07-T05 Scroll pans the camera, Shift+scroll sideways, and Cmd/Ctrl+scroll or a pinch zooms', () => {
  it('pans by deltaY down and deltaX across, by the same screen pixels, both at once', () => {
    expect(wheelMove(wheel({ deltaY: 40 }), size)).toEqual({ dx: 0, dy: 40 });
    expect(wheelMove(wheel({ deltaX: -25 }), size)).toEqual({ dx: -25, dy: 0 });
    expect(wheelMove(wheel({ deltaX: 3, deltaY: 7 }), size)).toEqual({ dx: 3, dy: 7 });
  });

  it('turns a wheel\'s deltaY sideways with Shift, never swapping twice', () => {
    expect(wheelMove(wheel({ deltaY: 100, shiftKey: true }), size)).toEqual({ dx: 100, dy: 0 });
    // A browser that already sent Shift+wheel as deltaX keeps it.
    expect(wheelMove(wheel({ deltaX: 100, shiftKey: true }), size)).toEqual({ dx: 100, dy: 0 });
  });

  it('scales line and page deltas to pixels', () => {
    expect(wheelMove(wheel({ deltaY: 3, deltaMode: 1 }), size)).toEqual({ dx: 0, dy: 60 });
    expect(wheelMove(wheel({ deltaX: 1, deltaY: 1, deltaMode: 2 }), size)).toEqual({ dx: 1000, dy: 600 });
    expect(wheelMove(wheel({ deltaY: 1, deltaMode: 2 }), null)).toEqual({ dx: 0, dy: 800 });
  });

  it('zooms with Cmd or Ctrl held, in on scrolling up, and a pinch keeps its speed', () => {
    const cmd = wheelMove(wheel({ deltaY: -100, metaKey: true }), size);
    expect(cmd).toEqual({ zoom: expect.closeTo(0.2, 6) });
    expect(wheelMove(wheel({ deltaY: 100, metaKey: true }), size)).toEqual({ zoom: expect.closeTo(-0.2, 6) });
    // A trackpad pinch arrives as a wheel with Ctrl held, its deltas small.
    expect(wheelMove(wheel({ deltaY: -2, ctrlKey: true }), size)).toEqual({ zoom: expect.closeTo(0.04, 6) });
    expect(wheelMove(wheel({ deltaY: -3, deltaMode: 1, metaKey: true }), size)).toEqual({ zoom: expect.closeTo(0.15, 6) });
    // One event zooms by a doubling at most.
    expect(wheelMove(wheel({ deltaY: -500, ctrlKey: true }), size)).toEqual({ zoom: 1 });
    expect(wheelMove(wheel({ deltaY: 1, deltaMode: 2, ctrlKey: true }), size)).toEqual({ zoom: -1 });
  });
});
