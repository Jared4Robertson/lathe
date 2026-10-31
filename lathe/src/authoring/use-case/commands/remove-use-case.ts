import { column, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import { USE_CASE_SLICE } from '../model.ts';
import { UseCaseRepository } from '../repository.ts';

/** The use case to remove. */
export type RemoveUseCase = { id: string };

export const REMOVE_USE_CASE: CommandDefinition<RemoveUseCase> = {
  id: 'LA-AUT-CMD103',
  slice: USE_CASE_SLICE,
  name: 'remove-use-case',
  description: 'Removes a use case whole: its actors, requirements, flows, steps, tests and the links they start. Refused while anything outside it references what is in it.',
  method: 'POST',
  route: '/api/use-case/remove-use-case',
  input: {
    id: column('use_case', 'id', 'required'),
  },
  handler: removeUseCase,
};

/** Removes the use case whole. */
export function removeUseCase(tx: Transaction, input: RemoveUseCase): void {
  const useCases = new UseCaseRepository(tx);
  const useCase = useCases.load(input.id) ?? tx.refuse('missing', `there is no use case ${input.id}`);
  useCases.remove(useCase);
}
