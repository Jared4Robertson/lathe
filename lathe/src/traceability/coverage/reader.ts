// The Coverage read model's reader (LA-TRC-RM01-RD): the one way the Coverage query reaches the read model's storage.
// The query handler depends only on the CoverageReader interface; the query runner injects the reader the query's
// definition makes (`reader`), over the data with the checks' run. Today's implementation reads the projection's
// table, kept in memory and built on each read.
import type { ReadView } from '../../platform/data/rules.ts';
import { coverageTableFrom, type CoverageTable, type ProductCoverage } from './read-model.ts';

/** What the Coverage query reads, and all it reads. */
export interface CoverageReader {
  /** The product's coverage, or undefined when there is no such product. */
  coverageOf(product: string): ProductCoverage | undefined;
}

/** The reader over the read model's table in memory. */
export class InMemoryCoverageReader implements CoverageReader {
  private readonly table: CoverageTable;

  constructor(table: CoverageTable) {
    this.table = table;
  }

  coverageOf(product: string): ProductCoverage | undefined {
    return this.table.products.get(product);
  }
}

/** The reader the query runner gives the Coverage query: today's, over the projection's table built from the checks' run. */
export const coverageReader = (view: ReadView): CoverageReader => new InMemoryCoverageReader(coverageTableFrom(view));
