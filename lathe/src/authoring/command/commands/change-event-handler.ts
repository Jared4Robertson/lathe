import { column, ids, texts, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { EventHandlerRow } from '../../../platform/data/tables.ts';
import { CHANGE_EVENT_HANDLER_IDENTITY } from './identities.generated.ts';
import { changeEventHandler } from './handlers.generated.ts';

/** The event handler's changes: a column given is set, null clears an optional one; a list given replaces its list. */
export type ChangeEventHandler = Pick<EventHandlerRow, 'id'> & { title?: string; file?: string | null; description?: string; meets?: string[]; packages?: string[] };

export const CHANGE_EVENT_HANDLER = {
  ...CHANGE_EVENT_HANDLER_IDENTITY,
  input: {
    id: column('event_handler', 'id', 'required'),
    title: column('event_handler', 'title', 'optional'),
    file: column('event_handler', 'file', 'clearable'),
    description: column('event_handler', 'description', 'optional'),
    meets: ids('The standard rules it follows. Replaces the list.', 'optional'),
    packages: texts('The packages it uses. Replaces the list.', 'optional'),
  },
  handler: changeEventHandler,
} satisfies CommandDefinition<ChangeEventHandler>;
