import { column, type CommandDefinition } from '../../../platform/commands/definition.ts';
import { REMOVE_TEST_DATA_SET_IDENTITY } from './identities.generated.ts';
import { removeTestDataSet } from './handlers.generated.ts';

/** The test data set to remove. */
export type RemoveTestDataSet = { id: string };

export const REMOVE_TEST_DATA_SET = {
  ...REMOVE_TEST_DATA_SET_IDENTITY,
  input: {
    id: column('test_data_set', 'id', 'required'),
  },
  handler: removeTestDataSet,
} satisfies CommandDefinition<RemoveTestDataSet>;
