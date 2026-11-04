// Generated from data/ by `npm run generate`. Do not edit.
// The table commands whose handler is the pattern: load the table, add, change or remove one record with the
// input's columns and lists, hold it to its rules, and save. Each definition takes its handler from here.
import { changed } from '../../../platform/data/rows.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import { TableRepository } from '../repository.ts';
import { holdToRules } from '../rules.ts';
import type { ChangeTable } from './change-table.ts';
import type { RemoveTable } from './remove-table.ts';

/** Changes a table's title, name, storage or file, its keys (the whole list, in order), the data store it is kept in (null clears it), or the standard rules it meets, the packages it uses or its helper files (each the whole list). Its parent changes only by a move. */
export function changeTable(tx: Transaction, input: ChangeTable): void {
  const tables = new TableRepository(tx);
  const table = tables.load(input.id) ?? tx.refuse('missing', `there is no table ${input.id}`);
  table.table = changed(table.table, input, ['title', 'name', 'storage', 'file']);
  table.meets = input.meets ?? table.meets;
  table.packages = input.packages ?? table.packages;
  table.helpers = input.helpers ?? table.helpers;
  table.keys = input.keys ?? table.keys;
  table.storedIn = input.stored_in === undefined ? table.storedIn : input.stored_in;
  holdToRules(tx, table);
  tables.save(table);
}

/** Removes a table whole: its keys, and the links, packages and helper files it names. Refused while anything else references it, such as another table's foreign key. */
export function removeTable(tx: Transaction, input: RemoveTable): void {
  const tables = new TableRepository(tx);
  const table = tables.load(input.id) ?? tx.refuse('missing', `there is no table ${input.id}`);
  tables.remove(table);
}
