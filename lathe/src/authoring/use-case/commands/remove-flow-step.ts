import { column, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import { UseCaseRepository } from '../repository.ts';
import { REMOVE_FLOW_STEP_IDENTITY } from './identities.generated.ts';

/** The step to remove. */
export type RemoveFlowStep = { id: string };

export const REMOVE_FLOW_STEP: CommandDefinition<RemoveFlowStep> = {
  ...REMOVE_FLOW_STEP_IDENTITY,
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
