import { column, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import { TableRepository } from '../repository.ts';
import { REMOVE_TABLE_IDENTITY } from './identities.generated.ts';

/** The table to remove. */
export type RemoveTable = { id: string };

export const REMOVE_TABLE = {
  ...REMOVE_TABLE_IDENTITY,
  input: {
    id: column('table', 'id', 'required'),
  },
  handler: removeTable,
} satisfies CommandDefinition<RemoveTable>;

/** Removes the table whole. */
export function removeTable(tx: Transaction, input: RemoveTable): void {
  const tables = new TableRepository(tx);
  const table = tables.load(input.id) ?? tx.refuse('missing', `there is no table ${input.id}`);
  tables.remove(table);
}
