import { useReactFlow, useViewport } from '@xyflow/react';
import { Button } from '../components/Button';
import { readMotion } from './motion';

// Edge hints (LA-BRW-UC20-R12): the context ring may run past the canvas's edges, so at each edge a
// small chip counts the faded boxes past it ("3 ↑", "8 →"). A click pans the camera that way by
// about half the canvas, with the shared motion, without changing the focus. The chips follow the
// camera, and an edge with nothing past it shows none. The graph and the Model view (ERD) share it.

export type Point = { x: number; y: number };
export type Side = 'up' | 'down' | 'left' | 'right';

/** How many of the given world points (box centers) lie past each edge of a canvas of this size, seen through this viewport. */
export function pastEdges(centers: Iterable<Point>, view: { x: number; y: number; zoom: number }, width: number, height: number): Record<Side, number> {
  const past = { up: 0, down: 0, left: 0, right: 0 };
  for (const c of centers) {
    const x = c.x * view.zoom + view.x;
    const y = c.y * view.zoom + view.y;
    if (x < 0) past.left++;
    else if (x > width) past.right++;
    if (y < 0) past.up++;
    else if (y > height) past.down++;
  }
  return past;
}

const HINTS = [
  { side: 'up', mark: '↑', label: 'above', dx: 0, dy: 1 },
  { side: 'down', mark: '↓', label: 'below', dx: 0, dy: -1 },
  { side: 'left', mark: '←', label: 'to the left', dx: 1, dy: 0 },
  { side: 'right', mark: '→', label: 'to the right', dx: -1, dy: 0 },
] as const;

/** The viewport after panning toward a side by half the canvas: content past the right edge comes in from the right. */
export function panToward(view: { x: number; y: number; zoom: number }, side: Side, width: number, height: number) {
  const h = HINTS.find((x) => x.side === side)!;
  return { x: view.x + (h.dx * width) / 2, y: view.y + (h.dy * height) / 2, zoom: view.zoom };
}

/** The chips, inside a React Flow provider. `centers` are the world centers of the context boxes; `wrapper` is the canvas element. */
export function EdgeHints({ centers, wrapper }: { centers: readonly Point[]; wrapper: { current: HTMLElement | null } }) {
  const view = useViewport();
  const { setViewport } = useReactFlow();
  const width = wrapper.current?.clientWidth ?? 0;
  const height = wrapper.current?.clientHeight ?? 0;
  if (width <= 0 || height <= 0 || centers.length === 0) return null;
  const past = pastEdges(centers, view, width, height);
  const pan = (side: Side) => {
    const motion = readMotion();
    setViewport(panToward(view, side, width, height), motion.duration > 0 ? { duration: motion.duration, ease: motion.ease, interpolate: 'linear' } : { duration: 0 });
  };
  return (
    <div className="graph-edge-hints">
      {HINTS.map((h) => past[h.side] > 0 && (
        <Button
          key={h.side}
          className={`graph-edge-hint is-${h.side}`}
          aria-label={`${past[h.side]} faded ${past[h.side] === 1 ? 'box' : 'boxes'} ${h.label}: pan that way`}
          title={`${past[h.side]} faded ${h.label}`}
          onClick={() => pan(h.side)}
        >
          {past[h.side]} {h.mark}
        </Button>
      ))}
    </div>
  );
}
