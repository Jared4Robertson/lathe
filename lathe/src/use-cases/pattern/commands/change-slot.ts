import { column, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { SlotRow } from '../../../platform/data/tables.ts';
import { CHANGE_SLOT_IDENTITY } from './identities.generated.ts';
import { changeSlot } from './handlers.generated.ts';

/** The slot's changes: a column given is set. */
export type ChangeSlot = Pick<SlotRow, 'id'> & { title?: SlotRow['title']; statement?: SlotRow['statement'] };

export const CHANGE_SLOT = {
  ...CHANGE_SLOT_IDENTITY,
  input: {
    id: column('slot', 'id', 'required'),
    title: column('slot', 'title', 'optional'),
    statement: column('slot', 'statement', 'optional'),
  },
  handler: changeSlot,
} satisfies CommandDefinition<ChangeSlot>;
