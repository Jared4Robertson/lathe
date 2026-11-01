// Moving a step of a flow or a journey: the one way both put a step at a position of a path and keep every path they
// touch numbered 1, 2, 3 without gaps. A path is compared trimmed and in any letter case.
import { byRecordId } from './ids.ts';

/** What a step of an ordered string has: its ID, the path it is on and its place there. */
export interface Placed {
  id: string;
  path: string;
  position: number;
}

const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();
const inOrder = <T extends Placed>(steps: readonly T[]): T[] => [...steps].sort((a, b) => a.position - b.position || byRecordId(a, b));

/**
 * The steps with the one given put at `position` of `path` (its own path when none is given; a path no step is on yet
 * starts with it), the others on the path it leaves and the path it joins renumbered from 1 in their order. Refuses a
 * step that is not among them and a position outside the path, from 1 to one past its last step.
 */
export function moveStep<T extends Placed>(steps: readonly T[], id: string, path: string | undefined, position: number, refuse: (rule: string, message: string) => never): T[] {
  const moving = steps.find((s) => s.id === id) ?? refuse('missing', `there is no step ${id} to move`);
  const target = path === undefined ? moving.path : (steps.find((s) => same(s.path, path))?.path ?? path.trim());
  if (!target) refuse('path', 'a path cannot be blank');
  const rest = steps.filter((s) => s.id !== id);
  const ahead = inOrder(rest.filter((s) => same(s.path, target)));
  if (!Number.isInteger(position) || position < 1 || position > ahead.length + 1) refuse('position', `position ${position} is outside path ${target}, which takes a step at 1 to ${ahead.length + 1}`);
  const placed = new Map<string, { path: string; position: number }>();
  if (!same(moving.path, target)) inOrder(rest.filter((s) => same(s.path, moving.path))).forEach((s, at) => placed.set(s.id, { path: s.path, position: at + 1 }));
  [...ahead.slice(0, position - 1), { ...moving, path: target }, ...ahead.slice(position - 1)].forEach((s, at) => placed.set(s.id, { path: s.path, position: at + 1 }));
  return steps.map((s) => (placed.has(s.id) ? { ...s, ...placed.get(s.id)! } : s));
}
