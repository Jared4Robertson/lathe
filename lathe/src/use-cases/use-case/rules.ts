// The Use case aggregate's rules, written once: each command's handler runs them on the instance before it saves,
// and every load and commit runs them over all data (useCaseRules, listed in AGGREGATE_RULES).
import { beyondFirst, type AggregateRules, type ReadView, type RuleProblem } from '../../platform/data/rules.ts';
import type { Row } from '../../platform/data/rows.ts';
import type { FlowRow, FlowStepRow, FlowTestRow } from '../../platform/data/tables.ts';
import { StoreError } from '../../platform/data/problems.ts';
import { rolesNotOfProduct } from '../../product/product/rules.ts';
import type { Transaction } from '../../platform/data/transaction.ts';
import { USE_CASE_AGGREGATE, useCasesFrom, type UseCase } from './model.ts';

/** A step's link, as its row. */
interface StepLink {
  source_id: string;
  target_id: string;
}

/**
 * Every row that breaks LA-UCS-INV100: a use case has at most one flow and a flow at most one flow test; a flow step
 * invokes at most one command or query. Each after the first is refused.
 */
export function useCaseOneEach(flows: readonly FlowRow[], flowTests: readonly FlowTestRow[], invokes: readonly StepLink[]): RuleProblem[] {
  const problem = (table: string, row: object, message: string): RuleProblem => ({ rule: 'use-case-one-each', table, row: row as unknown as Row, message });
  return [
    ...beyondFirst(flows, (r) => r.use_case_id).map((r) => problem('flow', r, `use case ${r.use_case_id} already has its flow, so ${r.id} cannot be a second: a use case has one flow, the same through every interface`)),
    ...beyondFirst(flowTests, (r) => r.flow_id).map((r) => problem('flow_test', r, `flow ${r.flow_id} already has its test, so ${r.id} cannot be a second: a flow has one`)),
    ...beyondFirst(invokes, (r) => r.source_id).map((r) => problem('invokes', r, `step ${r.source_id} already invokes a command or query, so it cannot also invoke ${r.target_id}: a step invokes one`)),
  ];
}

/** The product a use case sits in, through its capability and domain, or undefined while either is missing. */
function productOf(useCase: UseCase, view: ReadView): string | undefined {
  const capability = view.record(useCase.useCase.capability_id);
  const domain = capability?.kind === 'capability' ? view.record(String(capability.row.domain_id)) : undefined;
  return domain?.kind === 'domain' ? String(domain.row.product_id) : undefined;
}

/**
 * Every rule the use case breaks (LA-UCS-INV100 one each, as useCaseOneEach says; LA-UCS-INV08 a step fulfills only
 * its own use case's requirements; LA-UCS-INV42 a flow's ID is its use case's and FL; LA-UCS-INV18 each step on a path
 * has its own position; LA-UCS-INV193 each actor is one of its product's roles). The view gives what the use case
 * names outside itself: the requirements its steps fulfill and its product's roles.
 */
export function useCaseProblems(useCase: UseCase, view: ReadView): RuleProblem[] {
  const problems: RuleProblem[] = [];
  const product = productOf(useCase, view);
  if (product !== undefined) {
    const actors = useCase.actors.map((role, at) => ({ use_case_id: useCase.root, position: at + 1, role_name: role }));
    problems.push(...rolesNotOfProduct(view, 'use_case_actor', `Use case ${useCase.root}`, product, actors, 'as its actor').map((p) => ({ rule: 'use-case-actor-role', ...p })));
  }
  const flows = new Map(useCase.flows.map((f) => [f.id, f]));
  for (const flow of useCase.flows) {
    const expected = `${flow.use_case_id}-FL`;
    if (flow.id !== expected) {
      problems.push({ rule: 'flow-id', table: 'flow', row: flow as unknown as Row, message: `${flow.id} is the flow of ${flow.use_case_id}, so its ID is ${expected}` });
    }
  }
  for (const step of useCase.steps) {
    const flow = flows.get(step.row.flow_id);
    if (!flow) continue;
    for (const target of step.fulfills) {
      const requirement = view.record(target);
      if (requirement?.kind !== 'uc_requirement' || requirement.row.use_case_id === useCase.root) continue;
      problems.push({
        rule: 'step-fulfills-own-use-case',
        table: 'fulfills',
        row: { source_id: step.row.id, target_id: target },
        message: `${step.row.id} is a step of the flow of ${useCase.root}, so it cannot fulfill ${target}, a requirement of ${requirement.row.use_case_id}`,
      });
    }
  }
  // LA-UCS-INV18: the steps on each path of a flow each have their own position; a path is compared trimmed and in any
  // letter case, and steps on different paths may share a position.
  const placed = new Map<string, FlowStepRow>();
  for (const { row } of useCase.steps) {
    const at = `${row.flow_id} ${row.path.trim().toLowerCase()} ${row.position}`;
    const holder = placed.get(at);
    if (holder === undefined) placed.set(at, row);
    else {
      problems.push({
        rule: 'step-position',
        table: 'flow_step',
        row: row as unknown as Row,
        message: `step ${holder.id} is at position ${row.position} of path ${holder.path.trim()} of ${row.flow_id}, so ${row.id} cannot be too: each step on a path has its own position`,
      });
    }
  }
  problems.push(
    ...useCaseOneEach(
      useCase.flows,
      useCase.flowTests.map((t) => t.row),
      useCase.steps.flatMap((s) => (s.invokes === null ? [] : [{ source_id: s.row.id, target_id: s.invokes }])),
    ),
  );
  return problems;
}

/** The rules over all data: every use case, whole. */
export const useCaseRules: AggregateRules = {
  aggregate: USE_CASE_AGGREGATE,
  check: (view) => [
    ...useCasesFrom((table) => view.rows(table)).flatMap((useCase) => useCaseProblems(useCase, view).filter((p) => p.rule !== 'use-case-one-each')),
    ...useCaseOneEach(
      view.rows('flow') as unknown as FlowRow[],
      view.rows('flow_test') as unknown as FlowTestRow[],
      view.rows('invokes') as unknown as StepLink[],
    ),
  ],
};

/** Refuses the command, with every reason, when the use case as it would be saved breaks one of its rules. */
export function holdToRules(tx: Transaction, useCase: UseCase): void {
  const problems = useCaseProblems(useCase, tx);
  if (problems.length) throw new StoreError(problems.map((p) => ({ rule: p.rule, table: p.table, message: p.message })));
}
