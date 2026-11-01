import { column, parts, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import type { ValueObjectRow } from '../../../platform/data/tables.ts';
import { FIELD_COLUMNS, newValueObject, type ValueObjectField } from '../model.ts';
import { ValueObjectRepository } from '../repository.ts';
import { holdToRules } from '../rules.ts';
import { ADD_VALUE_OBJECT_IDENTITY } from './identities.generated.ts';

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

export function addValueObject(tx: Transaction, input: AddValueObject): void {
  const valueObjects = new ValueObjectRepository(tx);
  const { fields = [], ...row } = input;
  const valueObject = valueObjects.create(newValueObject(row, fields));
  holdToRules(tx, valueObject);
  valueObjects.save(valueObject);
}
