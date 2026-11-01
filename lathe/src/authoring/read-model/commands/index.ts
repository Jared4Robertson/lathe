// Generated from data/ by `npm run generate`. Do not edit.
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
import { ADD_READER } from './add-reader.ts';
import { CHANGE_READER } from './change-reader.ts';
import { REMOVE_READER } from './remove-reader.ts';

export const READ_MODEL_COMMANDS = [
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
  ADD_READER,
  CHANGE_READER,
  REMOVE_READER,
] as const satisfies readonly AnyCommand[];
