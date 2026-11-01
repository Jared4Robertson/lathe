import { column, type CommandDefinition } from '../../../platform/commands/definition.ts';
import { REMOVE_POLICY_IDENTITY } from './identities.generated.ts';
import { removePolicy } from './handlers.generated.ts';

/** The policy to remove. */
export type RemovePolicy = { id: string };

export const REMOVE_POLICY = {
  ...REMOVE_POLICY_IDENTITY,
  input: {
    id: column('policy', 'id', 'required'),
  },
  handler: removePolicy,
} satisfies CommandDefinition<RemovePolicy>;
