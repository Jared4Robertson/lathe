import { column, type CommandDefinition } from '../../../platform/commands/definition.ts';
import { toDomain } from '../../../platform/data/renames.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import type { UseCaseRow } from '../../../platform/data/tables.ts';
import { UseCaseRepository } from '../repository.ts';
import { holdToRules } from '../rules.ts';
import { MOVE_USE_CASE_IDENTITY } from './identities.generated.ts';

/** The use case and the capability it moves to. */
export type MoveUseCase = Pick<UseCaseRow, 'id' | 'capability_id'>;

export const MOVE_USE_CASE = {
  ...MOVE_USE_CASE_IDENTITY,
  input: {
    id: column('use_case', 'id', 'required'),
    capability_id: column('use_case', 'capability_id', 'required'),
  },
  handler: moveUseCase,
} satisfies CommandDefinition<MoveUseCase>;

/** Puts the use case under the other capability: what is in it keeps its IDs in its domain, and takes the new domain's in another. */
export function moveUseCase(tx: Transaction, input: MoveUseCase): void {
  const useCases = new UseCaseRepository(tx);
  const useCase = useCases.load(input.id) ?? tx.refuse('missing', `there is no use case ${input.id}`);
  if (useCase.useCase.capability_id === input.capability_id) tx.refuse('parent', `${input.id} is already under ${input.capability_id}`);
  const from = String(tx.record(useCase.useCase.capability_id)?.row.domain_id);
  const capability = tx.record(input.capability_id);
  if (capability?.kind !== 'capability') tx.refuse('missing', `there is no capability ${input.capability_id}`);
  const to = String(capability.row.domain_id);
  const renames = from === to ? new Map<string, string>() : toDomain(tx, { id: input.id, label: 'use case', domainId: from }, to);
  useCase.useCase = { ...useCase.useCase, capability_id: input.capability_id };
  holdToRules(tx, useCase);
  useCases.save(useCase);
  useCases.carryRenames(renames);
}
