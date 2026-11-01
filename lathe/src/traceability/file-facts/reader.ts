// The File facts read model's reader (LA-TRC-RM05-RD): the one way the File facts query reaches the read model's
// storage. The query handler depends only on the FileFactsReader interface; the query runner injects the reader the
// query's definition makes (`reader`), over the data with the checks' run. Today's implementation reads the
// projection's table, kept in memory and built on each read.
import type { ReadView } from '../../platform/data/rules.ts';
import { fileFactsTableFrom, type FileFactsTable, type TracedAddresses } from './read-model.ts';

/** What the File facts query reads, and all it reads. */
export interface FileFactsReader {
  /** The product's traced addresses, or undefined when there is no such product. */
  addressesOf(product: string): TracedAddresses | undefined;
}

/** The reader over the read model's table in memory. */
export class InMemoryFileFactsReader implements FileFactsReader {
  private readonly table: FileFactsTable;

  constructor(table: FileFactsTable) {
    this.table = table;
  }

  addressesOf(product: string): TracedAddresses | undefined {
    return this.table.products.get(product);
  }
}

/** The reader the query runner gives the File facts query: today's, over the projection's table built from the checks' run. */
export const fileFactsReader = (view: ReadView): FileFactsReader => new InMemoryFileFactsReader(fileFactsTableFrom(view));
