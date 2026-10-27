import type { SpecData } from '../../../lathe/src/server/contract';
import { addRows, indexOf } from '../fixtures/load';
import { modelWorkspace } from '../fixtures/model';

// The graph tests' workspace: the `model` fixture (fixtures/model.ts), product P with domains P-D and
// P-E, and variants of it for the tests of groups.

export { PROBLEMS } from '../fixtures/model';

export const testWorkspace = (): SpecData => modelWorkspace();

export const testIndex = () => indexOf(testWorkspace());

/** A second use case, P-D-UC02, in P-D-CAP01, with `count` UC requirements. */
function withReturns(count: number): SpecData {
  const w = testWorkspace();
  addRows(w, 'use_case', { id: 'P-D-UC02', title: 'Return a thing', capability_id: 'P-D-CAP01' });
  for (let i = 1; i <= count; i++) addRows(w, 'uc_requirement', { id: `P-D-UC02-R0${i}`, title: `Return rule ${i}`, use_case_id: 'P-D-UC02', statement: `Return rule ${i} MUST hold.` });
  return w;
}

/**
 * The test workspace with a second use case that has six UC requirements, and a command under Shelf
 * (P-D-A4), which then holds an entity and a command: more than one kind of child, so it reaches them
 * through groups.
 */
export const groupedWorkspace = (): SpecData =>
  addRows(withReturns(6), 'command', { id: 'P-D-CMD06', title: 'Restock shelf', aggregate_id: 'P-D-A4' });

/** The test workspace with a second use case that has seven UC requirements and nothing else: one kind, so no groups. */
export const manyOfOneKindWorkspace = (): SpecData => withReturns(7);

/** A map's groups of siblings (LA-EXP-DR58): its roots, then each parent's children, in the tree's order. */
export function siblingGroups<N extends { children: readonly string[] }>(map: { roots: readonly string[]; nodes: ReadonlyMap<string, N> }): N[][] {
  const groups = [map.roots.map((id) => map.nodes.get(id)!)];
  for (const n of map.nodes.values()) if (n.children.length > 0) groups.push(n.children.map((id) => map.nodes.get(id)!));
  return groups;
}
