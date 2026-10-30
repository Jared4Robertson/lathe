import { Button } from '../components/Button';

// Edge hints (LA-V94-R06): at each edge of a canvas a small chip counts the boxes of interest
// past it ("3 ↑", "8 →"): the ERD view's boxes in focus, and its changed boxes. A click pans the camera that way, with
// the shared motion, without changing the focus, by about half the canvas. The chips follow the
// camera, and an edge with nothing past it shows none. The ERD's canvas counts them as it paints (erd/ErdView.tsx).

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

/**
 * The chips for the counts past each edge: `noun` says what they are ("more"), `word` what they say beside the count
 * ("1 change ↓", "4 changes →"); `onPan` moves the camera toward a side. Each chip's name starts with the words it shows,
 * the arrow aside (LA-PAT-APP-UX-R10).
 */
export function EdgeHintChips({ past, noun, word, onPan }: { past: Record<Side, number>; noun: string; word?: { one: string; many: string }; onPan: (side: Side) => void }) {
  return (
    <div className={word ? 'graph-edge-hints is-changes' : 'graph-edge-hints'}>
      {HINTS.map((h) => {
        const count = past[h.side];
        if (count === 0) return null;
        const shown = word ? `${count} ${count === 1 ? word.one : word.many}` : `${count}`;
        const name = word ? `${shown} ${h.label}` : `${count} ${noun} ${count === 1 ? 'box' : 'boxes'} ${h.label}`;
        return (
          <Button key={h.side} className={`graph-edge-hint is-${h.side}`} aria-label={`${name}: pan that way`} title={name} onClick={() => onPan(h.side)}>
            {shown} <span aria-hidden="true">{h.mark}</span>
          </Button>
        );
      })}
    </div>
  );
}
