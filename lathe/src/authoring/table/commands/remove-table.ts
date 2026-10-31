import { column, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import { TABLE_SLICE } from '../model.ts';
import { TableRepository } from '../repository.ts';

/** The table to remove. */
export type RemoveTable = { id: string };

export const REMOVE_TABLE: CommandDefinition<RemoveTable> = {
  id: 'LA-AUT-CMD303',
  slice: TABLE_SLICE,
  name: 'remove-table',
  description: "Removes a table whole: its keys, and the links and packages it names. Refused while anything else references it, such as another table's foreign key.",
  method: 'POST',
  route: '/api/table/remove-table',
  input: {
    id: column('table', 'id', 'required'),
  },
  handler: removeTable,
};

/** Removes the table whole. */
export function removeTable(tx: Transaction, input: RemoveTable): void {
  const tables = new TableRepository(tx);
  const table = tables.load(input.id) ?? tx.refuse('missing', `there is no table ${input.id}`);
  tables.remove(table);
}
