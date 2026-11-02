import { column, type CommandDefinition } from '../../../platform/commands/definition.ts';
import { REMOVE_DATA_MODEL_IDENTITY } from './identities.generated.ts';
import { removeDataModel } from './handlers.generated.ts';

/** The data model to remove. */
export type RemoveDataModel = { id: string };

export const REMOVE_DATA_MODEL = {
  ...REMOVE_DATA_MODEL_IDENTITY,
  input: {
    id: column('data_model', 'id', 'required'),
  },
  handler: removeDataModel,
} satisfies CommandDefinition<RemoveDataModel>;
