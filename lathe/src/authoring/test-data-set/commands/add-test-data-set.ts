import { column, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import type { TestDataSetRow } from '../../../platform/data/tables.ts';
import { newTestDataSet } from '../model.ts';
import { TestDataSetRepository } from '../repository.ts';
import { ADD_TEST_DATA_SET_IDENTITY } from './identities.generated.ts';

/** A new test data set: its row. */
export type AddTestDataSet = Pick<TestDataSetRow, 'id' | 'title' | 'domain_id' | 'environment' | 'accounts' | 'records' | 'prepare' | 'reset' | 'file' | 'description'>;

export const ADD_TEST_DATA_SET = {
  ...ADD_TEST_DATA_SET_IDENTITY,
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
} satisfies CommandDefinition<AddTestDataSet>;

/** Adds the test data set, whole and new. */
export function addTestDataSet(tx: Transaction, input: AddTestDataSet): void {
  const testDataSets = new TestDataSetRepository(tx);
  const testDataSet = testDataSets.create(newTestDataSet(input));
  testDataSets.save(testDataSet);
}
