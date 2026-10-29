// Remove a value object (LA-AUT-CMD272): Removes a value object whole: its fields, constraints with their tests and its value type, and the links they start. Refused while anything outside it references what is in it, such as a field it types.
import { column, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import { VALUE_OBJECT_SLICE } from '../model.ts';
import { ValueObjectRepository } from '../repository.ts';

/** The value object to remove. */
export type RemoveValueObject = { id: string };

/** Remove a value object (LA-AUT-CMD272). */
export const REMOVE_VALUE_OBJECT: CommandDefinition<RemoveValueObject> = {
  id: 'LA-AUT-CMD272',
  slice: VALUE_OBJECT_SLICE,
  name: 'remove-value-object',
  description: 'Removes a value object whole: its fields, constraints with their tests and its value type, and the links they start. Refused while anything outside it references what is in it, such as a field it types.',
  method: 'POST',
  route: '/api/value-object/remove-value-object',
  input: {
    id: column('value_object', 'id', 'required'),
  },
  handler: removeValueObject,
};

/** Removes the value object whole. */
export function removeValueObject(tx: Transaction, input: RemoveValueObject): void {
  const valueObjects = new ValueObjectRepository(tx);
  const valueObject = valueObjects.load(input.id) ?? tx.refuse('missing', `there is no value object ${input.id}`);
  valueObjects.remove(valueObject);
}
