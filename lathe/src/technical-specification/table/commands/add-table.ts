import { column, id, ids, parts, texts, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { TableRow } from '../../../platform/data/tables.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import { KEY_COLUMNS, type TableKey } from '../model.ts';
import { TableRepository } from '../repository.ts';
import { holdToRules } from '../rules.ts';
import { ADD_TABLE_IDENTITY } from './identities.generated.ts';

export type AddTable = Pick<TableRow, 'id' | 'title' | 'entity_id' | 'read_model_id' | 'domain_id' | 'name' | 'storage' | 'file'> & { keys?: TableKey[]; stored_in?: string; meets?: string[]; packages?: string[]; helpers?: string[] };

export const ADD_TABLE = {
  ...ADD_TABLE_IDENTITY,
  input: {
    id: column('table', 'id', 'required'),
    title: column('table', 'title', 'required'),
    entity_id: column('table', 'entity_id', 'optional'),
    read_model_id: column('table', 'read_model_id', 'optional'),
    domain_id: column('table', 'domain_id', 'optional'),
    name: column('table', 'name', 'required'),
    storage: column('table', 'storage', 'required'),
    file: column('table', 'file', 'optional'),
    keys: parts('table_key', KEY_COLUMNS, 'Its keys in order: one primary at most, a unique key with the invariant it enforces (and a condition for a partial one), a foreign key with the table it points at, or an index. Only a table in a database has keys.', 'optional'),
    stored_in: id('The data store it is kept in.', 'optional'),
    meets: ids('The standard rules it meets.', 'optional'),
    packages: texts("The packages it uses, by their names in the product's package.json files.", 'optional'),
    helpers: texts('The helper files its code is split across beside its file, such as helpers and build-tag variants, each from the product root; no other record names one.', 'optional'),
  },
  handler: addTable,
} satisfies CommandDefinition<AddTable>;

/** Adds the table, whole and new, under exactly one entity, read model or domain: a rule the schema's CHECK backs up, refused here first with the count given. */
export function addTable(tx: Transaction, input: AddTable): void {
  const tables = new TableRepository(tx);
  const given = [input.entity_id, input.read_model_id, input.domain_id].filter((p) => p !== undefined).length;
  if (given !== 1) tx.refuse('parent', `table ${input.id} sits under exactly one entity, read model or domain; ${given} are given`);
  const { keys = [], stored_in, meets = [], packages = [], helpers = [], ...row } = input;
  const table = tables.create({ root: row.id, table: row, keys, storedIn: stored_in ?? null, meets, packages, helpers });
  holdToRules(tx, table);
  tables.save(table);
}
