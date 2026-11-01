import { column, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import { UseCaseRepository } from '../repository.ts';
import { REMOVE_USE_CASE_IDENTITY } from './identities.generated.ts';

/** The use case to remove. */
export type RemoveUseCase = { id: string };

export const REMOVE_USE_CASE = {
  ...REMOVE_USE_CASE_IDENTITY,
  input: {
    id: column('use_case', 'id', 'required'),
  },
  handler: removeUseCase,
} satisfies CommandDefinition<RemoveUseCase>;

/** Removes the use case whole. */
export function removeUseCase(tx: Transaction, input: RemoveUseCase): void {
  const useCases = new UseCaseRepository(tx);
  const useCase = useCases.load(input.id) ?? tx.refuse('missing', `there is no use case ${input.id}`);
  useCases.remove(useCase);
}
