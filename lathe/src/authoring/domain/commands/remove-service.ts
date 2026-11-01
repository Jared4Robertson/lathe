import { column, type CommandDefinition } from '../../../platform/commands/definition.ts';
import { REMOVE_SERVICE_IDENTITY } from './identities.generated.ts';
import { removeService } from './handlers.generated.ts';

/** The service to remove. */
export type RemoveService = { id: string };

export const REMOVE_SERVICE = {
  ...REMOVE_SERVICE_IDENTITY,
  input: {
    id: column('service', 'id', 'required'),
  },
  handler: removeService,
} satisfies CommandDefinition<RemoveService>;
