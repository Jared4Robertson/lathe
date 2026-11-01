import { column, type CommandDefinition } from '../../../platform/commands/definition.ts';
import { REMOVE_STORAGE_REQUIREMENT_TEST_IDENTITY } from './identities.generated.ts';
import { removeStorageRequirementTest } from './handlers.generated.ts';

/** The storage requirement test to remove. */
export type RemoveStorageRequirementTest = { id: string };

export const REMOVE_STORAGE_REQUIREMENT_TEST = {
  ...REMOVE_STORAGE_REQUIREMENT_TEST_IDENTITY,
  input: {
    id: column('storage_requirement_test', 'id', 'required'),
  },
  handler: removeStorageRequirementTest,
} satisfies CommandDefinition<RemoveStorageRequirementTest>;
