import { column, type CommandDefinition } from '../../../platform/commands/definition.ts';
import { toDomain } from '../../../platform/data/renames.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import type { EntryPointRow } from '../../../platform/data/tables.ts';
import { EntryPointRepository } from '../repository.ts';
import { MOVE_ENTRY_POINT_IDENTITY } from './identities.generated.ts';

/** The entry point and the domain it moves to. */
export type MoveEntryPoint = Pick<EntryPointRow, 'id' | 'domain_id'>;

export const MOVE_ENTRY_POINT = {
  ...MOVE_ENTRY_POINT_IDENTITY,
  input: {
    id: column('entry_point', 'id', 'required'),
    domain_id: column('entry_point', 'domain_id', 'required'),
  },
  handler: moveEntryPoint,
} satisfies CommandDefinition<MoveEntryPoint>;

export function moveEntryPoint(tx: Transaction, input: MoveEntryPoint): void {
  const entryPoints = new EntryPointRepository(tx);
  const entryPoint = entryPoints.load(input.id) ?? tx.refuse('missing', `there is no entry point ${input.id}`);
  const renames = toDomain(tx, { id: input.id, label: 'entry point', domainId: entryPoint.entryPoint.domain_id }, input.domain_id);
  entryPoint.entryPoint = { ...entryPoint.entryPoint, domain_id: input.domain_id };
  entryPoints.save(entryPoint);
  entryPoints.carryRenames(renames);
}
