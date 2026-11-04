import { column, ids, texts, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { EventTypeRow } from '../../../platform/data/tables.ts';
import { CHANGE_EVENT_TYPE_IDENTITY } from './identities.generated.ts';
import { changeEventType } from './handlers.generated.ts';

/** The event type's changes: a column given is set, null clears an optional one; a list given replaces its list. */
export type ChangeEventType = Pick<EventTypeRow, 'id'> & { title?: string; delivery?: EventTypeRow['delivery'] | null; file?: string | null; meets?: string[]; packages?: string[]; helpers?: string[] };

export const CHANGE_EVENT_TYPE = {
  ...CHANGE_EVENT_TYPE_IDENTITY,
  input: {
    id: column('event_type', 'id', 'required'),
    title: column('event_type', 'title', 'optional'),
    delivery: column('event_type', 'delivery', 'clearable'),
    file: column('event_type', 'file', 'clearable'),
    meets: ids('The standard rules it follows. Replaces the list.', 'optional'),
    packages: texts('The packages it uses. Replaces the list.', 'optional'),
    helpers: texts('The helper files its code is split across beside its file, each from the product root. Replaces the list.', 'optional'),
  },
  handler: changeEventType,
} satisfies CommandDefinition<ChangeEventType>;
