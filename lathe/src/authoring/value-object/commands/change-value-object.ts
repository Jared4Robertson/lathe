import { column, parts, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import type { ValueObjectRow } from '../../../platform/data/tables.ts';
import { FIELD_COLUMNS, changed, type ValueObjectField } from '../model.ts';
import { ValueObjectRepository } from '../repository.ts';
import { holdToRules } from '../rules.ts';
import { CHANGE_VALUE_OBJECT_IDENTITY } from './identities.generated.ts';

/** The value object's changes: a column given is set; fields, when given, replace the list. */
export type ChangeValueObject = Pick<ValueObjectRow, 'id'> & { title?: ValueObjectRow['title']; description?: ValueObjectRow['description']; fields?: ValueObjectField[] };

export const CHANGE_VALUE_OBJECT: CommandDefinition<ChangeValueObject> = {
  ...CHANGE_VALUE_OBJECT_IDENTITY,
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
