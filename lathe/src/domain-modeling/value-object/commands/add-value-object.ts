import { column, parts, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { ValueObjectRow } from '../../../platform/data/tables.ts';
import { FIELD_COLUMNS, type ValueObjectField } from '../model.ts';
import { ADD_VALUE_OBJECT_IDENTITY } from './identities.generated.ts';
import { addValueObject } from './handlers.generated.ts';

export type AddValueObject = Pick<ValueObjectRow, 'id' | 'title' | 'description'> & { fields?: ValueObjectField[] };

export const ADD_VALUE_OBJECT = {
  ...ADD_VALUE_OBJECT_IDENTITY,
  input: {
    id: column('value_object', 'id', 'required'),
    title: column('value_object', 'title', 'required'),
    description: column('value_object', 'description', 'required'),
    fields: parts('value_object_field', FIELD_COLUMNS, "Its fields in order, each a name, what it means, exactly one type (a basic type, another value object or an aggregate), whether it is required, and its column's name and an example when they help.", 'optional'),
  },
  handler: addValueObject,
} satisfies CommandDefinition<AddValueObject>;
