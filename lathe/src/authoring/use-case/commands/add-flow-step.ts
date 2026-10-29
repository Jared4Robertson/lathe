// Add a flow step (LA-AUT-CMD110): Adds a step to its flow, on a path at a position, with the requirements it fulfills, what it invokes, the view it happens in and the integrations it exchanges with.
import { column, id, ids, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import type { FlowStepRow } from '../../../platform/data/tables.ts';
import { USE_CASE_SLICE } from '../model.ts';
import { UseCaseRepository } from '../repository.ts';
import { holdToRules } from '../rules.ts';

/** A new flow step, with the links it starts. */
export type AddFlowStep = Pick<FlowStepRow, 'id' | 'title' | 'flow_id' | 'path' | 'position'> & {
  fulfills?: string[];
  invokes?: string;
  happens_in?: string;
  exchanges_with?: string[];
};

/** Add a flow step (LA-AUT-CMD110). */
export const ADD_FLOW_STEP: CommandDefinition<AddFlowStep> = {
  id: 'LA-AUT-CMD110',
  slice: USE_CASE_SLICE,
  name: 'add-flow-step',
  description: 'Adds a step to its flow, on a path at a position, with the requirements it fulfills, what it invokes, the view it happens in and the integrations it exchanges with.',
  method: 'POST',
  route: '/api/use-case/add-flow-step',
  input: {
    id: column('flow_step', 'id', 'required'),
    title: column('flow_step', 'title', 'required'),
    flow_id: column('flow_step', 'flow_id', 'required'),
    path: column('flow_step', 'path', 'required'),
    position: column('flow_step', 'position', 'required'),
    fulfills: ids('The UC requirements of its own use case it fulfills.', 'optional'),
    invokes: id('The command or query it invokes, if any.', 'optional'),
    happens_in: id('The view it happens in, if any: only on a web app, desktop or other interface.', 'optional'),
    exchanges_with: ids('The integrations it exchanges with.', 'optional'),
  },
  handler: addFlowStep,
};

/** Adds the step to its flow, with its links. */
export function addFlowStep(tx: Transaction, input: AddFlowStep): void {
  const useCases = new UseCaseRepository(tx);
  const useCase = useCases.loadHolding('flow', input.flow_id) ?? tx.refuse('missing', `there is no flow ${input.flow_id}`);
  const { fulfills = [], invokes, happens_in, exchanges_with = [], ...row } = input;
  useCase.steps.push({ row, fulfills, invokes: invokes ?? null, happensIn: happens_in ?? null, exchangesWith: exchanges_with });
  holdToRules(tx, useCase);
  useCases.save(useCase);
}
