import { describe, expect, it } from 'vitest';
import { DEFAULT_SIZE, MIN_SIZE, parseWindowStates, saveWindow, windowFor } from '../src/windowState.ts';

const display = { x: 0, y: 0, width: 1728, height: 1080 };

describe('LA-DSK-T03 Each folder window reopens where it was left, and always on a screen', () => {
  it('saves and restores a window by folder', () => {
    const states = saveWindow({}, '/p/lathe', { x: 100, y: 80, width: 1400, height: 900 });
    expect(windowFor(states, '/p/lathe', [display])).toEqual({ x: 100, y: 80, width: 1400, height: 900 });
    expect(windowFor(states, '/p/other', [display])).toEqual(DEFAULT_SIZE);
  });

  it('keeps each folder apart, and replaces only the folder saved', () => {
    let states = saveWindow({}, '/p/a', { x: 0, y: 0, width: 900, height: 700 });
    states = saveWindow(states, '/p/b', { x: 50, y: 50, width: 1000, height: 800 });
    states = saveWindow(states, '/p/a', { x: 10, y: 10, width: 950, height: 720 });
    expect(Object.keys(states)).toEqual(['/p/a', '/p/b']);
    expect(states['/p/a']).toEqual({ x: 10, y: 10, width: 950, height: 720 });
  });

  it('remembers maximized and full screen with the normal bounds', () => {
    const states = saveWindow({}, '/p/a', { x: 20, y: 30, width: 1000, height: 700, maximized: true });
    expect(windowFor(states, '/p/a', [display])).toEqual({ x: 20, y: 30, width: 1000, height: 700, maximized: true });
  });

  it('centers a window whose saved place is on a screen no longer connected', () => {
    const states = saveWindow({}, '/p/a', { x: 3000, y: 200, width: 1000, height: 700 });
    expect(windowFor(states, '/p/a', [display])).toEqual({ width: 1000, height: 700 });
  });

  it('shrinks a saved size to fit the largest screen', () => {
    const states = saveWindow({}, '/p/a', { x: 0, y: 0, width: 4000, height: 3000 });
    expect(windowFor(states, '/p/a', [display, { x: 1728, y: 0, width: 1280, height: 800 }])).toEqual({ x: 0, y: 0, width: 1728, height: 1080 });
  });

  it('reads saved state safely, never smaller than the minimum', () => {
    expect(parseWindowStates(null)).toEqual({});
    expect(parseWindowStates({ '/a': { width: 'wide' }, '/b': { width: 100, height: 100, x: 1 } })).toEqual({ '/b': { width: MIN_SIZE.width, height: MIN_SIZE.height } });
  });
});
