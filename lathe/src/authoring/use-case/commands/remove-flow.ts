import { column, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import { UseCaseRepository } from '../repository.ts';
import { REMOVE_FLOW_IDENTITY } from './identities.generated.ts';

/** The flow to remove. */
export type RemoveFlow = { id: string };

export const REMOVE_FLOW = {
  ...REMOVE_FLOW_IDENTITY,
  input: {
    id: column('flow', 'id', 'required'),
  },
  handler: removeFlow,
} satisfies CommandDefinition<RemoveFlow>;

/** Removes the flow, its steps and its test from its use case. */
export function removeFlow(tx: Transaction, input: RemoveFlow): void {
  const useCases = new UseCaseRepository(tx);
  const useCase = useCases.loadHolding('flow', input.id) ?? tx.refuse('missing', `there is no flow ${input.id}`);
  useCase.flows = useCase.flows.filter((f) => f.id !== input.id);
  useCase.steps = useCase.steps.filter((s) => s.row.flow_id !== input.id);
  useCase.flowTests = useCase.flowTests.filter((t) => t.row.flow_id !== input.id);
  useCases.save(useCase);
}
