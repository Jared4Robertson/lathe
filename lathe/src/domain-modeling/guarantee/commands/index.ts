// Generated from data/ by `npm run generate`. Do not edit.
import type { AnyCommand } from '../../../platform/commands/definition.ts';
import { ADD_GUARANTEE } from './add-guarantee.ts';
import { CHANGE_GUARANTEE } from './change-guarantee.ts';
import { REMOVE_GUARANTEE } from './remove-guarantee.ts';
import { ADD_GUARANTEE_TEST } from './add-guarantee-test.ts';
import { CHANGE_GUARANTEE_TEST } from './change-guarantee-test.ts';
import { REMOVE_GUARANTEE_TEST } from './remove-guarantee-test.ts';

export const GUARANTEE_COMMANDS = [
  ADD_GUARANTEE,
  CHANGE_GUARANTEE,
  REMOVE_GUARANTEE,
  ADD_GUARANTEE_TEST,
  CHANGE_GUARANTEE_TEST,
  REMOVE_GUARANTEE_TEST,
] as const satisfies readonly AnyCommand[];
