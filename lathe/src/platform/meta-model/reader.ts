// The Meta model read model's reader (LA-PLT-RM08-RD): the one way the Meta model query reaches the read model's
// storage. The query handler depends only on the MetaModelReader interface; the query runner injects the reader the
// query's definition makes (`reader`). Today's implementation reads the projection's table, kept in memory and built
// on each read.
import type { ReadView } from '../data/rules.ts';
import { metaModelTableFrom, type MetaModel, type MetaModelTable } from './read-model.ts';

/** What the Meta model query reads, and all it reads. */
export interface MetaModelReader {
  model(): MetaModel;
}

/** The reader over the read model's table in memory. */
export class InMemoryMetaModelReader implements MetaModelReader {
  private readonly table: MetaModelTable;

  constructor(table: MetaModelTable) {
    this.table = table;
  }

  model(): MetaModel {
    return this.table.model;
  }
}

/** The reader the query runner gives the Meta model query: today's, over the projection's table built from the schema. */
export const metaModelReader = (view: ReadView): MetaModelReader => new InMemoryMetaModelReader(metaModelTableFrom(view));
