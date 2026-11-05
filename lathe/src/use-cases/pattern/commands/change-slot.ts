import { column, type CommandDefinition } from '../../../platform/commands/definition.ts';
import type { SlotRow } from '../../../platform/data/tables.ts';
import { CHANGE_SLOT_IDENTITY } from './identities.generated.ts';
import { changeSlot } from './handlers.generated.ts';

/** The slot's changes: a column given is set. */
export type ChangeSlot = Pick<SlotRow, 'id'> & { title?: SlotRow['title']; statement?: SlotRow['statement']; fills_vary_by_design?: SlotRow['fills_vary_by_design'] | null };

export const CHANGE_SLOT = {
  ...CHANGE_SLOT_IDENTITY,
  input: {
    id: column('slot', 'id', 'required'),
    title: column('slot', 'title', 'optional'),
    statement: column('slot', 'statement', 'optional'),
    fills_vary_by_design: column('slot', 'fills_vary_by_design', 'clearable'),
  },
  handler: changeSlot,
} satisfies CommandDefinition<ChangeSlot>;
