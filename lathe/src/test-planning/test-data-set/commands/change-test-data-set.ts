import { column, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { TestDataSetRow } from '../../../platform/data/tables.ts';
import { CHANGE_TEST_DATA_SET_IDENTITY } from './identities.generated.ts';
import { changeTestDataSet } from './handlers.generated.ts';

/** The test data set's changes: a column given is set, null clears an optional one. */
export type ChangeTestDataSet = Pick<TestDataSetRow, 'id'> & { title?: TestDataSetRow['title']; environment?: TestDataSetRow['environment']; accounts?: TestDataSetRow['accounts'] | null; records?: TestDataSetRow['records']; prepare?: TestDataSetRow['prepare']; reset?: TestDataSetRow['reset']; file?: TestDataSetRow['file'] | null; description?: TestDataSetRow['description'] };

export const CHANGE_TEST_DATA_SET = {
  ...CHANGE_TEST_DATA_SET_IDENTITY,
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
} satisfies CommandDefinition<ChangeTestDataSet>;
