import type { Mark, Shape } from './shapes';

// The small marks for a kind's shape (LA-V93-R06): drawn before a box's kind and ID line in the
// Nested and Voronoi views, where every box keeps its rectangle or cell (by the canvas, paint.ts,
// from these same paths), and in the graph's key.
// A mark (a tag, a gear, a lens, a marker, a ruler, a port) tells apart two kinds that share a shape, in every
// view. Each is a line drawing in its box's edge and fill colors.

/** Each shape's drawing in a 16 by 11 box: one path, or layers drawn back to front. */
export const SHAPE_PATHS: Readonly<Record<Shape, string | readonly string[]>> = {
  box: 'M1.5 1.5h13v8h-13z',
  product: 'M3.2 0.8h9.6a2.2 2.2 0 0 1 2.2 2.2v5a2.2 2.2 0 0 1-2.2 2.2H3.2A2.2 2.2 0 0 1 1 8V3a2.2 2.2 0 0 1 2.2-2.2z M3.6 3h8.8',
  hexagon: 'M4.5 1h7L15 5.5 11.5 10h-7L1 5.5z',
  folder: 'M1 1h6l1.5 1.8H15V10H1z',
  slice: 'M1 1.5h10l4 4-4 4H1z',
  double: 'M1 1h14v9H1z M3 3h10v5H3z',
  octagon: 'M4 1h8l3 3v3l-3 3H4L1 7V4z',
  flag: 'M1 1.5h14l-3.5 4 3.5 4H1z',
  parallelogram: 'M4 1.5h11l-3 8H1z',
  stadium: 'M5.5 1h5a4.5 4.5 0 0 1 0 9h-5a4.5 4.5 0 0 1 0-9z',
  page: 'M1 1h10.5L15 4.5V10H1z M11.5 1v3.5H15',
  stack: ['M3.5 1H15v6.5H3.5z', 'M1 3.5h11.5V10H1z'],
  'chevron-bar': 'M1 1.5h11l3 4-3 4H1l3-4z M8 1.5l3 4-3 4',
  chevron: 'M1 1.5h10l4 4-4 4H1l4-4z',
  window: 'M1 1h14v9H1z M1 3.5h14',
  port: 'M1 1.5h14v8H1V7h2.5V4H1z',
  stripes: 'M1 1h14v9H1z M1 3h14 M1 8h14',
  component: 'M4 1.5h11v8H4V8H1V6h3V5H1V3h3z',
  shield: 'M1 1h14v5l-7 4.5L1 6z',
  diamond: 'M1 5.5 4.5 2 8 1l3.5 1L15 5.5 11.5 9 8 10 4.5 9z',
};

/** Each mark's drawing in an 11 by 11 box. */
export const MARK_PATHS: Readonly<Record<Mark, string>> = {
  value: 'M1 5.5 4 2h6v7H4z M5.5 5.5h0.1',
  lens: 'M4.5 1.5a3 3 0 1 0 0 6 3 3 0 1 0 0-6z M6.7 6.7 10 10',
  gear: 'M5.5 3.2a2.3 2.3 0 1 0 0 4.6 2.3 2.3 0 1 0 0-4.6z M5.5 1v2.2 M5.5 7.8V10 M1 5.5h2.2 M7.8 5.5H10 M2.3 2.3l1.6 1.6 M7.1 7.1l1.6 1.6 M2.3 8.7l1.6-1.6 M7.1 3.9l1.6-1.6',
  ruler: 'M1 3.5h9v4H1z M3 3.5v2 M5 3.5v1.2 M7 3.5v2 M9 3.5v1.2',
  port: 'M1 5.5h3 M4 3h5v5H4z',
  marker: 'M3 1h5v9L5.5 7.8 3 10z',
};

/** A shape's mark, as a box shows it before its kind and ID line or the key beside its meaning. */
export function ShapeIcon({ shape }: { shape: Shape }) {
  return (
    <svg className={`graph-shape-icon shape-${shape}`} viewBox="0 0 16 11" aria-hidden="true" focusable="false">
      {[SHAPE_PATHS[shape]].flat().map((d) => <path key={d} d={d} />)}
    </svg>
  );
}

/** A kind's mark (a tag, a gear, a lens, a marker, a ruler, a port). */
export function MarkIcon({ mark }: { mark: Mark }) {
  return (
    <svg className={`graph-mark-icon mark-${mark}`} viewBox="0 0 11 11" aria-hidden="true" focusable="false">
      <path d={MARK_PATHS[mark]} />
    </svg>
  );
}
