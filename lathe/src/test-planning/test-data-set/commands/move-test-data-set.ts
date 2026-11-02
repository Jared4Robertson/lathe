import { column, type CommandDefinition } from '../../../platform/commands/definition.ts';
import { toDomain } from '../../../platform/data/renames.ts';
import type { Transaction } from '../../../platform/data/transaction.ts';
import type { TestDataSetRow } from '../../../platform/data/tables.ts';
import { TestDataSetRepository } from '../repository.ts';
import { MOVE_TEST_DATA_SET_IDENTITY } from './identities.generated.ts';

/** The test data set and the domain it moves to. */
export type MoveTestDataSet = Pick<TestDataSetRow, 'id' | 'domain_id'>;

export const MOVE_TEST_DATA_SET = {
  ...MOVE_TEST_DATA_SET_IDENTITY,
  input: {
    id: column('test_data_set', 'id', 'required'),
    domain_id: column('test_data_set', 'domain_id', 'required'),
  },
  handler: moveTestDataSet,
} satisfies CommandDefinition<MoveTestDataSet>;

export function moveTestDataSet(tx: Transaction, input: MoveTestDataSet): void {
  const sets = new TestDataSetRepository(tx);
  const set = sets.load(input.id) ?? tx.refuse('missing', `there is no test data set ${input.id}`);
  const renames = toDomain(tx, { id: input.id, label: 'test data set', domainId: set.testDataSet.domain_id }, input.domain_id);
  set.testDataSet = { ...set.testDataSet, domain_id: input.domain_id };
  sets.save(set);
  sets.carryRenames(renames);
}
