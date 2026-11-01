import { column, type CommandDefinition } from '../../../platform/commands/definition.ts';
import { REMOVE_UC_REQUIREMENT_IDENTITY } from './identities.generated.ts';
import { removeUcRequirement } from './handlers.generated.ts';

/** The requirement to remove. */
export type RemoveUcRequirement = { id: string };

export const REMOVE_UC_REQUIREMENT = {
  ...REMOVE_UC_REQUIREMENT_IDENTITY,
  input: {
    id: column('uc_requirement', 'id', 'required'),
  },
  handler: removeUcRequirement,
} satisfies CommandDefinition<RemoveUcRequirement>;
