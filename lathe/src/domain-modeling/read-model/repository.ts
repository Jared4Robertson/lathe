// Generated from data/ by `npm run generate`. Do not edit.
// ReadModelRepository (LA-MOD-REPO10): Loads a read model whole (its fields, queries with their handlers, its
// projection, and the links they start) from the transaction's draft and saves exactly the rows that changed, in its
// aggregate's own tables only; a write to any other table is refused when it is made (`DataFiles`). A record inside a
// read model is loaded through the read model that holds it (`loadHolding`), and a removal is refused, naming what
// references it, while anything left references it.
import { AggregateRepository as Repository, type InstanceRows } from '../../platform/data/repository.ts';
import type { Transaction } from '../../platform/data/transaction.ts';
import { READ_MODEL_TABLES, readModelRows, readModelsFrom, type ReadModel, type ReadModelKind } from './model.ts';

export class ReadModelRepository extends Repository<ReadModel> {
  constructor(tx: Transaction) {
    super(tx, 'ReadModelRepository', READ_MODEL_TABLES);
  }

  protected read(rootId: string): ReadModel | undefined {
    return readModelsFrom((table) => this.files.rows(table), rootId)[0];
  }

  protected rowsOf(readModel: ReadModel): InstanceRows {
    return readModelRows(readModel);
  }

  /** Loads the read model that holds the record of the kind with this ID, found up its parents; undefined when there is none. */
  loadHolding(kind: ReadModelKind, id: string): ReadModel | undefined {
    const root = this.rootOf(kind, id);
    const readModel = root === undefined ? undefined : this.load(root);
    return readModel && holds(readModel, kind, id) ? readModel : undefined;
  }

  // The root's ID, up the parents of the record of the kind with this ID; undefined when one of them is missing.
  private rootOf(kind: ReadModelKind, id: string): string | undefined {
    const row = this.files.find(kind, { id });
    if (!row) return undefined;
    switch (kind) {
      case 'read_model': return id;
      case 'query': return this.rootOf('read_model', String(row.read_model_id));
      case 'projection': return this.rootOf('read_model', String(row.read_model_id));
      case 'reader': return this.rootOf('read_model', String(row.read_model_id));
      case 'query_handler': return this.rootOf('query', String(row.query_id));
    }
  }
}

/** Whether the read model holds the record of the kind with this ID. */
function holds(readModel: ReadModel, kind: ReadModelKind, id: string): boolean {
  switch (kind) {
    case 'read_model': return readModel.root === id;
    case 'query': return readModel.queries.some((x) => x.row.id === id);
    case 'projection': return readModel.projection?.row.id === id;
    case 'reader': return readModel.reader?.row.id === id;
    case 'query_handler': return readModel.queryHandlers.some((x) => x.row.id === id);
  }
}
