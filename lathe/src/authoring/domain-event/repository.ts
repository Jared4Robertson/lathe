// DomainEventRepository (LA-AUT-REPO07): loads and saves the Domain event aggregate whole, in its own tables only. An
// event type is reached through the event it is the shape of.
import { AggregateRepository, type InstanceRows } from '../../platform/data/repository.ts';
import type { Transaction } from '../../platform/data/transaction.ts';
import { DOMAIN_EVENT_TABLES, domainEventRows, domainEventsFrom, kindInside, type DomainEvent, type DomainEventKind } from './model.ts';

export class DomainEventRepository extends AggregateRepository<DomainEvent> {
  constructor(tx: Transaction) {
    super(tx, 'DomainEventRepository', DOMAIN_EVENT_TABLES);
  }

  protected read(rootId: string): DomainEvent | undefined {
    return domainEventsFrom((table) => this.files.rows(table), rootId)[0];
  }

  protected rowsOf(event: DomainEvent): InstanceRows {
    return domainEventRows(event);
  }

  /** Loads the event that holds the record of the kind with this ID: the event itself, or its event type's. */
  loadHolding(kind: DomainEventKind, id: string): DomainEvent | undefined {
    const row = this.files.find(kind, { id });
    if (!row) return undefined;
    const event = this.load(kind === 'domain_event' ? id : String(row.domain_event_id));
    return event && kindInside(event, id) === kind ? event : undefined;
  }
}
