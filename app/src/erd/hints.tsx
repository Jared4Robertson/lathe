import { useReactFlow, useStore } from '@xyflow/react';
import { EdgeHintChips, panToward, pastEdges, type Point, type Side } from '../graph/hints';
import { readMotion } from '../graph/motion';

// The ERD view's edge hints (LA-V94-R06, app/src/graph/hints.tsx): the chips over its
// React Flow canvas, counting the boxes past each edge through React Flow's camera: the faded
// context, and any box a model too big to fit at a legible zoom leaves outside.

/**
 * The chips, inside a React Flow provider. `centers` are the world centers of the boxes they count;
 * `wrapper` is the canvas element.
 */
export function EdgeHints({ centers, wrapper }: { centers: readonly Point[]; wrapper: { current: HTMLElement | null } }) {
  const { getViewport, setViewport } = useReactFlow();
  const width = wrapper.current?.clientWidth ?? 0;
  const height = wrapper.current?.clientHeight ?? 0;
  // The counts, as one key: the camera moves every frame of a glide, but the chips are drawn again
  // only when a count changes (LA-PAT-APP-UX-R11). The canvas's size in the store redraws them on a resize.
  const key = useStore((s) => {
    const [x, y, zoom] = s.transform;
    const p = pastEdges(centers, { x, y, zoom }, wrapper.current?.clientWidth ?? s.width, wrapper.current?.clientHeight ?? s.height);
    return `${p.up} ${p.down} ${p.left} ${p.right} ${s.width}x${s.height}`;
  });
  if (width <= 0 || height <= 0 || centers.length === 0) return null;
  const [up, down, left, right] = key.split(' ').map(Number);
  const pan = (side: Side) => {
    const motion = readMotion();
    setViewport(panToward(getViewport(), side, width, height), motion.duration > 0 ? { duration: motion.duration, ease: motion.ease, interpolate: 'linear' } : { duration: 0 });
  };
  return <EdgeHintChips past={{ up, down, left, right }} noun="more" onPan={pan} />;
}
