// The Table aggregate's commands, as the CLI, the MCP server and the HTTP API register them.
import type { AnyCommand } from '../../../platform/commands/definition.ts';
import { ADD_TABLE } from './add-table.ts';
import { CHANGE_TABLE } from './change-table.ts';
import { MOVE_TABLE } from './move-table.ts';
import { REMOVE_TABLE } from './remove-table.ts';

export const TABLE_COMMANDS: readonly AnyCommand[] = [ADD_TABLE, CHANGE_TABLE, MOVE_TABLE, REMOVE_TABLE];
