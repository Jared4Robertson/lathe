// TestDataSetRepository (LA-AUT-REPO17): loads and saves the Test data set aggregate whole, in its own table only.
import { AggregateRepository, type InstanceRows } from '../../platform/data/repository.ts';
import type { Transaction } from '../../platform/data/transaction.ts';
import { TEST_DATA_SET_TABLES, testDataSetRows, testDataSetsFrom, type TestDataSet } from './model.ts';

export class TestDataSetRepository extends AggregateRepository<TestDataSet> {
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
