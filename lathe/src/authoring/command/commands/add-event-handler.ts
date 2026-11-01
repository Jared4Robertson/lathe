import { column, ids, texts, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { EventHandlerRow } from '../../../platform/data/tables.ts';
import { ADD_EVENT_HANDLER_IDENTITY } from './identities.generated.ts';
import { addEventHandler } from './handlers.generated.ts';

export type AddEventHandler = Pick<EventHandlerRow, 'id' | 'title' | 'policy_id' | 'file' | 'description'> & { meets?: string[]; packages?: string[] };

export const ADD_EVENT_HANDLER = {
  ...ADD_EVENT_HANDLER_IDENTITY,
  input: {
    id: column('event_handler', 'id', 'required'),
    title: column('event_handler', 'title', 'required'),
    policy_id: column('event_handler', 'policy_id', 'required'),
    file: column('event_handler', 'file', 'optional'),
    description: column('event_handler', 'description', 'required'),
    meets: ids('The standard rules it follows.', 'optional'),
    packages: texts('The packages it uses, each listed in one of the product\'s package.json files.', 'optional'),
  },
  handler: addEventHandler,
} satisfies CommandDefinition<AddEventHandler>;
