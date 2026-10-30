// Capturing the stage for a message (LA-PLT-UC22-R05): the page's rectangle is checked, and the pixels come back as base64 PNG.
import { describe, expect, it } from 'vitest';
import { captureStage, parseRect } from '../src/chatCapture.ts';

const page = (empty: boolean, seen: unknown[] = []) => ({
  capturePage: async (rect?: unknown) => {
    seen.push(rect);
    return { isEmpty: () => empty, toPNG: () => Buffer.from([137, 80, 78, 71]) };
  },
}) as never;

describe('LA-PLT-UC22-R05-T04 The shell captures the rectangle of the window the page names, as a PNG, and nothing else', () => {
  it('rounds a good rectangle and refuses one that is not finite, empty or larger than a screen', () => {
    expect(parseRect({ x: 10.4, y: 20.6, width: 300.2, height: 200 })).toEqual({ x: 10, y: 21, width: 300, height: 200 });
    expect(parseRect({ x: 0, y: 0, width: 0, height: 10 })).toBeNull();
    expect(parseRect({ x: 0, y: 0, width: 9000, height: 10 })).toBeNull();
    expect(parseRect({ x: Number.NaN, y: 0, width: 10, height: 10 })).toBeNull();
    expect(parseRect({ x: '0', y: 0, width: 10, height: 10 })).toBeNull();
    expect(parseRect(null)).toBeNull();
  });

  it('answers the picture as base64, and null for a bad rectangle or a blank capture', async () => {
    const seen: unknown[] = [];
    expect(await captureStage(page(false, seen), { x: 1, y: 2, width: 30, height: 40 })).toBe(Buffer.from([137, 80, 78, 71]).toString('base64'));
    expect(seen).toEqual([{ x: 1, y: 2, width: 30, height: 40 }]);
    expect(await captureStage(page(false, seen), { x: 1, y: 2, width: 0, height: 40 })).toBeNull();
    expect(seen).toHaveLength(1);
    expect(await captureStage(page(true), { x: 1, y: 2, width: 30, height: 40 })).toBeNull();
  });
});
