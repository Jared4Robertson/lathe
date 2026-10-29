// Add a value type (LA-AUT-CMD276): Adds the value type of a value object, its one piece of code, with the standard rules it meets and the packages it uses.
import { column, ids, texts, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import type { ValueTypeRow } from '../../../platform/data/tables.ts';
import { VALUE_OBJECT_SLICE } from '../model.ts';
import { ValueObjectRepository } from '../repository.ts';

/** A new value type, with the standard rules it meets and the packages it uses. */
export type AddValueType = Pick<ValueTypeRow, 'id' | 'title' | 'value_object_id' | 'file'> & { meets?: string[]; packages?: string[] };

/** Add a value type (LA-AUT-CMD276). */
export const ADD_VALUE_TYPE: CommandDefinition<AddValueType> = {
  id: 'LA-AUT-CMD276',
  slice: VALUE_OBJECT_SLICE,
  name: 'add-value-type',
  description: 'Adds the value type of a value object, its one piece of code, with the standard rules it meets and the packages it uses.',
  method: 'POST',
  route: '/api/value-object/add-value-type',
  input: {
    id: column('value_type', 'id', 'required'),
    title: column('value_type', 'title', 'required'),
    value_object_id: column('value_type', 'value_object_id', 'required'),
    file: column('value_type', 'file', 'optional'),
    meets: ids('The standard rules it meets.', 'optional'),
    packages: texts("The packages it uses, by their names in the product's package.json files.", 'optional'),
  },
  handler: addValueType,
};

/** Adds the value type to its value object, which has none yet. */
export function addValueType(tx: Transaction, input: AddValueType): void {
  const valueObjects = new ValueObjectRepository(tx);
  const valueObject = valueObjects.load(input.value_object_id) ?? tx.refuse('missing', `there is no value object ${input.value_object_id}`);
  if (valueObject.valueType) tx.refuse('exists', `${valueObject.root} already has its value type, ${valueObject.valueType.row.id}`);
  const { meets = [], packages = [], ...row } = input;
  valueObject.valueType = { row, meets, packages };
  valueObjects.save(valueObject);
}
