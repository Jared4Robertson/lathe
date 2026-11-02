import { column, type CommandDefinition } from '../../../platform/commands/definition.ts';
import { REMOVE_EVENT_HANDLER_IDENTITY } from './identities.generated.ts';
import { removeEventHandler } from './handlers.generated.ts';

/** The event handler to remove. */
export type RemoveEventHandler = { id: string };

export const REMOVE_EVENT_HANDLER = {
  ...REMOVE_EVENT_HANDLER_IDENTITY,
  input: {
    id: column('event_handler', 'id', 'required'),
  },
  handler: removeEventHandler,
} satisfies CommandDefinition<RemoveEventHandler>;
