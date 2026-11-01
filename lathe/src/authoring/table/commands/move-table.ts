import { column, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import type { TableRow } from '../../../platform/data/tables.ts';
import { PARENT_COLUMNS } from '../model.ts';
import { TableRepository } from '../repository.ts';
import { holdToRules } from '../rules.ts';
import { MOVE_TABLE_IDENTITY } from './identities.generated.ts';

/** The table and the one parent it moves to. */
export type MoveTable = Pick<TableRow, 'id' | 'entity_id' | 'read_model_id' | 'domain_id'>;

export const MOVE_TABLE = {
  ...MOVE_TABLE_IDENTITY,
  input: {
    id: column('table', 'id', 'required'),
    entity_id: column('table', 'entity_id', 'optional'),
    read_model_id: column('table', 'read_model_id', 'optional'),
    domain_id: column('table', 'domain_id', 'optional'),
  },
  handler: moveTable,
} satisfies CommandDefinition<MoveTable>;

/** Puts the table under its new parent, clearing the one it had; its keys keep their places. */
export function moveTable(tx: Transaction, input: MoveTable): void {
  const tables = new TableRepository(tx);
  const table = tables.load(input.id) ?? tx.refuse('missing', `there is no table ${input.id}`);
  const given = PARENT_COLUMNS.filter((c) => input[c] !== undefined);
  if (given.length !== 1) tx.refuse('parent', `table ${input.id} moves under exactly one entity, read model or domain; ${given.length} are given`);
  const column = given[0];
  if (table.table[column] === input[column]) tx.refuse('parent', `${input.id} is already under ${input[column]}`);
  const { entity_id: _entity, read_model_id: _readModel, domain_id: _domain, ...rest } = table.table;
  table.table = { ...rest, [column]: input[column] };
  holdToRules(tx, table);
  tables.save(table);
}
