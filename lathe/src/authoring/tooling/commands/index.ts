// The Tooling aggregate's commands (LA-AUT-A21), as the CLI, the MCP server and the HTTP API register them.
import type { AnyCommand } from '../../../platform/commands/definition.ts';
import { ADD_TOOLING } from './add-tooling.ts';
import { CHANGE_TOOLING } from './change-tooling.ts';
import { REMOVE_TOOLING } from './remove-tooling.ts';

export const TOOLING_COMMANDS: readonly AnyCommand[] = [ADD_TOOLING, CHANGE_TOOLING, REMOVE_TOOLING];
