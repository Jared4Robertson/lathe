import { column, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import { UseCaseRepository } from '../repository.ts';
import { REMOVE_FLOW_TEST_IDENTITY } from './identities.generated.ts';

/** The test to remove. */
export type RemoveFlowTest = { id: string };

export const REMOVE_FLOW_TEST = {
  ...REMOVE_FLOW_TEST_IDENTITY,
  input: {
    id: column('flow_test', 'id', 'required'),
  },
  handler: removeFlowTest,
} satisfies CommandDefinition<RemoveFlowTest>;

/** Removes the test from its flow. */
export function removeFlowTest(tx: Transaction, input: RemoveFlowTest): void {
  const useCases = new UseCaseRepository(tx);
  const useCase = useCases.loadHolding('flow_test', input.id) ?? tx.refuse('missing', `there is no flow test ${input.id}`);
  useCase.flowTests = useCase.flowTests.filter((t) => t.row.id !== input.id);
  useCases.save(useCase);
}
