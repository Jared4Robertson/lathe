// The Endpoint read model's reader (LA-AUT-RM33-RD): the one way the Endpoint queries reach the read model's storage.
// The query handlers depend only on the EndpointReader interface; the query runner injects the reader each query's
// definition makes (`reader`), so keeping the read model elsewhere is a new implementation of this interface and
// nothing more. Today's implementation reads the projection's table, kept in memory and built on each read.
import type { ReadView } from '../../platform/data/rules.ts';
import { endpointTableFrom, type EndpointPage, type EndpointSummary, type EndpointTable } from './read-model.ts';

/** What the Endpoint queries read, and all they read. */
export interface EndpointReader {
  /** The kind of the record with this ID, of any kind, or undefined when no record has it. */
  kindOf(id: string): string | undefined;
  /** The page of the endpoint that holds the record, or undefined when no endpoint holds it. */
  page(id: string): EndpointPage | undefined;
  /** The endpoints that expose the command or query, by ID. */
  endpointsOf(parent: string): EndpointSummary[];
  /** The domain whose ID begins the record's, the longest, or undefined. */
  domainOf(id: string): string | undefined;
  /** The highest number in use after the prefix, as in <prefix>07, or 0 when none is. */
  highestAfter(prefix: string): number;
}

/** The reader over the read model's table in memory. */
export class InMemoryEndpointReader implements EndpointReader {
  private readonly table: EndpointTable;

  constructor(table: EndpointTable) {
    this.table = table;
  }

  kindOf(id: string): string | undefined {
    return this.table.kinds.get(id);
  }

  page(id: string): EndpointPage | undefined {
    const root = this.table.holding.get(id);
    return root === undefined ? undefined : this.table.endpoints.get(root);
  }

  endpointsOf(parent: string): EndpointSummary[] {
    return [...this.table.endpoints.values()].filter((e) => e.exposes === parent).map((e) => ({ id: e.id, title: e.title }));
  }

  domainOf(id: string): string | undefined {
    return this.table.domains.filter((d) => id.startsWith(`${d}-`)).sort((a, b) => b.length - a.length)[0];
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

/** The reader the query runner gives each Endpoint query: today's, over the projection's table built from the data. */
export const endpointReader = (view: ReadView): EndpointReader => new InMemoryEndpointReader(endpointTableFrom(view));
