import { column, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import type { FlowRow } from '../../../platform/data/tables.ts';
import { USE_CASE_SLICE } from '../model.ts';
import { UseCaseRepository } from '../repository.ts';
import { holdToRules } from '../rules.ts';

/** A new flow. */
export type AddFlow = Pick<FlowRow, 'id' | 'title' | 'use_case_id' | 'interface_id'>;

export const ADD_FLOW: CommandDefinition<AddFlow> = {
  id: 'LA-AUT-CMD107',
  slice: USE_CASE_SLICE,
  name: 'add-flow',
  description: "Adds a flow to its use case, through one interface of its product: its ID ends in the interface's number.",
  method: 'POST',
  route: '/api/use-case/add-flow',
  input: {
    id: column('flow', 'id', 'required'),
    title: column('flow', 'title', 'required'),
    use_case_id: column('flow', 'use_case_id', 'required'),
    interface_id: column('flow', 'interface_id', 'required'),
  },
  handler: addFlow,
};

/** Adds the flow to its use case. */
export function addFlow(tx: Transaction, input: AddFlow): void {
  const useCases = new UseCaseRepository(tx);
  const useCase = useCases.load(input.use_case_id) ?? tx.refuse('missing', `there is no use case ${input.use_case_id}`);
  useCase.flows.push(input);
  holdToRules(tx, useCase);
  useCases.save(useCase);
}
