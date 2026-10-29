// The Use case read model's reader (LA-AUT-RM11-RD): the one way the Use case queries reach the read model's storage.
// The query handlers depend only on the UseCaseReader interface; the query runner injects the reader each query's
// definition makes (`reader`), so keeping the read model elsewhere is a new implementation of this interface and
// nothing more. Today's implementation reads the projection's table, kept in memory and built on each read.
import type { ReadView } from '../../platform/data/rules.ts';
import { useCaseTableFrom, type UseCasePage, type UseCaseSummary, type UseCaseTable } from './read-model.ts';

/** What the Use case queries read, and all they read. */
export interface UseCaseReader {
  /** The kind of the record with this ID, of any kind, or undefined when no record has it. */
  kindOf(id: string): string | undefined;
  /** The page of a record inside a use case, or undefined when no use case holds it. */
  page(id: string): UseCasePage | undefined;
  /** A capability's use cases, by ID, or undefined when there is no such capability. */
  useCasesOf(capabilityId: string): UseCaseSummary[] | undefined;
  /** A capability's domain and product, or undefined when there is no such capability. */
  capability(id: string): { domain: string; product: string } | undefined;
  /** A product's interfaces, by ID. */
  interfacesOf(product: string): string[];
  /** The highest number in use after the prefix, as in <prefix>07, or 0 when none is. */
  highestAfter(prefix: string): number;
}

/** The reader over the read model's table in memory. */
export class InMemoryUseCaseReader implements UseCaseReader {
  private readonly table: UseCaseTable;

  constructor(table: UseCaseTable) {
    this.table = table;
  }

  kindOf(id: string): string | undefined {
    return this.table.kinds.get(id);
  }

  page(id: string): UseCasePage | undefined {
    const holding = this.table.holding.get(id);
    return holding && { record: { id, kind: holding.kind }, ...this.table.useCases.get(holding.root)! };
  }

  useCasesOf(capabilityId: string): UseCaseSummary[] | undefined {
    return this.table.capabilities.get(capabilityId)?.useCases;
  }

  capability(id: string): { domain: string; product: string } | undefined {
    const found = this.table.capabilities.get(id);
    return found && { domain: found.domain, product: found.product };
  }

  interfacesOf(product: string): string[] {
    return this.table.interfaces.get(product) ?? [];
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

/** The reader the query runner gives each Use case query: today's, over the projection's table built from the data. */
export const useCaseReader = (view: ReadView): UseCaseReader => new InMemoryUseCaseReader(useCaseTableFrom(view));
