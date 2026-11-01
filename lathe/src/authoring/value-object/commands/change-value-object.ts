import { column, parts, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { ValueObjectRow } from '../../../platform/data/tables.ts';
import { FIELD_COLUMNS, type ValueObjectField } from '../model.ts';
import { CHANGE_VALUE_OBJECT_IDENTITY } from './identities.generated.ts';
import { changeValueObject } from './handlers.generated.ts';

/** The value object's changes: a column given is set; fields, when given, replace the list. */
export type ChangeValueObject = Pick<ValueObjectRow, 'id'> & { title?: ValueObjectRow['title']; description?: ValueObjectRow['description']; fields?: ValueObjectField[] };

export const CHANGE_VALUE_OBJECT = {
  ...CHANGE_VALUE_OBJECT_IDENTITY,
  input: {
    id: column('value_object', 'id', 'required'),
    title: column('value_object', 'title', 'optional'),
    description: column('value_object', 'description', 'optional'),
    fields: parts('value_object_field', FIELD_COLUMNS, "Its fields in order, each a name, what it means, exactly one type (a basic type, another value object or an aggregate), whether it is required, and its column's name and an example when they help. Replaces the list.", 'optional'),
  },
  handler: changeValueObject,
} satisfies CommandDefinition<ChangeValueObject>;
