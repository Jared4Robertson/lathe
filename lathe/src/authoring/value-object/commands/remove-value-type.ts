import { column, type CommandDefinition } from '../../../platform/commands/definition.ts';
import { REMOVE_VALUE_TYPE_IDENTITY } from './identities.generated.ts';
import { removeValueType } from './handlers.generated.ts';

/** The value type to remove. */
export type RemoveValueType = { id: string };

export const REMOVE_VALUE_TYPE = {
  ...REMOVE_VALUE_TYPE_IDENTITY,
  input: {
    id: column('value_type', 'id', 'required'),
  },
  handler: removeValueType,
} satisfies CommandDefinition<RemoveValueType>;
