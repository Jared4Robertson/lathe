// Remove a UC requirement (LA-AUT-CMD106): Removes a UC requirement with its use case tests and the links they start. Refused while a step fulfills it, or anything else references it or its tests.
import { column, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import { USE_CASE_SLICE } from '../model.ts';
import { UseCaseRepository } from '../repository.ts';

/** The requirement to remove. */
export type RemoveUcRequirement = { id: string };

/** Remove a UC requirement (LA-AUT-CMD106). */
export const REMOVE_UC_REQUIREMENT: CommandDefinition<RemoveUcRequirement> = {
  id: 'LA-AUT-CMD106',
  slice: USE_CASE_SLICE,
  name: 'remove-uc-requirement',
  description: 'Removes a UC requirement with its use case tests and the links they start. Refused while a step fulfills it, or anything else references it or its tests.',
  method: 'POST',
  route: '/api/use-case/remove-uc-requirement',
  input: {
    id: column('uc_requirement', 'id', 'required'),
  },
  handler: removeUcRequirement,
};

/** Removes the requirement and its tests from its use case. */
export function removeUcRequirement(tx: Transaction, input: RemoveUcRequirement): void {
  const useCases = new UseCaseRepository(tx);
  const useCase = useCases.loadHolding('uc_requirement', input.id) ?? tx.refuse('missing', `there is no UC requirement ${input.id}`);
  useCase.requirements = useCase.requirements.filter((r) => r.id !== input.id);
  useCase.useCaseTests = useCase.useCaseTests.filter((t) => t.row.uc_requirement_id !== input.id);
  useCases.save(useCase);
}
