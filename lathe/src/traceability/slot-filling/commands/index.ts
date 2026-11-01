// Generated from data/ by `npm run generate`. Do not edit.
import type { AnyCommand } from '../../../platform/commands/definition.ts';
import { FILL_SLOT } from './fill-slot.ts';
import { STOP_FILLING_SLOT } from './stop-filling-slot.ts';

export const SLOT_FILLING_COMMANDS = [
  FILL_SLOT,
  STOP_FILLING_SLOT,
] as const satisfies readonly AnyCommand[];
