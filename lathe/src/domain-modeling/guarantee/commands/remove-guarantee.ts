import { column, type CommandDefinition } from '../../../platform/commands/definition.ts';
import { REMOVE_GUARANTEE_IDENTITY } from './identities.generated.ts';
import { removeGuarantee } from './handlers.generated.ts';

/** The guarantee to remove. */
export type RemoveGuarantee = { id: string };

export const REMOVE_GUARANTEE = {
  ...REMOVE_GUARANTEE_IDENTITY,
  input: {
    id: column('guarantee', 'id', 'required'),
  },
  handler: removeGuarantee,
} satisfies CommandDefinition<RemoveGuarantee>;
