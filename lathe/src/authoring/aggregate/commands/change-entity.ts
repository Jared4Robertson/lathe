import { column, ids, parts, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { EntityRow } from '../../../platform/data/tables.ts';
import type { EntityFieldInput } from '../model.ts';
import { CHANGE_ENTITY_IDENTITY } from './identities.generated.ts';
import { changeEntity } from './handlers.generated.ts';

/** The entity's changes: a column given is set, null clears an optional one; a list given replaces its list. */
export type ChangeEntity = Pick<EntityRow, 'id'> & {
  title?: string;
  role?: EntityRow['role'];
  in_root_table?: boolean | null;
  description?: string;
  fields?: EntityFieldInput[];
  has_one?: string[];
  has_many?: string[];
};

export const CHANGE_ENTITY = {
  ...CHANGE_ENTITY_IDENTITY,
  input: {
    id: column('entity', 'id', 'required'),
    title: column('entity', 'title', 'optional'),
    role: column('entity', 'role', 'optional'),
    in_root_table: column('entity', 'in_root_table', 'clearable'),
    description: column('entity', 'description', 'optional'),
    fields: parts('entity_field', ['name', 'meaning', 'type', 'type_value_object_id', 'type_aggregate_id', 'required', 'column_name', 'example'], 'Its fields, in order: each its name, meaning, one type (a basic type, a value object or an aggregate), whether it is required, and its column name and an example when it has them. Replaces the list.', 'optional'),
    has_one: ids('The entities of its aggregate it holds exactly one of. Replaces the list.', 'optional'),
    has_many: ids('The entities of its aggregate it holds any number of. Replaces the list.', 'optional'),
  },
  handler: changeEntity,
} satisfies CommandDefinition<ChangeEntity>;
