// Change a UC requirement (LA-AUT-CMD105): Changes a UC requirement's title, statement or group.
import { column, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import type { UcRequirementRow } from '../../../platform/data/tables.ts';
import { changed, USE_CASE_SLICE } from '../model.ts';
import { UseCaseRepository } from '../repository.ts';
import { holdToRules } from '../rules.ts';

/** The requirement's changes: a column given is set, null clears an optional one. */
export type ChangeUcRequirement = Pick<UcRequirementRow, 'id'> & { title?: string; statement?: string; group_name?: string | null };

/** Change a UC requirement (LA-AUT-CMD105). */
export const CHANGE_UC_REQUIREMENT: CommandDefinition<ChangeUcRequirement> = {
  id: 'LA-AUT-CMD105',
  slice: USE_CASE_SLICE,
  name: 'change-uc-requirement',
  description: "Changes a UC requirement's title, statement or group.",
  method: 'POST',
  route: '/api/use-case/change-uc-requirement',
  input: {
    id: column('uc_requirement', 'id', 'required'),
    title: column('uc_requirement', 'title', 'optional'),
    statement: column('uc_requirement', 'statement', 'optional'),
    group_name: column('uc_requirement', 'group_name', 'clearable'),
  },
  handler: changeUcRequirement,
};

/** Changes the requirement's own columns. */
export function changeUcRequirement(tx: Transaction, input: ChangeUcRequirement): void {
  const useCases = new UseCaseRepository(tx);
  const useCase = useCases.loadHolding('uc_requirement', input.id) ?? tx.refuse('missing', `there is no UC requirement ${input.id}`);
  useCase.requirements = useCase.requirements.map((r) => (r.id === input.id ? changed(r, input, ['title', 'statement', 'group_name']) : r));
  holdToRules(tx, useCase);
  useCases.save(useCase);
}
