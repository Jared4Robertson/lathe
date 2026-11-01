import { column, type CommandDefinition } from '../../../platform/commands/definition.ts';
import { REMOVE_SPECIFICATION_IDENTITY } from './identities.generated.ts';
import { removeSpecification } from './handlers.generated.ts';

/** The specification to remove. */
export type RemoveSpecification = { id: string };

export const REMOVE_SPECIFICATION = {
  ...REMOVE_SPECIFICATION_IDENTITY,
  input: {
    id: column('specification', 'id', 'required'),
  },
  handler: removeSpecification,
} satisfies CommandDefinition<RemoveSpecification>;
