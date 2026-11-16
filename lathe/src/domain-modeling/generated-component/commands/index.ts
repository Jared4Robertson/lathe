// Generated from data/ by `npm run generate`. Do not edit.
import type { AnyCommand } from '../../../platform/commands/definition.ts';
import { ADD_GENERATED_COMPONENT } from './add-generated-component.ts';
import { CHANGE_GENERATED_COMPONENT } from './change-generated-component.ts';
import { REMOVE_GENERATED_COMPONENT } from './remove-generated-component.ts';

export const GENERATED_COMPONENT_COMMANDS = [
  ADD_GENERATED_COMPONENT,
  CHANGE_GENERATED_COMPONENT,
  REMOVE_GENERATED_COMPONENT,
] as const satisfies readonly AnyCommand[];
