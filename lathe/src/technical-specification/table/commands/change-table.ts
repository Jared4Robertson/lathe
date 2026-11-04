import { column, id, ids, parts, texts, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { TableRow } from '../../../platform/data/tables.ts';
import { KEY_COLUMNS, type TableKey } from '../model.ts';
import { CHANGE_TABLE_IDENTITY } from './identities.generated.ts';
import { changeTable } from './handlers.generated.ts';

/** The table's changes: a column given is set, null clears an optional one; a list given replaces the list. */
export type ChangeTable = Pick<TableRow, 'id'> & { title?: TableRow['title']; name?: TableRow['name']; storage?: TableRow['storage']; file?: TableRow['file'] | null; keys?: TableKey[]; stored_in?: string | null; meets?: string[]; packages?: string[]; helpers?: string[] };

export const CHANGE_TABLE = {
  ...CHANGE_TABLE_IDENTITY,
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
    helpers: texts('The helper files its code is split across beside its file, each from the product root. Replaces the list.', 'optional'),
  },
  handler: changeTable,
} satisfies CommandDefinition<ChangeTable>;
