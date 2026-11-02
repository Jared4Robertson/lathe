import { column, type CommandDefinition } from '../../../platform/commands/definition.ts';
import { REMOVE_TOOLING_IDENTITY } from './identities.generated.ts';
import { removeTooling } from './handlers.generated.ts';

/** The tooling record to remove. */
export type RemoveTooling = { id: string };

export const REMOVE_TOOLING = {
  ...REMOVE_TOOLING_IDENTITY,
  input: {
    id: column('tooling', 'id', 'required'),
  },
  handler: removeTooling,
} satisfies CommandDefinition<RemoveTooling>;
