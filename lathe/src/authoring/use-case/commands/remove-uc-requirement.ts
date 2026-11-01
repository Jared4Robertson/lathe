import { column, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import { UseCaseRepository } from '../repository.ts';
import { REMOVE_UC_REQUIREMENT_IDENTITY } from './identities.generated.ts';

/** The requirement to remove. */
export type RemoveUcRequirement = { id: string };

export const REMOVE_UC_REQUIREMENT = {
  ...REMOVE_UC_REQUIREMENT_IDENTITY,
  input: {
    id: column('uc_requirement', 'id', 'required'),
  },
  handler: removeUcRequirement,
} satisfies CommandDefinition<RemoveUcRequirement>;

/** Removes the requirement and its tests from its use case. */
export function removeUcRequirement(tx: Transaction, input: RemoveUcRequirement): void {
  const useCases = new UseCaseRepository(tx);
  const useCase = useCases.loadHolding('uc_requirement', input.id) ?? tx.refuse('missing', `there is no UC requirement ${input.id}`);
  useCase.requirements = useCase.requirements.filter((r) => r.id !== input.id);
  useCase.useCaseTests = useCase.useCaseTests.filter((t) => t.row.uc_requirement_id !== input.id);
  useCases.save(useCase);
}
