import { column, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import { UseCaseRepository } from '../repository.ts';
import { REMOVE_USE_CASE_TEST_IDENTITY } from './identities.generated.ts';

/** The test to remove. */
export type RemoveUseCaseTest = { id: string };

export const REMOVE_USE_CASE_TEST = {
  ...REMOVE_USE_CASE_TEST_IDENTITY,
  input: {
    id: column('use_case_test', 'id', 'required'),
  },
  handler: removeUseCaseTest,
} satisfies CommandDefinition<RemoveUseCaseTest>;

/** Removes the test from its UC requirement. */
export function removeUseCaseTest(tx: Transaction, input: RemoveUseCaseTest): void {
  const useCases = new UseCaseRepository(tx);
  const useCase = useCases.loadHolding('use_case_test', input.id) ?? tx.refuse('missing', `there is no use case test ${input.id}`);
  useCase.useCaseTests = useCase.useCaseTests.filter((t) => t.row.id !== input.id);
  useCases.save(useCase);
}
