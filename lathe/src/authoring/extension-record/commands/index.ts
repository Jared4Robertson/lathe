// Generated from data/ by `npm run generate`. Do not edit.
import type { AnyCommand } from '../../../platform/commands/definition.ts';
import { ADD_EXTENSION_RECORD } from './add-extension-record.ts';
import { CHANGE_EXTENSION_RECORD } from './change-extension-record.ts';
import { REMOVE_EXTENSION_RECORD } from './remove-extension-record.ts';

export const EXTENSION_RECORD_COMMANDS = [
  ADD_EXTENSION_RECORD,
  CHANGE_EXTENSION_RECORD,
  REMOVE_EXTENSION_RECORD,
] as const satisfies readonly AnyCommand[];
