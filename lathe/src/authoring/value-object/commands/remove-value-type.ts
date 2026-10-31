import { column, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import { VALUE_OBJECT_SLICE } from '../model.ts';
import { ValueObjectRepository } from '../repository.ts';

/** The value type to remove. */
export type RemoveValueType = { id: string };

export const REMOVE_VALUE_TYPE: CommandDefinition<RemoveValueType> = {
  id: 'LA-AUT-CMD278',
  slice: VALUE_OBJECT_SLICE,
  name: 'remove-value-type',
  description: "Removes a value object's value type with the links it starts and the packages it uses. Refused while anything references it.",
  method: 'POST',
  route: '/api/value-object/remove-value-type',
  input: {
    id: column('value_type', 'id', 'required'),
  },
  handler: removeValueType,
};

/** Removes the value type from its value object. */
export function removeValueType(tx: Transaction, input: RemoveValueType): void {
  const valueObjects = new ValueObjectRepository(tx);
  const valueObject = valueObjects.loadHolding('value_type', input.id) ?? tx.refuse('missing', `there is no value type ${input.id}`);
  valueObject.valueType = null;
  valueObjects.save(valueObject);
}
