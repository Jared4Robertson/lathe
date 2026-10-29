// Change an event type (LA-AUT-CMD234): Changes an event type's title, delivery or file, or the standard rules it meets or the packages it uses (each list whole). Its event does not change.
import { column, ids, texts, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import type { EventTypeRow } from '../../../platform/data/tables.ts';
import { changed, DOMAIN_EVENT_SLICE } from '../model.ts';
import { DomainEventRepository } from '../repository.ts';

/** The event type's changes: a column given is set, null clears an optional one; a list given replaces its list. */
export type ChangeEventType = Pick<EventTypeRow, 'id'> & { title?: string; delivery?: EventTypeRow['delivery'] | null; file?: string | null; meets?: string[]; packages?: string[] };

/** Change an event type (LA-AUT-CMD234). */
export const CHANGE_EVENT_TYPE: CommandDefinition<ChangeEventType> = {
  id: 'LA-AUT-CMD234',
  slice: DOMAIN_EVENT_SLICE,
  name: 'change-event-type',
  description: "Changes an event type's title, delivery or file, or the standard rules it meets or the packages it uses (each list whole). Its event does not change.",
  method: 'POST',
  route: '/api/domain-event/change-event-type',
  input: {
    id: column('event_type', 'id', 'required'),
    title: column('event_type', 'title', 'optional'),
    delivery: column('event_type', 'delivery', 'clearable'),
    file: column('event_type', 'file', 'clearable'),
    meets: ids('The standard rules it follows. Replaces the list.', 'optional'),
    packages: texts('The packages it uses. Replaces the list.', 'optional'),
  },
  handler: changeEventType,
};

/** Changes the event type's columns and links. */
export function changeEventType(tx: Transaction, input: ChangeEventType): void {
  const events = new DomainEventRepository(tx);
  const event = events.loadHolding('event_type', input.id) ?? tx.refuse('missing', `there is no event type ${input.id}`);
  const type = event.eventType!;
  event.eventType = { row: changed(type.row, input, ['title', 'delivery', 'file']), meets: input.meets ?? type.meets, packages: input.packages ?? type.packages };
  events.save(event);
}
