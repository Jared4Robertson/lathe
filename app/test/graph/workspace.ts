import type { Coverage, Problem } from '../../../lathe/src/types';
import type { SpecData } from '../../../lathe/src/server/contract';
import { addRows, fixture, indexOf } from '../fixtures/load';

// A small workspace for the graph tests (fixtures/data/graph/): one product P with one domain P-D,
// an aggregate with two domain rules, a use case, a view, an endpoint, two components, a test and a
// question.

export const PROBLEMS: Problem[] = [
  { severity: 'error', check: 'run-by-mentions-id', record: 'P-D-T01', message: 'test/thing.test.ts does not mention P-D-T01' },
  { severity: 'warning', check: 'rule-not-proved', record: 'P-D-DR01', message: 'No test proves P-D-DR01' },
  { severity: 'warning', check: 'rule-not-satisfied', record: 'P-D-DR02', message: 'No component satisfies P-D-DR02' },
  { severity: 'warning', check: 'rule-not-proved', record: 'P-D-DR02', message: 'No test proves P-D-DR02' },
];

const coverage = (): Coverage[] => [{
  domain: 'P-D',
  obligations: [
    { kind: 'domain_rule', label: 'Domain rule', total: 2, designed: 1, built: 1, proved: 0, planned: 0, planned_any: 0 },
    { kind: 'requirement', label: 'UC requirement', total: 1, designed: 1, built: 1, proved: 1, planned: 0, planned_any: 0 },
  ],
  tests: { automated: 1, manual: 0, planned: 0 },
  gaps: [
    { id: 'P-D-DR01', kind: 'domain_rule', missing: 'proves' },
    { id: 'P-D-DR02', kind: 'domain_rule', missing: 'satisfies' },
    { id: 'P-D-DR02', kind: 'domain_rule', missing: 'proves' },
  ],
}];

export const testWorkspace = (): SpecData => fixture('graph', { problems: structuredClone(PROBLEMS), coverage: coverage() });

export const testIndex = () => indexOf(testWorkspace());

/** A second use case, P-D-UC02, with `count` requirements. */
function withReturns(count: number): SpecData {
  const w = testWorkspace();
  addRows(w, 'use_case', { id: 'P-D-UC02', title: 'Return a thing', domain_id: 'P-D' });
  for (let i = 1; i <= count; i++) addRows(w, 'requirement', { id: `P-D-UC02-R0${i}`, title: `Return rule ${i}`, use_case_id: 'P-D-UC02', statement: `Return rule ${i} MUST hold.` });
  return w;
}

/**
 * The test workspace with a second use case that has six requirements and an open question: more
 * than one kind of child, so it reaches them through groups.
 */
export function groupedWorkspace(): SpecData {
  return addRows(withReturns(6), 'question', { id: 'P-D-UC02-Q01', title: 'Can a thing come back broken?', product_id: 'P', domain_id: 'P-D', use_case_id: 'P-D-UC02', owner: 'Ana' });
}

/** The test workspace with a second use case that has seven requirements and nothing else: one kind, so no groups. */
export const manyOfOneKindWorkspace = (): SpecData => withReturns(7);

/** A map's groups of siblings (LA-EXP-DR58): its roots, then each parent's children, in the tree's order. */
export function siblingGroups<N extends { children: readonly string[] }>(map: { roots: readonly string[]; nodes: ReadonlyMap<string, N> }): N[][] {
  const groups = [map.roots.map((id) => map.nodes.get(id)!)];
  for (const n of map.nodes.values()) if (n.children.length > 0) groups.push(n.children.map((id) => map.nodes.get(id)!));
  return groups;
}
