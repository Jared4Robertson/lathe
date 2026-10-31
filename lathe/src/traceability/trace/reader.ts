// The Trace read model's reader (LA-TRC-RM13-RD): the one way the Trace query reaches the read model's storage.
// The query handler depends only on the TraceReader interface; the query runner injects the reader the query's
// definition makes (`reader`), over the data with the checks' run, so keeping the read model elsewhere is a new
// implementation of this interface and nothing more. Today's implementation reads the projection's table, kept in
// memory and built on each read.
import type { ReadView } from '../../platform/data/rules.ts';
import { traceTableFrom, type TraceTable, type ProductTrace } from './read-model.ts';

/** What the Trace query reads, and all it reads. */
export interface TraceReader {
  /** The product's trace, or undefined when there is no such product. */
  traceOf(product: string): ProductTrace | undefined;
}

/** The reader over the read model's table in memory. */
export class InMemoryTraceReader implements TraceReader {
  private readonly table: TraceTable;

  constructor(table: TraceTable) {
    this.table = table;
  }

  traceOf(product: string): ProductTrace | undefined {
    return this.table.products.get(product);
  }
}

/** The reader the query runner gives the Trace query: today's, over the projection's table built from the rows and the checks' run. */
export const traceReader = (view: ReadView): TraceReader => new InMemoryTraceReader(traceTableFrom(view));
