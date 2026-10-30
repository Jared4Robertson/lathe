// Change a value object (LA-AUT-CMD271): Changes a value object's title or description, or its fields (the whole list, in order).
import { column, parts, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import type { ValueObjectRow } from '../../../platform/data/tables.ts';
import { FIELD_COLUMNS, VALUE_OBJECT_SLICE, changed, type ValueObjectField } from '../model.ts';
import { ValueObjectRepository } from '../repository.ts';
import { holdToRules } from '../rules.ts';

/** The value object's changes: a column given is set; fields, when given, replace the list. */
export type ChangeValueObject = Pick<ValueObjectRow, 'id'> & { title?: ValueObjectRow['title']; description?: ValueObjectRow['description']; fields?: ValueObjectField[] };

/** Change a value object (LA-AUT-CMD271). */
export const CHANGE_VALUE_OBJECT: CommandDefinition<ChangeValueObject> = {
  id: 'LA-AUT-CMD271',
  slice: VALUE_OBJECT_SLICE,
  name: 'change-value-object',
  description: "Changes a value object's title or description, or its fields (the whole list, in order).",
  method: 'POST',
  route: '/api/value-object/change-value-object',
  input: {
    id: column('value_object', 'id', 'required'),
    title: column('value_object', 'title', 'optional'),
    description: column('value_object', 'description', 'optional'),
    fields: parts('value_object_field', FIELD_COLUMNS, "Its fields in order, each a name, what it means, exactly one type (a basic type, another value object or an aggregate), whether it is required, and its column's name and an example when they help. Replaces the list.", 'optional'),
  },
  handler: changeValueObject,
};

/** Changes the value object's columns and fields. */
export function changeValueObject(tx: Transaction, input: ChangeValueObject): void {
  const valueObjects = new ValueObjectRepository(tx);
  const valueObject = valueObjects.load(input.id) ?? tx.refuse('missing', `there is no value object ${input.id}`);
  valueObject.valueObject = changed(valueObject.valueObject, input, ['title', 'description']);
  if (input.fields) valueObject.fields = input.fields;
  holdToRules(tx, valueObject);
  valueObjects.save(valueObject);
}
