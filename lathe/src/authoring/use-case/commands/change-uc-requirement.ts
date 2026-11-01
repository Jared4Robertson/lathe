import { column, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import type { UcRequirementRow } from '../../../platform/data/tables.ts';
import { changed } from '../model.ts';
import { UseCaseRepository } from '../repository.ts';
import { holdToRules } from '../rules.ts';
import { CHANGE_UC_REQUIREMENT_IDENTITY } from './identities.generated.ts';

/** The requirement's changes: a column given is set, null clears an optional one. */
export type ChangeUcRequirement = Pick<UcRequirementRow, 'id'> & { title?: string; statement?: string; group_name?: string | null };

export const CHANGE_UC_REQUIREMENT = {
  ...CHANGE_UC_REQUIREMENT_IDENTITY,
  input: {
    id: column('uc_requirement', 'id', 'required'),
    title: column('uc_requirement', 'title', 'optional'),
    statement: column('uc_requirement', 'statement', 'optional'),
    group_name: column('uc_requirement', 'group_name', 'clearable'),
  },
  handler: changeUcRequirement,
} satisfies CommandDefinition<ChangeUcRequirement>;

/** Changes the requirement's own columns. */
export function changeUcRequirement(tx: Transaction, input: ChangeUcRequirement): void {
  const useCases = new UseCaseRepository(tx);
  const useCase = useCases.loadHolding('uc_requirement', input.id) ?? tx.refuse('missing', `there is no UC requirement ${input.id}`);
  useCase.requirements = useCase.requirements.map((r) => (r.id === input.id ? changed(r, input, ['title', 'statement', 'group_name']) : r));
  holdToRules(tx, useCase);
  useCases.save(useCase);
}
