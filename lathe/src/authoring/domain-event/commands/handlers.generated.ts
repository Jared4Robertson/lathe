// Generated from data/ by `npm run generate`. Do not edit.
// The domain-event commands whose handler is the pattern: load the domain event, add, change or remove one record with the
// input's columns and lists, hold it to its rules, and save. Each definition takes its handler from here.
import { changed } from '../../../platform/data/rows.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import { DomainEventRepository } from '../repository.ts';
import { holdToRules } from '../rules.ts';
import type { AddDomainEvent } from './add-domain-event.ts';
import type { ChangeDomainEvent } from './change-domain-event.ts';
import type { RemoveDomainEvent } from './remove-domain-event.ts';
import type { ChangeEventType } from './change-event-type.ts';
import type { RemoveEventType } from './remove-event-type.ts';

/** Adds a domain event to the aggregate it happens to, with the fields it carries, in order. */
export function addDomainEvent(tx: Transaction, input: AddDomainEvent): void {
  const domainEvents = new DomainEventRepository(tx);
  const { fields = [], ...row } = input;
  const domainEvent = domainEvents.create({ root: row.id, event: row, fields: fields.map((item, at) => ({ domain_event_id: row.id, position: at + 1, ...item })), eventType: null });
  holdToRules(tx, domainEvent);
  domainEvents.save(domainEvent);
}

/** Changes a domain event's title, description or whether it is published, or its fields (the whole list, in order). The aggregate it happens to does not change. */
export function changeDomainEvent(tx: Transaction, input: ChangeDomainEvent): void {
  const domainEvents = new DomainEventRepository(tx);
  const domainEvent = domainEvents.load(input.id) ?? tx.refuse('missing', `there is no domain event ${input.id}`);
  domainEvent.event = changed(domainEvent.event, input, ['title', 'published', 'description']);
  domainEvent.fields = input.fields ? input.fields.map((item, at) => ({ domain_event_id: input.id, position: at + 1, ...item })) : domainEvent.fields;
  holdToRules(tx, domainEvent);
  domainEvents.save(domainEvent);
}

/** Removes a domain event whole: its fields, its event type and the links it starts. Refused while anything else references it: a command that raises it, a policy that hears it or a read model it feeds. */
export function removeDomainEvent(tx: Transaction, input: RemoveDomainEvent): void {
  const domainEvents = new DomainEventRepository(tx);
  const domainEvent = domainEvents.load(input.id) ?? tx.refuse('missing', `there is no domain event ${input.id}`);
  domainEvents.remove(domainEvent);
}

/** Changes an event type's title, delivery or file, or the standard rules it meets or the packages it uses (each list whole). Its event does not change. */
export function changeEventType(tx: Transaction, input: ChangeEventType): void {
  const domainEvents = new DomainEventRepository(tx);
  const domainEvent = domainEvents.loadHolding('event_type', input.id) ?? tx.refuse('missing', `there is no event type ${input.id}`);
  const held = domainEvent.eventType!;
  domainEvent.eventType = { row: changed(held.row, input, ['title', 'delivery', 'file']), meets: input.meets ?? held.meets, packages: input.packages ?? held.packages };
  holdToRules(tx, domainEvent);
  domainEvents.save(domainEvent);
}

/** Removes an event type with the links it starts and the packages it uses. Refused while anything else references it. */
export function removeEventType(tx: Transaction, input: RemoveEventType): void {
  const domainEvents = new DomainEventRepository(tx);
  const domainEvent = domainEvents.loadHolding('event_type', input.id) ?? tx.refuse('missing', `there is no event type ${input.id}`);
  domainEvent.eventType = null;
  domainEvents.save(domainEvent);
}
