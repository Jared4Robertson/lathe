import { NODE_HEIGHT, NODE_WIDTH, type Point } from './layout';

// Re-centering moves the camera, not the picture (LA-BRW-UC20-R09). The layout puts each new
// focus at the origin; anchoring shifts the whole new layout so the new focus keeps the place it
// had in the last picture, so the world stays put and records in both pictures move little. Then
// the camera (the viewport) pans, and zooms when the new picture needs another scale, to frame the
// new focus. Records new to the picture fade in at their place and records leaving fade out.

/** Every position moved by (dx, dy). */
export function translate(positions: ReadonlyMap<string, Point>, dx: number, dy: number): Map<string, Point> {
  return new Map([...positions].map(([id, p]) => [id, { x: p.x + dx, y: p.y + dy }]));
}

/**
 * The new layout anchored on its focus (LA-BRW-DR180): when the focus was in the last picture, the
 * whole layout is shifted by its old position minus its new one, so it stays where it was in world
 * coordinates. Otherwise (the first picture, or a focus that was not drawn) the layout is kept as
 * it is, with the focus at the origin. The same layout and anchor always give the same positions.
 */
export function anchorLayout(next: ReadonlyMap<string, Point>, focus: string, previous: ReadonlyMap<string, Point> | null): Map<string, Point> {
  const was = previous?.get(focus);
  const now = next.get(focus);
  if (!was || !now) return new Map(next);
  return translate(next, was.x - now.x, was.y - now.y);
}

/** Which records fade in (new to the picture) and which fade out (in the last picture, not in this one). The first picture has neither. */
export function fadeSets(before: Iterable<string> | null, after: Iterable<string>): { entering: Set<string>; leaving: Set<string> } {
  if (!before) return { entering: new Set(), leaving: new Set() };
  const was = new Set(before);
  const now = new Set(after);
  return {
    entering: new Set([...now].filter((id) => !was.has(id))),
    leaving: new Set([...was].filter((id) => !now.has(id))),
  };
}

export interface Viewport { x: number; y: number; zoom: number }

/**
 * The camera that frames the focus (LA-BRW-DR181): zoomed so the whole picture fits the canvas
 * (never past 1), and panned so the focus is at the center, moved only as far as keeps the whole
 * picture in view. Where the picture is too large to fit even at the smallest zoom, the focus is
 * centered.
 */
export function frameFocus(positions: ReadonlyMap<string, Point>, focus: string, width: number, height: number, padding = 40, minZoom = 0.1): Viewport {
  const all = [...positions.values()];
  if (all.length === 0) return { x: width / 2, y: height / 2, zoom: 1 };
  const minX = Math.min(...all.map((p) => p.x));
  const minY = Math.min(...all.map((p) => p.y));
  const maxX = Math.max(...all.map((p) => p.x + NODE_WIDTH));
  const maxY = Math.max(...all.map((p) => p.y + NODE_HEIGHT));
  const zoom = Math.max(minZoom, Math.min(1, (width - 2 * padding) / (maxX - minX), (height - 2 * padding) / (maxY - minY)));
  const f = positions.get(focus) ?? { x: (minX + maxX - NODE_WIDTH) / 2, y: (minY + maxY - NODE_HEIGHT) / 2 };
  const center = (size: number, at: number, lo: number, hi: number) => {
    const ideal = size / 2 - at * zoom;
    const least = padding - lo * zoom; // the picture's near edge at the padding
    const most = size - padding - hi * zoom; // its far edge at the padding
    return least <= most ? Math.min(most, Math.max(least, ideal)) : ideal;
  };
  return {
    x: center(width, f.x + NODE_WIDTH / 2, minX, maxX),
    y: center(height, f.y + NODE_HEIGHT / 2, minY, maxY),
    zoom,
  };
}
