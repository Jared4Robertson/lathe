import { column, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import { USE_CASE_SLICE } from '../model.ts';
import { UseCaseRepository } from '../repository.ts';

/** The step to remove. */
export type RemoveFlowStep = { id: string };

export const REMOVE_FLOW_STEP: CommandDefinition<RemoveFlowStep> = {
  id: 'LA-AUT-CMD112',
  slice: USE_CASE_SLICE,
  name: 'remove-flow-step',
  description: 'Removes a flow step with the links it starts. Refused while anything else references it.',
  method: 'POST',
  route: '/api/use-case/remove-flow-step',
  input: {
    id: column('flow_step', 'id', 'required'),
  },
  handler: removeFlowStep,
};

/** Removes the step from its flow. */
export function removeFlowStep(tx: Transaction, input: RemoveFlowStep): void {
  const useCases = new UseCaseRepository(tx);
  const useCase = useCases.loadHolding('flow_step', input.id) ?? tx.refuse('missing', `there is no flow step ${input.id}`);
  useCase.steps = useCase.steps.filter((s) => s.row.id !== input.id);
  useCases.save(useCase);
}
