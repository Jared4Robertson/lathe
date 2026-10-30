// The Domain read model's reader (LA-AUT-RM24-RD): the one way the Domain queries reach the read model's storage.
// The query handlers depend only on the DomainReader interface; the query runner injects the reader each query's
// definition makes (`reader`), so keeping the read model elsewhere is a new implementation of this interface and
// nothing more. Today's implementation reads the projection's table, kept in memory and built on each read.
import type { ReadView } from '../../platform/data/rules.ts';
import { domainTableFrom, type DomainPage, type DomainSummary, type DomainTable } from './read-model.ts';

/** What the Domain queries read, and all they read. */
export interface DomainReader {
  /** The kind of the record with this ID, of any kind, or undefined when no record has it. */
  kindOf(id: string): string | undefined;
  /** The page of a record inside a domain, or undefined when no domain holds it. */
  page(id: string): DomainPage | undefined;
  /** A product's domains, by ID, or undefined when there is no such product. */
  domainsOf(productId: string): DomainSummary[] | undefined;
  /** The highest number in use after the prefix, as in <prefix>07, or 0 when none is. */
  highestAfter(prefix: string): number;
}

/** The reader over the read model's table in memory. */
export class InMemoryDomainReader implements DomainReader {
  private readonly table: DomainTable;

  constructor(table: DomainTable) {
    this.table = table;
  }

  kindOf(id: string): string | undefined {
    return this.table.kinds.get(id);
  }

  page(id: string): DomainPage | undefined {
    const holding = this.table.holding.get(id);
    return holding && { record: { id, kind: holding.kind }, ...this.table.domains.get(holding.root)! };
  }

  domainsOf(productId: string): DomainSummary[] | undefined {
    return this.table.products.get(productId);
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

/** The reader the query runner gives each Domain query: today's, over the projection's table built from the data. */
export const domainReader = (view: ReadView): DomainReader => new InMemoryDomainReader(domainTableFrom(view));
