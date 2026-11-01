import { column, type CommandDefinition } from '../../../platform/commands/definition.ts';
import { REMOVE_VALUE_OBJECT_IDENTITY } from './identities.generated.ts';
import { removeValueObject } from './handlers.generated.ts';

/** The value object to remove. */
export type RemoveValueObject = { id: string };

export const REMOVE_VALUE_OBJECT = {
  ...REMOVE_VALUE_OBJECT_IDENTITY,
  input: {
    id: column('value_object', 'id', 'required'),
  },
  handler: removeValueObject,
} satisfies CommandDefinition<RemoveValueObject>;
