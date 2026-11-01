import { column, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { SlotRow } from '../../../platform/data/tables.ts';
import { ADD_SLOT_IDENTITY } from './identities.generated.ts';
import { addSlot } from './handlers.generated.ts';

/** A new slot. */
export type AddSlot = Pick<SlotRow, 'id' | 'title' | 'pattern_id' | 'statement'>;

export const ADD_SLOT = {
  ...ADD_SLOT_IDENTITY,
  input: {
    id: column('slot', 'id', 'required'),
    title: column('slot', 'title', 'required'),
    pattern_id: column('slot', 'pattern_id', 'required'),
    statement: column('slot', 'statement', 'required'),
  },
  handler: addSlot,
} satisfies CommandDefinition<AddSlot>;
