import { column, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import { USE_CASE_SLICE } from '../model.ts';
import { UseCaseRepository } from '../repository.ts';

/** The test to remove. */
export type RemoveFlowTest = { id: string };

export const REMOVE_FLOW_TEST: CommandDefinition<RemoveFlowTest> = {
  id: 'LA-AUT-CMD118',
  slice: USE_CASE_SLICE,
  name: 'remove-flow-test',
  description: 'Removes a flow test with the links it starts. Refused while anything else references it, such as a business outcome it measures.',
  method: 'POST',
  route: '/api/use-case/remove-flow-test',
  input: {
    id: column('flow_test', 'id', 'required'),
  },
  handler: removeFlowTest,
};

/** Removes the test from its flow. */
export function removeFlowTest(tx: Transaction, input: RemoveFlowTest): void {
  const useCases = new UseCaseRepository(tx);
  const useCase = useCases.loadHolding('flow_test', input.id) ?? tx.refuse('missing', `there is no flow test ${input.id}`);
  useCase.flowTests = useCase.flowTests.filter((t) => t.row.id !== input.id);
  useCases.save(useCase);
}
