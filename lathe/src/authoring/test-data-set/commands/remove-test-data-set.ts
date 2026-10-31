import { column, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import { TEST_DATA_SET_SLICE } from '../model.ts';
import { TestDataSetRepository } from '../repository.ts';

/** The test data set to remove. */
export type RemoveTestDataSet = { id: string };

export const REMOVE_TEST_DATA_SET: CommandDefinition<RemoveTestDataSet> = {
  id: 'LA-AUT-CMD187',
  slice: TEST_DATA_SET_SLICE,
  name: 'remove-test-data-set',
  description: 'Removes a test data set. Refused while a test starts from it or anything else references it.',
  method: 'POST',
  route: '/api/test-data-set/remove-test-data-set',
  input: {
    id: column('test_data_set', 'id', 'required'),
  },
  handler: removeTestDataSet,
};

/** Removes the test data set whole. */
export function removeTestDataSet(tx: Transaction, input: RemoveTestDataSet): void {
  const testDataSets = new TestDataSetRepository(tx);
  const testDataSet = testDataSets.load(input.id) ?? tx.refuse('missing', `there is no test data set ${input.id}`);
  testDataSets.remove(testDataSet);
}
