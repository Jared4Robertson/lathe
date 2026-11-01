import { column, type CommandDefinition } from '../../../platform/commands/definition.ts';
import { REMOVE_DOMAIN_SERVICE_IDENTITY } from './identities.generated.ts';
import { removeDomainService } from './handlers.generated.ts';

/** The domain service to remove. */
export type RemoveDomainService = { id: string };

export const REMOVE_DOMAIN_SERVICE = {
  ...REMOVE_DOMAIN_SERVICE_IDENTITY,
  input: {
    id: column('domain_service', 'id', 'required'),
  },
  handler: removeDomainService,
} satisfies CommandDefinition<RemoveDomainService>;
