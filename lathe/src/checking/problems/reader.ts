// The Problems read model's reader (LA-CHK-RM01-RD): the one way the Problems query reaches the read model's storage.
// The query handler depends only on the ProblemsReader interface; the query runner injects the reader the query's
// definition makes (`reader`), over the data with the checks' run, so keeping the read model elsewhere is a new
// implementation of this interface and nothing more. Today's implementation reads the projection's table, kept in
// memory and built on each read.
import type { ReadView } from '../../platform/data/rules.ts';
import { problemsTableFrom, type ProblemsTable, type ProductProblems } from './read-model.ts';

/** What the Problems query reads, and all it reads. */
export interface ProblemsReader {
  /** The product's problems with the workspace's, or undefined when there is no such product. */
  problemsOf(product: string): ProductProblems | undefined;
}

/** The reader over the read model's table in memory. */
export class InMemoryProblemsReader implements ProblemsReader {
  private readonly table: ProblemsTable;

  constructor(table: ProblemsTable) {
    this.table = table;
  }

  problemsOf(product: string): ProductProblems | undefined {
    return this.table.products.get(product);
  }
}

/** The reader the query runner gives the Problems query: today's, over the projection's table built from the checks' run. */
export const problemsReader = (view: ReadView): ProblemsReader => new InMemoryProblemsReader(problemsTableFrom(view));
