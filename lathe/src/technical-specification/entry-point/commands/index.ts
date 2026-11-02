// Generated from data/ by `npm run generate`. Do not edit.
import type { AnyCommand } from '../../../platform/commands/definition.ts';
import { ADD_ENTRY_POINT } from './add-entry-point.ts';
import { CHANGE_ENTRY_POINT } from './change-entry-point.ts';
import { REMOVE_ENTRY_POINT } from './remove-entry-point.ts';
import { MOVE_ENTRY_POINT } from './move-entry-point.ts';

export const ENTRY_POINT_COMMANDS = [
  ADD_ENTRY_POINT,
  CHANGE_ENTRY_POINT,
  REMOVE_ENTRY_POINT,
  MOVE_ENTRY_POINT,
] as const satisfies readonly AnyCommand[];
