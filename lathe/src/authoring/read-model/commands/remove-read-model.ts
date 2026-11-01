import { column, type CommandDefinition } from '../../../platform/commands/definition.ts';
import { REMOVE_READ_MODEL_IDENTITY } from './identities.generated.ts';
import { removeReadModel } from './handlers.generated.ts';

/** The read model to remove. */
export type RemoveReadModel = { id: string };

export const REMOVE_READ_MODEL = {
  ...REMOVE_READ_MODEL_IDENTITY,
  input: {
    id: column('read_model', 'id', 'required'),
  },
  handler: removeReadModel,
} satisfies CommandDefinition<RemoveReadModel>;
