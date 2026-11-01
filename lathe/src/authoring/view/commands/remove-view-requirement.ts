import { column, type CommandDefinition } from '../../../platform/commands/definition.ts';
import { REMOVE_VIEW_REQUIREMENT_IDENTITY } from './identities.generated.ts';
import { removeViewRequirement } from './handlers.generated.ts';

/** The view requirement to remove. */
export type RemoveViewRequirement = { id: string };

export const REMOVE_VIEW_REQUIREMENT = {
  ...REMOVE_VIEW_REQUIREMENT_IDENTITY,
  input: {
    id: column('view_requirement', 'id', 'required'),
  },
  handler: removeViewRequirement,
} satisfies CommandDefinition<RemoveViewRequirement>;
