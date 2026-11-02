// Generated from data/ by `npm run generate`. Do not edit.
// DomainEventRepository (LA-MOD-REPO07): Loads a domain event whole from the transaction's draft (its fields in order,
// and its event type with the standard rules it meets and the packages it uses) and saves exactly the rows that
// changed, in the Domain event aggregate's own tables only; a write to any other table is refused when it is made
// (`DataFiles`). A record inside one is loaded through the root that holds it (`loadHolding`), and a removal is
// refused, naming the referrers, while anything outside what goes references it.
import { AggregateRepository as Repository, type InstanceRows } from '../../platform/data/repository.ts';
import type { Transaction } from '../../platform/data/transaction.ts';
import { DOMAIN_EVENT_TABLES, domainEventRows, domainEventsFrom, type DomainEvent, type DomainEventKind } from './model.ts';

export class DomainEventRepository extends Repository<DomainEvent> {
  constructor(tx: Transaction) {
    super(tx, 'DomainEventRepository', DOMAIN_EVENT_TABLES);
  }

  protected read(rootId: string): DomainEvent | undefined {
    return domainEventsFrom((table) => this.files.rows(table), rootId)[0];
  }

  protected rowsOf(domainEvent: DomainEvent): InstanceRows {
    return domainEventRows(domainEvent);
  }

  /** Loads the domain event that holds the record of the kind with this ID, found up its parents; undefined when there is none. */
  loadHolding(kind: DomainEventKind, id: string): DomainEvent | undefined {
    const root = this.rootOf(kind, id);
    const domainEvent = root === undefined ? undefined : this.load(root);
    return domainEvent && holds(domainEvent, kind, id) ? domainEvent : undefined;
  }

  // The root's ID, up the parents of the record of the kind with this ID; undefined when one of them is missing.
  private rootOf(kind: DomainEventKind, id: string): string | undefined {
    const row = this.files.find(kind, { id });
    if (!row) return undefined;
    switch (kind) {
      case 'domain_event': return id;
      case 'event_type': return this.rootOf('domain_event', String(row.domain_event_id));
    }
  }
}

/** Whether the domain event holds the record of the kind with this ID. */
function holds(domainEvent: DomainEvent, kind: DomainEventKind, id: string): boolean {
  switch (kind) {
    case 'domain_event': return domainEvent.root === id;
    case 'event_type': return domainEvent.eventType?.row.id === id;
  }
}
