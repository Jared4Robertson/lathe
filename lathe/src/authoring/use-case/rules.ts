// The Use case aggregate's rules, written once: each command's handler runs them on the instance before it saves,
// and every load and commit runs them over all data (useCaseRules, listed in AGGREGATE_RULES).
import { beyondFirst, type AggregateRules, type ReadView, type RuleProblem } from '../../platform/data/rules.ts';
import type { Row } from '../../platform/data/rows.ts';
import type { FlowRow, FlowTestRow } from '../../platform/data/tables.ts';
import { StoreError } from '../../platform/data/problems.ts';
import type { Transaction } from '../../platform/data/transaction.ts';
import { USE_CASE_AGGREGATE, useCasesFrom, type UseCase } from './model.ts';

/** A step's link, as its row. */
interface StepLink {
  source_id: string;
  target_id: string;
}

/**
 * Every row that breaks LA-AUT-INV100: a use case has at most one flow per interface and a flow at most one flow test;
 * a flow step invokes at most one command or query and happens in at most one view. Each after the first is refused.
 */
export function useCaseOneEach(flows: readonly FlowRow[], flowTests: readonly FlowTestRow[], invokes: readonly StepLink[], happensIn: readonly StepLink[]): RuleProblem[] {
  const problem = (table: string, row: object, message: string): RuleProblem => ({ rule: 'use-case-one-each', table, row: row as unknown as Row, message });
  return [
    ...beyondFirst(flows, (r) => `${r.use_case_id} ${r.interface_id}`).map((r) => problem('flow', r, `use case ${r.use_case_id} already has its flow through ${r.interface_id}, so ${r.id} cannot be a second: a use case has one flow per interface`)),
    ...beyondFirst(flowTests, (r) => r.flow_id).map((r) => problem('flow_test', r, `flow ${r.flow_id} already has its test, so ${r.id} cannot be a second: a flow has one`)),
    ...beyondFirst(invokes, (r) => r.source_id).map((r) => problem('invokes', r, `step ${r.source_id} already invokes a command or query, so it cannot also invoke ${r.target_id}: a step invokes one`)),
    ...beyondFirst(happensIn, (r) => r.source_id).map((r) => problem('happens_in', r, `step ${r.source_id} already happens in a view, so it cannot also happen in ${r.target_id}: a step happens in one`)),
  ];
}

/** The interface kinds whose flows' steps happen in no view: an API's, a CLI's and agent tools'. */
const VIEWLESS_INTERFACES = ['API', 'CLI', 'agent tools'];

/**
 * Every rule the use case breaks (LA-AUT-INV100 one each, as useCaseOneEach says; LA-AUT-INV08 a step fulfills only
 * its own use case's requirements; LA-AUT-INV42 a flow's ID names its interface; LA-AUT-INV43 a step of an API, CLI or
 * agent tools flow happens in no view). The view gives what the use case names outside itself: its flows' interfaces and the requirements its steps fulfill.
 */
export function useCaseProblems(useCase: UseCase, view: ReadView): RuleProblem[] {
  const problems: RuleProblem[] = [];
  const flows = new Map(useCase.flows.map((f) => [f.id, f]));
  for (const flow of useCase.flows) {
    const number = /-IF([0-9]+)$/.exec(flow.interface_id)?.[1] ?? '';
    const expected = `${flow.use_case_id}-FL${number}`;
    if (flow.id !== expected) {
      problems.push({ rule: 'flow-id-interface', table: 'flow', row: flow as unknown as Row, message: `${flow.id} goes through ${flow.interface_id}, so its ID is ${expected}` });
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
    const face = view.record(flow.interface_id);
    if (step.happensIn !== null && face?.kind === 'interface' && VIEWLESS_INTERFACES.includes(String(face.row.kind))) {
      problems.push({
        rule: 'step-fits-interface',
        table: 'happens_in',
        row: { source_id: step.row.id, target_id: step.happensIn },
        message: `${step.row.id} is a step of ${flow.id}, which goes through ${flow.interface_id}, an interface of kind ${face.row.kind}, so it cannot happen in view ${step.happensIn}`,
      });
    }
  }
  problems.push(
    ...useCaseOneEach(
      useCase.flows,
      useCase.flowTests.map((t) => t.row),
      useCase.steps.flatMap((s) => (s.invokes === null ? [] : [{ source_id: s.row.id, target_id: s.invokes }])),
      useCase.steps.flatMap((s) => (s.happensIn === null ? [] : [{ source_id: s.row.id, target_id: s.happensIn }])),
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
      view.rows('happens_in') as unknown as StepLink[],
    ),
  ],
};

/** Refuses the command, with every reason, when the use case as it would be saved breaks one of its rules. */
export function holdToRules(tx: Transaction, useCase: UseCase): void {
  const problems = useCaseProblems(useCase, tx);
  if (problems.length) throw new StoreError(problems.map((p) => ({ rule: p.rule, table: p.table, message: p.message, command: 0 })));
}
