import { column, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import { TestDataSetRepository } from '../repository.ts';
import { REMOVE_TEST_DATA_SET_IDENTITY } from './identities.generated.ts';

/** The test data set to remove. */
export type RemoveTestDataSet = { id: string };

export const REMOVE_TEST_DATA_SET = {
  ...REMOVE_TEST_DATA_SET_IDENTITY,
  input: {
    id: column('test_data_set', 'id', 'required'),
  },
  handler: removeTestDataSet,
} satisfies CommandDefinition<RemoveTestDataSet>;

/** Removes the test data set whole. */
export function removeTestDataSet(tx: Transaction, input: RemoveTestDataSet): void {
  const testDataSets = new TestDataSetRepository(tx);
  const testDataSet = testDataSets.load(input.id) ?? tx.refuse('missing', `there is no test data set ${input.id}`);
  testDataSets.remove(testDataSet);
}
