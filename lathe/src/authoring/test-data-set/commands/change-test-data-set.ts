// Change a test data set (LA-AUT-CMD186): Changes a test data set's columns. Its domain never changes.
import { column, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import type { TestDataSetRow } from '../../../platform/data/tables.ts';
import { TEST_DATA_SET_SLICE, changed } from '../model.ts';
import { TestDataSetRepository } from '../repository.ts';

/** The test data set's changes: a column given is set, null clears an optional one. */
export type ChangeTestDataSet = Pick<TestDataSetRow, 'id'> & { title?: TestDataSetRow['title']; environment?: TestDataSetRow['environment']; accounts?: TestDataSetRow['accounts'] | null; records?: TestDataSetRow['records']; prepare?: TestDataSetRow['prepare']; reset?: TestDataSetRow['reset']; file?: TestDataSetRow['file'] | null; description?: TestDataSetRow['description'] };

/** Change a test data set (LA-AUT-CMD186). */
export const CHANGE_TEST_DATA_SET: CommandDefinition<ChangeTestDataSet> = {
  id: 'LA-AUT-CMD186',
  slice: TEST_DATA_SET_SLICE,
  name: 'change-test-data-set',
  description: "Changes a test data set's columns. Its domain never changes.",
  method: 'POST',
  route: '/api/test-data-set/change-test-data-set',
  input: {
    id: column('test_data_set', 'id', 'required'),
    title: column('test_data_set', 'title', 'optional'),
    environment: column('test_data_set', 'environment', 'optional'),
    accounts: column('test_data_set', 'accounts', 'clearable'),
    records: column('test_data_set', 'records', 'optional'),
    prepare: column('test_data_set', 'prepare', 'optional'),
    reset: column('test_data_set', 'reset', 'optional'),
    file: column('test_data_set', 'file', 'clearable'),
    description: column('test_data_set', 'description', 'optional'),
  },
  handler: changeTestDataSet,
};

/** Changes the test data set's columns. */
export function changeTestDataSet(tx: Transaction, input: ChangeTestDataSet): void {
  const testDataSets = new TestDataSetRepository(tx);
  const testDataSet = testDataSets.load(input.id) ?? tx.refuse('missing', `there is no test data set ${input.id}`);
  testDataSet.testDataSet = changed(testDataSet.testDataSet, input, ['title', 'environment', 'accounts', 'records', 'prepare', 'reset', 'file', 'description']);
  testDataSets.save(testDataSet);
}
