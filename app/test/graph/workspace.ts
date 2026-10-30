import type { ServedData } from '../read-view';
import { addRows, indexOf } from '../fixtures/load';
import { modelWorkspace } from '../fixtures/model';

// The graph tests' workspace: the `model` fixture (fixtures/model.ts), product P with domains P-D and
// P-E, and variants of it for the tests of groups.

export const testWorkspace = (): ServedData => modelWorkspace();

export const testIndex = () => indexOf(testWorkspace());

/** A second use case, P-D-UC02, in P-D-CAP01, with `count` UC requirements. */
function withReturns(count: number): ServedData {
  const w = testWorkspace();
  addRows(w, 'use_case', { id: 'P-D-UC02', title: 'Return a thing', capability_id: 'P-D-CAP01' });
  for (let i = 1; i <= count; i++) addRows(w, 'uc_requirement', { id: `P-D-UC02-R0${i}`, title: `Return rule ${i}`, use_case_id: 'P-D-UC02', statement: `Return rule ${i} MUST hold.` });
  return w;
}

/**
 * The test workspace with a second use case that has six UC requirements, and under Shelf (P-D-A4) a
 * command on its entity that raises an event of its own: Shelf then holds an entity and a domain event,
 * more than one kind of child, so it reaches them through groups, and its entity holds the command.
 */
export const groupedWorkspace = (): ServedData => {
  const w = withReturns(6);
  addRows(w, 'command', { id: 'P-D-CMD06', title: 'Restock shelf', entity_id: 'P-D-EN06' });
  addRows(w, 'domain_event', { id: 'P-D-EV04', title: 'Shelf restocked', aggregate_id: 'P-D-A4', published: false });
  return addRows(w, 'raises', { source_id: 'P-D-CMD06', target_id: 'P-D-EV04' });
};

/** The test workspace with a second use case that has seven UC requirements and nothing else: one kind, so no groups. */
export const manyOfOneKindWorkspace = (): ServedData => withReturns(7);

/** A map's groups of siblings (LA-EXP-DS06): its roots, then each parent's children, in the tree's order. */
export function siblingGroups<N extends { children: readonly string[] }>(map: { roots: readonly string[]; nodes: ReadonlyMap<string, N> }): N[][] {
  const groups = [map.roots.map((id) => map.nodes.get(id)!)];
  for (const n of map.nodes.values()) if (n.children.length > 0) groups.push(n.children.map((id) => map.nodes.get(id)!));
  return groups;
}
