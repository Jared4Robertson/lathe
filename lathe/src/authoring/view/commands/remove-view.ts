import { column, type CommandDefinition } from '../../../platform/commands/definition.ts';
import { REMOVE_VIEW_IDENTITY } from './identities.generated.ts';
import { removeView } from './handlers.generated.ts';

/** The view to remove. */
export type RemoveView = { id: string };

export const REMOVE_VIEW = {
  ...REMOVE_VIEW_IDENTITY,
  input: {
    id: column('view', 'id', 'required'),
  },
  handler: removeView,
} satisfies CommandDefinition<RemoveView>;
