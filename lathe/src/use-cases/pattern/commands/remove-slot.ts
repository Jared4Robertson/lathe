import { column, type CommandDefinition } from '../../../platform/commands/definition.ts';
import { REMOVE_SLOT_IDENTITY } from './identities.generated.ts';
import { removeSlot } from './handlers.generated.ts';

/** The slot to remove. */
export type RemoveSlot = { id: string };

export const REMOVE_SLOT = {
  ...REMOVE_SLOT_IDENTITY,
  input: {
    id: column('slot', 'id', 'required'),
  },
  handler: removeSlot,
} satisfies CommandDefinition<RemoveSlot>;
