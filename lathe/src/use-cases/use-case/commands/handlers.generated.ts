// Generated from data/ by `npm run generate`. Do not edit.
// The use-case commands whose handler is the pattern: load the use case, add, change or remove one record with the
// input's columns and lists, hold it to its rules, and save. Each definition takes its handler from here.
import { changed } from '../../../platform/data/rows.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import { UseCaseRepository } from '../repository.ts';
import { holdToRules } from '../rules.ts';
import type { AddUseCase } from './add-use-case.ts';
import type { ChangeUseCase } from './change-use-case.ts';
import type { RemoveUseCase } from './remove-use-case.ts';
import type { AddUcRequirement } from './add-uc-requirement.ts';
import type { ChangeUcRequirement } from './change-uc-requirement.ts';
import type { RemoveUcRequirement } from './remove-uc-requirement.ts';
import type { AddFlow } from './add-flow.ts';
import type { ChangeFlow } from './change-flow.ts';
import type { RemoveFlow } from './remove-flow.ts';
import type { AddFlowStep } from './add-flow-step.ts';
import type { ChangeFlowStep } from './change-flow-step.ts';
import type { RemoveFlowStep } from './remove-flow-step.ts';
import type { AddUseCaseTest } from './add-use-case-test.ts';
import type { ChangeUseCaseTest } from './change-use-case-test.ts';
import type { RemoveUseCaseTest } from './remove-use-case-test.ts';
import type { AddFlowTest } from './add-flow-test.ts';
import type { ChangeFlowTest } from './change-flow-test.ts';
import type { RemoveFlowTest } from './remove-flow-test.ts';

/** Adds a use case under a capability, with its actors in order, the main actor first. */
export function addUseCase(tx: Transaction, input: AddUseCase): void {
  const useCases = new UseCaseRepository(tx);
  const { actors = [], ...row } = input;
  const useCase = useCases.create({ root: row.id, useCase: row, actors: actors, requirements: [], useCaseTests: [], flows: [], steps: [], flowTests: [] });
  holdToRules(tx, useCase);
  useCases.save(useCase);
}

/** Changes a use case's title, goal or notes, or its actors (the whole list, in order). Its capability changes only by Move a use case. */
export function changeUseCase(tx: Transaction, input: ChangeUseCase): void {
  const useCases = new UseCaseRepository(tx);
  const useCase = useCases.load(input.id) ?? tx.refuse('missing', `there is no use case ${input.id}`);
  useCase.useCase = changed(useCase.useCase, input, ['title', 'goal', 'notes']);
  useCase.actors = input.actors ?? useCase.actors;
  holdToRules(tx, useCase);
  useCases.save(useCase);
}

/** Removes a use case whole: its actors, requirements, flows, steps, tests and the links they start. Refused while anything outside it references what is in it. */
export function removeUseCase(tx: Transaction, input: RemoveUseCase): void {
  const useCases = new UseCaseRepository(tx);
  const useCase = useCases.load(input.id) ?? tx.refuse('missing', `there is no use case ${input.id}`);
  useCases.remove(useCase);
}

/** Adds a UC requirement to its use case. */
export function addUcRequirement(tx: Transaction, input: AddUcRequirement): void {
  const useCases = new UseCaseRepository(tx);
  const useCase = useCases.load(input.use_case_id) ?? tx.refuse('missing', `there is no use case ${input.use_case_id}`);
  useCase.requirements.push(input);
  holdToRules(tx, useCase);
  useCases.save(useCase);
}

/** Changes a UC requirement's title, statement or group. */
export function changeUcRequirement(tx: Transaction, input: ChangeUcRequirement): void {
  const useCases = new UseCaseRepository(tx);
  const useCase = useCases.loadHolding('uc_requirement', input.id) ?? tx.refuse('missing', `there is no UC requirement ${input.id}`);
  useCase.requirements = useCase.requirements.map((x) => (x.id === input.id ? changed(x, input, ['title', 'statement', 'group_name']) : x));
  holdToRules(tx, useCase);
  useCases.save(useCase);
}

/** Removes a UC requirement with its use case tests and the links they start. Refused while a step fulfills it, or anything else references it or its tests. */
export function removeUcRequirement(tx: Transaction, input: RemoveUcRequirement): void {
  const useCases = new UseCaseRepository(tx);
  const useCase = useCases.loadHolding('uc_requirement', input.id) ?? tx.refuse('missing', `there is no UC requirement ${input.id}`);
  useCase.requirements = useCase.requirements.filter((x) => x.id !== input.id);
  useCase.useCaseTests = useCase.useCaseTests.filter((x) => x.row.uc_requirement_id !== input.id);
  useCases.save(useCase);
}

/** Adds its use case's one flow: its ID is the use case's and FL. */
export function addFlow(tx: Transaction, input: AddFlow): void {
  const useCases = new UseCaseRepository(tx);
  const useCase = useCases.load(input.use_case_id) ?? tx.refuse('missing', `there is no use case ${input.use_case_id}`);
  useCase.flows.push(input);
  holdToRules(tx, useCase);
  useCases.save(useCase);
}

/** Changes a flow's title, which is its use case's. */
export function changeFlow(tx: Transaction, input: ChangeFlow): void {
  const useCases = new UseCaseRepository(tx);
  const useCase = useCases.loadHolding('flow', input.id) ?? tx.refuse('missing', `there is no flow ${input.id}`);
  useCase.flows = useCase.flows.map((x) => (x.id === input.id ? changed(x, input, ['title']) : x));
  holdToRules(tx, useCase);
  useCases.save(useCase);
}

/** Removes a flow with its steps, its flow test and the links they start. Refused while anything else references them. */
export function removeFlow(tx: Transaction, input: RemoveFlow): void {
  const useCases = new UseCaseRepository(tx);
  const useCase = useCases.loadHolding('flow', input.id) ?? tx.refuse('missing', `there is no flow ${input.id}`);
  useCase.flows = useCase.flows.filter((x) => x.id !== input.id);
  useCase.steps = useCase.steps.filter((x) => x.row.flow_id !== input.id);
  useCase.flowTests = useCase.flowTests.filter((x) => x.row.flow_id !== input.id);
  useCases.save(useCase);
}

/** Adds a step to its flow, on a path at a position, with the interface it is a variant of if only one does it, the requirements it fulfills, what it invokes and the integrations it exchanges with. */
export function addFlowStep(tx: Transaction, input: AddFlowStep): void {
  const useCases = new UseCaseRepository(tx);
  const useCase = useCases.loadHolding('flow', input.flow_id) ?? tx.refuse('missing', `there is no flow ${input.flow_id}`);
  const { fulfills = [], invokes, exchanges_with = [], ...row } = input;
  useCase.steps.push({ row, fulfills: fulfills, exchangesWith: exchanges_with, invokes: invokes ?? null });
  holdToRules(tx, useCase);
  useCases.save(useCase);
}

/** Changes a step's title or the interface it is a variant of (null makes it every interface's), or its links: a list given replaces the list, null clears what it invokes. Its path and position change only by Move a flow step. */
export function changeFlowStep(tx: Transaction, input: ChangeFlowStep): void {
  const useCases = new UseCaseRepository(tx);
  const useCase = useCases.loadHolding('flow_step', input.id) ?? tx.refuse('missing', `there is no flow step ${input.id}`);
  useCase.steps = useCase.steps.map((x) => (x.row.id === input.id ? { row: changed(x.row, input, ['title', 'interface_id']), fulfills: input.fulfills ?? x.fulfills, exchangesWith: input.exchanges_with ?? x.exchangesWith, invokes: input.invokes === undefined ? x.invokes : input.invokes } : x));
  holdToRules(tx, useCase);
  useCases.save(useCase);
}

/** Removes a flow step with the links it starts. Refused while anything else references it. */
export function removeFlowStep(tx: Transaction, input: RemoveFlowStep): void {
  const useCases = new UseCaseRepository(tx);
  const useCase = useCases.loadHolding('flow_step', input.id) ?? tx.refuse('missing', `there is no flow step ${input.id}`);
  useCase.steps = useCase.steps.filter((x) => x.row.id !== input.id);
  useCases.save(useCase);
}

/** Adds a use case test under its UC requirement, with the test data sets it starts from. */
export function addUseCaseTest(tx: Transaction, input: AddUseCaseTest): void {
  const useCases = new UseCaseRepository(tx);
  const useCase = useCases.loadHolding('uc_requirement', input.uc_requirement_id) ?? tx.refuse('missing', `there is no UC requirement ${input.uc_requirement_id}`);
  const { starts_from = [], ...row } = input;
  useCase.useCaseTests.push({ row, startsFrom: starts_from });
  holdToRules(tx, useCase);
  useCases.save(useCase);
}

/** Changes a use case test's way of running or the test data sets it starts from (the whole list). */
export function changeUseCaseTest(tx: Transaction, input: ChangeUseCaseTest): void {
  const useCases = new UseCaseRepository(tx);
  const useCase = useCases.loadHolding('use_case_test', input.id) ?? tx.refuse('missing', `there is no use case test ${input.id}`);
  useCase.useCaseTests = useCase.useCaseTests.map((x) => (x.row.id === input.id ? { row: changed(x.row, input, ['title', 'level', 'state', 'file', 'manual_reason', 'size', 'smoke', 'external', 'when', 'then', 'notes']), startsFrom: input.starts_from ?? x.startsFrom } : x));
  holdToRules(tx, useCase);
  useCases.save(useCase);
}

/** Removes a use case test with the links it starts. Refused while anything else references it, such as a business outcome it measures. */
export function removeUseCaseTest(tx: Transaction, input: RemoveUseCaseTest): void {
  const useCases = new UseCaseRepository(tx);
  const useCase = useCases.loadHolding('use_case_test', input.id) ?? tx.refuse('missing', `there is no use case test ${input.id}`);
  useCase.useCaseTests = useCase.useCaseTests.filter((x) => x.row.id !== input.id);
  useCases.save(useCase);
}

/** Adds a flow test under its flow, with the test data sets it starts from. */
export function addFlowTest(tx: Transaction, input: AddFlowTest): void {
  const useCases = new UseCaseRepository(tx);
  const useCase = useCases.loadHolding('flow', input.flow_id) ?? tx.refuse('missing', `there is no flow ${input.flow_id}`);
  const { starts_from = [], ...row } = input;
  useCase.flowTests.push({ row, startsFrom: starts_from });
  holdToRules(tx, useCase);
  useCases.save(useCase);
}

/** Changes a flow test's way of running or the test data sets it starts from (the whole list). */
export function changeFlowTest(tx: Transaction, input: ChangeFlowTest): void {
  const useCases = new UseCaseRepository(tx);
  const useCase = useCases.loadHolding('flow_test', input.id) ?? tx.refuse('missing', `there is no flow test ${input.id}`);
  useCase.flowTests = useCase.flowTests.map((x) => (x.row.id === input.id ? { row: changed(x.row, input, ['title', 'level', 'state', 'file', 'manual_reason', 'size', 'smoke', 'external', 'steps', 'expected_result', 'notes']), startsFrom: input.starts_from ?? x.startsFrom } : x));
  holdToRules(tx, useCase);
  useCases.save(useCase);
}

/** Removes a flow test with the links it starts. Refused while anything else references it, such as a business outcome it measures. */
export function removeFlowTest(tx: Transaction, input: RemoveFlowTest): void {
  const useCases = new UseCaseRepository(tx);
  const useCase = useCases.loadHolding('flow_test', input.id) ?? tx.refuse('missing', `there is no flow test ${input.id}`);
  useCase.flowTests = useCase.flowTests.filter((x) => x.row.id !== input.id);
  useCases.save(useCase);
}
