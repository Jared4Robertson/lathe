// The Entry point aggregate's commands (LA-AUT-A20), as the CLI, the MCP server and the HTTP API register them.
import type { AnyCommand } from '../../../platform/commands/definition.ts';
import { ADD_ENTRY_POINT } from './add-entry-point.ts';
import { CHANGE_ENTRY_POINT } from './change-entry-point.ts';
import { REMOVE_ENTRY_POINT } from './remove-entry-point.ts';

export const ENTRY_POINT_COMMANDS: readonly AnyCommand[] = [ADD_ENTRY_POINT, CHANGE_ENTRY_POINT, REMOVE_ENTRY_POINT];
