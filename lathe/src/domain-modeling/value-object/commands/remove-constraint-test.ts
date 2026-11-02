import { column, type CommandDefinition } from '../../../platform/commands/definition.ts';
import { REMOVE_CONSTRAINT_TEST_IDENTITY } from './identities.generated.ts';
import { removeConstraintTest } from './handlers.generated.ts';

/** The constraint test to remove. */
export type RemoveConstraintTest = { id: string };

export const REMOVE_CONSTRAINT_TEST = {
  ...REMOVE_CONSTRAINT_TEST_IDENTITY,
  input: {
    id: column('constraint_test', 'id', 'required'),
  },
  handler: removeConstraintTest,
} satisfies CommandDefinition<RemoveConstraintTest>;
