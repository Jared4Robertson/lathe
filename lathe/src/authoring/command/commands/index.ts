// The Command aggregate's commands (LA-AUT-A8), as the CLI, the MCP server and the HTTP API register them.
import type { AnyCommand } from '../../../platform/commands/definition.ts';
import { ADD_COMMAND } from './add-command.ts';
import { CHANGE_COMMAND } from './change-command.ts';
import { REMOVE_COMMAND } from './remove-command.ts';
import { ADD_COMMAND_HANDLER } from './add-command-handler.ts';
import { CHANGE_COMMAND_HANDLER } from './change-command-handler.ts';
import { REMOVE_COMMAND_HANDLER } from './remove-command-handler.ts';
import { ADD_POLICY } from './add-policy.ts';
import { CHANGE_POLICY } from './change-policy.ts';
import { REMOVE_POLICY } from './remove-policy.ts';
import { ADD_EVENT_HANDLER } from './add-event-handler.ts';
import { CHANGE_EVENT_HANDLER } from './change-event-handler.ts';
import { REMOVE_EVENT_HANDLER } from './remove-event-handler.ts';
import { ADD_POLICY_TEST } from './add-policy-test.ts';
import { CHANGE_POLICY_TEST } from './change-policy-test.ts';
import { REMOVE_POLICY_TEST } from './remove-policy-test.ts';

export const COMMAND_COMMANDS: readonly AnyCommand[] = [
  ADD_COMMAND,
  CHANGE_COMMAND,
  REMOVE_COMMAND,
  ADD_COMMAND_HANDLER,
  CHANGE_COMMAND_HANDLER,
  REMOVE_COMMAND_HANDLER,
  ADD_POLICY,
  CHANGE_POLICY,
  REMOVE_POLICY,
  ADD_EVENT_HANDLER,
  CHANGE_EVENT_HANDLER,
  REMOVE_EVENT_HANDLER,
  ADD_POLICY_TEST,
  CHANGE_POLICY_TEST,
  REMOVE_POLICY_TEST,
];
