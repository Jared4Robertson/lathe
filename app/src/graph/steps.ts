// The stage's walk: the plain arrow keys step the focus through the tree, out to the parent, in to the first child and
// across the siblings, from anywhere on the page (LA-V93-R19). The commands layer's one arrow handler
// (useStageWalk, app/src/shell/commands.tsx) sends each arrow to the stage shown; each stage maps it to a step here. The
// Graph steps by its layout's keys; the Trace stage, which draws parents beside their children as the Tree does, by the
// Tree's; the ERD stage by where its boxes sit on the map (erd/walk.ts `erdStep`), through `useWalk`.
import { useCallback } from 'react';
import { kindLabel, type SpecIndex } from '../specs/data';
import { useStageWalk } from '../shell/commands';
import { COMMANDS } from '../shell/keymap';
import { groupKindLabel, groupName, groupOwner, isGraphNode, isGroup, nodeChildren, nodeParent } from './model';
import type { GraphLayout } from './GraphPage';

/** A step through the tree: out to the parent, in to the first child, to the previous or next sibling. */
export type Step = 'out' | 'in' | 'previous' | 'next';
/** Each step's keymap command, in the toolbar's order, which is the same in every view. */
export const STEP_COMMANDS: Readonly<Record<Step, string>> = { out: 'graphStepOut', in: 'graphStepIn', previous: 'graphStepPrevious', next: 'graphStepNext' };
export const STEPS = Object.keys(STEP_COMMANDS) as Step[];
/** Whether a view draws children inside their parent (Nested and Voronoi), and so steps by the keymap's `nestedKeys`. */
export const nestsChildren = (layout: GraphLayout) => layout !== 'tree';
/**
 * The plain arrow key that takes a step in a view, from the keymap (LA-V93-R19): in the Tree view Left out, Right in, Up
 * and Down across; in the Nested and Voronoi views, which draw children inside their parent, Up out, Down in, Left and
 * Right across.
 */
export function stepKey(layout: GraphLayout, step: Step): string {
  const command = COMMANDS.find((c) => c.id === STEP_COMMANDS[step])!;
  return ((nestsChildren(layout) ? command.nestedKeys : undefined) ?? command.keys)[0];
}
/** The step a plain arrow key takes in a view, or none. */
export const arrowStep = (layout: GraphLayout, key: string): Step | undefined => STEPS.find((s) => stepKey(layout, s) === key);

/**
 * Where a step goes from a node: its parent, its first child, or its previous or next sibling in the tree. The siblings
 * loop (LA-V93-R19): next from the last goes to the first, previous from the first to the last. Out of the root, in to a
 * node with no children, or across from an only child, there is no step.
 */
export function stepTarget(index: SpecIndex, focus: string, step: Step): string | null {
  const ok = (id: string | null | undefined) => (id && isGraphNode(index, id) ? id : null);
  if (step === 'out') return ok(nodeParent(index, focus));
  if (step === 'in') return ok(nodeChildren(index, focus).find((c) => isGraphNode(index, c)));
  const up = nodeParent(index, focus);
  if (up === null) return null;
  const siblings = nodeChildren(index, up).filter((c) => isGraphNode(index, c));
  const at = siblings.indexOf(focus);
  if (at < 0 || siblings.length < 2) return null;
  return ok(siblings[(at + (step === 'next' ? 1 : -1) + siblings.length) % siblings.length]);
}

/** What a step says to a screen reader: the new focus as the graph's box names it, "Use case Borrow a tool", "Use cases in LA-D". */
export function stepName(index: SpecIndex, id: string): string {
  if (isGroup(index, id)) return `${groupKindLabel(index, id)} ${groupName(index, id)} in ${groupOwner(index, id)}`;
  const record = index.byId.get(id);
  return record ? `${kindLabel(index, record.kind)} ${record.title}` : id;
}

/**
 * Registers the shown stage's walk: a plain arrow anywhere but a control that uses arrows itself takes the layout's step
 * from the focus and moves the focus there, as a click does. `follow` says, before the move, whether keyboard focus
 * follows to the new focus's box (and so is read out there); otherwise the walk is announced.
 */
export function useStepWalk(index: SpecIndex, focus: string, layout: GraphLayout, onNavigate: (id: string) => void, follow?: (to: string) => boolean) {
  const target = useCallback((key: string) => {
    const step = arrowStep(layout, key);
    return step ? stepTarget(index, focus, step) : null;
  }, [index, focus, layout]);
  useWalk(index, focus, target, onNavigate, follow);
}

/**
 * Registers a stage's walk by its own step: `target` says where a plain arrow's key goes from the focus, or null. The
 * walk moves the focus there, as a click does, and announces it unless `follow` takes keyboard focus there.
 */
export function useWalk(index: SpecIndex, focus: string, target: (key: string) => string | null, onNavigate: (id: string) => void, follow?: (to: string) => boolean) {
  const walk = useCallback((key: string) => {
    const to = target(key);
    if (!to) return null;
    const followed = follow?.(to) ?? false;
    onNavigate(to);
    return followed ? null : stepName(index, to);
  }, [index, target, onNavigate, follow]);
  useStageWalk(walk, isGraphNode(index, focus));
}
