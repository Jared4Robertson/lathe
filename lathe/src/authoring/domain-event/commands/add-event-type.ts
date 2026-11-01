import { column, ids, texts, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { EventTypeRow } from '../../../platform/data/tables.ts';
import { ADD_EVENT_TYPE_IDENTITY } from './identities.generated.ts';
import { addEventType } from './handlers.generated.ts';

export type AddEventType = Pick<EventTypeRow, 'id' | 'title' | 'domain_event_id' | 'delivery' | 'file'> & { meets?: string[]; packages?: string[] };

export const ADD_EVENT_TYPE = {
  ...ADD_EVENT_TYPE_IDENTITY,
  input: {
    id: column('event_type', 'id', 'required'),
    title: column('event_type', 'title', 'required'),
    domain_event_id: column('event_type', 'domain_event_id', 'required'),
    delivery: column('event_type', 'delivery', 'optional'),
    file: column('event_type', 'file', 'optional'),
    meets: ids('The standard rules it follows.', 'optional'),
    packages: texts('The packages it uses, each listed in one of the product\'s package.json files.', 'optional'),
  },
  handler: addEventType,
} satisfies CommandDefinition<AddEventType>;
