import { column, type CommandDefinition } from '../../../platform/commands/definition.ts';
import { REMOVE_SPECIFICATION_TEST_IDENTITY } from './identities.generated.ts';
import { removeSpecificationTest } from './handlers.generated.ts';

/** The specification test to remove. */
export type RemoveSpecificationTest = { id: string };

export const REMOVE_SPECIFICATION_TEST = {
  ...REMOVE_SPECIFICATION_TEST_IDENTITY,
  input: {
    id: column('specification_test', 'id', 'required'),
  },
  handler: removeSpecificationTest,
} satisfies CommandDefinition<RemoveSpecificationTest>;
