import { column, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import { ToolingRepository } from '../repository.ts';
import { REMOVE_TOOLING_IDENTITY } from './identities.generated.ts';

/** The tooling record to remove. */
export type RemoveTooling = { id: string };

export const REMOVE_TOOLING = {
  ...REMOVE_TOOLING_IDENTITY,
  input: {
    id: column('tooling', 'id', 'required'),
  },
  handler: removeTooling,
} satisfies CommandDefinition<RemoveTooling>;

/** Removes the tooling record whole. */
export function removeTooling(tx: Transaction, input: RemoveTooling): void {
  const records = new ToolingRepository(tx);
  const record = records.load(input.id) ?? tx.refuse('missing', `there is no tooling ${input.id}`);
  records.remove(record);
}
