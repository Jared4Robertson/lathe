// The Domain event read model's reader (LA-AUT-RM27-RD): the one way the Domain event queries reach the read model's
// storage. The query handlers depend only on the DomainEventReader interface; the query runner injects the reader each
// query's definition makes (`reader`), so keeping the read model elsewhere is a new implementation of this interface
// and nothing more. Today's implementation reads the projection's table, kept in memory and built on each read.
import type { ReadView } from '../../platform/data/rules.ts';
import { domainEventTableFrom, type DomainEventPage, type DomainEventSummary, type DomainEventTable } from './read-model.ts';

/** What the Domain event queries read, and all they read. */
export interface DomainEventReader {
  /** The kind of the record with this ID, of any kind, or undefined when no record has it. */
  kindOf(id: string): string | undefined;
  /** The page of a record inside a domain event, or undefined when no event holds it. */
  page(id: string): DomainEventPage | undefined;
  /** An aggregate's domain events, by ID, or undefined when there is no such aggregate. */
  eventsOf(aggregateId: string): DomainEventSummary[] | undefined;
  /** The domain an aggregate sits under, or undefined when there is no such aggregate. */
  domainOf(aggregateId: string): string | undefined;
  /** The highest number in use after the prefix, as in <prefix>07, or 0 when none is. */
  highestAfter(prefix: string): number;
}

/** The reader over the read model's table in memory. */
export class InMemoryDomainEventReader implements DomainEventReader {
  private readonly table: DomainEventTable;

  constructor(table: DomainEventTable) {
    this.table = table;
  }

  kindOf(id: string): string | undefined {
    return this.table.kinds.get(id);
  }

  page(id: string): DomainEventPage | undefined {
    const holding = this.table.holding.get(id);
    return holding && { record: { id, kind: holding.kind }, ...this.table.events.get(holding.root)! };
  }

  eventsOf(aggregateId: string): DomainEventSummary[] | undefined {
    return this.table.aggregates.get(aggregateId)?.events;
  }

  domainOf(aggregateId: string): string | undefined {
    return this.table.aggregates.get(aggregateId)?.domain;
  }

  highestAfter(prefix: string): number {
    const shape = new RegExp(`^${prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\d+)$`);
    let highest = 0;
    for (const id of this.table.kinds.keys()) {
      const m = shape.exec(id);
      if (m) highest = Math.max(highest, Number(m[1]));
    }
    return highest;
  }
}

/** The reader the query runner gives each Domain event query: today's, over the projection's table built from the data. */
export const domainEventReader = (view: ReadView): DomainEventReader => new InMemoryDomainEventReader(domainEventTableFrom(view));
