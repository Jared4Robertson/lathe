// The Check read model's reader (LA-CHK-RM10-RD): the one way the Check queries reach the read model's storage. The
// query handlers depend only on the CheckReader interface; the query runner injects the reader each query's definition
// makes (`reader`), so keeping the read model elsewhere is a new implementation of this interface and nothing more.
// Today's implementation reads the projection's table, kept in memory and built on each read.
import type { ReadView } from '../../platform/data/rules.ts';
import { checkTableFrom, type CheckPage, type CheckSummary, type CheckTable } from './read-model.ts';

/** What the Check queries read, and all they read. */
export interface CheckReader {
  /** The check with the name, or undefined. */
  check(name: string): CheckPage | undefined;
  /** The checks that run on the product, Lathe's first, each in its run order; undefined when there is no such product. */
  checksOn(product: string): CheckSummary[] | undefined;
}

/** The reader over the read model's table in memory. */
export class InMemoryCheckReader implements CheckReader {
  private readonly table: CheckTable;

  constructor(table: CheckTable) {
    this.table = table;
  }

  check(name: string): CheckPage | undefined {
    return this.table.checks.get(name);
  }

  checksOn(product: string): CheckSummary[] | undefined {
    if (!this.table.products.has(product)) return undefined;
    return [...this.table.checks.values()].filter((c) => c.product === null || c.product === product).map((c) => ({ name: c.name, product: c.product, severity: c.severity, summary: c.summary }));
  }
}

/** The reader the query runner gives each Check query: today's, over the projection's table built from the data. */
export const checkReader = (view: ReadView): CheckReader => new InMemoryCheckReader(checkTableFrom(view));
