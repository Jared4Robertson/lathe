import { column, type CommandDefinition } from '../../../platform/commands/definition.ts';
import { REMOVE_VIEW_TEST_IDENTITY } from './identities.generated.ts';
import { removeViewTest } from './handlers.generated.ts';

/** The view test to remove. */
export type RemoveViewTest = { id: string };

export const REMOVE_VIEW_TEST = {
  ...REMOVE_VIEW_TEST_IDENTITY,
  input: {
    id: column('view_test', 'id', 'required'),
  },
  handler: removeViewTest,
} satisfies CommandDefinition<RemoveViewTest>;
