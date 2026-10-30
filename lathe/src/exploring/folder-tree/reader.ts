// The Folder tree read model's reader (LA-EXP-RM02-RD): the one way the Folder tree query reaches the read model's
// storage. The query handler depends only on the FolderTreeReader interface; the query runner injects the reader the
// query's definition makes (`reader`). Today's implementation reads the projection's table, kept in memory and built
// on each read.
import type { ReadView } from '../../platform/data/rules.ts';
import { folderTreeTableFrom, type FolderTree, type FolderTreeTable } from './read-model.ts';

/** What the Folder tree query reads, and all it reads. */
export interface FolderTreeReader {
  /** The product's tree, or undefined when there is no such product. */
  treeOf(product: string): FolderTree | undefined;
}

/** The reader over the read model's table in memory. */
export class InMemoryFolderTreeReader implements FolderTreeReader {
  private readonly table: FolderTreeTable;

  constructor(table: FolderTreeTable) {
    this.table = table;
  }

  treeOf(product: string): FolderTree | undefined {
    return this.table.products.get(product);
  }
}

/** The reader the query runner gives the Folder tree query: today's, over the projection's table built from the rows. */
export const folderTreeReader = (view: ReadView): FolderTreeReader => new InMemoryFolderTreeReader(folderTreeTableFrom(view));
