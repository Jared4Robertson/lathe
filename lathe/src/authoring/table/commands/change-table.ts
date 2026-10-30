// Change a table (LA-AUT-CMD301): Changes a table's title, name, storage or file, its keys (the whole list, in order), the data store it is kept in (null clears it), or the standard rules it meets or packages it uses (each the whole list). Its parent changes only by a move.
import { column, id, ids, parts, texts, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import type { TableRow } from '../../../platform/data/tables.ts';
import { KEY_COLUMNS, TABLE_SLICE, changed, type TableKey } from '../model.ts';
import { TableRepository } from '../repository.ts';
import { holdToRules } from '../rules.ts';

/** The table's changes: a column given is set, null clears an optional one; a list given replaces the list. */
export type ChangeTable = Pick<TableRow, 'id'> & { title?: TableRow['title']; name?: TableRow['name']; storage?: TableRow['storage']; file?: TableRow['file'] | null; keys?: TableKey[]; stored_in?: string | null; meets?: string[]; packages?: string[] };

/** Change a table (LA-AUT-CMD301). */
export const CHANGE_TABLE: CommandDefinition<ChangeTable> = {
  id: 'LA-AUT-CMD301',
  slice: TABLE_SLICE,
  name: 'change-table',
  description: "Changes a table's title, name, storage or file, its keys (the whole list, in order), the data store it is kept in (null clears it), or the standard rules it meets or packages it uses (each the whole list). Its parent changes only by a move.",
  method: 'POST',
  route: '/api/table/change-table',
  input: {
    id: column('table', 'id', 'required'),
    title: column('table', 'title', 'optional'),
    name: column('table', 'name', 'optional'),
    storage: column('table', 'storage', 'optional'),
    file: column('table', 'file', 'clearable'),
    keys: parts('table_key', KEY_COLUMNS, 'Its keys in order: one primary at most, a unique key with the invariant it enforces (and a condition for a partial one), a foreign key with the table it points at, or an index. Only a table in a database has keys. Replaces the list.', 'optional'),
    stored_in: id('The data store it is kept in.', 'clearable'),
    meets: ids('The standard rules it meets. Replaces the list.', 'optional'),
    packages: texts("The packages it uses, by their names in the product's package.json files. Replaces the list.", 'optional'),
  },
  handler: changeTable,
};

/** Changes the table's columns, keys and links. */
export function changeTable(tx: Transaction, input: ChangeTable): void {
  const tables = new TableRepository(tx);
  const table = tables.load(input.id) ?? tx.refuse('missing', `there is no table ${input.id}`);
  table.table = changed(table.table, input, ['title', 'name', 'storage', 'file']);
  if (input.keys) table.keys = input.keys;
  if (input.stored_in !== undefined) table.storedIn = input.stored_in;
  if (input.meets) table.meets = input.meets;
  if (input.packages) table.packages = input.packages;
  holdToRules(tx, table);
  tables.save(table);
}
