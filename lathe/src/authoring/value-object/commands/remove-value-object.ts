import { column, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import { ValueObjectRepository } from '../repository.ts';
import { REMOVE_VALUE_OBJECT_IDENTITY } from './identities.generated.ts';

/** The value object to remove. */
export type RemoveValueObject = { id: string };

export const REMOVE_VALUE_OBJECT: CommandDefinition<RemoveValueObject> = {
  ...REMOVE_VALUE_OBJECT_IDENTITY,
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
