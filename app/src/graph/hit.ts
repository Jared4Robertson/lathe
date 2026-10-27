import type { Plate } from './plate';

// Hit testing on the canvas (LA-EXP-C05): the box under the pointer, found from the map's own
// outlines in map units (a box's rectangle, a shape's polygon or rounded corners, a Voronoi cell's
// polygon), never from the page. Boxes are tested from the last drawn to the first, so a child
// drawn over its parent (Nested, Voronoi) is found before it.

type Point = { x: number; y: number };

/** Whether a point lies inside a polygon (even-odd). */
export function inPolygon(points: readonly (readonly [number, number])[], { x, y }: Point): boolean {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const [xi, yi] = points[i];
    const [xj, yj] = points[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** Whether a point in the map lies inside a box's outline. */
export function inPlate(p: Pick<Plate, 'x' | 'y' | 'w' | 'h' | 'outline'>, at: Point): boolean {
  if (at.x < p.x || at.x > p.x + p.w || at.y < p.y || at.y > p.y + p.h) return false;
  const o = p.outline;
  if (o.kind === 'polygon') return inPolygon(o.points, at);
  // A rounded corner: outside the quarter ellipse in its corner is outside the box.
  const rx = Math.min(o.rx, p.w / 2);
  const ry = Math.min(o.ry, p.h / 2);
  if (rx <= 0 || ry <= 0) return true;
  const dx = Math.max(p.x + rx - at.x, at.x - (p.x + p.w - rx), 0);
  const dy = Math.max(p.y + ry - at.y, at.y - (p.y + p.h - ry), 0);
  return dx === 0 || dy === 0 || (dx / rx) ** 2 + (dy / ry) ** 2 <= 1;
}

/** The box under a point in the map: the last drawn whose outline holds it, or null. */
export function hitPlate<T extends Pick<Plate, 'x' | 'y' | 'w' | 'h' | 'outline'>>(plates: readonly T[], at: Point): T | null {
  for (let i = plates.length - 1; i >= 0; i--) if (inPlate(plates[i], at)) return plates[i];
  return null;
}

/** Whether a box in the map shows in a pane through a camera: its bounding box meets the pane. */
export function onScreen(r: { x: number; y: number; w: number; h: number }, cam: { cx: number; cy: number; zoom: number; w: number; h: number }): boolean {
  const left = (r.x - cam.cx) * cam.zoom + cam.w / 2;
  const top = (r.y - cam.cy) * cam.zoom + cam.h / 2;
  return left + r.w * cam.zoom >= 0 && left <= cam.w && top + r.h * cam.zoom >= 0 && top <= cam.h;
}
