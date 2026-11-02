// Generated from data/ by `npm run generate`. Do not edit.
// TestDataSetRepository (LA-TST-REPO17): Loads a test data set whole from the transaction's draft and saves exactly the
// rows that changed, in the Test data set aggregate's own table only; a write to any other table is refused when it is
// made (`DataFiles`), and a removal is refused, naming the referrers, while a test starts from it.
import { AggregateRepository as Repository, type InstanceRows } from '../../platform/data/repository.ts';
import type { Transaction } from '../../platform/data/transaction.ts';
import { TEST_DATA_SET_TABLES, testDataSetRows, testDataSetsFrom, type TestDataSet } from './model.ts';

export class TestDataSetRepository extends Repository<TestDataSet> {
  constructor(tx: Transaction) {
    super(tx, 'TestDataSetRepository', TEST_DATA_SET_TABLES);
  }

  protected read(rootId: string): TestDataSet | undefined {
    return testDataSetsFrom((table) => this.files.rows(table), rootId)[0];
  }

  protected rowsOf(testDataSet: TestDataSet): InstanceRows {
    return testDataSetRows(testDataSet);
  }
}
