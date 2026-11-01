import { column, type CommandDefinition } from '../../../platform/commands/definition.ts';
import { REMOVE_STORAGE_REQUIREMENT_IDENTITY } from './identities.generated.ts';
import { removeStorageRequirement } from './handlers.generated.ts';

/** The storage requirement to remove. */
export type RemoveStorageRequirement = { id: string };

export const REMOVE_STORAGE_REQUIREMENT = {
  ...REMOVE_STORAGE_REQUIREMENT_IDENTITY,
  input: {
    id: column('storage_requirement', 'id', 'required'),
  },
  handler: removeStorageRequirement,
} satisfies CommandDefinition<RemoveStorageRequirement>;
