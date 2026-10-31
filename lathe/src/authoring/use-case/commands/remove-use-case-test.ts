import { column, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import { USE_CASE_SLICE } from '../model.ts';
import { UseCaseRepository } from '../repository.ts';

/** The test to remove. */
export type RemoveUseCaseTest = { id: string };

export const REMOVE_USE_CASE_TEST: CommandDefinition<RemoveUseCaseTest> = {
  id: 'LA-AUT-CMD115',
  slice: USE_CASE_SLICE,
  name: 'remove-use-case-test',
  description: 'Removes a use case test with the links it starts. Refused while anything else references it, such as a business outcome it measures.',
  method: 'POST',
  route: '/api/use-case/remove-use-case-test',
  input: {
    id: column('use_case_test', 'id', 'required'),
  },
  handler: removeUseCaseTest,
};

/** Removes the test from its UC requirement. */
export function removeUseCaseTest(tx: Transaction, input: RemoveUseCaseTest): void {
  const useCases = new UseCaseRepository(tx);
  const useCase = useCases.loadHolding('use_case_test', input.id) ?? tx.refuse('missing', `there is no use case test ${input.id}`);
  useCase.useCaseTests = useCase.useCaseTests.filter((t) => t.row.id !== input.id);
  useCases.save(useCase);
}
