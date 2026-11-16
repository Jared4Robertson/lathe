// Generated from data/ by `npm run generate`. Do not edit.
import type { AnyCommand } from '../../../platform/commands/definition.ts';
import { ADD_LIBRARY } from './add-library.ts';
import { CHANGE_LIBRARY } from './change-library.ts';
import { REMOVE_LIBRARY } from './remove-library.ts';

export const LIBRARY_COMMANDS = [
  ADD_LIBRARY,
  CHANGE_LIBRARY,
  REMOVE_LIBRARY,
] as const satisfies readonly AnyCommand[];
