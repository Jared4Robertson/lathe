import { column, type CommandDefinition } from '../../../platform/commands/definition.ts';
import { REMOVE_ENTITY_IDENTITY } from './identities.generated.ts';
import { removeEntity } from './handlers.generated.ts';

/** The entity to remove. */
export type RemoveEntity = { id: string };

export const REMOVE_ENTITY = {
  ...REMOVE_ENTITY_IDENTITY,
  input: {
    id: column('entity', 'id', 'required'),
  },
  handler: removeEntity,
} satisfies CommandDefinition<RemoveEntity>;
