// The Data store aggregate's commands (LA-AUT-A23), as the CLI, the MCP server and the HTTP API register them.
import type { AnyCommand } from '../../../platform/commands/definition.ts';
import { ADD_DATA_STORE } from './add-data-store.ts';
import { CHANGE_DATA_STORE } from './change-data-store.ts';
import { REMOVE_DATA_STORE } from './remove-data-store.ts';

export const DATA_STORE_COMMANDS: readonly AnyCommand[] = [ADD_DATA_STORE, CHANGE_DATA_STORE, REMOVE_DATA_STORE];
