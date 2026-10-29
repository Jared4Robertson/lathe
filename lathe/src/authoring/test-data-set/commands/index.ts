// The Test data set aggregate's commands, as the CLI, the MCP server and the HTTP API register them.
import type { AnyCommand } from '../../../platform/commands/definition.ts';
import { ADD_TEST_DATA_SET } from './add-test-data-set.ts';
import { CHANGE_TEST_DATA_SET } from './change-test-data-set.ts';
import { REMOVE_TEST_DATA_SET } from './remove-test-data-set.ts';

export const TEST_DATA_SET_COMMANDS: readonly AnyCommand[] = [
  ADD_TEST_DATA_SET,
  CHANGE_TEST_DATA_SET,
  REMOVE_TEST_DATA_SET,
];
