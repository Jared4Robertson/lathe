import { column, type CommandDefinition } from '../../../platform/commands/definition.ts';
import { toDomain } from '../../../platform/data/renames.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import type { ToolingRow } from '../../../platform/data/tables.ts';
import { ToolingRepository } from '../repository.ts';
import { MOVE_TOOLING_IDENTITY } from './identities.generated.ts';

/** The tooling and the domain it moves to. */
export type MoveTooling = Pick<ToolingRow, 'id' | 'domain_id'>;

export const MOVE_TOOLING = {
  ...MOVE_TOOLING_IDENTITY,
  input: {
    id: column('tooling', 'id', 'required'),
    domain_id: column('tooling', 'domain_id', 'required'),
  },
  handler: moveTooling,
} satisfies CommandDefinition<MoveTooling>;

export function moveTooling(tx: Transaction, input: MoveTooling): void {
  const toolings = new ToolingRepository(tx);
  const tooling = toolings.load(input.id) ?? tx.refuse('missing', `there is no tooling ${input.id}`);
  const renames = toDomain(tx, { id: input.id, label: 'tooling', domainId: tooling.tooling.domain_id }, input.domain_id);
  tooling.tooling = { ...tooling.tooling, domain_id: input.domain_id };
  toolings.save(tooling);
  toolings.carryRenames(renames);
}
