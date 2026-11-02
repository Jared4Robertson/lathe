import { column, type CommandDefinition } from '../../../platform/commands/definition.ts';
import { REMOVE_API_REQUIREMENT_IDENTITY } from './identities.generated.ts';
import { removeApiRequirement } from './handlers.generated.ts';

/** The API requirement to remove. */
export type RemoveApiRequirement = { id: string };

export const REMOVE_API_REQUIREMENT = {
  ...REMOVE_API_REQUIREMENT_IDENTITY,
  input: {
    id: column('api_requirement', 'id', 'required'),
  },
  handler: removeApiRequirement,
} satisfies CommandDefinition<RemoveApiRequirement>;
