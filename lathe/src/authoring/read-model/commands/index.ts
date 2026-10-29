// The Read model aggregate's commands, as the CLI, the MCP server and the HTTP API register them.
import type { AnyCommand } from '../../../platform/commands/definition.ts';
import { ADD_READ_MODEL } from './add-read-model.ts';
import { CHANGE_READ_MODEL } from './change-read-model.ts';
import { REMOVE_READ_MODEL } from './remove-read-model.ts';
import { ADD_QUERY } from './add-query.ts';
import { CHANGE_QUERY } from './change-query.ts';
import { REMOVE_QUERY } from './remove-query.ts';
import { ADD_PROJECTION } from './add-projection.ts';
import { CHANGE_PROJECTION } from './change-projection.ts';
import { REMOVE_PROJECTION } from './remove-projection.ts';
import { ADD_QUERY_HANDLER } from './add-query-handler.ts';
import { CHANGE_QUERY_HANDLER } from './change-query-handler.ts';
import { REMOVE_QUERY_HANDLER } from './remove-query-handler.ts';

export const READ_MODEL_COMMANDS: readonly AnyCommand[] = [
  ADD_READ_MODEL,
  CHANGE_READ_MODEL,
  REMOVE_READ_MODEL,
  ADD_QUERY,
  CHANGE_QUERY,
  REMOVE_QUERY,
  ADD_PROJECTION,
  CHANGE_PROJECTION,
  REMOVE_PROJECTION,
  ADD_QUERY_HANDLER,
  CHANGE_QUERY_HANDLER,
  REMOVE_QUERY_HANDLER,
];
