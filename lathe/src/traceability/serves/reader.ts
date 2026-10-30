// The Serves read model's reader (LA-TRC-RM12-RD): the one way the Serves queries reach the read model's storage. The
// query handlers depend only on the ServesReader interface; the query runner injects the reader the queries'
// definitions make (`reader`), over the data. Today's implementation reads the projection's table, kept in memory and
// worked out on each read.
import type { ReadView } from '../../platform/data/rules.ts';
import { servesTableFrom, type ProductServes, type RecordServes, type ServesTable } from './read-model.ts';

/** What the Serves queries read, and all they read. */
export interface ServesReader {
  /** What the record serves, or undefined when there is no such record. */
  servesOf(id: string): RecordServes | undefined;
  /** The product's records that serve an outcome and those no outcome reaches, or undefined when there is no such product. */
  productOf(product: string): ProductServes | undefined;
}

/** The reader over the read model's table in memory. */
export class InMemoryServesReader implements ServesReader {
  private readonly table: ServesTable;

  constructor(table: ServesTable) {
    this.table = table;
  }

  servesOf(id: string): RecordServes | undefined {
    return this.table.records.get(id);
  }

  productOf(product: string): ProductServes | undefined {
    return this.table.products.get(product);
  }
}

/** The reader the query runner gives the Serves queries: today's, over the projection's table. */
export const servesReader = (view: ReadView): ServesReader => new InMemoryServesReader(servesTableFrom(view));
