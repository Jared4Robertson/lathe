// ExtensionRecordRepository (LA-AUT-REPO19): loads and saves one record of a product's own kind whole, with the links
// it starts and the packages it uses, in the aggregate's own tables only: every product kind's table, package_use, and
// the link tables of the relations a product kind may start. Its tables follow the schema the declarations build, so
// they are read from the transaction's schema when the repository is made.
import { AggregateRepository, type InstanceRows } from '../../platform/data/repository.ts';
import type { Transaction } from '../../platform/data/transaction.ts';
import { extensionRecordRows, extensionRecordsFrom, extensionRecordTables, type ExtensionRecord } from './model.ts';

export class ExtensionRecordRepository extends AggregateRepository<ExtensionRecord> {
  constructor(tx: Transaction) {
    super(tx, 'ExtensionRecordRepository', extensionRecordTables(tx.schema));
  }

  protected read(rootId: string): ExtensionRecord | undefined {
    const found = this.tx.record(rootId);
    if (!found || this.tx.schema.kinds[found.kind]?.productId == null) return undefined;
    return extensionRecordsFrom(this.tx.schema, (table) => this.files.rows(table), rootId)[0];
  }

  protected rowsOf(record: ExtensionRecord): InstanceRows {
    return extensionRecordRows(this.tx.schema, record);
  }
}
