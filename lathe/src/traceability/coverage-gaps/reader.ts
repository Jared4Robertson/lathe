// The Coverage gaps read model's reader (LA-TRC-RM02-RD): the one way the Coverage gaps queries reach the read model's
// storage. The query handlers depend only on the CoverageGapsReader interface; the query runner injects the reader the
// query's definition makes (`reader`), over the data with the checks' run. Today's implementation reads the
// projection's table, kept in memory and built on each read.
import type { ReadView } from '../../platform/data/rules.ts';
import { coverageGapsTableFrom, type CoverageGapRow, type CoverageGapsTable } from './read-model.ts';

/** What the Coverage gaps queries read, and all they read. */
export interface CoverageGapsReader {
  /** The product's gaps, its own scope's first then each domain's in ID order, or undefined when there is no such product. */
  gapsOf(product: string): CoverageGapRow[] | undefined;
}

/** The reader over the read model's table in memory. */
export class InMemoryCoverageGapsReader implements CoverageGapsReader {
  private readonly table: CoverageGapsTable;

  constructor(table: CoverageGapsTable) {
    this.table = table;
  }

  gapsOf(product: string): CoverageGapRow[] | undefined {
    return this.table.products.get(product);
  }
}

/** The reader the query runner gives the Coverage gaps queries: today's, over the projection's table built from the checks' run. */
export const coverageGapsReader = (view: ReadView): CoverageGapsReader => new InMemoryCoverageGapsReader(coverageGapsTableFrom(view));
