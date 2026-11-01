import { column, type CommandDefinition } from '../../../platform/commands/definition.ts';
import { REMOVE_EVENT_TYPE_IDENTITY } from './identities.generated.ts';
import { removeEventType } from './handlers.generated.ts';

/** The event type to remove. */
export type RemoveEventType = { id: string };

export const REMOVE_EVENT_TYPE = {
  ...REMOVE_EVENT_TYPE_IDENTITY,
  input: {
    id: column('event_type', 'id', 'required'),
  },
  handler: removeEventType,
} satisfies CommandDefinition<RemoveEventType>;
