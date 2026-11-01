import { column, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import { ValueObjectRepository } from '../repository.ts';
import { REMOVE_VALUE_TYPE_IDENTITY } from './identities.generated.ts';

/** The value type to remove. */
export type RemoveValueType = { id: string };

export const REMOVE_VALUE_TYPE = {
  ...REMOVE_VALUE_TYPE_IDENTITY,
  input: {
    id: column('value_type', 'id', 'required'),
  },
  handler: removeValueType,
} satisfies CommandDefinition<RemoveValueType>;

/** Removes the value type from its value object. */
export function removeValueType(tx: Transaction, input: RemoveValueType): void {
  const valueObjects = new ValueObjectRepository(tx);
  const valueObject = valueObjects.loadHolding('value_type', input.id) ?? tx.refuse('missing', `there is no value type ${input.id}`);
  valueObject.valueType = null;
  valueObjects.save(valueObject);
}
