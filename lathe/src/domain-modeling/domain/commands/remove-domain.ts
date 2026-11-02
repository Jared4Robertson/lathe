import { column, type CommandDefinition } from '../../../platform/commands/definition.ts';
import { REMOVE_DOMAIN_IDENTITY } from './identities.generated.ts';
import { removeDomain } from './handlers.generated.ts';

/** The domain to remove. */
export type RemoveDomain = { id: string };

export const REMOVE_DOMAIN = {
  ...REMOVE_DOMAIN_IDENTITY,
  input: {
    id: column('domain', 'id', 'required'),
  },
  handler: removeDomain,
} satisfies CommandDefinition<RemoveDomain>;
