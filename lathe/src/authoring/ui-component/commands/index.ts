// Generated from data/ by `npm run generate`. Do not edit.
import type { AnyCommand } from '../../../platform/commands/definition.ts';
import { ADD_UI_COMPONENT } from './add-ui-component.ts';
import { CHANGE_UI_COMPONENT } from './change-ui-component.ts';
import { REMOVE_UI_COMPONENT } from './remove-ui-component.ts';

export const UI_COMPONENT_COMMANDS = [
  ADD_UI_COMPONENT,
  CHANGE_UI_COMPONENT,
  REMOVE_UI_COMPONENT,
] as const satisfies readonly AnyCommand[];
