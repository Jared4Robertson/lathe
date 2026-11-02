import { column, type CommandDefinition } from '../../../platform/commands/definition.ts';
import { REMOVE_DOMAIN_EVENT_IDENTITY } from './identities.generated.ts';
import { removeDomainEvent } from './handlers.generated.ts';

/** The event to remove. */
export type RemoveDomainEvent = { id: string };

export const REMOVE_DOMAIN_EVENT = {
  ...REMOVE_DOMAIN_EVENT_IDENTITY,
  input: {
    id: column('domain_event', 'id', 'required'),
  },
  handler: removeDomainEvent,
} satisfies CommandDefinition<RemoveDomainEvent>;
