// ReadModelRepository (LA-AUT-REPO10): loads and saves the Read model aggregate whole, in its own tables only. A query,
// the projection or a query handler is reached through the read model that holds it.
import { AggregateRepository, type InstanceRows } from '../../platform/data/repository.ts';
import type { Transaction } from '../../platform/data/transaction.ts';
import { kindInside, READ_MODEL_KINDS, READ_MODEL_TABLES, readModelRows, readModelsFrom, type ReadModel, type ReadModelKind } from './model.ts';

export class ReadModelRepository extends AggregateRepository<ReadModel> {
  constructor(tx: Transaction) {
    super(tx, 'ReadModelRepository', READ_MODEL_TABLES);
  }

  protected read(rootId: string): ReadModel | undefined {
    return readModelsFrom((table) => this.files.rows(table), rootId)[0];
  }

  protected rowsOf(readModel: ReadModel): InstanceRows {
    return readModelRows(readModel);
  }

  /**
   * Loads the read model that holds the record of the kind with this ID: the read model itself, or the one its record
   * sits under, found up its parents inside the aggregate. Undefined when there is no such record.
   */
  loadHolding(kind: ReadModelKind, id: string): ReadModel | undefined {
    let at: { kind: ReadModelKind; id: string } = { kind, id };
    for (;;) {
      const row = this.files.find(at.kind, { id: at.id });
      if (!row) return undefined;
      if (at.kind === 'read_model') break;
      const column = READ_MODEL_KINDS[at.kind];
      at = { kind: column === 'query_id' ? 'query' : 'read_model', id: String(row[column]) };
    }
    const readModel = this.load(at.id);
    return readModel && kindInside(readModel, id) === kind ? readModel : undefined;
  }
}
