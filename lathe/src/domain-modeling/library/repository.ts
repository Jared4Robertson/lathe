// Generated from data/ by `npm run generate`. Do not edit.
// LibraryRepository (LA-MOD-REPO30): Loads a library whole (its row and the business outcomes it serves) from the
// transaction's draft and saves exactly the rows that changed, in its aggregate's own tables only, and only its own
// record's rows of the shared serves table; a removal is refused, naming what references it, while anything left
// references it, such as a guarantee it makes.
import { AggregateRepository as Repository, type InstanceRows } from '../../platform/data/repository.ts';
import type { Transaction } from '../../platform/data/transaction.ts';
import { librariesFrom, LIBRARY_TABLES, libraryRows, type Library } from './model.ts';

export class LibraryRepository extends Repository<Library> {
  constructor(tx: Transaction) {
    super(tx, 'LibraryRepository', LIBRARY_TABLES);
  }

  protected read(rootId: string): Library | undefined {
    return librariesFrom((table) => this.files.rows(table), rootId)[0];
  }

  protected rowsOf(library: Library): InstanceRows {
    return libraryRows(library);
  }
}
