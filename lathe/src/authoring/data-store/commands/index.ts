// Generated from data/ by `npm run generate`. Do not edit.
import type { AnyCommand } from '../../../platform/commands/definition.ts';
import { ADD_DATA_STORE } from './add-data-store.ts';
import { CHANGE_DATA_STORE } from './change-data-store.ts';
import { REMOVE_DATA_STORE } from './remove-data-store.ts';

export const DATA_STORE_COMMANDS = [
  ADD_DATA_STORE,
  CHANGE_DATA_STORE,
  REMOVE_DATA_STORE,
] as const satisfies readonly AnyCommand[];
