// Generated from data/ by `npm run generate`. Do not edit.
import type { AnyCommand } from '../../../platform/commands/definition.ts';
import { ADD_TOOLING } from './add-tooling.ts';
import { CHANGE_TOOLING } from './change-tooling.ts';
import { REMOVE_TOOLING } from './remove-tooling.ts';

export const TOOLING_COMMANDS = [
  ADD_TOOLING,
  CHANGE_TOOLING,
  REMOVE_TOOLING,
] as const satisfies readonly AnyCommand[];
