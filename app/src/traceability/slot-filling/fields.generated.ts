// Generated from data/ by `npm run generate`. Do not edit.
// The slot-filling commands' inputs, by route, from their definitions: what the editors' forms are drawn from.
import type { InputFields } from '../../edit/command-form';

export const SLOT_FILLING_FIELDS = {
  '/api/slot-filling/fill-slot': {
    record_id: { kind: 'id', description: 'The technical record, written by hand, that fills the slot.', required: true, clearable: false },
    slot_id: { kind: 'id', description: 'The slot it fills.', required: true, clearable: false },
  },
  '/api/slot-filling/stop-filling-slot': {
    record_id: { kind: 'id', description: 'The technical record that fills the slot.', required: true, clearable: false },
    slot_id: { kind: 'id', description: 'The slot it stops filling.', required: true, clearable: false },
  },
} as const satisfies Record<string, InputFields>;
