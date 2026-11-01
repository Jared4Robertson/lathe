// The Tests by state read model's reader (LA-TRC-RM03-RD): the one way the Tests by state query reaches the read
// model's storage. The query handler depends only on the TestsByStateReader interface; the query runner injects the
// reader the query's definition makes (`reader`), over the data with the checks' run. Today's implementation reads the
// projection's table, kept in memory and built on each read.
import type { ReadView } from '../../platform/data/rules.ts';
import { testsByStateTableFrom, type ScopeTestCounts, type TestsByStateTable } from './read-model.ts';

/** What the Tests by state query reads, and all it reads. */
export interface TestsByStateReader {
  /** The product's scopes, its own first then each domain in ID order, or undefined when there is no such product. */
  countsOf(product: string): ScopeTestCounts[] | undefined;
}

/** The reader over the read model's table in memory. */
export class InMemoryTestsByStateReader implements TestsByStateReader {
  private readonly table: TestsByStateTable;

  constructor(table: TestsByStateTable) {
    this.table = table;
  }

  countsOf(product: string): ScopeTestCounts[] | undefined {
    return this.table.products.get(product);
  }
}

/** The reader the query runner gives the Tests by state query: today's, over the projection's table built from the checks' run. */
export const testsByStateReader = (view: ReadView): TestsByStateReader => new InMemoryTestsByStateReader(testsByStateTableFrom(view));
