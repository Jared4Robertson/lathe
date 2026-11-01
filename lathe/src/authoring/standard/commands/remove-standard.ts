import { column, type CommandDefinition } from '../../../platform/commands/definition.ts';
import { REMOVE_STANDARD_IDENTITY } from './identities.generated.ts';
import { removeStandard } from './handlers.generated.ts';

/** The standard to remove. */
export type RemoveStandard = { id: string };

export const REMOVE_STANDARD = {
  ...REMOVE_STANDARD_IDENTITY,
  input: {
    id: column('standard', 'id', 'required'),
  },
  handler: removeStandard,
} satisfies CommandDefinition<RemoveStandard>;
