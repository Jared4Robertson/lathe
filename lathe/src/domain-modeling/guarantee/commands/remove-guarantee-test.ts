import { column, type CommandDefinition } from '../../../platform/commands/definition.ts';
import { REMOVE_GUARANTEE_TEST_IDENTITY } from './identities.generated.ts';
import { removeGuaranteeTest } from './handlers.generated.ts';

/** The test to remove. */
export type RemoveGuaranteeTest = { id: string };

export const REMOVE_GUARANTEE_TEST = {
  ...REMOVE_GUARANTEE_TEST_IDENTITY,
  input: {
    id: column('guarantee_test', 'id', 'required'),
  },
  handler: removeGuaranteeTest,
} satisfies CommandDefinition<RemoveGuaranteeTest>;
