import { column, ids, parts, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { EntityRow } from '../../../platform/data/tables.ts';
import type { EntityFieldInput } from '../model.ts';
import { ADD_ENTITY_IDENTITY } from './identities.generated.ts';
import { addEntity } from './handlers.generated.ts';

export type AddEntity = Pick<EntityRow, 'id' | 'title' | 'aggregate_id' | 'role' | 'in_root_table' | 'description'> & {
  fields?: EntityFieldInput[];
  has_one?: string[];
  has_many?: string[];
};

export const ADD_ENTITY = {
  ...ADD_ENTITY_IDENTITY,
  input: {
    id: column('entity', 'id', 'required'),
    title: column('entity', 'title', 'required'),
    aggregate_id: column('entity', 'aggregate_id', 'required'),
    role: column('entity', 'role', 'required'),
    in_root_table: column('entity', 'in_root_table', 'optional'),
    description: column('entity', 'description', 'required'),
    fields: parts('entity_field', ['name', 'meaning', 'type', 'type_value_object_id', 'type_aggregate_id', 'required', 'column_name', 'example'], 'Its fields, in order: each its name, meaning, one type (a basic type, a value object or an aggregate), whether it is required, and its column name and an example when it has them.', 'optional'),
    has_one: ids('The entities of its aggregate it holds exactly one of.', 'optional'),
    has_many: ids('The entities of its aggregate it holds any number of.', 'optional'),
  },
  handler: addEntity,
} satisfies CommandDefinition<AddEntity>;
