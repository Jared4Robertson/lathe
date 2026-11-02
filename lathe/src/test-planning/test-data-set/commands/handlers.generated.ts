// Generated from data/ by `npm run generate`. Do not edit.
// The test-data-set commands whose handler is the pattern: load the test data set, add, change or remove one record with the
// input's columns and lists, hold it to its rules, and save. Each definition takes its handler from here.
import { changed } from '../../../platform/data/rows.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import { TestDataSetRepository } from '../repository.ts';
import type { AddTestDataSet } from './add-test-data-set.ts';
import type { ChangeTestDataSet } from './change-test-data-set.ts';
import type { RemoveTestDataSet } from './remove-test-data-set.ts';

/** Adds a test data set to the domain whose tests it serves: where it runs, what it starts with, how to prepare and reset it, and the file that builds it. */
export function addTestDataSet(tx: Transaction, input: AddTestDataSet): void {
  const testDataSets = new TestDataSetRepository(tx);
  if (tx.record(input.domain_id)?.kind !== 'domain') tx.refuse('missing', `there is no domain ${input.domain_id}`);
  const testDataSet = testDataSets.create({ root: input.id, testDataSet: input });
  testDataSets.save(testDataSet);
}

/** Changes a test data set's details. Its domain never changes. */
export function changeTestDataSet(tx: Transaction, input: ChangeTestDataSet): void {
  const testDataSets = new TestDataSetRepository(tx);
  const testDataSet = testDataSets.load(input.id) ?? tx.refuse('missing', `there is no test data set ${input.id}`);
  testDataSet.testDataSet = changed(testDataSet.testDataSet, input, ['title', 'environment', 'accounts', 'records', 'prepare', 'reset', 'file', 'description']);
  testDataSets.save(testDataSet);
}

/** Removes a test data set. Refused while a test starts from it or anything else references it. */
export function removeTestDataSet(tx: Transaction, input: RemoveTestDataSet): void {
  const testDataSets = new TestDataSetRepository(tx);
  const testDataSet = testDataSets.load(input.id) ?? tx.refuse('missing', `there is no test data set ${input.id}`);
  testDataSets.remove(testDataSet);
}
