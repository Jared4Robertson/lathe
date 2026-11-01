// Generated from data/ by `npm run generate`. Do not edit.
import type { AnyCommand } from '../../../platform/commands/definition.ts';
import { ADD_TEST_DATA_SET } from './add-test-data-set.ts';
import { CHANGE_TEST_DATA_SET } from './change-test-data-set.ts';
import { REMOVE_TEST_DATA_SET } from './remove-test-data-set.ts';

export const TEST_DATA_SET_COMMANDS = [
  ADD_TEST_DATA_SET,
  CHANGE_TEST_DATA_SET,
  REMOVE_TEST_DATA_SET,
] as const satisfies readonly AnyCommand[];
