// Generated from data/ by `npm run generate`. Do not edit.
// The table commands' inputs, by route, from their definitions: what the editors' forms are drawn from.
import type { InputFields } from '../../edit/command-form';

export const TABLE_FIELDS = {
  '/api/table/add-table': {
    id: { kind: 'column', table: 'table', column: 'id', required: true, clearable: false },
    title: { kind: 'column', table: 'table', column: 'title', required: true, clearable: false },
    entity_id: { kind: 'column', table: 'table', column: 'entity_id', required: false, clearable: false },
    read_model_id: { kind: 'column', table: 'table', column: 'read_model_id', required: false, clearable: false },
    domain_id: { kind: 'column', table: 'table', column: 'domain_id', required: false, clearable: false },
    name: { kind: 'column', table: 'table', column: 'name', required: true, clearable: false },
    storage: { kind: 'column', table: 'table', column: 'storage', required: true, clearable: false },
    file: { kind: 'column', table: 'table', column: 'file', required: false, clearable: false },
    keys: { kind: 'parts', table: 'table_key', columns: ['type', 'columns', 'name', 'invariant_id', 'target_table_id', 'condition'], description: 'Its keys in order: one primary at most, a unique key with the invariant it enforces (and a condition for a partial one), a foreign key with the table it points at, or an index. Only a table in a database has keys.', required: false, clearable: false },
    stored_in: { kind: 'id', description: 'The data store it is kept in.', required: false, clearable: false },
    meets: { kind: 'ids', description: 'The standard rules it meets.', required: false, clearable: false },
    packages: { kind: 'texts', description: 'The packages it uses, by their names in the product\'s package.json files.', required: false, clearable: false },
  },
  '/api/table/change-table': {
    id: { kind: 'column', table: 'table', column: 'id', required: true, clearable: false },
    title: { kind: 'column', table: 'table', column: 'title', required: false, clearable: false },
    name: { kind: 'column', table: 'table', column: 'name', required: false, clearable: false },
    storage: { kind: 'column', table: 'table', column: 'storage', required: false, clearable: false },
    file: { kind: 'column', table: 'table', column: 'file', required: false, clearable: true },
    keys: { kind: 'parts', table: 'table_key', columns: ['type', 'columns', 'name', 'invariant_id', 'target_table_id', 'condition'], description: 'Its keys in order: one primary at most, a unique key with the invariant it enforces (and a condition for a partial one), a foreign key with the table it points at, or an index. Only a table in a database has keys. Replaces the list.', required: false, clearable: false },
    stored_in: { kind: 'id', description: 'The data store it is kept in.', required: false, clearable: true },
    meets: { kind: 'ids', description: 'The standard rules it meets. Replaces the list.', required: false, clearable: false },
    packages: { kind: 'texts', description: 'The packages it uses, by their names in the product\'s package.json files. Replaces the list.', required: false, clearable: false },
  },
  '/api/table/move-table': {
    id: { kind: 'column', table: 'table', column: 'id', required: true, clearable: false },
    entity_id: { kind: 'column', table: 'table', column: 'entity_id', required: false, clearable: false },
    read_model_id: { kind: 'column', table: 'table', column: 'read_model_id', required: false, clearable: false },
    domain_id: { kind: 'column', table: 'table', column: 'domain_id', required: false, clearable: false },
  },
  '/api/table/remove-table': {
    id: { kind: 'column', table: 'table', column: 'id', required: true, clearable: false },
  },
} as const satisfies Record<string, InputFields>;
