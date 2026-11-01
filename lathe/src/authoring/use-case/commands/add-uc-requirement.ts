import { column, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import type { UcRequirementRow } from '../../../platform/data/tables.ts';
import { UseCaseRepository } from '../repository.ts';
import { holdToRules } from '../rules.ts';
import { ADD_UC_REQUIREMENT_IDENTITY } from './identities.generated.ts';

/** A new UC requirement. */
export type AddUcRequirement = Pick<UcRequirementRow, 'id' | 'title' | 'use_case_id' | 'statement' | 'group_name'>;

export const ADD_UC_REQUIREMENT: CommandDefinition<AddUcRequirement> = {
  ...ADD_UC_REQUIREMENT_IDENTITY,
  input: {
    id: column('uc_requirement', 'id', 'required'),
    title: column('uc_requirement', 'title', 'required'),
    use_case_id: column('uc_requirement', 'use_case_id', 'required'),
    statement: column('uc_requirement', 'statement', 'required'),
    group_name: column('uc_requirement', 'group_name', 'optional'),
  },
  handler: addUcRequirement,
};

/** Adds the requirement to its use case. */
export function addUcRequirement(tx: Transaction, input: AddUcRequirement): void {
  const useCases = new UseCaseRepository(tx);
  const useCase = useCases.load(input.use_case_id) ?? tx.refuse('missing', `there is no use case ${input.use_case_id}`);
  useCase.requirements.push(input);
  holdToRules(tx, useCase);
  useCases.save(useCase);
}
