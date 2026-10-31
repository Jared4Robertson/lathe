import { column, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import type { TestDataSetRow } from '../../../platform/data/tables.ts';
import { TEST_DATA_SET_SLICE, newTestDataSet } from '../model.ts';
import { TestDataSetRepository } from '../repository.ts';

/** A new test data set: its row. */
export type AddTestDataSet = Pick<TestDataSetRow, 'id' | 'title' | 'domain_id' | 'environment' | 'accounts' | 'records' | 'prepare' | 'reset' | 'file' | 'description'>;

export const ADD_TEST_DATA_SET: CommandDefinition<AddTestDataSet> = {
  id: 'LA-AUT-CMD185',
  slice: TEST_DATA_SET_SLICE,
  name: 'add-test-data-set',
  description: 'Adds a test data set to the domain whose tests it serves: where it runs, what it starts with, how to prepare and reset it, and the file that builds it.',
  method: 'POST',
  route: '/api/test-data-set/add-test-data-set',
  input: {
    id: column('test_data_set', 'id', 'required'),
    title: column('test_data_set', 'title', 'required'),
    domain_id: column('test_data_set', 'domain_id', 'required'),
    environment: column('test_data_set', 'environment', 'required'),
    accounts: column('test_data_set', 'accounts', 'optional'),
    records: column('test_data_set', 'records', 'required'),
    prepare: column('test_data_set', 'prepare', 'required'),
    reset: column('test_data_set', 'reset', 'required'),
    file: column('test_data_set', 'file', 'optional'),
    description: column('test_data_set', 'description', 'required'),
  },
  handler: addTestDataSet,
};

/** Adds the test data set, whole and new. */
export function addTestDataSet(tx: Transaction, input: AddTestDataSet): void {
  const testDataSets = new TestDataSetRepository(tx);
  const testDataSet = testDataSets.create(newTestDataSet(input));
  testDataSets.save(testDataSet);
}
