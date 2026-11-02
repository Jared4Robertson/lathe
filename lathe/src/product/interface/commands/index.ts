// Generated from data/ by `npm run generate`. Do not edit.
import type { AnyCommand } from '../../../platform/commands/definition.ts';
import { ADD_INTERFACE } from './add-interface.ts';
import { CHANGE_INTERFACE } from './change-interface.ts';
import { REMOVE_INTERFACE } from './remove-interface.ts';

export const INTERFACE_COMMANDS = [
  ADD_INTERFACE,
  CHANGE_INTERFACE,
  REMOVE_INTERFACE,
] as const satisfies readonly AnyCommand[];
